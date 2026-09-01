import fs from 'node:fs';
import path from 'node:path';
import { spawn, ChildProcess } from 'node:child_process';
import { MannostreeConfig } from '../config/schema.js';
import { MetadataStore } from '../metadata/store.js';
import {
  AgentDispatchOptions,
  AgentCancelOptions,
  AgentSessionRecord,
  AgentSessionState,
  ExitCode,
  MannostreeError,
} from '../types/index.js';
import {
  generateTaskContractMarkdown,
  parseTaskContractMarkdown,
} from './contract.js';

export class AgentRunner {
  private activeProcesses: Map<string, ChildProcess> = new Map();

  constructor(
    public repoRoot: string,
    public store: MetadataStore,
    public config: MannostreeConfig
  ) {}

  public interpolateCommand(
    template: string,
    vars: {
      worktreePath: string;
      contractPath: string;
      feature?: string;
      role?: string;
    }
  ): string {
    return template
      .replace(/\{worktree_path\}/g, vars.worktreePath)
      .replace(/\{contract_path\}/g, vars.contractPath)
      .replace(/\{feature\}/g, vars.feature || '')
      .replace(/\{role\}/g, vars.role || 'worker');
  }

  public async dispatchSession(
    options: AgentDispatchOptions
  ): Promise<AgentSessionRecord> {
    const {
      target,
      role = 'worker',
      command,
      contract,
      title,
      problemStatement,
      scope,
      criteria,
      timeoutSeconds,
      dryRun = false,
    } = options;

    // 1. Resolve target worktree record
    let worktreeRecord = await this.store.getWorktree(target);
    let featureName = target;

    if (!worktreeRecord) {
      // Check if target is a feature experiment name
      const experiment = await this.store.getExperiment(target);
      if (experiment && experiment.variants.length > 0) {
        // Target is experiment, pick first variant or throw if not parallel flag
        const firstVariantId = experiment.variants[0];
        worktreeRecord = await this.store.getWorktree(firstVariantId);
        featureName = experiment.feature;
      }
    }

    if (!worktreeRecord) {
      throw new MannostreeError(
        `Target worktree or experiment '${target}' not found in metadata registry.`,
        ExitCode.USAGE_ERROR
      );
    }

    const fullWorktreePath = path.resolve(this.repoRoot, worktreeRecord.worktree_path);
    if (!fs.existsSync(fullWorktreePath)) {
      throw new MannostreeError(
        `Worktree directory does not exist at ${worktreeRecord.worktree_path}.`,
        ExitCode.USAGE_ERROR
      );
    }

    const taskDir = path.join(fullWorktreePath, this.config.artifact_dir_name || '.task');
    if (!fs.existsSync(taskDir) && !dryRun) {
      fs.mkdirSync(taskDir, { recursive: true });
    }

    const contractFilePath = path.join(taskDir, 'task-contract.md');

    // 2. Initialize or update task contract
    if (!dryRun) {
      if (contract && fs.existsSync(contract)) {
        fs.copyFileSync(contract, contractFilePath);
      } else if (title || problemStatement || scope || criteria || !fs.existsSync(contractFilePath)) {
        const contractContent = generateTaskContractMarkdown({
          title: title || worktreeRecord.feature_name || worktreeRecord.id,
          problem_statement: problemStatement,
          scope,
          acceptance_criteria: criteria && criteria.length > 0
            ? criteria.map((c, i) => ({
                id: `AC-${String(i + 1).padStart(3, '0')}`,
                description: c,
                completed: false,
              }))
            : undefined,
        });
        fs.writeFileSync(contractFilePath, contractContent, 'utf-8');
      }
    }


    // 3. Resolve command template
    const rawTemplate = command || this.config.agent?.default_command || '';
    const interpolatedCmd = rawTemplate
      ? this.interpolateCommand(rawTemplate, {
          worktreePath: fullWorktreePath,
          contractPath: contractFilePath,
          feature: worktreeRecord.feature_name || featureName,
          role,
        })
      : '';

    const now = new Date().toISOString();
    const randomSuffix = Math.random().toString(36).substring(2, 6);
    const datePrefix = now.replace(/[-:T]/g, '').slice(0, 14);
    const sessionId = `session_${datePrefix}_${randomSuffix}`;

    const sessionRecord: AgentSessionRecord = {
      session_id: sessionId,
      worktree_id: worktreeRecord.id,
      feature: worktreeRecord.feature_name || featureName,
      role,
      command: interpolatedCmd || '(contract_only)',
      state: 'dispatched',
      started_at: now,
      contract_path: path.relative(this.repoRoot, contractFilePath),
    };

    if (dryRun) {
      return sessionRecord;
    }

    // 4. Save session record
    await this.store.saveSession(sessionRecord);

    // 5. Update worktree lifecycle state
    worktreeRecord.lifecycle_state = 'TASK_RESOLVED';
    worktreeRecord.status = 'dispatched';
    worktreeRecord.updated_at = now;
    await this.store.saveWorktree(worktreeRecord);

    // 6. Launch process if command provided
    if (interpolatedCmd) {
      const timeout = (timeoutSeconds || this.config.agent?.timeout_seconds || 1800) * 1000;
      const child = spawn(interpolatedCmd, {
        cwd: fullWorktreePath,
        shell: true,
        detached: true,
        stdio: 'ignore',
        env: {
          ...process.env,
          MANNOSTREE_WORKTREE: fullWorktreePath,
          MANNOSTREE_CONTRACT: contractFilePath,
          MANNOSTREE_SESSION: sessionId,
        },
      });

      child.unref();

      sessionRecord.pid = child.pid;
      this.activeProcesses.set(sessionId, child);
      await this.store.saveSession(sessionRecord);

      // Timeout watchdog
      const timer = setTimeout(() => {
        if (this.activeProcesses.has(sessionId)) {
          this.cancelSession(sessionId, { force: true }).catch(() => {});
        }
      }, timeout);

      child.on('exit', async (code) => {
        clearTimeout(timer);
        this.activeProcesses.delete(sessionId);
        const endedAt = new Date().toISOString();
        const durationSec = (new Date(endedAt).getTime() - new Date(sessionRecord.started_at).getTime()) / 1000;

        const currentSession = await this.store.getSession(sessionId);
        if (currentSession && currentSession.state === 'dispatched') {
          currentSession.state = code === 0 ? 'working' : 'execution_failed';
          currentSession.exit_code = code ?? undefined;
          currentSession.ended_at = endedAt;
          currentSession.duration_seconds = Math.round(durationSec);
          await this.store.saveSession(currentSession);
        }
      });
    }

    return sessionRecord;
  }

  public async cancelSession(
    target: string,
    options: AgentCancelOptions = {}
  ): Promise<AgentSessionRecord | null> {
    // Check if target is sessionId or worktreeId
    let session = await this.store.getSession(target);
    if (!session) {
      const sessions = await this.store.listSessions({ worktreeId: target });
      session = sessions.find((s) => s.state === 'dispatched' || s.state === 'working' || s.state === 'planning') || null;
    }

    if (!session) {
      return null;
    }

    if (session.pid) {
      try {
        process.kill(session.pid, options.force ? 'SIGKILL' : 'SIGTERM');
      } catch {
        // process might already be dead
      }
    }

    this.activeProcesses.delete(session.session_id);

    const now = new Date().toISOString();
    session.state = 'cancelled';
    session.ended_at = now;
    if (session.started_at) {
      session.duration_seconds = Math.round((new Date(now).getTime() - new Date(session.started_at).getTime()) / 1000);
    }

    await this.store.saveSession(session);
    return session;
  }

  public async getSessionStatus(target?: string): Promise<AgentSessionRecord[]> {
    if (target) {
      const single = await this.store.getSession(target);
      if (single) return [single];
      return this.store.listSessions({ worktreeId: target });
    }
    return this.store.listSessions();
  }

  public async updateSessionState(
    sessionId: string,
    state: AgentSessionState,
    error?: string
  ): Promise<AgentSessionRecord> {
    const session = await this.store.getSession(sessionId);
    if (!session) {
      throw new MannostreeError(`Session '${sessionId}' not found.`, ExitCode.USAGE_ERROR);
    }

    session.state = state;
    if (error) session.error = error;
    if (state === 'fulfilled' || state === 'fulfillment_rejected' || state === 'execution_failed' || state === 'cancelled') {
      const now = new Date().toISOString();
      session.ended_at = now;
      session.duration_seconds = Math.round((new Date(now).getTime() - new Date(session.started_at).getTime()) / 1000);
    }

    await this.store.saveSession(session);
    return session;
  }
}
