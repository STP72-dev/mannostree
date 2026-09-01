import fs from 'node:fs';
import path from 'node:path';
import { MannostreeConfig, ProfileConfig } from '../config/schema.js';
import { GitEngine } from '../git/engine.js';
import { MetadataStore } from '../metadata/store.js';
import { resolveBaseBranch } from '../git/base-resolver.js';
import { PublishEngine } from './publish.js';
import {
  ExitCode,
  ExperimentRecord,
  MannostreeError,
  WorktreeRecord,
  ParallelPublishOptions,
  ParallelPublishResult,
} from '../types/index.js';

export interface ParallelSpawnOptions {
  feature: string;
  count: number;
  baseBranch?: string;
  profile?: string;
  planMode?: 'shared' | 'isolated';
  dryRun?: boolean;
}

export interface VariantComparisonEntry {
  id: string;
  variant: string;
  branch: string;
  worktree_path: string;
  ahead_count: number;
  behind_count: number;
  files_changed: number;
  lines_added: number;
  lines_removed: number;
  validation_status: string;
  review_status: string;
  lifecycle_state: string;
  is_winner: boolean;
}

export interface ParallelComparisonReport {
  feature: string;
  base_branch: string;
  created_at: string;
  winner?: string | null;
  selected_at?: string | null;
  variants: VariantComparisonEntry[];
}

export interface ParallelPickOptions {
  feature: string;
  winner: string;
  cleanupLosers?: boolean;
  archiveLosers?: boolean;
  reason?: string;
  yes?: boolean;
  dryRun?: boolean;
}

export interface ParallelPickResult {
  feature: string;
  winner: string;
  cleaned_losers: string[];
  experiment: ExperimentRecord;
}

export interface ParallelDropOptions {
  feature: string;
  force?: boolean;
  keepBranch?: boolean;
  archive?: boolean;
  yes?: boolean;
  dryRun?: boolean;
}

export interface ParallelDropResult {
  feature: string;
  dropped_variants: string[];
  surviving_variants: string[];
  failed_variants: Array<{ id: string; error: string }>;
  winner_protected?: string | null;
  experiment_deleted: boolean;
  experiment: ExperimentRecord | null;
}

export class ParallelEngine {
  constructor(
    public repoRoot: string,
    public config: MannostreeConfig,
    public git: GitEngine,
    public store: MetadataStore,
    public spawnWorktreeFn: (opts: any) => Promise<any>,
    public dropWorktreeFn: (id: string, opts: any) => Promise<any>
  ) {}

  public async spawnVariants(
    options: ParallelSpawnOptions
  ): Promise<{
    feature: string;
    base_branch: string;
    variants: WorktreeRecord[];
    experiment: ExperimentRecord;
  }> {
    const {
      feature,
      count,
      baseBranch: explicitBase,
      profile = 'default',
      planMode = 'shared',
      dryRun = false,
    } = options;

    if (!feature || feature.trim().length === 0) {
      throw new MannostreeError(
        'A valid feature name is required for parallel spawn.',
        ExitCode.USAGE_ERROR
      );
    }

    const sanitizedFeature = feature.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/\/+/g, '-');
    const maxVariants = this.config.parallel?.max_variants || 5;

    if (count < 1 || count > maxVariants) {
      throw new MannostreeError(
        `Variant count ${count} is out of bounds (1..${maxVariants}).`,
        ExitCode.USAGE_ERROR
      );
    }

    // Check if experiment already exists
    const existingExperiment = await this.store.getExperiment(sanitizedFeature);
    if (existingExperiment) {
      throw new MannostreeError(
        `Experiment '${sanitizedFeature}' already exists in registry.`,
        ExitCode.USAGE_ERROR
      );
    }

    // Resolve explicit base branch once for all variants
    const resolvedBase = await resolveBaseBranch({
      cliBaseBranch: explicitBase,
      profileName: profile,
      config: this.config,
      gitEngine: this.git,
    });

    const variantRecords: WorktreeRecord[] = [];
    const variantIds: string[] = [];
    const now = new Date().toISOString();

    for (let i = 1; i <= count; i++) {
      const variantName = `${sanitizedFeature}-v${i}`;
      const spawnRes = await this.spawnWorktreeFn({
        name: variantName,
        baseBranch: resolvedBase,
        kind: 'experiment',
        profile,
        dryRun,
      });

      const record: WorktreeRecord = spawnRes.result;
      record.variant = `v${i}`;
      record.parallel = {
        experiment_name: sanitizedFeature,
        winner: false,
        selected: false,
      };

      if (!dryRun) {
        await this.store.saveWorktree(record);
      }

      variantRecords.push(record);
      variantIds.push(record.id);
    }

    const experimentRecord: ExperimentRecord = {
      version: 1,
      feature: sanitizedFeature,
      base_branch: resolvedBase,
      profile,
      created_at: now,
      updated_at: now,
      variants: variantIds,
      winner: null,
      selected_at: null,
      selection_reason: null,
      status: 'active',
      plan_mode: planMode,
    };

    if (!dryRun) {
      await this.store.saveExperiment(experimentRecord);
    }

    return {
      feature: sanitizedFeature,
      base_branch: resolvedBase,
      variants: variantRecords,
      experiment: experimentRecord,
    };
  }

  public async compareVariants(feature: string): Promise<ParallelComparisonReport> {
    const sanitizedFeature = feature.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/\/+/g, '-');
    const experiment = await this.store.getExperiment(sanitizedFeature);

    if (!experiment) {
      throw new MannostreeError(
        `Experiment '${sanitizedFeature}' not found in metadata store.`,
        ExitCode.USAGE_ERROR
      );
    }

    const entries: VariantComparisonEntry[] = [];

    for (const id of experiment.variants) {
      const record = await this.store.getWorktree(id);
      if (!record) {
        continue;
      }

      const ab = await this.git.getAheadBehindCount(
        record.worktree_path,
        record.base_branch,
        record.branch
      );
      const diffStat = await this.git.getDiffShortStat(
        record.worktree_path,
        record.base_branch,
        record.branch
      );

      entries.push({
        id: record.id,
        variant: record.variant || record.id,
        branch: record.branch,
        worktree_path: record.worktree_path,
        ahead_count: ab.ahead,
        behind_count: ab.behind,
        files_changed: diffStat.files_changed,
        lines_added: diffStat.insertions,
        lines_removed: diffStat.deletions,
        validation_status: record.validation?.status || (record.setup?.install_succeeded ? 'passed' : 'pending'),
        review_status: record.review?.status || 'pending',
        lifecycle_state: record.lifecycle_state,
        is_winner: !!record.parallel?.winner,
      });
    }

    return {
      feature: experiment.feature,
      base_branch: experiment.base_branch,
      created_at: experiment.created_at,
      winner: experiment.winner,
      selected_at: experiment.selected_at,
      variants: entries,
    };
  }

  public async pickWinner(options: ParallelPickOptions): Promise<ParallelPickResult> {
    const {
      feature,
      winner,
      cleanupLosers = false,
      archiveLosers = false,
      reason,
      yes = false,
      dryRun = false,
    } = options;

    const sanitizedFeature = feature.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/\/+/g, '-');
    const experiment = await this.store.getExperiment(sanitizedFeature);

    if (!experiment) {
      throw new MannostreeError(
        `Experiment '${sanitizedFeature}' not found in metadata store.`,
        ExitCode.USAGE_ERROR
      );
    }

    // Resolve winner ID (full id or short index like v1 or 1)
    let winnerId: string | undefined;
    for (const vId of experiment.variants) {
      if (
        vId === winner ||
        vId === `experiment-${sanitizedFeature}-${winner}` ||
        vId === `experiment-${sanitizedFeature}-v${winner}` ||
        vId.endsWith(`-${winner}`)
      ) {
        winnerId = vId;
        break;
      }
    }

    if (!winnerId) {
      throw new MannostreeError(
        `Specified winner '${winner}' does not match any variant in experiment '${sanitizedFeature}'. Available: ${experiment.variants.join(', ')}`,
        ExitCode.USAGE_ERROR
      );
    }

    const winnerRecord = await this.store.getWorktree(winnerId);
    if (!winnerRecord) {
      throw new MannostreeError(
        `Worktree record for winner '${winnerId}' not found.`,
        ExitCode.USAGE_ERROR
      );
    }

    const now = new Date().toISOString();
    const cleanedLosers: string[] = [];

    if (!dryRun) {
      // 1. Update winning worktree record
      winnerRecord.parallel = {
        ...(winnerRecord.parallel || { experiment_name: sanitizedFeature }),
        winner: true,
        selected: true,
      };
      winnerRecord.updated_at = now;
      await this.store.saveWorktree(winnerRecord);

      // 2. Update experiment record
      experiment.winner = winnerId;
      experiment.selected_at = now;
      experiment.selection_reason = reason || 'Explicitly selected by user';
      experiment.status = 'completed';
      experiment.updated_at = now;
      await this.store.saveExperiment(experiment);

      // 3. Cleanup losers if explicitly instructed with confirmation
      if (cleanupLosers && yes) {
        for (const vId of experiment.variants) {
          if (vId !== winnerId) {
            try {
              await this.dropWorktreeFn(vId, {
                archive: archiveLosers,
                force: true,
                dryRun: false,
              });
              cleanedLosers.push(vId);
            } catch {
              // ignore drop failure on single loser
            }
          }
        }
      }
    }

    return {
      feature: sanitizedFeature,
      winner: winnerId,
      cleaned_losers: cleanedLosers,
      experiment,
    };
  }

  public async listExperiments(status?: string): Promise<ExperimentRecord[]> {
    const experiments = await this.store.listExperiments();
    if (status) {
      return experiments.filter((e) => e.status === status);
    }
    return experiments;
  }

  public async dropExperiment(options: ParallelDropOptions): Promise<ParallelDropResult> {
    const {
      feature,
      force = false,
      keepBranch = false,
      archive = false,
      yes = false,
      dryRun = false,
    } = options;

    const sanitizedFeature = feature.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/\/+/g, '-');
    const experiment = await this.store.getExperiment(sanitizedFeature);

    if (!experiment) {
      throw new MannostreeError(
        `Experiment '${sanitizedFeature}' not found in metadata store.`,
        ExitCode.USAGE_ERROR
      );
    }

    const protectWinner = this.config.cleanup?.protect_winner !== false;
    let winnerProtected: string | null = null;
    let candidateVariants = [...experiment.variants];

    if (protectWinner && !force && experiment.winner) {
      if (candidateVariants.includes(experiment.winner)) {
        winnerProtected = experiment.winner;
        candidateVariants = candidateVariants.filter((vId) => vId !== experiment.winner);
      }
    }

    if (!yes || dryRun) {
      return {
        feature: sanitizedFeature,
        dropped_variants: candidateVariants,
        surviving_variants: winnerProtected ? [winnerProtected] : [],
        failed_variants: [],
        winner_protected: winnerProtected,
        experiment_deleted: false,
        experiment,
      };
    }

    const droppedVariants: string[] = [];
    const failedVariants: Array<{ id: string; error: string }> = [];
    const survivingVariants: string[] = [];

    if (winnerProtected) {
      survivingVariants.push(winnerProtected);
    }

    for (const vId of candidateVariants) {
      try {
        await this.dropWorktreeFn(vId, {
          force,
          keepBranch,
          archive,
          dryRun: false,
        });
        droppedVariants.push(vId);
      } catch (err: any) {
        failedVariants.push({
          id: vId,
          error: err.message || 'Failed to drop variant worktree',
        });
        survivingVariants.push(vId);
      }
    }

    if (survivingVariants.length === 0) {
      await this.store.deleteExperiment(sanitizedFeature);
      return {
        feature: sanitizedFeature,
        dropped_variants: droppedVariants,
        surviving_variants: [],
        failed_variants: [],
        winner_protected: null,
        experiment_deleted: true,
        experiment: null,
      };
    } else {
      experiment.variants = survivingVariants;
      experiment.updated_at = new Date().toISOString();
      await this.store.saveExperiment(experiment);
      return {
        feature: sanitizedFeature,
        dropped_variants: droppedVariants,
        surviving_variants: survivingVariants,
        failed_variants: failedVariants,
        winner_protected: winnerProtected,
        experiment_deleted: false,
        experiment,
      };
    }
  }

  public async publishWinner(
    options: ParallelPublishOptions,
    publishEngine: PublishEngine
  ): Promise<ParallelPublishResult> {
    const {
      featureName,
      title,
      draft = this.config.publish?.default_draft ?? true,
      push = false,
      targetBase,
      preview = false,
      dryRun = false,
      force = false,
      exportPrBody,
    } = options;

    if (!featureName || featureName.trim().length === 0) {
      throw new MannostreeError(
        'A valid feature name is required for parallel publish.',
        ExitCode.USAGE_ERROR
      );
    }

    const sanitizedFeature = featureName.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/\/+/g, '-');
    const experiment = await this.store.getExperiment(sanitizedFeature);

    if (!experiment) {
      throw new MannostreeError(
        `Experiment '${sanitizedFeature}' not found in metadata store.`,
        ExitCode.USAGE_ERROR
      );
    }

    if (!experiment.winner) {
      throw new MannostreeError(
        `No winning variant has been selected for experiment '${sanitizedFeature}'. Run 'parallel pick' or 'parallel eval --auto-pick' first.`,
        ExitCode.USAGE_ERROR
      );
    }

    const winnerRecord = await this.store.getWorktree(experiment.winner);
    if (!winnerRecord) {
      throw new MannostreeError(
        `Worktree record for winner '${experiment.winner}' not found.`,
        ExitCode.USAGE_ERROR
      );
    }

    // Load all variant records
    const allVariants: WorktreeRecord[] = [];
    for (const vId of experiment.variants) {
      const vRec = await this.store.getWorktree(vId);
      if (vRec) {
        allVariants.push(vRec);
      }
    }

    // Validation / Quality gate guard
    const validationPassed = winnerRecord.validation?.status !== 'failed';
    if (!validationPassed && !force) {
      throw new MannostreeError(
        `Validation failed for winning variant '${winnerRecord.id}'. Use --force to publish anyway.`,
        ExitCode.VALIDATION_FAILURE
      );
    }

    const baseBranch = targetBase || winnerRecord.base_branch || experiment.base_branch || 'main';
    const prTitle =
      title ||
      `feat(${experiment.feature}): implement ${experiment.feature} (${winnerRecord.variant || winnerRecord.id} winner)`;

    const prBody = publishEngine.assembleParallelPrBody(
      experiment,
      winnerRecord,
      allVariants,
      experiment.eval_matrix
    );

    const relBodyPath = path.join(this.config.artifact_dir_name, 'pr-body.md');
    const fullBodyPath = path.join(winnerRecord.worktree_path, relBodyPath);

    if (!dryRun) {
      if (!preview && fs.existsSync(winnerRecord.worktree_path)) {
        const artifactDir = path.dirname(fullBodyPath);
        if (!fs.existsSync(artifactDir)) {
          fs.mkdirSync(artifactDir, { recursive: true });
        }
        fs.writeFileSync(fullBodyPath, prBody, 'utf-8');
      }

      if (exportPrBody) {
        const customExportPath = path.resolve(this.repoRoot, exportPrBody);
        const exportDir = path.dirname(customExportPath);
        if (!fs.existsSync(exportDir)) {
          fs.mkdirSync(exportDir, { recursive: true });
        }
        fs.writeFileSync(customExportPath, prBody, 'utf-8');
      }
    }

    const now = new Date().toISOString();

    if (preview || dryRun || !push) {
      return {
        feature_name: sanitizedFeature,
        winner_variant: winnerRecord.id,
        branch: winnerRecord.branch,
        base_branch: baseBranch,
        pushed: false,
        pr_number: null,
        pr_url: null,
        pr_body_file: relBodyPath,
        pr_title: prTitle,
        pr_body: prBody,
        published_at: now,
        comparison_embedded: !!(experiment.eval_matrix && experiment.eval_matrix.variants.length > 0),
        quality_gates_passed: validationPassed,
        evaluated_variants: experiment.variants,
      };
    }

    // Remote push requested
    let prUrl: string | null = null;
    let prNumber: number | null = null;
    const remote = this.config.publish?.default_remote || 'origin';

    if (fs.existsSync(winnerRecord.worktree_path)) {
      await this.git.exec(['push', '-u', remote, winnerRecord.branch], winnerRecord.worktree_path);

      try {
        const ghArgs = [
          'pr',
          'create',
          '--head',
          winnerRecord.branch,
          '--base',
          baseBranch,
          '--title',
          prTitle,
          '--body-file',
          fullBodyPath,
        ];
        if (draft) {
          ghArgs.push('--draft');
        }

        const ghRes = await publishEngine.ghExecutor(ghArgs, winnerRecord.worktree_path);
        prUrl = ghRes.stdout.trim();
        const numMatch = prUrl.match(/\/pull\/(\d+)/);
        if (numMatch) {
          prNumber = parseInt(numMatch[1], 10);
        }
      } catch {
        // gh CLI fallback
      }
    }

    winnerRecord.publish = {
      pushed: true,
      published_at: now,
      pr_url: prUrl,
      pr_number: prNumber,
    };
    winnerRecord.updated_at = now;
    await this.store.saveWorktree(winnerRecord);

    experiment.status = 'completed';
    experiment.updated_at = now;
    await this.store.saveExperiment(experiment);

    return {
      feature_name: sanitizedFeature,
      winner_variant: winnerRecord.id,
      branch: winnerRecord.branch,
      base_branch: baseBranch,
      pushed: true,
      pr_number: prNumber,
      pr_url: prUrl,
      pr_body_file: relBodyPath,
      pr_title: prTitle,
      pr_body: prBody,
      published_at: now,
      comparison_embedded: !!(experiment.eval_matrix && experiment.eval_matrix.variants.length > 0),
      quality_gates_passed: validationPassed,
      evaluated_variants: experiment.variants,
    };
  }
}

