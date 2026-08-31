import path from 'node:path';
import { MannostreeConfig, ProfileConfig } from '../config/schema.js';
import { GitEngine } from '../git/engine.js';
import { MetadataStore } from '../metadata/store.js';
import { resolveBaseBranch } from '../git/base-resolver.js';
import {
  ExitCode,
  ExperimentRecord,
  MannostreeError,
  WorktreeRecord,
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
}
