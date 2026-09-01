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
}
