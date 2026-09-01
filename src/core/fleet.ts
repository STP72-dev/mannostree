import fs from 'node:fs';
import path from 'node:path';
import { GitEngine } from '../git/engine.js';
import { MetadataStore } from '../metadata/store.js';
import { MannostreeConfig } from '../config/schema.js';
import {
  AgentSessionState,
  ConflictHunkDetail,
  ConflictMatrixCell,
  ConflictSeverity,
  ExitCode,
  FleetConflictMatrixOptions,
  FleetConflictMatrixReport,
  FleetSyncOptions,
  FleetSyncReport,
  FleetSyncStatusType,
  MannostreeError,
  WorktreeRecord,
  WorktreeSyncStatus,
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

      // Check dirty
      const isDirty = await this.git.isWorktreeDirty(fullPath);
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

      // Check active agent sessions
      const sessions = await this.store.listSessions({ worktreeId: record.id });
      const activeStates: AgentSessionState[] = ['dispatched', 'planning', 'working', 'verifying'];
      const activeSession = sessions.find((s) => activeStates.includes(s.state));
      if (activeSession && this.config.fleet?.guard_active_sessions !== false) {


        skippedCount++;
        worktreeStatuses.push({
          worktree_id: record.id,
          branch: record.branch,
          base_branch: record.base_branch,
          status: 'SESSION_ACTIVE_SKIPPED',
          ahead: 0,
          behind: 0,
          dirty: isDirty,
          active_session_id: activeSession.session_id,
          message: `Skipped sync due to active agent session '${activeSession.session_id}'.`,
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
}
