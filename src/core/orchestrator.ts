import path from 'node:path';
import fs from 'node:fs';
import { MannostreeConfig, ProfileConfig } from '../config/schema.js';
import { GitEngine } from '../git/engine.js';
import { MetadataStore, writeAtomicJson } from '../metadata/store.js';
import { resolveBaseBranch } from '../git/base-resolver.js';
import { scaffoldArtifacts } from '../artifact/scaffold.js';
import { DoctorEngine, DoctorReport, ProposedRepair } from './doctor.js';
import { SetupEngine, SetupApplyResult, EnvApplyResult } from './setup.js';
import {
  ParallelEngine,
  ParallelSpawnOptions,
  ParallelComparisonReport,
  ParallelPickOptions,
  ParallelPickResult,
  ParallelDropOptions,
  ParallelDropResult,
} from './parallel.js';
import { PublishEngine, PrOptions, PrResult, GhExecutor } from './publish.js';
import { TaskEngine, TaskValidationResult, HandoffReport } from './task.js';
import { ParallelHandoffEngine } from './handoff.js';
import { AgentRunner } from './agent-runner.js';
import { QualityGatesRunner } from './quality-gates.js';
import { MatrixEvaluator } from './matrix-eval.js';
import { FleetEngine } from './fleet.js';
import {
  parseTaskContractMarkdown,
  validateContractFulfillment,
  compileScorecard,
  generateScorecardMarkdown,
} from './contract.js';
import {
  ArchiveRecord,
  CommandOutput,
  ExitCode,
  ExperimentRecord,
  HealthMetadata,
  LifecycleState,
  MannostreeError,
  ParallelHandoffPackage,
  WorktreeRecord,
  AgentDispatchOptions,
  AgentVerifyOptions,
  AgentCancelOptions,
  AgentStatusOptions,
  AgentSessionRecord,
  FulfillmentVerificationReport,
  ExecutionScorecard,
  ExperimentMatrixReport,
  ParallelEvalOptions,
  QualityGateCommand,
  FleetSyncOptions,
  FleetSyncReport,
  FleetConflictMatrixOptions,
  FleetConflictMatrixReport,
  WorkspaceLease,
  FleetTier,
  FleetCapacityReport,
  AutoArchiveReport,
  FleetLeaseAcquireOptions,
  FleetLeaseReleaseOptions,
  FleetLeaseRenewOptions,
  FleetAutoArchiveOptions,
  ParallelPublishOptions,
  ParallelPublishResult,
  FleetMergeSyncOptions,
  FleetMergeSyncReport,
  FleetBatchPublishOptions,
  FleetBatchPublishReport,
  SandboxRuntimeType,
  NetworkIsolationMode,
  SandboxExecutionResult,
  IssueTrackerProvider,
} from '../types/index.js';
import {
  createDefaultSandboxRegistry,
  SandboxRegistry,
  writeSandboxReceipt,
} from '../sandbox/index.js';
import { PolyEngine, PolyLinkEngine, PolyPublishEngine } from '../poly/index.js';
import {
  IssueTrackerRegistry,
  createDefaultIssueTrackerRegistry,
  IssueSyncEngine,
} from '../issues/index.js';

export interface SpawnOptions {
  name: string;
  baseBranch?: string;
  kind?: string;
  profile?: string;
  noSetup?: boolean;
  env?: 'copy' | 'link' | 'skip' | 'generate';
  issue?: string;
  issueProvider?: IssueTrackerProvider;
  noIssueTransition?: boolean;
  dryRun?: boolean;
}

export interface ListOptions {
  state?: string;
  kind?: string;
  tag?: string;
  archived?: boolean;
}


export interface InfoOptions {
  worktreeId?: string;
}

export interface DropOptions {
  keepBranch?: boolean;
  force?: boolean;
  archive?: boolean;
  dryRun?: boolean;
}

export interface StatusOptions {
  fetch?: boolean;
}

export interface DoctorOptions {
  fix?: boolean;
  yes?: boolean;
  dryRun?: boolean;
}

export interface CleanOptions {
  merged?: boolean;
  staleDays?: number;
  state?: string;
  force?: boolean;
  yes?: boolean;
  dryRun?: boolean;
}

export interface SyncOptions {
  strategy?: 'rebase' | 'merge' | 'ff-only';
  fetch?: boolean;
  dryRun?: boolean;
}

export interface DiffOptions {
  statOnly?: boolean;
}

export interface RecoverOptions {
  rebuildMetadata?: boolean;
  reattachWorktree?: boolean;
  reattachBranch?: boolean;
  recoverTransaction?: boolean;
  yes?: boolean;
  dryRun?: boolean;
}

export interface SetupOptions {
  profile?: string;
  reinstall?: boolean;
  dryRun?: boolean;
}

export interface EnvOptions {
  mode?: 'copy' | 'link' | 'skip' | 'generate';
  from?: string;
  dryRun?: boolean;
}

export interface ExecOptions {
  command?: string;
  commandArgs?: string[];
  inheritStdio?: boolean;
  sandbox?: SandboxRuntimeType;
  image?: string;
  cpus?: number;
  memory?: string;
  network?: NetworkIsolationMode;
  timeout?: number;
  dryRun?: boolean;
}

export class MannostreeOrchestrator {
  public git: GitEngine;
  public store: MetadataStore;
  public doctorEngine: DoctorEngine;
  public setupEngine: SetupEngine;
  public parallelEngine: ParallelEngine;
  public publishEngine: PublishEngine;
  public taskEngine: TaskEngine;
  public parallelHandoffEngine: ParallelHandoffEngine;
  public agentRunner: AgentRunner;
  public qualityGatesRunner: QualityGatesRunner;
  public matrixEvaluator: MatrixEvaluator;
  public fleetEngine: FleetEngine;
  public sandboxRegistry: SandboxRegistry;
  public polyEngine: PolyEngine;
  public polyLinkEngine: PolyLinkEngine;
  public polyPublishEngine: PolyPublishEngine;
  public issueRegistry: IssueTrackerRegistry;
  public issueSyncEngine: IssueSyncEngine;

  constructor(
    public repoRoot: string,
    public config: MannostreeConfig,
    ghExecutor?: GhExecutor
  ) {
    this.git = new GitEngine(repoRoot);
    this.store = new MetadataStore(repoRoot, config);
    this.setupEngine = new SetupEngine(repoRoot);
    this.parallelEngine = new ParallelEngine(
      repoRoot,
      config,
      this.git,
      this.store,
      this.spawn.bind(this),
      this.drop.bind(this)
    );
    this.publishEngine = new PublishEngine(repoRoot, config, this.git, ghExecutor);
    this.taskEngine = new TaskEngine(repoRoot, config, this.git);
    this.parallelHandoffEngine = new ParallelHandoffEngine(
      repoRoot,
      config,
      this.git,
      this.store,
      this.parallelEngine
    );
    this.agentRunner = new AgentRunner(repoRoot, this.store, config);
    this.qualityGatesRunner = new QualityGatesRunner();
    this.matrixEvaluator = new MatrixEvaluator(repoRoot, this.git, this.store, config);
    this.fleetEngine = new FleetEngine(repoRoot, config, this.git, this.store);
    this.sandboxRegistry = createDefaultSandboxRegistry();
    this.polyLinkEngine = new PolyLinkEngine(this.store);
    this.polyEngine = new PolyEngine(config, this.store, this.git, this.polyLinkEngine, this.sandboxRegistry);
    this.polyPublishEngine = new PolyPublishEngine(config, this.store, this.git);
    this.issueRegistry = createDefaultIssueTrackerRegistry(config.issues);
    this.issueSyncEngine = new IssueSyncEngine(this.store, this.issueRegistry, config);
    this.doctorEngine = new DoctorEngine(
      repoRoot,
      config,
      this.git,
      this.store,
      this.sandboxRegistry,
      undefined,
      this.issueRegistry
    );
  }




  public getProfile(name: string = 'default'): ProfileConfig {
    const profiles = this.config.profiles || {};
    return (
      profiles[name] ||
      profiles.default || {
        install_commands: [],
        env_mode: 'skip',
        env_files: [],
        env_vars: {},
        validation_commands: [],
      }
    );
  }


  public async spawn(options: SpawnOptions): Promise<CommandOutput<WorktreeRecord>> {
    const {
      name,
      baseBranch: explicitBase,
      kind = 'feature',
      profile: profileName = 'default',
      noSetup = false,
      env = 'skip',
      dryRun = false,
    } = options;

    if (!name || name.trim().length === 0) {
      throw new MannostreeError(
        'A valid worktree/feature name is required for spawn.',
        ExitCode.USAGE_ERROR
      );
    }

    const sanitizedName = name.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/\/+/g, '-');
    const id = `${kind}-${sanitizedName}`;
    const branch = `${kind}/${sanitizedName}`;
    const relWorktreePath = path.join(this.config.worktree_root, sanitizedName);
    const fullWorktreePath = path.resolve(this.repoRoot, relWorktreePath);

    // Check collision in metadata registry
    const existing = await this.store.getWorktree(id);
    if (existing) {
      throw new MannostreeError(
        `Worktree record '${id}' already exists in registry.`,
        ExitCode.USAGE_ERROR
      );
    }

    // Resolve explicit base branch
    const resolvedBase = await resolveBaseBranch({
      cliBaseBranch: explicitBase,
      profileName,
      config: this.config,
      gitEngine: this.git,
    });

    const warnings: string[] = [];

    // Pre-flight git checks
    const branchExists = await this.git.branchOrRefExists(branch);
    if (branchExists) {
      throw new MannostreeError(
        `Git branch '${branch}' already exists in repository.`,
        ExitCode.USAGE_ERROR
      );
    }

    if (fs.existsSync(fullWorktreePath)) {
      throw new MannostreeError(
        `Target directory '${relWorktreePath}' already exists on disk.`,
        ExitCode.USAGE_ERROR
      );
    }

    // Execute git worktree creation
    await this.git.createBranchAndWorktree(
      branch,
      relWorktreePath,
      resolvedBase,
      dryRun
    );

    // Scaffold artifacts
    scaffoldArtifacts({
      worktreeFullPath: fullWorktreePath,
      artifactDirName: this.config.artifact_dir_name,
      featureName: sanitizedName,
      baseBranch: resolvedBase,
      dryRun,
    });

    // Apply setup & env profile
    const profile = this.getProfile(profileName);
    let installRan = false;
    let installSucceeded = true;
    let setupCommands: string[] = [];
    let initialLifecycle: LifecycleState = 'CONTEXT_PACKED';

    if (!noSetup && !dryRun) {
      const setupRes = await this.setupEngine.applyProfile(fullWorktreePath, profile, { dryRun });
      installRan = setupRes.install_ran;
      installSucceeded = setupRes.install_succeeded && setupRes.validation_passed;
      setupCommands = setupRes.commands_executed;

      if (!installSucceeded) {
        initialLifecycle = 'BROKEN';
        warnings.push(...setupRes.errors);
      }

      await this.setupEngine.applyEnvPolicy(fullWorktreePath, profile, env, undefined, { dryRun });
    }

    const now = new Date().toISOString();
    const worktreeRecord: WorktreeRecord = {
      version: 1,
      id,
      kind,
      feature_name: sanitizedName,
      repo_root: this.repoRoot,
      worktree_path: relWorktreePath,
      metadata_path: path.relative(
        this.repoRoot,
        this.store.getWorktreeRecordPath(id)
      ),
      branch,
      base_branch: resolvedBase,
      branch_type: kind,
      created_at: now,
      updated_at: now,
      last_activity_at: now,
      created_by: 'mannostree spawn',
      profile: profileName,
      status: installSucceeded ? 'created' : 'broken',
      lifecycle_state: initialLifecycle,
      task: {
        source_type: 'manual',
        task_contract_file: path.join(
          this.config.artifact_dir_name,
          'task-contract.md'
        ),
        implementation_plan_file: path.join(
          this.config.artifact_dir_name,
          'implementation-plan.md'
        ),
      },
      artifacts: {
        artifact_root: this.config.artifact_dir_name,
        results_file: 'RESULTS.md',
        quality_gates_file: path.join(
          this.config.artifact_dir_name,
          'quality-gates.md'
        ),
        review_file: path.join(this.config.artifact_dir_name, 'review.md'),
      },
      setup: {
        setup_mode: profileName,
        env_mode: env,
        install_ran: installRan,
        install_succeeded: installSucceeded,
        setup_commands: setupCommands,
      },
      git_state: {
        dirty: false,
        ahead_count: 0,
        behind_count: 0,
        has_untracked_files: false,
        has_conflicts: false,
      },
      health: {
        exists_on_disk: true,
        branch_exists: true,
        metadata_consistent: true,
        last_health_check_at: now,
        health_status: installSucceeded ? 'ok' : 'degraded',
      },
      tags: [kind, sanitizedName],
    };

    if (!dryRun) {
      await this.store.saveWorktree(worktreeRecord);
    }

    if (options.issue) {
      try {
        const { record } = await this.issueSyncEngine.ingestIssue({
          key: options.issue,
          worktreeId: id,
          provider: options.issueProvider,
          dryRun,
        });

        await this.issueSyncEngine.scaffoldTaskContract(record, fullWorktreePath, dryRun);

        if (worktreeRecord.task) {
          (worktreeRecord.task as any).issue_key = record.key;
          (worktreeRecord.task as any).issue_provider = record.provider;
          (worktreeRecord.task as any).issue_url = record.url;
          (worktreeRecord.task as any).issue_title = record.title;
          (worktreeRecord.task as any).issue_status = record.status;
          (worktreeRecord.task as any).last_synced_at = record.last_synced_at;
          (worktreeRecord.task as any).auto_transition = this.config.issues?.auto_transition ?? true;
        }

        if (!dryRun) {
          await this.store.saveWorktree(worktreeRecord);
        }

        if (!options.noIssueTransition && (this.config.issues?.auto_transition ?? true)) {
          const targetState = this.config.issues?.transitions?.on_spawn || 'In Progress';
          await this.issueSyncEngine.transitionIssue({
            key: options.issue,
            status: targetState,
            worktreeId: id,
            provider: options.issueProvider,
            dryRun,
          });
        }
      } catch (err: any) {
        warnings.push(`Issue tracker sync warning: ${err.message}`);
      }
    }


    return {
      command: 'spawn',
      ok: true,
      dry_run: dryRun,
      result: worktreeRecord,
      warnings,
      errors: [],
    };
  }


  public async list(
    options: ListOptions = {}
  ): Promise<CommandOutput<WorktreeRecord[]>> {
    const records = await this.store.listWorktrees();
    let filtered = records;

    if (options.archived) {
      filtered = filtered.filter((r) => r.status === 'archived');
    } else if (!options.state) {
      filtered = filtered.filter((r) => r.status !== 'archived');
    }

    if (options.state) {
      filtered = filtered.filter(
        (r) =>
          r.lifecycle_state.toLowerCase() === options.state!.toLowerCase() ||
          r.status.toLowerCase() === options.state!.toLowerCase()
      );
    }

    if (options.kind) {
      filtered = filtered.filter(
        (r) => r.kind?.toLowerCase() === options.kind!.toLowerCase()
      );
    }

    if (options.tag) {
      filtered = filtered.filter((r) => r.tags?.includes(options.tag!));
    }

    return {
      command: 'list',
      ok: true,
      dry_run: false,
      result: filtered,
      warnings: [],
      errors: [],
    };
  }

  public async info(
    id: string
  ): Promise<CommandOutput<WorktreeRecord & { live_health: HealthMetadata }>> {
    const record = await this.store.getWorktree(id);
    if (!record) {
      throw new MannostreeError(
        `Worktree '${id}' not found in metadata registry.`,
        ExitCode.USAGE_ERROR
      );
    }

    const fullPath = path.resolve(this.repoRoot, record.worktree_path);
    const existsOnDisk = fs.existsSync(fullPath);
    const branchExists = await this.git.branchOrRefExists(record.branch);
    const gitState = await this.git.getGitState(record.worktree_path, record.base_branch, record.branch);

    const liveHealth: HealthMetadata = {
      exists_on_disk: existsOnDisk,
      branch_exists: branchExists,
      metadata_consistent: true,
      last_health_check_at: new Date().toISOString(),
      health_status: existsOnDisk && branchExists ? 'ok' : 'degraded',
    };

    const enriched: WorktreeRecord & { live_health: HealthMetadata } = {
      ...record,
      git_state: gitState,
      live_health: liveHealth,
    };

    return {
      command: 'info',
      ok: true,
      dry_run: false,
      result: enriched,
      warnings: [],
      errors: [],
    };
  }

  public async status(
    id: string,
    options: StatusOptions = {}
  ): Promise<CommandOutput<WorktreeRecord & { live_health: HealthMetadata }>> {
    const record = await this.store.getWorktree(id);
    if (!record) {
      throw new MannostreeError(
        `Worktree '${id}' not found in metadata registry.`,
        ExitCode.USAGE_ERROR
      );
    }

    if (options.fetch) {
      try {
        await this.git.fetchAll(path.resolve(this.repoRoot, record.worktree_path));
      } catch {
        // Warning if fetch fails (e.g. offline)
      }
    }

    const fullPath = path.resolve(this.repoRoot, record.worktree_path);
    const existsOnDisk = fs.existsSync(fullPath);
    const branchExists = await this.git.branchOrRefExists(record.branch);
    const gitState = await this.git.getGitState(record.worktree_path, record.base_branch, record.branch);

    const liveHealth: HealthMetadata = {
      exists_on_disk: existsOnDisk,
      branch_exists: branchExists,
      metadata_consistent: true,
      last_health_check_at: new Date().toISOString(),
      health_status: existsOnDisk && branchExists ? 'ok' : 'degraded',
    };

    const enriched: WorktreeRecord & { live_health: HealthMetadata } = {
      ...record,
      git_state: gitState,
      live_health: liveHealth,
    };

    return {
      command: 'status',
      ok: true,
      dry_run: false,
      result: enriched,
      warnings: [],
      errors: [],
    };
  }

  public async sync(
    id: string,
    options: SyncOptions = {}
  ): Promise<
    CommandOutput<{
      id: string;
      strategy: string;
      base_branch: string;
      branch: string;
    }>
  > {
    const { strategy = 'rebase', fetch = true, dryRun = false } = options;

    const record = await this.store.getWorktree(id);
    if (!record) {
      throw new MannostreeError(
        `Worktree '${id}' not found in metadata registry.`,
        ExitCode.USAGE_ERROR
      );
    }

    const fullPath = path.resolve(this.repoRoot, record.worktree_path);
    if (!fs.existsSync(fullPath)) {
      throw new MannostreeError(
        `Worktree directory for '${id}' is missing on disk: ${record.worktree_path}`,
        ExitCode.USAGE_ERROR
      );
    }

    if (fetch && !dryRun) {
      try {
        await this.git.fetchAll(fullPath);
      } catch {
        // ignore fetch failures in local/offline repos
      }
    }

    await this.git.syncWorktree(record.worktree_path, record.base_branch, strategy, dryRun);

    if (!dryRun) {
      record.last_activity_at = new Date().toISOString();
      record.git_state = await this.git.getGitState(record.worktree_path, record.base_branch, record.branch);
      await this.store.saveWorktree(record);
    }

    return {
      command: 'sync',
      ok: true,
      dry_run: dryRun,
      result: {
        id,
        strategy,
        base_branch: record.base_branch,
        branch: record.branch,
      },
      warnings: [],
      errors: [],
    };
  }

  public async setup(
    id: string,
    options: SetupOptions = {}
  ): Promise<CommandOutput<SetupApplyResult & { id: string; profile: string }>> {
    const { profile: profileOverride, reinstall = false, dryRun = false } = options;

    const record = await this.store.getWorktree(id);
    if (!record) {
      throw new MannostreeError(
        `Worktree '${id}' not found in metadata registry.`,
        ExitCode.USAGE_ERROR
      );
    }

    const targetProfileName = profileOverride || record.profile || 'default';
    const profile = this.getProfile(targetProfileName);
    const fullPath = path.resolve(this.repoRoot, record.worktree_path);

    const setupResult = await this.setupEngine.applyProfile(fullPath, profile, {
      reinstall,
      dryRun,
    });

    if (!dryRun) {
      record.profile = targetProfileName;
      record.last_activity_at = new Date().toISOString();
      record.setup = {
        ...(record.setup || {}),
        setup_mode: targetProfileName,
        install_ran: setupResult.install_ran,
        install_succeeded: setupResult.install_succeeded && setupResult.validation_passed,
        setup_commands: setupResult.commands_executed,
      };

      if (!setupResult.install_succeeded || !setupResult.validation_passed) {
        record.lifecycle_state = 'BROKEN';
        record.status = 'broken';
      }

      await this.store.saveWorktree(record);
    }

    return {
      command: 'setup',
      ok: setupResult.install_succeeded && setupResult.validation_passed,
      dry_run: dryRun,
      result: {
        ...setupResult,
        id,
        profile: targetProfileName,
      },
      warnings: [],
      errors: setupResult.errors,
    };
  }

  public async env(
    id: string,
    options: EnvOptions = {}
  ): Promise<CommandOutput<EnvApplyResult & { id: string }>> {
    const { mode, from, dryRun = false } = options;

    const record = await this.store.getWorktree(id);
    if (!record) {
      throw new MannostreeError(
        `Worktree '${id}' not found in metadata registry.`,
        ExitCode.USAGE_ERROR
      );
    }

    const profile = this.getProfile(record.profile);
    const fullPath = path.resolve(this.repoRoot, record.worktree_path);

    const envResult = await this.setupEngine.applyEnvPolicy(fullPath, profile, mode, from, {
      dryRun,
    });

    if (!dryRun) {
      record.last_activity_at = new Date().toISOString();
      record.setup = {
        ...(record.setup || {}),
        env_mode: envResult.mode,
      };
      await this.store.saveWorktree(record);
    }

    return {
      command: 'env',
      ok: true,
      dry_run: dryRun,
      result: {
        ...envResult,
        id,
      },
      warnings: [],
      errors: [],
    };
  }

  public async exec(
    id: string,
    commandOrArgs: string | string[] | ExecOptions,
    options: ExecOptions = {}
  ): Promise<{ exitCode: number; stdout: string; stderr: string; ok: boolean; result: SandboxExecutionResult }> {
    const record = await this.store.getWorktree(id);
    if (!record) {
      throw new MannostreeError(
        `Worktree '${id}' not found in metadata registry.`,
        ExitCode.USAGE_ERROR
      );
    }

    let commandStr: string;
    let actualOpts: ExecOptions = {};

    if (Array.isArray(commandOrArgs)) {
      commandStr = commandOrArgs.join(' ');
      actualOpts = options;
    } else if (typeof commandOrArgs === 'string') {
      commandStr = commandOrArgs;
      actualOpts = options;
    } else {
      actualOpts = commandOrArgs || {};
      commandStr = actualOpts.command || (actualOpts.commandArgs ? actualOpts.commandArgs.join(' ') : '');
    }

    const profile = this.getProfile(record.profile);
    const fullPath = path.resolve(this.repoRoot, record.worktree_path);

    if (actualOpts.inheritStdio && !actualOpts.sandbox) {
      const legacyRes = await this.setupEngine.execInWorktree(fullPath, [commandStr], profile, { inheritStdio: true });
      return {
        exitCode: legacyRes.exitCode,
        stdout: legacyRes.stdout || '',
        stderr: legacyRes.stderr || '',
        ok: legacyRes.exitCode === 0,
        result: {
          runtime: 'process',
          command: commandStr,
          exit_code: legacyRes.exitCode,
          duration_ms: 0,
          stdout: legacyRes.stdout || '',
          stderr: legacyRes.stderr || '',
          timed_out: false,
        },
      };
    }

    const runtimeType = actualOpts.sandbox || this.config.sandbox?.default_runtime || 'process';
    const runtime = this.sandboxRegistry.resolveRuntime(runtimeType);

    const limits = {
      cpus: actualOpts.cpus ?? this.config.sandbox?.limits?.cpus,
      memory: actualOpts.memory ?? this.config.sandbox?.limits?.memory,
      timeout_seconds: actualOpts.timeout ?? this.config.sandbox?.limits?.timeout_seconds,
    };

    const execRes = await runtime.execute(fullPath, {
      command: commandStr,
      image: actualOpts.image || this.config.sandbox?.default_image,
      network: actualOpts.network || this.config.sandbox?.default_network,
      limits,
      env: profile?.env_vars,
      dryRun: actualOpts.dryRun,
    });

    if (!actualOpts.dryRun && fs.existsSync(fullPath)) {
      const { receiptPath } = writeSandboxReceipt({
        worktreeId: id,
        worktreePath: fullPath,
        artifactDirName: this.config.artifact_dir_name,
        result: execRes,
      });
      execRes.receipt_path = receiptPath;
    }

    return {
      exitCode: execRes.exit_code,
      stdout: execRes.stdout,
      stderr: execRes.stderr,
      ok: execRes.exit_code === 0,
      result: execRes,
    };
  }

  public async doctor(
    options: DoctorOptions = {}
  ): Promise<CommandOutput<DoctorReport & { repairs_applied?: ProposedRepair[] }>> {
    const { fix = false, yes = false, dryRun = false } = options;

    const report = await this.doctorEngine.diagnose();

    let repairsApplied: ProposedRepair[] | undefined;
    if (fix) {
      if (!yes && !dryRun) {
        throw new MannostreeError(
          `Doctor found ${report.proposed_repairs.length} repairable issue(s). To execute repairs, rerun with --yes or preview with --dry-run.`,
          ExitCode.USAGE_ERROR
        );
      }

      const { applied } = await this.doctorEngine.applyRepairs(
        report.proposed_repairs,
        dryRun
      );
      repairsApplied = applied;
    }

    return {
      command: 'doctor',
      ok: report.healthy,
      dry_run: dryRun,
      result: {
        ...report,
        repairs_applied: repairsApplied,
      },
      warnings: report.findings.filter((f) => f.severity === 'warning').map((f) => f.message),
      errors: report.findings.filter((f) => f.severity === 'error').map((f) => f.message),
    };
  }

  public async clean(
    options: CleanOptions = {}
  ): Promise<
    CommandOutput<{
      candidates: string[];
      cleaned: string[];
      reasons: Record<string, string>;
    }>
  > {
    const {
      merged = false,
      staleDays,
      state,
      force = false,
      yes = false,
      dryRun = false,
    } = options;

    const isExplicitFilterProvided = merged || staleDays !== undefined || state !== undefined;
    const records = await this.store.listWorktrees();
    const candidateMap: Record<string, string> = {};

    const now = Date.now();

    for (const record of records) {
      // 1. Never clean protected winner variants
      if (record.parallel?.winner && this.config.cleanup?.protect_winner) {
        continue;
      }

      let matches = false;
      let reason = '';

      if (merged) {
        const isMerged = await this.git.isBranchMerged(record.branch, record.base_branch);
        if (isMerged) {
          matches = true;
          reason = `Branch '${record.branch}' is fully merged into base '${record.base_branch}'`;
        }
      }

      if (staleDays !== undefined && !matches) {
        const lastActive = new Date(record.last_activity_at || record.updated_at).getTime();
        const daysOld = (now - lastActive) / (1000 * 60 * 60 * 24);
        if (daysOld >= staleDays) {
          matches = true;
          reason = `Inactive for ${Math.floor(daysOld)} days (threshold: ${staleDays} days)`;
        }
      }

      if (state !== undefined && !matches) {
        if (
          record.lifecycle_state.toLowerCase() === state.toLowerCase() ||
          record.status.toLowerCase() === state.toLowerCase()
        ) {
          matches = true;
          reason = `Matches state filter '${state}'`;
        }
      }

      if (matches) {
        candidateMap[record.id] = reason;
      }
    }

    const candidateIds = Object.keys(candidateMap);

    // If no explicit filter was provided, clean acts as candidate report / requires filter
    if (!isExplicitFilterProvided) {
      return {
        command: 'clean',
        ok: true,
        dry_run: true,
        result: {
          candidates: candidateIds,
          cleaned: [],
          reasons: candidateMap,
        },
        warnings: [
          'No cleanup filters supplied (--merged, --stale-days <N>, or --state <S>). Reporting all candidate worktrees in dry-run mode.',
        ],
        errors: [],
      };
    }

    // If filter supplied but no --yes, default to preview (dry-run)
    const effectiveDryRun = dryRun || !yes;
    const cleanedIds: string[] = [];

    if (!effectiveDryRun) {
      for (const id of candidateIds) {
        try {
          await this.drop(id, {
            force,
            archive: this.config.cleanup?.archive_on_drop,
            dryRun: false,
          });
          cleanedIds.push(id);
        } catch (err: any) {
          // Skip dirty worktrees if not force
        }
      }
    }

    return {
      command: 'clean',
      ok: true,
      dry_run: effectiveDryRun,
      result: {
        candidates: candidateIds,
        cleaned: cleanedIds,
        reasons: candidateMap,
      },
      warnings: !yes
        ? ['Cleanup preview only. To execute real removal, supply --yes flag.']
        : [],
      errors: [],
    };
  }

  public async recover(
    id?: string,
    options: RecoverOptions = {}
  ): Promise<
    CommandOutput<{
      id: string;
      action: string;
      success: boolean;
      details: string;
    }>
  > {
    const {
      rebuildMetadata = false,
      reattachWorktree = false,
      reattachBranch = false,
      recoverTransaction = false,
      yes = false,
      dryRun = false,
    } = options;

    const effectiveDryRun = dryRun || !yes;

    if (!id || recoverTransaction) {
      const activeTx = this.store.journal.getActiveTransaction();
      if (!activeTx) {
        return {
          command: 'recover',
          ok: true,
          dry_run: effectiveDryRun,
          result: {
            id: 'journal',
            action: 'recover-transaction',
            success: true,
            details: 'No in-flight or interrupted transactions found in journal.',
          },
          warnings: [],
          errors: [],
        };
      }

      if (!effectiveDryRun) {
        await this.store.journal.rollbackTransaction(activeTx.transaction_id);
      }

      return {
        command: 'recover',
        ok: true,
        dry_run: effectiveDryRun,
        result: {
          id: activeTx.entity_id,
          action: 'recover-transaction',
          success: true,
          details: `Rolled back interrupted transaction '${activeTx.transaction_id}' for ${activeTx.entity_type} '${activeTx.entity_id}'.`,
        },
        warnings: !yes ? ['Preview only. Add --yes to apply rollback.'] : [],
        errors: [],
      };
    }

    const actionCount = [rebuildMetadata, reattachWorktree, reattachBranch].filter(Boolean).length;
    if (actionCount !== 1) {
      throw new MannostreeError(
        'Please specify exactly one repair mode for recover: --rebuild-metadata, --reattach-worktree, or --reattach-branch.',
        ExitCode.USAGE_ERROR
      );
    }

    let record = await this.store.getWorktree(id);
    const fullPath = record
      ? path.resolve(this.repoRoot, record.worktree_path)
      : path.resolve(this.repoRoot, this.config.worktree_root, id.replace(/^[a-z]+-/, ''));

    if (rebuildMetadata) {
      if (!fs.existsSync(fullPath)) {
        throw new MannostreeError(
          `Cannot rebuild metadata for '${id}': directory does not exist at '${fullPath}'.`,
          ExitCode.USAGE_ERROR
        );
      }

      const branch = (await this.git.getCurrentBranchIn(fullPath)) || `feature/${id.replace(/^[a-z]+-/, '')}`;
      const now = new Date().toISOString();

      if (!effectiveDryRun) {
        const reconstructed: WorktreeRecord = {
          version: 1,
          id,
          repo_root: this.repoRoot,
          worktree_path: path.relative(this.repoRoot, fullPath),
          branch,
          base_branch: this.config.default_base_branch,
          created_at: now,
          updated_at: now,
          status: 'recovered',
          lifecycle_state: 'WORKTREE_READY',
        };
        await this.store.saveWorktree(reconstructed);
      }

      return {
        command: 'recover',
        ok: true,
        dry_run: effectiveDryRun,
        result: {
          id,
          action: 'rebuild-metadata',
          success: true,
          details: `Reconstructed metadata for '${id}' from on-disk worktree at '${fullPath}'.`,
        },
        warnings: !yes ? ['Preview only. Add --yes to apply repair.'] : [],
        errors: [],
      };
    }

    if (reattachWorktree) {
      if (!record) {
        throw new MannostreeError(
          `Cannot reattach worktree: record '${id}' not found in metadata registry.`,
          ExitCode.USAGE_ERROR
        );
      }

      const branchExists = await this.git.branchOrRefExists(record.branch);
      if (!branchExists) {
        throw new MannostreeError(
          `Cannot reattach worktree: branch '${record.branch}' does not exist in git.`,
          ExitCode.USAGE_ERROR
        );
      }

      if (!effectiveDryRun) {
        if (!fs.existsSync(fullPath)) {
          await this.git.exec(['worktree', 'add', fullPath, record.branch]);
        }
        await this.git.repairWorktree(fullPath);
      }

      return {
        command: 'recover',
        ok: true,
        dry_run: effectiveDryRun,
        result: {
          id,
          action: 'reattach-worktree',
          success: true,
          details: `Reattached worktree directory at '${fullPath}' to branch '${record.branch}'.`,
        },
        warnings: !yes ? ['Preview only. Add --yes to apply repair.'] : [],
        errors: [],
      };
    }

    if (reattachBranch) {
      if (!record) {
        throw new MannostreeError(
          `Cannot reattach branch: record '${id}' not found in metadata registry.`,
          ExitCode.USAGE_ERROR
        );
      }

      if (!effectiveDryRun) {
        const branchExists = await this.git.branchOrRefExists(record.branch);
        if (!branchExists) {
          await this.git.exec(['branch', record.branch, record.base_branch]);
        }
      }

      return {
        command: 'recover',
        ok: true,
        dry_run: effectiveDryRun,
        result: {
          id,
          action: 'reattach-branch',
          success: true,
          details: `Recreated git branch '${record.branch}' from base '${record.base_branch}'.`,
        },
        warnings: !yes ? ['Preview only. Add --yes to apply repair.'] : [],
        errors: [],
      };
    }

    throw new MannostreeError('Invalid recover request.', ExitCode.USAGE_ERROR);
  }

  public async drop(
    id: string,
    options: DropOptions = {}
  ): Promise<
    CommandOutput<{
      id: string;
      removed_branch: boolean;
      removed_worktree: boolean;
    }>
  > {
    const { keepBranch = false, force = false, archive = false, dryRun = false } =
      options;

    const record = await this.store.getWorktree(id);
    if (!record) {
      throw new MannostreeError(
        `Worktree '${id}' not found in metadata registry.`,
        ExitCode.USAGE_ERROR
      );
    }

    // Check lease guard
    const leaseStatus = await this.fleetEngine.hasActiveLease(id);
    if (leaseStatus.active && !force) {
      throw new MannostreeError(
        `Cannot drop actively leased worktree '${id}' (held by ${leaseStatus.lease?.holder} until ${leaseStatus.lease?.expires_at}). Use --force to break the lease.`,
        ExitCode.USAGE_ERROR
      );
    }


    // Git removal
    await this.git.removeWorktreeAndBranch(
      record.worktree_path,
      record.branch,
      keepBranch,
      force,
      dryRun
    );

    // Update metadata store
    if (!dryRun) {
      await this.store.deleteWorktree(id, archive);
    }

    return {
      command: 'drop',
      ok: true,
      dry_run: dryRun,
      result: {
        id,
        removed_branch: !keepBranch,
        removed_worktree: true,
      },
      warnings: [],
      errors: [],
    };
  }

  public async parallelSpawn(
    options: ParallelSpawnOptions
  ): Promise<
    CommandOutput<{
      feature: string;
      base_branch: string;
      variants: WorktreeRecord[];
      experiment: ExperimentRecord;
    }>
  > {
    const res = await this.parallelEngine.spawnVariants(options);
    return {
      command: 'parallel spawn',
      ok: true,
      dry_run: !!options.dryRun,
      result: res,
      warnings: [],
      errors: [],
    };
  }

  public async parallelCompare(
    feature: string
  ): Promise<CommandOutput<ParallelComparisonReport>> {
    const res = await this.parallelEngine.compareVariants(feature);
    return {
      command: 'parallel compare',
      ok: true,
      dry_run: false,
      result: res,
      warnings: [],
      errors: [],
    };
  }

  public async parallelPick(
    options: ParallelPickOptions
  ): Promise<CommandOutput<ParallelPickResult>> {
    const res = await this.parallelEngine.pickWinner(options);
    return {
      command: 'parallel pick',
      ok: true,
      dry_run: !!options.dryRun,
      result: res,
      warnings: !options.yes && options.cleanupLosers
        ? ['Cleanup losers preview only. Add --yes to delete non-winning variants.']
        : [],
      errors: [],
    };
  }

  public async parallelList(
    status?: string
  ): Promise<CommandOutput<ExperimentRecord[]>> {
    const records = await this.parallelEngine.listExperiments(status);
    return {
      command: 'parallel list',
      ok: true,
      dry_run: false,
      result: records,
      warnings: [],
      errors: [],
    };
  }

  public async parallelDrop(
    options: ParallelDropOptions
  ): Promise<CommandOutput<ParallelDropResult>> {
    const isDryRun = !options.yes || !!options.dryRun;
    const res = await this.parallelEngine.dropExperiment(options);

    const warnings: string[] = [];
    if (!options.yes && !options.dryRun) {
      warnings.push(`Drop experiment preview only. Add --yes to delete all variants of '${options.feature}'.`);
    }
    if (res.winner_protected) {
      warnings.push(`Winner '${res.winner_protected}' is protected from deletion (pass --force to override).`);
    }

    const errors: string[] = [];
    if (res.failed_variants.length > 0) {
      for (const fail of res.failed_variants) {
        errors.push(`Failed to drop variant '${fail.id}': ${fail.error}`);
      }
    }

    return {
      command: 'parallel drop',
      ok: res.failed_variants.length === 0,
      dry_run: isDryRun,
      result: res,
      warnings,
      errors,
    };
  }

  public async pr(
    id: string,
    options: PrOptions = {}
  ): Promise<CommandOutput<PrResult & { id: string }>> {
    const record = await this.store.getWorktree(id);
    if (!record) {
      throw new MannostreeError(
        `Worktree '${id}' not found in metadata registry.`,
        ExitCode.USAGE_ERROR
      );
    }

    const fullPath = path.resolve(this.repoRoot, record.worktree_path);
    const prRes = await this.publishEngine.publishPr(fullPath, record, options);

    if (!options.dryRun) {
      const now = new Date().toISOString();
      record.last_activity_at = now;
      record.publish = {
        pushed: prRes.mode === 'published',
        pr_number: prRes.pr_number ?? null,
        pr_url: prRes.pr_url ?? null,
        published_at: prRes.mode === 'published' ? now : null,
      };
      if (prRes.mode === 'published') {
        record.lifecycle_state = 'PR_OPEN';
        record.status = 'pr_open';

        // Auto-transition linked issue if configured
        if ((record.task as any)?.issue_key && (this.config.issues?.auto_transition ?? true)) {
          const issueKey = (record.task as any).issue_key;
          const issueProvider = (record.task as any).issue_provider;
          const targetState = this.config.issues?.transitions?.on_pr || 'In Review';
          try {
            await this.issueSyncEngine.transitionIssue({
              key: issueKey,
              status: targetState,
              worktreeId: id,
              provider: issueProvider,
            });
            if (prRes.pr_url) {
              await this.issueSyncEngine.postComment({
                key: issueKey,
                message: `Pull Request opened: [PR #${prRes.pr_number || ''}](${prRes.pr_url})`,
                provider: issueProvider,
              });
            }
          } catch {
            // non-fatal
          }
        }
      }
      await this.store.saveWorktree(record);
    }


    return {
      command: 'pr',
      ok: true,
      dry_run: !!options.dryRun,
      result: {
        ...prRes,
        id,
      },
      warnings: prRes.mode === 'prepare-only'
        ? [prRes.instructions || 'PR prepared locally in prepare-only mode.']
        : [],
      errors: [],
    };
  }

  public async issue(
    id: string,
    options: { issue: number; title?: string; dryRun?: boolean }
  ): Promise<CommandOutput<{ id: string; issue_number: number; issue_title?: string }>> {
    const record = await this.store.getWorktree(id);
    if (!record) {
      throw new MannostreeError(
        `Worktree '${id}' not found in metadata registry.`,
        ExitCode.USAGE_ERROR
      );
    }

    const fullPath = path.resolve(this.repoRoot, record.worktree_path);
    const linkRes = await this.taskEngine.linkIssue(
      fullPath,
      record,
      options.issue,
      options.title,
      options.dryRun
    );

    if (!options.dryRun) {
      record.last_activity_at = new Date().toISOString();
      record.task = {
        ...(record.task || {}),
        source_type: 'issue',
        issue_number: linkRes.issue_number,
        issue_title: linkRes.issue_title,
      };
      await this.store.saveWorktree(record);
    }

    return {
      command: 'issue',
      ok: true,
      dry_run: !!options.dryRun,
      result: {
        id,
        issue_number: linkRes.issue_number,
        issue_title: linkRes.issue_title,
      },
      warnings: [],
      errors: [],
    };
  }

  public async task(
    id: string,
    options: { validate?: boolean; summary?: boolean } = {}
  ): Promise<CommandOutput<TaskValidationResult & { id: string }>> {
    const record = await this.store.getWorktree(id);
    if (!record) {
      throw new MannostreeError(
        `Worktree '${id}' not found in metadata registry.`,
        ExitCode.USAGE_ERROR
      );
    }

    const fullPath = path.resolve(this.repoRoot, record.worktree_path);
    const validation = this.taskEngine.validateArtifacts(fullPath);

    return {
      command: 'task',
      ok: validation.complete,
      dry_run: false,
      result: {
        ...validation,
        id,
      },
      warnings: !validation.complete
        ? [`Task artifacts incomplete (${validation.total_present}/${validation.total_required} present, score: ${validation.score_percentage}%).`]
        : [],
      errors: [],
    };
  }

  public async handoff(
    id: string,
    options: { to?: string; notes?: string } = {}
  ): Promise<CommandOutput<HandoffReport>> {
    const record = await this.store.getWorktree(id);
    if (!record) {
      throw new MannostreeError(
        `Worktree '${id}' not found in metadata registry.`,
        ExitCode.USAGE_ERROR
      );
    }

    const fullPath = path.resolve(this.repoRoot, record.worktree_path);
    const report = await this.taskEngine.generateHandoff(
      fullPath,
      record,
      options.to,
      options.notes
    );

    return {
      command: 'handoff',
      ok: true,
      dry_run: false,
      result: report,
      warnings: [],
      errors: [],
    };
  }

  public async archive(
    id: string,
    options: { force?: boolean; yes?: boolean; dryRun?: boolean } = {}
  ): Promise<CommandOutput<{ id: string; archived: boolean; worktree_path: string }>> {
    const { force = false, yes = false, dryRun = false } = options;
    const effectiveDryRun = dryRun || !yes;

    const record = await this.store.getWorktree(id);
    if (!record) {
      throw new MannostreeError(
        `Worktree '${id}' not found in metadata registry.`,
        ExitCode.USAGE_ERROR
      );
    }

    // Check lease guard
    const leaseStatus = await this.fleetEngine.hasActiveLease(id);
    if (leaseStatus.active && !force) {
      throw new MannostreeError(
        `Cannot archive actively leased worktree '${id}' (held by ${leaseStatus.lease?.holder} until ${leaseStatus.lease?.expires_at}). Use --force to proceed.`,
        ExitCode.USAGE_ERROR
      );
    }


    const fullPath = path.resolve(this.repoRoot, record.worktree_path);
    if (fs.existsSync(fullPath)) {
      const isDirty = await this.git.isWorktreeDirty(fullPath);
      if (isDirty && !force) {
        throw new MannostreeError(
          `Refusing to archive worktree '${id}' with uncommitted or untracked changes. Use --force to proceed.`,
          ExitCode.USAGE_ERROR
        );
      }
    }

    if (!effectiveDryRun) {
      if (fs.existsSync(fullPath)) {
        await this.git.exec(['worktree', 'remove', fullPath, '--force']);
      }
      record.status = 'archived';
      record.lifecycle_state = 'CLEANED';
      record.updated_at = new Date().toISOString();
      await this.store.saveWorktree(record);

      const archiveRecord: ArchiveRecord = {
        entity_id: id,
        entity_type: 'worktree',
        archived_at: record.updated_at,
        base_branch: record.base_branch,
        head_sha: (await this.git.getHeadCommit(record.branch)) || 'unknown',
        original_worktree_path: record.worktree_path,
        branch_name: record.branch,
        metadata_snapshot_path: path.relative(this.repoRoot, this.store.getWorktreeRecordPath(id)),
        artifacts: [],
      };
      const archivePath = this.store.getArchiveRecordPath(id);
      writeAtomicJson(archivePath, archiveRecord);
    }

    return {
      command: 'archive',
      ok: true,
      dry_run: effectiveDryRun,
      result: {
        id,
        archived: true,
        worktree_path: record.worktree_path,
      },
      warnings: !yes ? ['Preview only. Add --yes to archive worktree and unmount directory.'] : [],
      errors: [],
    };
  }

  public async restore(
    id: string,
    options: { yes?: boolean; dryRun?: boolean } = {}
  ): Promise<CommandOutput<{ id: string; restored: boolean; worktree_path: string }>> {
    const { yes = false, dryRun = false } = options;
    const effectiveDryRun = dryRun || !yes;

    const record = await this.store.getWorktree(id);
    if (!record) {
      throw new MannostreeError(
        `Worktree '${id}' not found in metadata registry.`,
        ExitCode.USAGE_ERROR
      );
    }

    const branchExists = await this.git.branchOrRefExists(record.branch);
    if (!branchExists) {
      throw new MannostreeError(
        `Cannot restore worktree '${id}': branch '${record.branch}' does not exist in git.`,
        ExitCode.USAGE_ERROR
      );
    }

    const fullPath = path.resolve(this.repoRoot, record.worktree_path);
    if (fs.existsSync(fullPath)) {
      throw new MannostreeError(
        `Target directory '${record.worktree_path}' already exists on disk.`,
        ExitCode.USAGE_ERROR
      );
    }

    if (!effectiveDryRun) {
      await this.git.exec(['worktree', 'add', fullPath, record.branch]);
      record.status = 'created';
      record.lifecycle_state = 'WORKTREE_READY';
      record.updated_at = new Date().toISOString();
      await this.store.saveWorktree(record);
    }

    return {
      command: 'restore',
      ok: true,
      dry_run: effectiveDryRun,
      result: {
        id,
        restored: true,
        worktree_path: record.worktree_path,
      },
      warnings: !yes ? ['Preview only. Add --yes to restore worktree.'] : [],
      errors: [],
    };
  }

  public async parallelHandoff(
    feature: string,
    options: { to?: string; notes?: string; dryRun?: boolean } = {}
  ): Promise<CommandOutput<ParallelHandoffPackage>> {
    const handoffPkg = await this.parallelHandoffEngine.generateParallelHandoff(
      feature,
      options
    );
    return {
      command: 'parallel handoff',
      ok: true,
      dry_run: !!options.dryRun,
      result: handoffPkg,
      warnings: [],
      errors: [],
    };
  }

  public async agentDispatch(
    options: AgentDispatchOptions
  ): Promise<CommandOutput<{ sessions: AgentSessionRecord[] }>> {
    const { target, parallel = false, dryRun = false } = options;

    const sessions: AgentSessionRecord[] = [];

    // Check if target is experiment
    const experiment = await this.store.getExperiment(target);
    if (experiment && (parallel || options.parallel)) {
      for (const variantId of experiment.variants) {
        const session = await this.agentRunner.dispatchSession({
          ...options,
          target: variantId,
          dryRun,
        });
        sessions.push(session);
      }
    } else {
      const session = await this.agentRunner.dispatchSession(options);
      sessions.push(session);
    }

    return {
      command: 'agent dispatch',
      ok: true,
      dry_run: !!dryRun,
      result: { sessions },
      warnings: [],
      errors: [],
    };
  }

  public async agentStatus(
    options: AgentStatusOptions = {}
  ): Promise<CommandOutput<{ sessions: AgentSessionRecord[] }>> {
    const sessions = await this.agentRunner.getSessionStatus(options.target);
    return {
      command: 'agent status',
      ok: true,
      dry_run: false,
      result: { sessions },
      warnings: [],
      errors: [],
    };
  }

  public async agentVerify(
    options: AgentVerifyOptions
  ): Promise<
    CommandOutput<{
      report: FulfillmentVerificationReport;
      scorecard: ExecutionScorecard;
      scorecard_path: string;
    }>
  > {
    const { target, retries = 0, dryRun = false } = options;

    let record = await this.store.getWorktree(target);
    if (!record) {
      // Check if target matches variant in experiment
      const experiment = await this.store.getExperiment(target);
      if (experiment && experiment.variants.length > 0) {
        record = await this.store.getWorktree(experiment.variants[0]);
      }
    }

    if (!record) {
      throw new MannostreeError(
        `Worktree '${target}' not found in metadata registry.`,
        ExitCode.USAGE_ERROR
      );
    }

    const fullPath = path.resolve(this.repoRoot, record.worktree_path);
    const taskDir = path.join(fullPath, this.config.artifact_dir_name || '.task');
    const contractPath = path.join(taskDir, 'task-contract.md');

    if (!fs.existsSync(contractPath)) {
      throw new MannostreeError(
        `Task contract not found at ${contractPath}. Run 'mannostree agent dispatch' first.`,
        ExitCode.USAGE_ERROR
      );
    }

    const contract = parseTaskContractMarkdown(contractPath);

    // Build quality gates list from profile or default
    const profile = this.getProfile(record.profile);
    const gates: QualityGateCommand[] = (profile.validation_commands || []).map((cmd, idx) => ({
      name: `gate_${idx + 1}`,
      command: cmd,
      mandatory: true,
    }));

    // If no validation commands configured, default to passing gate
    const gateReport = await this.qualityGatesRunner.executeGates(fullPath, gates, { retries });
    const report = validateContractFulfillment(record.id, contract, gateReport);

    // Compute diff stats
    let filesChanged = 0;
    let insertions = 0;
    let deletions = 0;
    let changedFiles: string[] = [];

    try {
      const diffStat = await this.git.getDiffShortStat(record.worktree_path, record.base_branch);
      filesChanged = diffStat.files_changed;
      insertions = diffStat.insertions;
      deletions = diffStat.deletions;

      const diffFilesRaw = await this.git.exec(
        ['diff', '--name-only', `${record.base_branch}...HEAD`],
        fullPath
      );
      changedFiles = diffFilesRaw.stdout.split('\n').filter((l: string) => l.trim().length > 0);
    } catch {
      // ignore diff error if brand new branch
    }


    // Get active or latest session
    const sessions = await this.store.listSessions({ worktreeId: record.id });
    const latestSession = sessions[0];
    const durationSeconds = latestSession?.duration_seconds || 0;

    const scorecard = compileScorecard({
      worktreeId: record.id,
      feature: record.feature_name,
      sessionId: latestSession?.session_id || `session_manual_${Date.now()}`,
      agentRole: latestSession?.role || 'worker',
      durationSeconds,
      gitDiff: {
        files_changed: filesChanged,
        insertions,
        deletions,
        changed_files: changedFiles,
      },
      qualityGates: gateReport,
      contract,
    });

    const scorecardPath = path.join(taskDir, 'scorecard.md');

    if (!dryRun) {
      // Write scorecard markdown
      fs.writeFileSync(scorecardPath, generateScorecardMarkdown(scorecard), 'utf-8');

      // If rejected, write review.md diagnostics
      if (report.status === 'rejected') {
        const reviewPath = path.join(taskDir, 'review.md');
        const reviewContent = `# Verification Review: ${record.id}

**Status**: **REJECTED**  
**Verified At**: ${report.verified_at}  

## Unmet Acceptance Criteria
${report.unmet_criteria.map((c) => `- [ ] ${c.id}: ${c.description}`).join('\n') || '- None'}

## Quality Gate Failures
${
  gateReport.results
    .filter((r) => !r.passed)
    .map((r) => `### Gate: ${r.gate_name}\nCommand: \`${r.command}\`\nOutput:\n\`\`\`\n${r.stderr || r.stdout}\n\`\`\``)
    .join('\n\n') || '- None'
}

## Remediation Steps
${report.remediation_steps.map((s) => `1. ${s}`).join('\n')}
`;
        fs.writeFileSync(reviewPath, reviewContent, 'utf-8');
      }

      // Update worktree metadata
      record.lifecycle_state = report.status === 'fulfilled' ? 'VERIFIED' : 'BROKEN';
      record.status = report.status === 'fulfilled' ? 'validated' : 'fulfillment_rejected';
      record.updated_at = new Date().toISOString();
      await this.store.saveWorktree(record);

      // Update session if exists
      if (latestSession) {
        latestSession.state = report.status === 'fulfilled' ? 'fulfilled' : 'fulfillment_rejected';
        latestSession.scorecard_path = path.relative(this.repoRoot, scorecardPath);
        latestSession.ended_at = new Date().toISOString();
        await this.store.saveSession(latestSession);
      }
    }

    return {
      command: 'agent verify',
      ok: report.status === 'fulfilled',
      dry_run: dryRun,
      result: {
        report,
        scorecard,
        scorecard_path: path.relative(this.repoRoot, scorecardPath),
      },
      warnings: report.status === 'rejected' ? report.remediation_steps : [],
      errors: [],
    };
  }

  public async agentCancel(
    options: AgentCancelOptions
  ): Promise<CommandOutput<{ session: AgentSessionRecord | null; cancelled: boolean }>> {
    if (!options.target) {
      throw new MannostreeError(
        'Target worktree or session ID must be specified for agent cancel.',
        ExitCode.USAGE_ERROR
      );
    }
    const session = await this.agentRunner.cancelSession(options.target, options);
    return {
      command: 'agent cancel',
      ok: true,
      dry_run: false,
      result: {
        session,
        cancelled: !!session,
      },
      warnings: !session ? [`No active session found for target '${options.target}'.`] : [],
      errors: [],
    };
  }

  public async parallelEval(
    options: ParallelEvalOptions
  ): Promise<
    CommandOutput<{
      report: ExperimentMatrixReport;
      matrix_report_path: string;
      picked_winner: string | null;
    }>
  > {

    const { report, matrix_report_path, experiment } = await this.matrixEvaluator.evaluateExperiment(
      options.feature,
      options
    );

    let pickedWinner: string | null = null;
    if (options.autoPick && report.recommended_winner_id && !options.dryRun) {
      await this.parallelPick({
        feature: options.feature,
        winner: report.recommended_winner_id,
        reason: report.winning_justification,
        dryRun: false,
      });
      pickedWinner = report.recommended_winner_id;
    }


    return {
      command: 'parallel eval',
      ok: true,
      dry_run: !!options.dryRun,
      result: {
        report,
        matrix_report_path,
        picked_winner: pickedWinner,
      },
      warnings: [],
      errors: [],
    };
  }

  public async fleetSync(
    options: FleetSyncOptions = {}
  ): Promise<CommandOutput<FleetSyncReport>> {
    const report = await this.fleetEngine.syncFleet(options);
    return {
      command: 'fleet sync',
      ok: report.failed_count === 0,
      dry_run: !!report.dry_run,
      result: report,
      warnings:
        report.skipped_count > 0
          ? [`${report.skipped_count} worktree(s) skipped due to dirty state or active session.`]
          : [],
      errors:
        report.failed_count > 0
          ? [`${report.failed_count} worktree(s) encountered sync errors or conflicts.`]
          : [],
    };
  }

  public async fleetConflictMatrix(
    options: FleetConflictMatrixOptions = {}
  ): Promise<CommandOutput<FleetConflictMatrixReport>> {
    const report = await this.fleetEngine.computeConflictMatrix(options);
    const hasHazards = report.conflict_hazard_count > 0;
    const ok = !(options.failOnConflict && hasHazards);

    return {
      command: 'fleet conflict-matrix',
      ok,
      dry_run: !!options.dryRun,
      result: report,
      warnings: hasHazards
        ? [`${report.conflict_hazard_count} direct conflict hazard(s) detected across worktrees.`]
        : [],
      errors: !ok
        ? [
            `Failing due to --fail-on-conflict: ${report.conflict_hazard_count} conflict hazard(s) present.`,
          ]
        : [],
    };
  }

  public async fleetLeaseAcquire(
    worktreeId: string,
    options: FleetLeaseAcquireOptions = {}
  ): Promise<CommandOutput<WorkspaceLease>> {
    const lease = await this.fleetEngine.acquireLease(worktreeId, options);
    return {
      command: 'fleet lease acquire',
      ok: true,
      dry_run: false,
      result: lease,
      warnings: [],
      errors: [],
    };
  }

  public async fleetLeaseRelease(
    worktreeId: string,
    options: FleetLeaseReleaseOptions = {}
  ): Promise<CommandOutput<WorkspaceLease>> {
    const lease = await this.fleetEngine.releaseLease(worktreeId, options);
    return {
      command: 'fleet lease release',
      ok: true,
      dry_run: false,
      result: lease,
      warnings: [],
      errors: [],
    };
  }

  public async fleetLeaseRenew(
    worktreeId: string,
    options: FleetLeaseRenewOptions = {}
  ): Promise<CommandOutput<WorkspaceLease>> {
    const lease = await this.fleetEngine.renewLease(worktreeId, options);
    return {
      command: 'fleet lease renew',
      ok: true,
      dry_run: false,
      result: lease,
      warnings: [],
      errors: [],
    };
  }

  public async fleetLeaseList(
    options: { activeOnly?: boolean } = {}
  ): Promise<CommandOutput<WorkspaceLease[]>> {
    const leases = await this.fleetEngine.listLeases(options);
    return {
      command: 'fleet lease list',
      ok: true,
      dry_run: false,
      result: leases,
      warnings: [],
      errors: [],
    };
  }

  public async fleetTierSet(
    worktreeId: string,
    tier: FleetTier
  ): Promise<CommandOutput<WorktreeRecord>> {
    const record = await this.fleetEngine.setTier(worktreeId, tier);
    return {
      command: 'fleet tier set',
      ok: true,
      dry_run: false,
      result: record,
      warnings: [],
      errors: [],
    };
  }

  public async fleetTierPin(worktreeId: string): Promise<CommandOutput<WorktreeRecord>> {
    const record = await this.fleetEngine.pinWorktree(worktreeId);
    return {
      command: 'fleet tier pin',
      ok: true,
      dry_run: false,
      result: record,
      warnings: [],
      errors: [],
    };
  }

  public async fleetTierUnpin(worktreeId: string): Promise<CommandOutput<WorktreeRecord>> {
    const record = await this.fleetEngine.unpinWorktree(worktreeId);
    return {
      command: 'fleet tier unpin',
      ok: true,
      dry_run: false,
      result: record,
      warnings: [],
      errors: [],
    };
  }

  public async fleetTierList(): Promise<
    CommandOutput<
      Array<{
        id: string;
        branch: string;
        tier: FleetTier;
        pinned: boolean;
        status: string;
        path: string;
        last_accessed_at?: string;
      }>
    >
  > {
    const tiers = await this.fleetEngine.listTiers();
    return {
      command: 'fleet tier list',
      ok: true,
      dry_run: false,
      result: tiers,
      warnings: [],
      errors: [],
    };
  }

  public async fleetAutoArchive(
    options: FleetAutoArchiveOptions = {}
  ): Promise<CommandOutput<AutoArchiveReport>> {
    const report = await this.fleetEngine.autoArchive(options);
    return {
      command: 'fleet auto-archive',
      ok: true,
      dry_run: report.dry_run,
      result: report,
      warnings: report.skipped_count > 0 ? [`${report.skipped_count} worktree(s) skipped by policy guards.`] : [],
      errors: [],
    };
  }

  public async fleetCapacityStatus(): Promise<CommandOutput<FleetCapacityReport>> {
    const report = await this.fleetEngine.getFleetCapacityReport();
    return {
      command: 'fleet status',
      ok: true,
      dry_run: false,
      result: report,
      warnings:
        report.active_mounted_count > report.max_capacity
          ? [`Active mounted worktrees (${report.active_mounted_count}) exceed max capacity quota (${report.max_capacity}). Run auto-archive to reclaim capacity.`]
          : [],
      errors: [],
    };
  }

  public async parallelPublish(
    options: ParallelPublishOptions
  ): Promise<CommandOutput<ParallelPublishResult>> {
    const result = await this.parallelEngine.publishWinner(options, this.publishEngine);
    return {
      command: 'parallel publish',
      ok: true,
      dry_run: !!options.dryRun || !!options.preview,
      result,
      warnings: !result.pushed
        ? [`PR prepared in preview/prepare-only mode (${result.pr_body_file}). Supply --push to push to remote.`]
        : [],
      errors: [],
    };
  }

  public async fleetMergeSync(
    options: FleetMergeSyncOptions
  ): Promise<CommandOutput<FleetMergeSyncReport>> {
    const report = await this.fleetEngine.mergeSync(options);
    return {
      command: 'fleet merge-sync',
      ok: report.conflict_count === 0 || !!options.ignoreConflicts,
      dry_run: report.dry_run,
      result: report,
      warnings:
        report.conflict_count > 0
          ? [`${report.conflict_count} candidate branch(es) have merge conflicts with target '${options.target}'.`]
          : [],
      errors: [],
    };
  }

  public async fleetBatchPublish(
    options: FleetBatchPublishOptions = {}
  ): Promise<CommandOutput<FleetBatchPublishReport>> {
    const report = await this.publishEngine.batchPublish(options, this.store, this.fleetEngine);
    return {
      command: 'fleet publish',
      ok: report.failed_count === 0,
      dry_run: !!options.dryRun || !!options.preview,
      result: report,
      warnings: report.skipped_count > 0 ? [`${report.skipped_count} worktree(s) skipped.`] : [],
      errors: [],
    };
  }
}








