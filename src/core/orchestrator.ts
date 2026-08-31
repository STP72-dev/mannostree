import path from 'node:path';
import fs from 'node:fs';
import { MannostreeConfig, ProfileConfig } from '../config/schema.js';
import { GitEngine } from '../git/engine.js';
import { MetadataStore } from '../metadata/store.js';
import { resolveBaseBranch } from '../git/base-resolver.js';
import { scaffoldArtifacts } from '../artifact/scaffold.js';
import { DoctorEngine, DoctorReport, ProposedRepair } from './doctor.js';
import { SetupEngine, SetupApplyResult, EnvApplyResult } from './setup.js';
import {
  CommandOutput,
  ExitCode,
  HealthMetadata,
  LifecycleState,
  MannostreeError,
  WorktreeRecord,
} from '../types/index.js';

export interface SpawnOptions {
  name: string;
  baseBranch?: string;
  kind?: string;
  profile?: string;
  noSetup?: boolean;
  env?: 'copy' | 'link' | 'skip' | 'generate';
  dryRun?: boolean;
}

export interface ListOptions {
  state?: string;
  kind?: string;
  tag?: string;
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

export interface SyncOptions {
  strategy?: 'rebase' | 'merge' | 'ff-only';
  fetch?: boolean;
  dryRun?: boolean;
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

export interface RecoverOptions {
  rebuildMetadata?: boolean;
  reattachWorktree?: boolean;
  reattachBranch?: boolean;
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
  inheritStdio?: boolean;
}

export class MannostreeOrchestrator {
  public git: GitEngine;
  public store: MetadataStore;
  public doctorEngine: DoctorEngine;
  public setupEngine: SetupEngine;

  constructor(
    public repoRoot: string,
    public config: MannostreeConfig
  ) {
    this.git = new GitEngine(repoRoot);
    this.store = new MetadataStore(repoRoot, config);
    this.doctorEngine = new DoctorEngine(repoRoot, config, this.git, this.store);
    this.setupEngine = new SetupEngine(repoRoot);
  }

  public getProfile(name: string = 'default'): ProfileConfig {
    return (
      this.config.profiles[name] ||
      this.config.profiles.default || {
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
    commandArgs: string[],
    options: ExecOptions = {}
  ): Promise<{ exitCode: number; stdout?: string; stderr?: string }> {
    const record = await this.store.getWorktree(id);
    if (!record) {
      throw new MannostreeError(
        `Worktree '${id}' not found in metadata registry.`,
        ExitCode.USAGE_ERROR
      );
    }

    const profile = this.getProfile(record.profile);
    const fullPath = path.resolve(this.repoRoot, record.worktree_path);

    return this.setupEngine.execInWorktree(fullPath, commandArgs, profile, options);
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
    id: string,
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
      yes = false,
      dryRun = false,
    } = options;

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

    const effectiveDryRun = dryRun || !yes;

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
}
