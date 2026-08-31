import path from 'node:path';
import fs from 'node:fs';
import { MannostreeConfig } from '../config/schema.js';
import { GitEngine } from '../git/engine.js';
import { MetadataStore } from '../metadata/store.js';
import { resolveBaseBranch } from '../git/base-resolver.js';
import { scaffoldArtifacts } from '../artifact/scaffold.js';
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

export class MannostreeOrchestrator {
  public git: GitEngine;
  public store: MetadataStore;

  constructor(
    public repoRoot: string,
    public config: MannostreeConfig
  ) {
    this.git = new GitEngine(repoRoot);
    this.store = new MetadataStore(repoRoot, config);
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
      status: 'created',
      lifecycle_state: 'CONTEXT_PACKED' as LifecycleState,
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
        install_ran: !noSetup,
        install_succeeded: !noSetup,
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
        health_status: 'ok',
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
    const gitState = await this.git.getGitState(record.worktree_path);

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
