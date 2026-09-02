import fs from 'node:fs';
import path from 'node:path';
import {
  IssueCommentOptions,
  IssueCommentResult,
  IssueDriftSummary,
  IssueIngestOptions,
  IssueRecord,
  IssueSyncOptions,
  IssueTrackerProvider,
  IssueTransitionOptions,
  IssueTransitionResult,
  MannostreeError,
  ExitCode,
  WorktreeRecord,
} from '../types/index.js';
import { MetadataStore } from '../metadata/store.js';
import { IssueTrackerAdapter, IssueTrackerRegistry } from './base.js';
import { MannostreeConfig } from '../config/schema.js';

export class IssueSyncEngine {
  constructor(
    private store: MetadataStore,
    private registry: IssueTrackerRegistry,
    private config?: MannostreeConfig
  ) {}

  public getRegistry(): IssueTrackerRegistry {
    return this.registry;
  }

  public resolveAdapter(key: string, explicitProvider?: IssueTrackerProvider): IssueTrackerAdapter {
    if (explicitProvider) {
      const adapter = this.registry.getAdapter(explicitProvider);
      if (adapter) return adapter;
    }
    return this.registry.resolveAdapterForIssue(key, this.config?.issues);
  }

  public scaffoldTaskContractContent(record: IssueRecord): string {
    const criteriaSection =
      record.acceptance_criteria.length > 0
        ? record.acceptance_criteria.map((c) => `- [ ] ${c}`).join('\n')
        : '- [ ] (Defined in issue ticket description)';

    const labelsText = record.labels.length > 0 ? record.labels.join(', ') : 'None';
    const assigneeText = record.assignee?.name || 'Unassigned';
    const priorityText = record.priority || 'Normal';

    return `# Task Contract: [${record.key}] ${record.title}

**Issue Key**: [${record.key}](${record.url})  
**Provider**: \`${record.provider}\`  
**Priority**: ${priorityText}  
**Assignee**: ${assigneeText}  
**Labels**: ${labelsText}  
**Synced At**: ${record.last_synced_at}  

---

## 1. Objective

${record.description || 'No detailed description provided in ticket.'}

---

## 2. Acceptance Criteria

${criteriaSection}

---

## 3. Verification Protocol

- [ ] All unit and integration test suites passing
- [ ] Code passes strict linter and typecheck
- [ ] Evidence receipts attached to issue ticket upon completion
`;
  }

  public async scaffoldTaskContract(
    record: IssueRecord,
    worktreePath: string,
    dryRun: boolean = false
  ): Promise<string> {
    const contractDir = path.join(worktreePath, '.task');
    const contractPath = path.join(contractDir, 'task-contract.md');
    const content = this.scaffoldTaskContractContent(record);

    if (!dryRun) {
      if (!fs.existsSync(contractDir)) {
        fs.mkdirSync(contractDir, { recursive: true });
      }
      fs.writeFileSync(contractPath, content, 'utf-8');
    }

    return contractPath;
  }

  public async ingestIssue(
    options: IssueIngestOptions
  ): Promise<{ record: IssueRecord; contractPath: string }> {
    const adapter = this.resolveAdapter(options.key, options.provider);
    const record = await adapter.fetchIssue(options.key);

    if (!options.dryRun) {
      await this.store.saveIssueRecord(record);
    }

    let contractPath = '.task/task-contract.md';
    if (options.worktreeId) {
      const worktree = await this.store.getWorktree(options.worktreeId);
      if (worktree) {
        const fullWorktreePath = path.resolve(this.store.repoRoot, worktree.worktree_path);
        contractPath = await this.scaffoldTaskContract(record, fullWorktreePath, options.dryRun);

        if (!options.dryRun) {
          worktree.task = {
            ...worktree.task,
            issue_key: record.key,
            issue_provider: record.provider,
            issue_url: record.url,
            issue_title: record.title,
            issue_status: record.status,
            last_synced_at: record.last_synced_at,
            auto_transition: this.config?.issues?.auto_transition ?? true,
          } as any;
          await this.store.saveWorktree(worktree);
        }
      }
    }

    return { record, contractPath };
  }

  public async transitionIssue(
    options: IssueTransitionOptions
  ): Promise<IssueTransitionResult> {
    const adapter = this.resolveAdapter(options.key, options.provider);
    const result = await adapter.transitionIssue(options.key, options.status, options.dryRun);

    if (result.success && !options.dryRun) {
      const cached = await this.store.getIssueRecord(options.key);
      if (cached) {
        cached.status = options.status;
        cached.last_synced_at = new Date().toISOString();
        await this.store.saveIssueRecord(cached);
      }

      if (options.worktreeId) {
        const worktree = await this.store.getWorktree(options.worktreeId);
        if (worktree && worktree.task) {
          (worktree.task as any).issue_status = options.status;
          (worktree.task as any).last_synced_at = new Date().toISOString();
          await this.store.saveWorktree(worktree);
        }
      }
    }

    return result;
  }

  public async postComment(options: IssueCommentOptions): Promise<IssueCommentResult> {
    const adapter = this.resolveAdapter(options.key, options.provider);
    return adapter.postComment(options.key, options.message, options.dryRun);
  }

  public async syncEvidence(
    options: IssueSyncOptions
  ): Promise<{ commentResult: IssueCommentResult; evidenceSummary: string }> {
    let issueKey = options.key;
    let worktreePath = process.cwd();

    if (options.worktreeId) {
      const worktree = await this.store.getWorktree(options.worktreeId);
      if (worktree) {
        worktreePath = path.resolve(this.store.repoRoot, worktree.worktree_path);
        if (!issueKey && (worktree.task as any)?.issue_key) {
          issueKey = (worktree.task as any).issue_key;
        }
      }
    }


    if (!issueKey) {
      throw new MannostreeError(
        'No issue key specified or linked to the active worktree.',
        ExitCode.VALIDATION_FAILURE
      );
    }

    let evidenceSummary = '### 🚀 Mannostree Verification Evidence\n\n';
    evidenceSummary += `- **Synced At**: ${new Date().toISOString()}\n`;

    const resultsPath = path.join(worktreePath, '.task', 'RESULTS.md');
    if (fs.existsSync(resultsPath)) {
      const resultsContent = fs.readFileSync(resultsPath, 'utf-8');
      evidenceSummary += `\n#### Verification Results\n\n${resultsContent}\n`;
    } else {
      evidenceSummary += `\n- **Status**: Worktree synchronized cleanly.\n`;
    }

    const commentResult = await this.postComment({
      key: issueKey,
      message: evidenceSummary,
      provider: options.provider,
      worktreeId: options.worktreeId,
      dryRun: options.dryRun,
    });

    return { commentResult, evidenceSummary };
  }

  public async checkIssueDrift(targetWorktreeId?: string): Promise<IssueDriftSummary[]> {
    const summaries: IssueDriftSummary[] = [];
    const registry = await this.store.getRegistry();

    const worktreeIds = targetWorktreeId
      ? [targetWorktreeId]
      : Object.keys(registry.worktrees || {});

    for (const wtId of worktreeIds) {
      const worktree = await this.store.getWorktree(wtId);
      if (!worktree || !(worktree.task as any)?.issue_key) {
        continue;
      }

      const issueKey = (worktree.task as any).issue_key;
      const issueProvider = (worktree.task as any).issue_provider || 'jira';
      const localState = worktree.lifecycle_state;

      try {
        const adapter = this.resolveAdapter(issueKey, issueProvider);
        const remote = await adapter.fetchIssue(issueKey);

        let driftDetected = false;
        let driftReason: string | undefined;

        // Compare local state vs remote status
        const normRemote = remote.status.toLowerCase();
        if (
          ['closed', 'done', 'cancelled'].includes(normRemote) &&
          !['CLEANED', 'ARCHIVED', 'VERIFIED'].includes(localState)
        ) {
          driftDetected = true;
          driftReason = `Remote ticket is "${remote.status}" but local worktree is still active in state "${localState}".`;
        }

        summaries.push({
          worktree_id: wtId,
          worktree_branch: worktree.branch,
          local_lifecycle_state: localState,
          issue_key: issueKey,
          issue_provider: issueProvider,
          remote_status: remote.status,
          drift_detected: driftDetected,
          drift_reason: driftReason,
        });
      } catch (err: any) {
        summaries.push({
          worktree_id: wtId,
          worktree_branch: worktree.branch,
          local_lifecycle_state: localState,
          issue_key: issueKey,
          issue_provider: issueProvider,
          remote_status: 'Unreachable',
          drift_detected: true,
          drift_reason: `Failed to contact issue tracker: ${err.message}`,
        });
      }
    }

    return summaries;
  }

  public async listIssues(
    provider?: IssueTrackerProvider,
    filter?: { assignee?: string; status?: string }
  ): Promise<IssueRecord[]> {
    const prov = provider || this.config?.issues?.default_provider || 'jira';
    const adapter = this.registry.getAdapter(prov);
    if (!adapter) {
      return [];
    }
    return adapter.listIssues(filter);
  }
}
