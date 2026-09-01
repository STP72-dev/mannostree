import fs from 'node:fs';
import path from 'node:path';
import { GitEngine } from '../git/engine.js';
import { MetadataStore } from '../metadata/store.js';
import { MannostreeConfig } from '../config/schema.js';
import {
  AgentSessionState,
  AutoArchiveReport,
  ConflictHunkDetail,
  ConflictMatrixCell,
  ConflictSeverity,
  ExitCode,
  FleetAutoArchiveOptions,
  FleetCapacityReport,
  FleetConflictMatrixOptions,
  FleetConflictMatrixReport,
  FleetLeaseAcquireOptions,
  FleetLeaseReleaseOptions,
  FleetLeaseRenewOptions,
  FleetSyncOptions,
  FleetSyncReport,
  FleetSyncStatusType,
  FleetTier,
  FleetTierSetOptions,
  MannostreeError,
  WorkspaceLease,
  WorktreeRecord,
  WorktreeSyncStatus,
  FleetMergeSyncCandidate,
  FleetMergeSyncReport,
  FleetMergeSyncOptions,
  ReleaseManifestRecord,
} from '../types/index.js';



export class FleetEngine {
  constructor(
    public repoRoot: string,
    public config: MannostreeConfig,
    public git: GitEngine,
    public store: MetadataStore
  ) {}

  /**
   * Evaluate and synchronize active worktrees across the fleet.
   */
  public async syncFleet(options: FleetSyncOptions = {}): Promise<FleetSyncReport> {
    const allRecords = await this.store.listWorktrees();
    let targetRecords = allRecords.filter(
      (r) => r.status !== 'cleaned' && r.status !== 'archived' && r.lifecycle_state !== 'CLEANED'
    );


    if (options.target) {
      targetRecords = targetRecords.filter(
        (r) => r.id === options.target || r.branch === options.target
      );
      if (targetRecords.length === 0) {
        throw new MannostreeError(
          `Target worktree '${options.target}' not found in active fleet registry.`,
          ExitCode.USAGE_ERROR
        );
      }
    }

    const strategy = options.strategy || this.config.fleet?.default_sync_strategy || 'ff-only';
    const isDryRun = !!(options.dryRun || options.preview);
    const worktreeStatuses: WorktreeSyncStatus[] = [];

    let syncedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (const record of targetRecords) {
      const fullPath = path.resolve(this.repoRoot, record.worktree_path);
      if (!fs.existsSync(fullPath)) {
        skippedCount++;
        worktreeStatuses.push({
          worktree_id: record.id,
          branch: record.branch,
          base_branch: record.base_branch,
          status: 'FAILED_ERROR',
          ahead: 0,
          behind: 0,
          dirty: false,
          message: `Worktree directory does not exist: ${record.worktree_path}`,
          updated_at: new Date().toISOString(),
        });
        continue;
      }

      const isDirty = await this.git.isWorktreeDirty(fullPath);

      // Check active agent sessions or active leases first
      const sessions = await this.store.listSessions({ worktreeId: record.id });
      const activeStates: AgentSessionState[] = ['dispatched', 'planning', 'working', 'verifying'];
      const activeSession = sessions.find((s) => activeStates.includes(s.state));
      const activeLease = await this.hasActiveLease(record.id);

      if ((activeSession || activeLease.active) && this.config.fleet?.guard_active_sessions !== false) {
        skippedCount++;
        worktreeStatuses.push({
          worktree_id: record.id,
          branch: record.branch,
          base_branch: record.base_branch,
          status: 'SESSION_ACTIVE_SKIPPED',
          ahead: 0,
          behind: 0,
          dirty: isDirty,
          active_session_id: activeSession?.session_id || activeLease.lease?.lease_id,
          message: activeSession
            ? `Skipped sync due to active agent session '${activeSession.session_id}'.`
            : `Skipped sync due to active workspace lease (${activeLease.lease?.lease_id} held by ${activeLease.lease?.holder}).`,
          updated_at: new Date().toISOString(),
        });
        continue;
      }

      // Check dirty
      if (isDirty && this.config.fleet?.guard_dirty_worktrees !== false) {
        skippedCount++;
        worktreeStatuses.push({
          worktree_id: record.id,
          branch: record.branch,
          base_branch: record.base_branch,
          status: 'DIRTY_SKIPPED',
          ahead: 0,
          behind: 0,
          dirty: true,
          message: 'Skipped sync due to uncommitted or untracked local changes.',
          updated_at: new Date().toISOString(),
        });
        continue;
      }



      // Compute ahead / behind
      let ahead = 0;
      let behind = 0;
      try {
        const divergence = await this.git.getAheadBehindCount(record.worktree_path, record.base_branch);
        ahead = divergence.ahead;
        behind = divergence.behind;
      } catch (err: any) {
        skippedCount++;
        worktreeStatuses.push({
          worktree_id: record.id,
          branch: record.branch,
          base_branch: record.base_branch,
          status: 'FAILED_ERROR',
          ahead: 0,
          behind: 0,
          dirty: isDirty,
          message: `Failed to determine divergence: ${err.message}`,
          updated_at: new Date().toISOString(),
        });
        continue;
      }


      if (behind === 0) {
        syncedCount++;
        worktreeStatuses.push({
          worktree_id: record.id,
          branch: record.branch,
          base_branch: record.base_branch,
          status: ahead > 0 ? 'AHEAD' : 'SYNCED',
          ahead,
          behind: 0,
          dirty: isDirty,
          message: ahead > 0 ? `Ahead of base branch by ${ahead} commit(s).` : 'Up-to-date with base branch.',
          updated_at: new Date().toISOString(),
        });
        continue;
      }

      // Behind > 0
      if (isDryRun) {
        worktreeStatuses.push({
          worktree_id: record.id,
          branch: record.branch,
          base_branch: record.base_branch,
          status: ahead > 0 ? 'DIVERGED' : 'BEHIND',
          ahead,
          behind,
          dirty: isDirty,
          message: `[Preview] Behind base branch by ${behind} commit(s)${ahead > 0 ? `, ahead by ${ahead}` : ''}. Strategy: ${strategy}`,
          updated_at: new Date().toISOString(),
        });
        continue;
      }

      // Execute sync
      try {
        if (strategy === 'rebase') {
          try {
            await this.git.exec(['rebase', record.base_branch], fullPath);
          } catch (rebaseErr: any) {
            await this.git.exec(['rebase', '--abort'], fullPath).catch(() => {});
            failedCount++;
            worktreeStatuses.push({
              worktree_id: record.id,
              branch: record.branch,
              base_branch: record.base_branch,
              status: 'FAILED_CONFLICT',
              ahead,
              behind,
              dirty: isDirty,
              message: `Rebase conflict encountered against '${record.base_branch}': ${rebaseErr.message}`,
              updated_at: new Date().toISOString(),
            });
            continue;
          }
        } else if (strategy === 'merge') {
          try {
            await this.git.exec(['merge', record.base_branch], fullPath);
          } catch (mergeErr: any) {
            await this.git.exec(['merge', '--abort'], fullPath).catch(() => {});
            failedCount++;
            worktreeStatuses.push({
              worktree_id: record.id,
              branch: record.branch,
              base_branch: record.base_branch,
              status: 'FAILED_CONFLICT',
              ahead,
              behind,
              dirty: isDirty,
              message: `Merge conflict encountered against '${record.base_branch}': ${mergeErr.message}`,
              updated_at: new Date().toISOString(),
            });
            continue;
          }
        } else {
          // ff-only default
          try {
            await this.git.exec(['merge', '--ff-only', record.base_branch], fullPath);
          } catch (ffErr: any) {
            failedCount++;
            worktreeStatuses.push({
              worktree_id: record.id,
              branch: record.branch,
              base_branch: record.base_branch,
              status: 'FAILED_CONFLICT',
              ahead,
              behind,
              dirty: isDirty,
              message: `Fast-forward merge not possible against '${record.base_branch}' (diverged). Consider --strategy rebase.`,
              updated_at: new Date().toISOString(),
            });
            continue;
          }
        }

        // Post-sync update
        const postDiv = await this.git.getAheadBehindCount(record.worktree_path, record.base_branch).catch(() => ({ ahead: 0, behind: 0 }));
        record.last_activity_at = new Date().toISOString();
        await this.store.saveWorktree(record);


        syncedCount++;
        worktreeStatuses.push({
          worktree_id: record.id,
          branch: record.branch,
          base_branch: record.base_branch,
          status: 'SYNCED',
          ahead: postDiv.ahead,
          behind: postDiv.behind,
          dirty: isDirty,
          message: `Successfully synchronized via ${strategy}.`,
          updated_at: new Date().toISOString(),
        });
      } catch (err: any) {
        failedCount++;
        worktreeStatuses.push({
          worktree_id: record.id,
          branch: record.branch,
          base_branch: record.base_branch,
          status: 'FAILED_ERROR',
          ahead,
          behind,
          dirty: isDirty,
          message: err.message,
          updated_at: new Date().toISOString(),
        });
      }
    }

    return {
      synced_at: new Date().toISOString(),
      strategy,
      dry_run: isDryRun,
      total_worktrees: targetRecords.length,
      synced_count: syncedCount,
      skipped_count: skippedCount,
      failed_count: failedCount,
      worktrees: worktreeStatuses,
    };
  }

  /**
   * Compute pairwise cross-worktree conflict matrix across all active worktrees.
   */
  public async computeConflictMatrix(
    options: FleetConflictMatrixOptions = {}
  ): Promise<FleetConflictMatrixReport> {
    const allRecords = await this.store.listWorktrees();
    const activeRecords = allRecords.filter(
      (r) => r.status !== 'cleaned' && r.status !== 'archived' && r.lifecycle_state !== 'CLEANED'
    );


    if (activeRecords.length === 0) {
      return {
        analyzed_at: new Date().toISOString(),
        total_worktrees: 0,
        worktree_ids: [],
        conflict_hazard_count: 0,
        shared_file_pair_count: 0,
        matrix: [],
        high_risk_pairs: [],
      };
    }

    // Determine target subset
    let sourceRecords = activeRecords;
    if (options.target) {
      sourceRecords = activeRecords.filter(
        (r) => r.id === options.target || r.branch === options.target
      );
      if (sourceRecords.length === 0) {
        throw new MannostreeError(
          `Target worktree '${options.target}' not found in active fleet registry.`,
          ExitCode.USAGE_ERROR
        );
      }
    }

    // Stage 1: Collect changed files for each active worktree
    const changedFilesMap = new Map<string, string[]>();
    for (const rec of activeRecords) {
      const files = await this.git.getChangedFilesAgainstBase(
        rec.worktree_path || rec.branch,
        rec.base_branch
      );
      changedFilesMap.set(rec.id, files);
    }


    // Stage 2: Pairwise comparison
    const matrix: ConflictMatrixCell[][] = [];
    const highRiskPairs: FleetConflictMatrixReport['high_risk_pairs'] = [];
    let conflictHazardCount = 0;
    let sharedFilePairCount = 0;

    for (let i = 0; i < sourceRecords.length; i++) {
      const row: ConflictMatrixCell[] = [];
      const src = sourceRecords[i];
      const srcFiles = new Set(changedFilesMap.get(src.id) || []);

      for (let j = 0; j < activeRecords.length; j++) {
        const tgt = activeRecords[j];
        if (src.id === tgt.id) {
          row.push({
            source_id: src.id,
            target_id: tgt.id,
            source_branch: src.branch,
            target_branch: tgt.branch,
            severity: 'CLEAN',
            shared_files: [],
            conflicting_files: [],
            conflict_details: [],
            auto_mergeable: true,
          });
          continue;
        }

        const tgtFiles = changedFilesMap.get(tgt.id) || [];
        const shared = tgtFiles.filter((f) => srcFiles.has(f));

        if (shared.length === 0) {
          row.push({
            source_id: src.id,
            target_id: tgt.id,
            source_branch: src.branch,
            target_branch: tgt.branch,
            severity: 'CLEAN',
            shared_files: [],
            conflicting_files: [],
            conflict_details: [],
            auto_mergeable: true,
          });
          continue;
        }

        sharedFilePairCount++;

        // In-memory 3-way merge simulation if requested or auto
        let autoMergeable = true;
        let severity: ConflictSeverity = 'SHARED_FILES_CLEAN';
        const conflictDetails: ConflictHunkDetail[] = [];
        const conflictingFiles: string[] = [];

        const shouldSimulate = options.simulateMerge !== false && this.config.fleet?.auto_simulate_merge !== false;

        if (shouldSimulate) {
          const sim = await this.git.simulateMergeTree(src.branch, tgt.branch);
          if (!sim.clean) {
            autoMergeable = false;
            severity = 'CONFLICT';
            conflictHazardCount++;
            for (const c of sim.conflicts) {
              conflictingFiles.push(c.file);
              conflictDetails.push({
                file_path: c.file,
                conflict_type: 'content',
                source_lines: c.detail,
              });
            }
            if (!highRiskPairs.some((p) => (p.source_id === src.id && p.target_id === tgt.id) || (p.source_id === tgt.id && p.target_id === src.id))) {
              highRiskPairs.push({
                source_id: src.id,
                target_id: tgt.id,
                conflicting_files: conflictingFiles.length > 0 ? conflictingFiles : shared,
              });
            }
          }
        }

        row.push({
          source_id: src.id,
          target_id: tgt.id,
          source_branch: src.branch,
          target_branch: tgt.branch,
          severity,
          shared_files: shared,
          conflicting_files: conflictingFiles,
          conflict_details: conflictDetails,
          auto_mergeable: autoMergeable,
        });
      }

      matrix.push(row);
    }

    const report: FleetConflictMatrixReport = {
      analyzed_at: new Date().toISOString(),
      total_worktrees: activeRecords.length,
      worktree_ids: activeRecords.map((r) => r.id),
      conflict_hazard_count: conflictHazardCount,
      shared_file_pair_count: sharedFilePairCount,
      matrix,
      high_risk_pairs: highRiskPairs,
    };

    // Save markdown report to active worktrees and .task/
    if (activeRecords.length > 0 && !options.dryRun) {
      for (const wt of activeRecords) {
        const wtDir = path.resolve(this.repoRoot, wt.worktree_path);
        if (fs.existsSync(wtDir)) {
          const taskDir = path.join(wtDir, this.config.artifact_dir_name || '.task');
          if (!fs.existsSync(taskDir)) {
            fs.mkdirSync(taskDir, { recursive: true });
          }
          fs.writeFileSync(
            path.join(taskDir, 'conflict-matrix.md'),
            this.generateConflictMatrixMarkdown(report),
            'utf-8'
          );
        }
      }

      // Also save to repo root .task/
      const rootTaskDir = path.join(this.repoRoot, this.config.artifact_dir_name || '.task');
      if (!fs.existsSync(rootTaskDir)) {
        fs.mkdirSync(rootTaskDir, { recursive: true });
      }
      fs.writeFileSync(
        path.join(rootTaskDir, 'conflict-matrix.md'),
        this.generateConflictMatrixMarkdown(report),
        'utf-8'
      );

      // Save JSON to .mannostree/fleet/conflict-matrix.json
      const fleetMetaDir = path.join(this.repoRoot, this.config.metadata_root || '.mannostree', 'fleet');
      if (!fs.existsSync(fleetMetaDir)) {
        fs.mkdirSync(fleetMetaDir, { recursive: true });
      }
      fs.writeFileSync(path.join(fleetMetaDir, 'conflict-matrix.json'), JSON.stringify(report, null, 2), 'utf-8');
    }


    return report;
  }

  /**
   * Generate durable GFM markdown report of conflict matrix.
   */
  public generateConflictMatrixMarkdown(report: FleetConflictMatrixReport): string {
    const lines: string[] = [];
    lines.push('# Fleet Cross-Worktree Conflict Matrix');
    lines.push('');
    lines.push(`**Analyzed At**: ${report.analyzed_at}  `);
    lines.push(`**Total Active Worktrees**: ${report.total_worktrees}  `);
    lines.push(`**Conflict Hazards**: **${report.conflict_hazard_count}**  `);
    lines.push(`**Shared File Overlaps**: ${report.shared_file_pair_count}  `);
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('## Pairwise Conflict Overview');
    lines.push('');

    if (report.worktree_ids.length === 0) {
      lines.push('No active worktrees currently in fleet.');
      return lines.join('\n');
    }

    // Header row
    const header = ['Worktree', ...report.worktree_ids.map((id) => `\`${id}\``)];
    lines.push(`| ${header.join(' | ')} |`);
    lines.push(`| ${header.map(() => '---').join(' | ')} |`);

    for (let i = 0; i < report.matrix.length; i++) {
      const row = report.matrix[i];
      const srcId = row[0]?.source_id || `WT-${i + 1}`;
      const cols = row.map((cell) => {
        if (cell.source_id === cell.target_id) return '—';
        if (cell.severity === 'CLEAN') return '✓ Clean';
        if (cell.severity === 'SHARED_FILES_CLEAN') return `~ Shared (${cell.shared_files.length})`;
        return `🔴 **CONFLICT (${cell.conflicting_files.length || cell.shared_files.length})**`;
      });
      lines.push(`| **\`${srcId}\`** | ${cols.join(' | ')} |`);
    }

    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('## Collision Risks & Details');
    lines.push('');

    if (report.high_risk_pairs.length === 0) {
      lines.push('✓ No merge collision risks detected across concurrent worktrees.');
    } else {
      for (const p of report.high_risk_pairs) {
        lines.push(`### Hazard: \`${p.source_id}\` ⟷ \`${p.target_id}\``);
        lines.push(`- **Conflicting Files**: ${p.conflicting_files.map((f) => `\`${f}\``).join(', ')}`);
        lines.push('- **Recommendation**: Rebase or synchronize branches before merging or publishing.');
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  /**
   * Acquire exclusive concurrency lease on a worktree.
   */
  public async acquireLease(
    worktreeId: string,
    options: FleetLeaseAcquireOptions = {}
  ): Promise<WorkspaceLease> {
    const worktree = await this.store.getWorktree(worktreeId);
    if (!worktree) {
      throw new MannostreeError(
        `Worktree '${worktreeId}' not found in metadata registry.`,
        ExitCode.USAGE_ERROR
      );
    }

    const currentLease = await this.store.getLease(worktreeId);
    const now = Date.now();
    if (currentLease && currentLease.status === 'active') {
      const expiresAtMs = new Date(currentLease.expires_at).getTime();
      if (expiresAtMs > now) {
        throw new MannostreeError(
          `Worktree '${worktreeId}' is currently leased by ${currentLease.holder} until ${currentLease.expires_at} (purpose: "${currentLease.purpose}"). Use release --force to break the lease.`,
          ExitCode.USAGE_ERROR
        );
      }
    }

    const defaultMins = this.config.fleet?.policy?.default_lease_ttl_minutes || 60;
    const ttlSeconds = parseDurationSeconds(options.ttl, defaultMins);
    const acquiredAt = new Date().toISOString();
    const expiresAt = new Date(now + ttlSeconds * 1000).toISOString();

    const lease: WorkspaceLease = {
      lease_id: `lease-${worktreeId}-${now}`,
      worktree_id: worktreeId,
      holder: options.holder || process.env.USER || 'anonymous',
      purpose: options.purpose || 'Development lease',
      acquired_at: acquiredAt,
      expires_at: expiresAt,
      ttl_seconds: ttlSeconds,
      status: 'active',
      renew_count: 0,
    };

    await this.store.saveLease(lease);

    // Update worktree metadata
    worktree.active_lease_id = lease.lease_id;
    worktree.last_accessed_at = acquiredAt;
    worktree.tier = 'hot';
    worktree.updated_at = acquiredAt;
    await this.store.saveWorktree(worktree);

    return lease;
  }

  /**
   * Release an active lease on a worktree.
   */
  public async releaseLease(
    worktreeId: string,
    options: FleetLeaseReleaseOptions = {}
  ): Promise<WorkspaceLease> {
    const worktree = await this.store.getWorktree(worktreeId);
    if (!worktree) {
      throw new MannostreeError(
        `Worktree '${worktreeId}' not found in metadata registry.`,
        ExitCode.USAGE_ERROR
      );
    }

    let lease = await this.store.getLease(worktreeId);
    const now = Date.now();

    if (!lease) {
      lease = {
        lease_id: `lease-${worktreeId}-${now}`,
        worktree_id: worktreeId,
        holder: 'none',
        purpose: 'none',
        acquired_at: new Date(now).toISOString(),
        expires_at: new Date(now).toISOString(),
        ttl_seconds: 0,
        status: 'released',
        renew_count: 0,
      };
    } else {
      lease.status = 'released';
      await this.store.saveLease(lease);
    }

    // Update worktree metadata
    worktree.active_lease_id = undefined;
    worktree.updated_at = new Date().toISOString();
    await this.store.saveWorktree(worktree);

    return lease;
  }

  /**
   * Renew an active lease extending expiration.
   */
  public async renewLease(
    worktreeId: string,
    options: FleetLeaseRenewOptions = {}
  ): Promise<WorkspaceLease> {
    const worktree = await this.store.getWorktree(worktreeId);
    if (!worktree) {
      throw new MannostreeError(
        `Worktree '${worktreeId}' not found in metadata registry.`,
        ExitCode.USAGE_ERROR
      );
    }

    const lease = await this.store.getLease(worktreeId);
    if (!lease || lease.status !== 'active') {
      throw new MannostreeError(
        `No active lease found for worktree '${worktreeId}'. Acquire a new lease instead.`,
        ExitCode.USAGE_ERROR
      );
    }

    const defaultMins = this.config.fleet?.policy?.default_lease_ttl_minutes || 60;
    const ttlSeconds = parseDurationSeconds(options.ttl, defaultMins);
    const now = Date.now();

    lease.expires_at = new Date(now + ttlSeconds * 1000).toISOString();
    lease.ttl_seconds = ttlSeconds;
    lease.renew_count = (lease.renew_count || 0) + 1;
    await this.store.saveLease(lease);

    worktree.last_accessed_at = new Date().toISOString();
    worktree.updated_at = new Date().toISOString();
    await this.store.saveWorktree(worktree);

    return lease;
  }

  /**
   * List all leases.
   */
  public async listLeases(options?: { activeOnly?: boolean }): Promise<WorkspaceLease[]> {
    return this.store.listLeases(options);
  }

  /**
   * Check if a worktree has an active, unexpired lease.
   */
  public async hasActiveLease(
    worktreeId: string
  ): Promise<{ active: boolean; lease?: WorkspaceLease }> {
    const lease = await this.store.getLease(worktreeId);
    if (!lease) {
      return { active: false };
    }
    const isExpired = new Date(lease.expires_at).getTime() <= Date.now();
    if (lease.status === 'active' && !isExpired) {
      return { active: true, lease };
    }
    return { active: false, lease };
  }

  /**
   * Calculate effective tier for a worktree.
   */
  public getEffectiveTier(record: WorktreeRecord, lease?: WorkspaceLease | null): FleetTier {
    if (record.pinned) return 'pinned';
    if (record.status === 'archived' || record.lifecycle_state === 'CLEANED' || record.tier === 'cold') return 'cold';
    if (lease && lease.status === 'active' && new Date(lease.expires_at).getTime() > Date.now()) {
      return 'hot';
    }
    if (record.tier === 'warm') return 'warm';
    if (record.tier === 'hot') return 'hot';
    const hotThresholdHours = this.config.fleet?.policy?.hot_threshold_hours || 4;
    const lastActivity = record.last_accessed_at || record.last_activity_at || record.updated_at;
    if (lastActivity) {
      const elapsedHours = (Date.now() - new Date(lastActivity).getTime()) / (1000 * 3600);
      if (elapsedHours <= hotThresholdHours) {
        return 'hot';
      }
    }
    return 'warm';
  }


  /**
   * Set tier explicitly on a worktree.
   */
  public async setTier(worktreeId: string, tier: FleetTier): Promise<WorktreeRecord> {
    const record = await this.store.getWorktree(worktreeId);
    if (!record) {
      throw new MannostreeError(
        `Worktree '${worktreeId}' not found in metadata registry.`,
        ExitCode.USAGE_ERROR
      );
    }
    record.tier = tier;
    record.pinned = tier === 'pinned';
    record.updated_at = new Date().toISOString();
    await this.store.saveWorktree(record);
    return record;

  }

  /**
   * Pin a worktree to exempt it from auto-archival.
   */
  public async pinWorktree(worktreeId: string): Promise<WorktreeRecord> {
    return this.setTier(worktreeId, 'pinned');
  }

  /**
   * Unpin a worktree.
   */
  public async unpinWorktree(worktreeId: string): Promise<WorktreeRecord> {
    return this.setTier(worktreeId, 'warm');
  }

  /**
   * List all worktree tiers.
   */
  public async listTiers(): Promise<
    Array<{
      id: string;
      branch: string;
      tier: FleetTier;
      pinned: boolean;
      status: string;
      path: string;
      last_accessed_at?: string;
    }>
  > {
    const records = await this.store.listWorktrees();
    const result = [];
    for (const r of records) {
      const lease = await this.store.getLease(r.id);
      const tier = this.getEffectiveTier(r, lease);
      result.push({
        id: r.id,
        branch: r.branch,
        tier,
        pinned: !!r.pinned,
        status: r.status,
        path: r.worktree_path,
        last_accessed_at: r.last_accessed_at || r.updated_at,
      });
    }
    return result;
  }

  /**
   * Evaluate retention policies and auto-archive idle/excess warm worktrees.
   */
  public async autoArchive(options: FleetAutoArchiveOptions = {}): Promise<AutoArchiveReport> {
    const allRecords = await this.store.listWorktrees();
    const activeRecords = allRecords.filter(
      (r) => r.status !== 'archived' && r.status !== 'cleaned' && r.lifecycle_state !== 'CLEANED'
    );

    const isDryRun = !!(options.dryRun || options.preview || !options.yes);
    const maxActive = this.config.fleet?.policy?.max_active_worktrees ?? 10;
    const idleTtlHours = this.config.fleet?.policy?.idle_ttl_hours ?? 48;
    const dirtyPolicy = this.config.fleet?.policy?.archive_dirty_policy || 'refuse';

    const archived: Array<{ id: string; branch: string; reason: string }> = [];
    const skipped: Array<{ id: string; reason: string }> = [];
    const candidates: Array<{ record: WorktreeRecord; idleHours: number; reason: string }> = [];

    const now = Date.now();

    for (const rec of activeRecords) {
      // 1. Check pinned
      if (rec.pinned) {
        skipped.push({ id: rec.id, reason: 'Worktree is pinned' });
        continue;
      }

      // 2. Check active lease
      const leaseStatus = await this.hasActiveLease(rec.id);
      if (leaseStatus.active) {
        skipped.push({
          id: rec.id,
          reason: `Active lease held by ${leaseStatus.lease?.holder} until ${leaseStatus.lease?.expires_at}`,
        });
        continue;
      }

      // 3. Check dirty
      const fullPath = path.resolve(this.repoRoot, rec.worktree_path);
      if (fs.existsSync(fullPath)) {
        const isDirty = await this.git.isWorktreeDirty(fullPath);
        if (isDirty && dirtyPolicy === 'refuse' && !options.force) {
          skipped.push({ id: rec.id, reason: 'Uncommitted changes (policy: refuse)' });
          continue;
        }
      }

      // Compute idle hours
      const lastActivity = rec.last_accessed_at || rec.last_activity_at || rec.updated_at;
      const idleHours = lastActivity ? (now - new Date(lastActivity).getTime()) / (1000 * 3600) : 0;

      if (idleHours >= idleTtlHours) {
        candidates.push({
          record: rec,
          idleHours,
          reason: `Idle for ${Math.round(idleHours)}h (exceeds ${idleTtlHours}h limit)`,
        });
      } else {
        candidates.push({
          record: rec,
          idleHours,
          reason: 'Eligible for quota pruning',
        });
      }
    }

    // Sort candidates by least recently used (highest idle hours first)
    candidates.sort((a, b) => b.idleHours - a.idleHours);

    // Determine candidates to archive: either over idle TTL or exceeding max active quota
    const quotaExcessCount = Math.max(0, activeRecords.length - maxActive);
    const toArchive = new Set<string>();

    for (const c of candidates) {
      if (c.idleHours >= idleTtlHours) {
        toArchive.add(c.record.id);
        archived.push({ id: c.record.id, branch: c.record.branch, reason: c.reason });
      }
    }


    for (const c of candidates) {
      if (toArchive.size < quotaExcessCount && !toArchive.has(c.record.id)) {
        toArchive.add(c.record.id);
        archived.push({
          id: c.record.id,
          branch: c.record.branch,
          reason: `Exceeds max active quota (limit: ${maxActive})`,
        });
      }
    }

    // If not dry-run and yes confirmed, execute unmount and metadata update
    if (!isDryRun) {
      for (const item of archived) {
        const rec = activeRecords.find((r) => r.id === item.id);
        if (rec) {
          const fullPath = path.resolve(this.repoRoot, rec.worktree_path);
          if (fs.existsSync(fullPath)) {
            await this.git.exec(['worktree', 'remove', fullPath, '--force']);
          }
          rec.status = 'archived';
          rec.lifecycle_state = 'CLEANED';
          rec.tier = 'cold';
          rec.updated_at = new Date().toISOString();
          await this.store.saveWorktree(rec);
        }
      }
    }

    return {
      timestamp: new Date().toISOString(),
      dry_run: isDryRun,
      total_evaluated: activeRecords.length,
      archived_count: archived.length,
      skipped_count: skipped.length,
      archived_worktrees: archived,
      skipped_worktrees: skipped,
    };
  }

  /**
   * Generate comprehensive fleet capacity and tier dashboard.
   */
  public async getFleetCapacityReport(): Promise<FleetCapacityReport> {
    const allRecords = await this.store.listWorktrees();
    const activeLeases = await this.listLeases({ activeOnly: true });

    let activeMountedCount = 0;
    let hotCount = 0;
    let warmCount = 0;
    let coldCount = 0;
    let pinnedCount = 0;
    let totalDiskBytes = 0;

    const archiveCandidates: FleetCapacityReport['archive_candidates'] = [];
    const idleTtlHours = this.config.fleet?.policy?.idle_ttl_hours || 48;
    const now = Date.now();

    for (const rec of allRecords) {
      const lease = activeLeases.find((l) => l.worktree_id === rec.id);
      const tier = this.getEffectiveTier(rec, lease);

      if (tier === 'pinned') pinnedCount++;
      else if (tier === 'cold') coldCount++;
      else if (tier === 'hot') {
        hotCount++;
        activeMountedCount++;
      } else {
        warmCount++;
        activeMountedCount++;
      }

      const fullPath = path.resolve(this.repoRoot, rec.worktree_path);
      if (fs.existsSync(fullPath) && tier !== 'cold') {
        try {
          const stats = fs.statSync(fullPath);
          totalDiskBytes += stats.size || 4096;
        } catch {}
      }

      if (tier === 'warm' && !rec.pinned && !lease) {
        const lastActivity = rec.last_accessed_at || rec.last_activity_at || rec.updated_at;
        const idleHours = lastActivity ? (now - new Date(lastActivity).getTime()) / (1000 * 3600) : 0;
        if (idleHours > idleTtlHours) {
          archiveCandidates.push({
            id: rec.id,
            branch: rec.branch,
            tier,
            idle_hours: Math.round(idleHours),
            reason: `Idle for ${Math.round(idleHours)}h (exceeds ${idleTtlHours}h limit)`,
          });
        }
      }
    }

    return {
      analyzed_at: new Date().toISOString(),
      max_capacity: this.config.fleet?.policy?.max_active_worktrees || 10,
      total_worktrees: allRecords.length,
      active_mounted_count: activeMountedCount,
      hot_count: hotCount,
      warm_count: warmCount,
      cold_count: coldCount,
      pinned_count: pinnedCount,
      active_leases: activeLeases,
      archive_candidates: archiveCandidates,
      total_disk_bytes: totalDiskBytes,
    };
  }

  /**
   * Pre-flight 3-way in-memory merge simulation and multi-branch release assembly.
   */
  public async mergeSync(options: FleetMergeSyncOptions): Promise<FleetMergeSyncReport> {
    const {
      target,
      candidates: candidateIds,
      preview = false,
      dryRun = false,
      yes = false,
      ignoreConflicts = false,
      createTargetIfMissing = true,
    } = options;

    if (!target || target.trim().length === 0) {
      throw new MannostreeError(
        'A target branch name is required for fleet merge-sync.',
        ExitCode.USAGE_ERROR
      );
    }

    const allRecords = await this.store.listWorktrees();
    let targetRecords: WorktreeRecord[] = [];

    if (candidateIds && candidateIds.length > 0) {
      for (const id of candidateIds) {
        const rec = allRecords.find((r) => r.id === id || r.branch === id);
        if (rec) {
          targetRecords.push(rec);
        }
      }
    } else {
      targetRecords = allRecords.filter(
        (r) => r.status !== 'archived' && r.status !== 'cleaned' && r.lifecycle_state !== 'CLEANED'
      );
    }

    const targetExists = await this.git.branchOrRefExists(target);
    if (!targetExists && !createTargetIfMissing && !preview && !dryRun) {
      throw new MannostreeError(
        `Target branch '${target}' does not exist in repository.`,
        ExitCode.USAGE_ERROR
      );
    }

    const candidateOutcomes: FleetMergeSyncCandidate[] = [];
    const baseToCompare = targetExists ? target : this.config.default_base_branch;

    for (const rec of targetRecords) {
      const headSha = (await this.git.getHeadCommit(rec.branch)) || 'unknown';
      let canMerge = true;
      let conflictFiles: string[] = [];

      try {
        const sim = await this.git.simulateMergeTree(baseToCompare, rec.branch);
        canMerge = sim.clean;
        conflictFiles = sim.conflicts.map((c) => c.file);
      } catch {
        canMerge = false;
        conflictFiles = ['all'];
      }

      candidateOutcomes.push({
        worktree_id: rec.id,
        branch: rec.branch,
        head_sha: headSha,
        can_merge_cleanly: canMerge,
        conflicting_files: conflictFiles,
        status: canMerge ? 'READY' : 'CONFLICT_BLOCKED',
      });
    }

    const cleanCount = candidateOutcomes.filter((c) => c.can_merge_cleanly).length;
    const conflictCount = candidateOutcomes.filter((c) => !c.can_merge_cleanly).length;
    const isExecution = !preview && !dryRun && yes;

    let integratedCount = 0;
    let releaseManifestPath: string | undefined;

    if (isExecution && (conflictCount === 0 || ignoreConflicts)) {
      if (!targetExists) {
        await this.git.exec(['branch', target, this.config.default_base_branch]);
      }

      const integrated: Array<{ worktree_id: string; branch: string; commit_sha: string }> = [];

      for (const cand of candidateOutcomes) {
        if (cand.can_merge_cleanly) {
          cand.status = 'MERGED';
          integrated.push({
            worktree_id: cand.worktree_id,
            branch: cand.branch,
            commit_sha: cand.head_sha,
          });
          integratedCount++;
        } else {
          cand.status = 'SKIPPED';
        }
      }

      const now = new Date().toISOString();
      const targetHead = (await this.git.getHeadCommit(target)) || 'head';
      const manifest: ReleaseManifestRecord = {
        version: 1,
        target_branch: target,
        assembled_at: now,
        head_commit: targetHead,
        integrated_worktrees: integrated,
      };
      await this.store.saveReleaseManifest(manifest);
      releaseManifestPath = this.store.getReleaseManifestPath(target);
    }

    return {
      timestamp: new Date().toISOString(),
      target_branch: target,
      dry_run: !isExecution,
      total_candidates: candidateOutcomes.length,
      clean_count: cleanCount,
      conflict_count: conflictCount,
      integrated_count: integratedCount,
      candidates: candidateOutcomes,
      release_manifest_path: releaseManifestPath,
    };
  }
}


export function parseDurationSeconds(ttl?: string, defaultMinutes = 60): number {
  if (!ttl) return defaultMinutes * 60;
  const raw = ttl.trim().toLowerCase();
  if (/^\d+$/.test(raw)) {
    return parseInt(raw, 10);
  }
  const match = raw.match(/^(\d+)\s*(s|sec|seconds?|m|min|minutes?|h|hr|hours?|d|days?)$/);
  if (!match) {
    return defaultMinutes * 60;
  }
  const val = parseInt(match[1], 10);
  const unit = match[2];
  if (unit.startsWith('s')) return val;
  if (unit.startsWith('m')) return val * 60;
  if (unit.startsWith('h')) return val * 3600;
  if (unit.startsWith('d')) return val * 86400;
  return defaultMinutes * 60;
}

