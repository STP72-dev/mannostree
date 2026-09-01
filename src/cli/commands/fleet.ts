import { Command } from 'commander';
import chalk from 'chalk';
import { loadConfig } from '../../config/loader.js';
import { MannostreeOrchestrator } from '../../core/orchestrator.js';
import { GitEngine } from '../../git/engine.js';
import { formatOutput } from '../output.js';
import { GlobalOptions } from '../../types/index.js';

export function registerFleetCommand(program: Command): void {
  const fleetCmd = program
    .command('fleet')
    .description('Fleet-wide multi-worktree synchronization and cross-worktree collision matrix');

  // fleet sync
  fleetCmd
    .command('sync')
    .description('Synchronize all active worktrees against their base branches')
    .option('--preview', 'Preview divergence and sync actions without modifying branches', false)
    .option('--strategy <strategy>', 'Sync strategy: rebase, merge, or ff-only', 'ff-only')
    .option('--target <worktree_id>', 'Filter sync to a specific worktree')
    .action(async (cmdOptions: any) => {
      const globalOpts = program.opts<GlobalOptions>();
      const cwd = globalOpts.cwd ? globalOpts.cwd : process.cwd();

      const config = loadConfig(globalOpts.config, cwd);
      const git = new GitEngine(cwd);
      const repoRoot = await git.getRepoRoot();

      const orchestrator = new MannostreeOrchestrator(repoRoot, config);

      const result = await orchestrator.fleetSync({
        strategy: cmdOptions.strategy,
        preview: cmdOptions.preview || globalOpts.dryRun,
        dryRun: globalOpts.dryRun,
        target: cmdOptions.target,
      });

      formatOutput(result, globalOpts, (data) => {
        const lines: string[] = [];
        const mode = data.dry_run ? ' [PREVIEW]' : '';
        lines.push(chalk.bold(`Fleet Synchronization Report${mode}:`));
        lines.push(`  Synced At:        ${data.synced_at}`);
        lines.push(`  Strategy:         ${data.strategy}`);
        lines.push(`  Total Worktrees:  ${data.total_worktrees}`);
        lines.push(`  Synced Clean:     ${chalk.green.bold(data.synced_count)}`);
        lines.push(`  Skipped (Guarded):${chalk.yellow.bold(data.skipped_count)}`);
        lines.push(`  Failed/Conflict:  ${chalk.red.bold(data.failed_count)}`);
        lines.push('');
        lines.push(chalk.bold('Worktree Details:'));

        for (const wt of data.worktrees) {
          let statusColor = chalk.green;
          if (wt.status.includes('SKIPPED')) statusColor = chalk.yellow;
          if (wt.status.includes('FAILED')) statusColor = chalk.red;
          if (wt.status === 'BEHIND' || wt.status === 'DIVERGED') statusColor = chalk.cyan;

          lines.push(
            `  ${statusColor(`[${wt.status}]`)} ${chalk.bold(wt.worktree_id)} (${wt.branch} ⟵ ${wt.base_branch})`
          );
          lines.push(`     Ahead: ${wt.ahead} | Behind: ${wt.behind} | Dirty: ${wt.dirty ? chalk.yellow('Yes') : 'No'}`);
          if (wt.message) {
            lines.push(`     Info:  ${wt.message}`);
          }
          lines.push('');
        }

        return lines.join('\n');
      });
    });

  // fleet conflict-matrix
  fleetCmd
    .command('conflict-matrix')
    .description('Generate pairwise cross-worktree file and line conflict collision matrix')
    .option('--target <worktree_id>', 'Filter collision analysis relative to a specific worktree')
    .option('--simulate-merge', 'Run in-memory 3-way git merge-tree simulation', true)
    .option('--fail-on-conflict', 'Exit with non-zero code if direct conflict hazards exist', false)
    .option('--verbose', 'Show detailed conflict hunks and file paths', false)
    .action(async (cmdOptions: any) => {
      const globalOpts = program.opts<GlobalOptions>();
      const cwd = globalOpts.cwd ? globalOpts.cwd : process.cwd();

      const config = loadConfig(globalOpts.config, cwd);
      const git = new GitEngine(cwd);
      const repoRoot = await git.getRepoRoot();

      const orchestrator = new MannostreeOrchestrator(repoRoot, config);

      const result = await orchestrator.fleetConflictMatrix({
        target: cmdOptions.target,
        simulateMerge: cmdOptions.simulateMerge,
        failOnConflict: cmdOptions.failOnConflict,
        verbose: cmdOptions.verbose,
        dryRun: globalOpts.dryRun,
      });

      formatOutput(result, globalOpts, (data) => {
        const lines: string[] = [];
        lines.push(chalk.bold('Fleet Cross-Worktree Conflict Matrix:'));
        lines.push(`  Analyzed At:       ${data.analyzed_at}`);
        lines.push(`  Active Worktrees:  ${data.total_worktrees}`);
        lines.push(`  Conflict Hazards:  ${data.conflict_hazard_count > 0 ? chalk.red.bold(data.conflict_hazard_count) : chalk.green('0 (Clean)')}`);
        lines.push(`  Shared Overlaps:   ${data.shared_file_pair_count}`);
        lines.push('');

        if (data.worktree_ids.length > 0) {
          lines.push(chalk.bold('Pairwise Matrix Grid:'));
          const header = ['Worktree', ...data.worktree_ids.map((id) => id.slice(0, 10))];
          lines.push(`  ${header.map((h) => h.padEnd(12)).join(' | ')}`);
          lines.push(`  ${header.map(() => '------------').join('-+-')}`);

          for (let i = 0; i < data.matrix.length; i++) {
            const row = data.matrix[i];
            const srcId = row[0]?.source_id.slice(0, 10) || `WT-${i + 1}`;
            const cols = row.map((cell) => {
              if (cell.source_id === cell.target_id) return chalk.gray('—');
              if (cell.severity === 'CLEAN') return chalk.green('✓ Clean');
              if (cell.severity === 'SHARED_FILES_CLEAN') return chalk.yellow(`~ Sh (${cell.shared_files.length})`);
              return chalk.red.bold(`! CONFLICT (${cell.conflicting_files.length || cell.shared_files.length})`);
            });
            lines.push(`  ${srcId.padEnd(12)} | ${cols.map((c) => c.padEnd(12)).join(' | ')}`);
          }
          lines.push('');
        }

        if (data.high_risk_pairs.length > 0) {
          lines.push(chalk.red.bold('High-Risk Collision Hazards:'));
          for (const p of data.high_risk_pairs) {
            lines.push(`  ${chalk.red.bold('!')} ${chalk.bold(p.source_id)} ⟷ ${chalk.bold(p.target_id)}`);
            lines.push(`    Conflicting files: ${p.conflicting_files.join(', ')}`);
          }
          lines.push('');
        } else {
          lines.push(chalk.green('✓ No merge collision risks detected across concurrent worktrees.'));
        }

        return lines.join('\n');
      });
    });

  // fleet lease
  const leaseCmd = fleetCmd
    .command('lease')
    .description('Manage exclusive workspace concurrency leases and locks');

  leaseCmd
    .command('acquire <worktree_id>')
    .description('Acquire exclusive lease on a worktree')
    .option('--holder <name>', 'Name or identifier of agent/developer claiming lease')
    .option('--ttl <duration>', 'Lease duration (e.g. 30m, 2h, 1d)', '60m')
    .option('--purpose <description>', 'Declared intention or task description', 'Development lease')
    .action(async (worktreeId: string, cmdOptions: any) => {
      const globalOpts = program.opts<GlobalOptions>();
      const cwd = globalOpts.cwd ? globalOpts.cwd : process.cwd();
      const config = loadConfig(globalOpts.config, cwd);
      const git = new GitEngine(cwd);
      const repoRoot = await git.getRepoRoot();
      const orchestrator = new MannostreeOrchestrator(repoRoot, config);

      const result = await orchestrator.fleetLeaseAcquire(worktreeId, {
        holder: cmdOptions.holder,
        ttl: cmdOptions.ttl,
        purpose: cmdOptions.purpose,
      });

      formatOutput(result, globalOpts, (lease) => {
        const lines: string[] = [];
        lines.push(chalk.green.bold('✓ Lease Acquired Successfully:'));
        lines.push(`  Worktree:    ${chalk.bold(lease.worktree_id)}`);
        lines.push(`  Lease ID:    ${lease.lease_id}`);
        lines.push(`  Holder:      ${chalk.cyan(lease.holder)}`);
        lines.push(`  Purpose:     ${lease.purpose}`);
        lines.push(`  Expires At:  ${chalk.yellow(lease.expires_at)} (${Math.round(lease.ttl_seconds / 60)} mins)`);
        return lines.join('\n');
      });
    });

  leaseCmd
    .command('release <worktree_id>')
    .description('Release an active lease on a worktree')
    .option('--force', 'Force release lease even if held by another process', false)
    .action(async (worktreeId: string, cmdOptions: any) => {
      const globalOpts = program.opts<GlobalOptions>();
      const cwd = globalOpts.cwd ? globalOpts.cwd : process.cwd();
      const config = loadConfig(globalOpts.config, cwd);
      const git = new GitEngine(cwd);
      const repoRoot = await git.getRepoRoot();
      const orchestrator = new MannostreeOrchestrator(repoRoot, config);

      const result = await orchestrator.fleetLeaseRelease(worktreeId, {
        force: cmdOptions.force,
      });

      formatOutput(result, globalOpts, (lease) => {
        return chalk.green(`✓ Lease released for worktree '${chalk.bold(lease.worktree_id)}'.`);
      });
    });

  leaseCmd
    .command('renew <worktree_id>')
    .description('Extend expiration of an active lease')
    .option('--ttl <duration>', 'Extension duration (e.g. 30m, 1h)', '60m')
    .action(async (worktreeId: string, cmdOptions: any) => {
      const globalOpts = program.opts<GlobalOptions>();
      const cwd = globalOpts.cwd ? globalOpts.cwd : process.cwd();
      const config = loadConfig(globalOpts.config, cwd);
      const git = new GitEngine(cwd);
      const repoRoot = await git.getRepoRoot();
      const orchestrator = new MannostreeOrchestrator(repoRoot, config);

      const result = await orchestrator.fleetLeaseRenew(worktreeId, {
        ttl: cmdOptions.ttl,
      });

      formatOutput(result, globalOpts, (lease) => {
        const lines: string[] = [];
        lines.push(chalk.green.bold('✓ Lease Renewed Successfully:'));
        lines.push(`  Worktree:     ${chalk.bold(lease.worktree_id)}`);
        lines.push(`  New Expiry:   ${chalk.yellow(lease.expires_at)}`);
        lines.push(`  Renew Count:  ${lease.renew_count}`);
        return lines.join('\n');
      });
    });

  leaseCmd
    .command('list')
    .description('List all active and expired workspace leases')
    .option('--active', 'Show only active unexpired leases', false)
    .action(async (cmdOptions: any) => {
      const globalOpts = program.opts<GlobalOptions>();
      const cwd = globalOpts.cwd ? globalOpts.cwd : process.cwd();
      const config = loadConfig(globalOpts.config, cwd);
      const git = new GitEngine(cwd);
      const repoRoot = await git.getRepoRoot();
      const orchestrator = new MannostreeOrchestrator(repoRoot, config);

      const result = await orchestrator.fleetLeaseList({ activeOnly: cmdOptions.active });

      formatOutput(result, globalOpts, (leases) => {
        if (leases.length === 0) {
          return chalk.gray('No leases found across the fleet.');
        }
        const lines: string[] = [];
        lines.push(chalk.bold(`Fleet Leases (${leases.length}):`));
        for (const l of leases) {
          const isExpired = new Date(l.expires_at).getTime() <= Date.now();
          const statusStr = isExpired
            ? chalk.gray('[EXPIRED]')
            : l.status === 'active'
            ? chalk.green('[ACTIVE]')
            : chalk.yellow(`[${l.status.toUpperCase()}]`);
          lines.push(`  ${statusStr} ${chalk.bold(l.worktree_id)} (Holder: ${l.holder})`);
          lines.push(`     Purpose: ${l.purpose} | Expires: ${l.expires_at}`);
        }
        return lines.join('\n');
      });
    });

  // fleet tier
  const tierCmd = fleetCmd
    .command('tier')
    .description('Manage workspace lifecycle tiers and pinning');

  tierCmd
    .command('set <worktree_id> <tier>')
    .description('Set lifecycle tier for a worktree (hot, warm, cold, pinned)')
    .action(async (worktreeId: string, tier: string) => {
      const globalOpts = program.opts<GlobalOptions>();
      const cwd = globalOpts.cwd ? globalOpts.cwd : process.cwd();
      const config = loadConfig(globalOpts.config, cwd);
      const git = new GitEngine(cwd);
      const repoRoot = await git.getRepoRoot();
      const orchestrator = new MannostreeOrchestrator(repoRoot, config);

      const result = await orchestrator.fleetTierSet(worktreeId, tier as any);
      formatOutput(result, globalOpts, (rec) => {
        return chalk.green(`✓ Set tier '${tier}' on worktree '${chalk.bold(rec.id)}'.`);
      });
    });

  tierCmd
    .command('pin <worktree_id>')
    .description('Pin a worktree to exempt it from auto-archival')
    .action(async (worktreeId: string) => {
      const globalOpts = program.opts<GlobalOptions>();
      const cwd = globalOpts.cwd ? globalOpts.cwd : process.cwd();
      const config = loadConfig(globalOpts.config, cwd);
      const git = new GitEngine(cwd);
      const repoRoot = await git.getRepoRoot();
      const orchestrator = new MannostreeOrchestrator(repoRoot, config);

      const result = await orchestrator.fleetTierPin(worktreeId);
      formatOutput(result, globalOpts, (rec) => {
        return chalk.green(`✓ Pinned worktree '${chalk.bold(rec.id)}' (exempt from auto-archive).`);
      });
    });

  tierCmd
    .command('unpin <worktree_id>')
    .description('Unpin a worktree')
    .action(async (worktreeId: string) => {
      const globalOpts = program.opts<GlobalOptions>();
      const cwd = globalOpts.cwd ? globalOpts.cwd : process.cwd();
      const config = loadConfig(globalOpts.config, cwd);
      const git = new GitEngine(cwd);
      const repoRoot = await git.getRepoRoot();
      const orchestrator = new MannostreeOrchestrator(repoRoot, config);

      const result = await orchestrator.fleetTierUnpin(worktreeId);
      formatOutput(result, globalOpts, (rec) => {
        return chalk.green(`✓ Unpinned worktree '${chalk.bold(rec.id)}'.`);
      });
    });

  tierCmd
    .command('list')
    .description('List all worktrees by lifecycle tier')
    .action(async () => {
      const globalOpts = program.opts<GlobalOptions>();
      const cwd = globalOpts.cwd ? globalOpts.cwd : process.cwd();
      const config = loadConfig(globalOpts.config, cwd);
      const git = new GitEngine(cwd);
      const repoRoot = await git.getRepoRoot();
      const orchestrator = new MannostreeOrchestrator(repoRoot, config);

      const result = await orchestrator.fleetTierList();
      formatOutput(result, globalOpts, (tiers) => {
        const lines: string[] = [];
        lines.push(chalk.bold(`Fleet Workspace Tiers (${tiers.length}):`));
        for (const t of tiers) {
          let tierColor = chalk.cyan;
          if (t.tier === 'hot') tierColor = chalk.red.bold;
          if (t.tier === 'pinned') tierColor = chalk.magenta.bold;
          if (t.tier === 'cold') tierColor = chalk.gray;
          lines.push(`  ${tierColor(`[${t.tier.toUpperCase()}]`)} ${chalk.bold(t.id)} (${t.branch}) ${t.pinned ? chalk.magenta('[PINNED]') : ''}`);
          lines.push(`     Path: ${t.path} | Last Access: ${t.last_accessed_at || 'n/a'}`);
        }
        return lines.join('\n');
      });
    });

  // fleet auto-archive
  fleetCmd
    .command('auto-archive')
    .description('Evaluate retention policies and auto-archive idle/excess warm worktrees')
    .option('--preview', 'Preview candidate worktrees without modifying disk', false)
    .option('--yes', 'Confirm automatic archival', false)
    .option('--force', 'Force proceed bypassing non-critical warnings', false)
    .action(async (cmdOptions: any) => {
      const globalOpts = program.opts<GlobalOptions>();
      const cwd = globalOpts.cwd ? globalOpts.cwd : process.cwd();
      const config = loadConfig(globalOpts.config, cwd);
      const git = new GitEngine(cwd);
      const repoRoot = await git.getRepoRoot();
      const orchestrator = new MannostreeOrchestrator(repoRoot, config);

      const result = await orchestrator.fleetAutoArchive({
        preview: cmdOptions.preview || globalOpts.dryRun,
        dryRun: globalOpts.dryRun,
        yes: cmdOptions.yes,
        force: cmdOptions.force,
      });

      formatOutput(result, globalOpts, (report) => {
        const lines: string[] = [];
        const mode = report.dry_run ? ' [PREVIEW]' : '';
        lines.push(chalk.bold(`Auto-Archive Execution Report${mode}:`));
        lines.push(`  Evaluated:   ${report.total_evaluated}`);
        lines.push(`  Archived:    ${chalk.green.bold(report.archived_count)}`);
        lines.push(`  Skipped:     ${chalk.yellow.bold(report.skipped_count)}`);
        lines.push('');

        if (report.archived_worktrees.length > 0) {
          lines.push(chalk.bold('Archived Worktrees:'));
          for (const a of report.archived_worktrees) {
            lines.push(`  ${chalk.green('✓')} ${chalk.bold(a.id)} (${a.branch}) — Reason: ${a.reason}`);
          }
          lines.push('');
        }

        if (report.skipped_worktrees.length > 0) {
          lines.push(chalk.bold('Skipped Worktrees:'));
          for (const s of report.skipped_worktrees) {
            lines.push(`  ${chalk.yellow('~')} ${chalk.bold(s.id)} — ${s.reason}`);
          }
          lines.push('');
        }

        return lines.join('\n');
      });
    });

  // fleet status
  fleetCmd
    .command('status')
    .description('Display fleet capacity, tier distribution, active leases, and resource metrics')
    .action(async () => {
      const globalOpts = program.opts<GlobalOptions>();
      const cwd = globalOpts.cwd ? globalOpts.cwd : process.cwd();
      const config = loadConfig(globalOpts.config, cwd);
      const git = new GitEngine(cwd);
      const repoRoot = await git.getRepoRoot();
      const orchestrator = new MannostreeOrchestrator(repoRoot, config);

      const result = await orchestrator.fleetCapacityStatus();
      formatOutput(result, globalOpts, (report) => {
        const lines: string[] = [];
        lines.push(chalk.bold.cyan('╔═════════════════════════════════════════════════════════════╗'));
        lines.push(chalk.bold.cyan('║                   Mannostree Fleet Status                   ║'));
        lines.push(chalk.bold.cyan('╠═════════════════════════════════════════════════════════════╣'));
        lines.push(`  Capacity Quota:      ${chalk.bold(report.active_mounted_count)} / ${report.max_capacity} Active Worktrees`);
        lines.push(`  Total Worktrees:     ${report.total_worktrees}`);
        lines.push(`  Estimated Disk:      ${Math.round(report.total_disk_bytes / 1024)} KB`);
        lines.push('');
        lines.push(chalk.bold('  Lifecycle Tier Distribution:'));
        lines.push(`    🔥 Hot (Active/Leased): ${chalk.red.bold(report.hot_count)}`);
        lines.push(`    🌤️ Warm (Mounted Idle):  ${chalk.cyan(report.warm_count)}`);
        lines.push(`    🧊 Cold (Archived Ref):  ${chalk.gray(report.cold_count)}`);
        lines.push(`    📌 Pinned:               ${chalk.magenta.bold(report.pinned_count)}`);
        lines.push('');
        lines.push(`  Active Leases:       ${report.active_leases.length}`);
        for (const l of report.active_leases) {
          lines.push(`    • ${chalk.bold(l.worktree_id)} (Holder: ${l.holder}, Expires: ${l.expires_at})`);
        }
        if (report.archive_candidates.length > 0) {
          lines.push('');
          lines.push(chalk.yellow.bold(`  Archive Candidates (${report.archive_candidates.length}):`));
          for (const c of report.archive_candidates) {
            lines.push(`    • ${chalk.bold(c.id)} (${c.idle_hours}h idle) — ${c.reason}`);
          }
        }
        lines.push(chalk.bold.cyan('╚═════════════════════════════════════════════════════════════╝'));
        return lines.join('\n');
      });
    });
}

