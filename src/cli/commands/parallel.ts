import { Command } from 'commander';
import { loadConfig } from '../../config/loader.js';
import { MannostreeOrchestrator } from '../../core/orchestrator.js';
import { GitEngine } from '../../git/engine.js';
import {
  formatOutput,
  formatParallelSpawnResult,
  formatParallelListResult,
  formatParallelCompareResult,
  formatParallelPickResult,
  formatParallelDropResult,
} from '../output.js';
import { GlobalOptions } from '../../types/index.js';

export function registerParallelCommand(program: Command): void {
  const parallelCmd = program
    .command('parallel')
    .description('Manage parallel variant development experiments');

  // parallel spawn
  parallelCmd
    .command('spawn <feature>')
    .description('Spawn N parallel variant worktrees from an explicit base branch')
    .requiredOption('-n, --variants <count>', 'Number of variants to spawn', (val) => parseInt(val, 10))
    .option('-b, --base-branch <branch>', 'Explicit base branch (default: main)')
    .option('--profile <name>', 'Profile to apply to all variants')
    .option('--plan-mode <mode>', 'Plan mode (shared or isolated)', 'shared')
    .action(async (feature: string, cmdOptions: any) => {
      const globalOpts = program.opts<GlobalOptions>();
      const cwd = globalOpts.cwd ? globalOpts.cwd : process.cwd();

      const config = loadConfig(globalOpts.config, cwd);
      const git = new GitEngine(cwd);
      const repoRoot = await git.getRepoRoot();

      const orchestrator = new MannostreeOrchestrator(repoRoot, config);

      const result = await orchestrator.parallelSpawn({
        feature,
        count: cmdOptions.variants,
        baseBranch: cmdOptions.baseBranch,
        profile: cmdOptions.profile,
        planMode: cmdOptions.planMode,
        dryRun: globalOpts.dryRun,
      });

      formatOutput(result, globalOpts, (data, dryRun) =>
        formatParallelSpawnResult(data, dryRun)
      );
    });

  // parallel list
  parallelCmd
    .command('list')
    .description('List all tracked parallel experiment groups')
    .option('--status <status>', 'Filter by status (active, completed, cleaned)')
    .action(async (cmdOptions: any) => {
      const globalOpts = program.opts<GlobalOptions>();
      const cwd = globalOpts.cwd ? globalOpts.cwd : process.cwd();

      const config = loadConfig(globalOpts.config, cwd);
      const git = new GitEngine(cwd);
      const repoRoot = await git.getRepoRoot();

      const orchestrator = new MannostreeOrchestrator(repoRoot, config);

      const result = await orchestrator.parallelList(cmdOptions.status);

      formatOutput(result, globalOpts, (data) =>
        formatParallelListResult(data)
      );
    });

  // parallel compare
  parallelCmd
    .command('compare <feature>')
    .description('Side-by-side comparison of all variants for a feature')
    .action(async (feature: string) => {
      const globalOpts = program.opts<GlobalOptions>();
      const cwd = globalOpts.cwd ? globalOpts.cwd : process.cwd();

      const config = loadConfig(globalOpts.config, cwd);
      const git = new GitEngine(cwd);
      const repoRoot = await git.getRepoRoot();

      const orchestrator = new MannostreeOrchestrator(repoRoot, config);

      const result = await orchestrator.parallelCompare(feature);

      formatOutput(result, globalOpts, (data) =>
        formatParallelCompareResult(data)
      );
    });

  // parallel pick
  parallelCmd
    .command('pick <feature>')
    .description('Select winning variant and optionally clean losing variants')
    .requiredOption('--winner <variant>', 'Winning variant index (e.g. v1, 1) or full ID')
    .option('--cleanup-losers', 'Delete non-winning variant worktrees and branches', false)
    .option('--archive-losers', 'Archive non-winning metadata records when cleaning', false)
    .option('--reason <text>', 'Document reason for winner selection')
    .option('-y, --yes', 'Confirm cleanup of losing variants')
    .action(async (feature: string, cmdOptions: any) => {
      const globalOpts = program.opts<GlobalOptions>();
      const cwd = globalOpts.cwd ? globalOpts.cwd : process.cwd();

      const config = loadConfig(globalOpts.config, cwd);
      const git = new GitEngine(cwd);
      const repoRoot = await git.getRepoRoot();

      const orchestrator = new MannostreeOrchestrator(repoRoot, config);

      const result = await orchestrator.parallelPick({
        feature,
        winner: cmdOptions.winner,
        cleanupLosers: cmdOptions.cleanupLosers,
        archiveLosers: cmdOptions.archiveLosers,
        reason: cmdOptions.reason,
        yes: cmdOptions.yes,
        dryRun: globalOpts.dryRun,
      });

      formatOutput(result, globalOpts, (data, dryRun) =>
        formatParallelPickResult(data, dryRun)
      );
    });

  // parallel drop
  parallelCmd
    .command('drop <feature>')
    .description('Safely drop an entire parallel experiment group and all its variant worktrees')
    .option('--force', 'Force drop dirty worktrees', false)
    .option('--discard-uncommitted', 'Explicitly discard uncommitted changes in worktrees', false)
    .option('--keep-branch', 'Retain git branches', false)
    .option('--archive', 'Archive metadata records', false)
    .option('-y, --yes', 'Confirm deletion of all variant worktrees and branches', false)
    .action(async (feature: string, cmdOptions: any) => {
      const globalOpts = program.opts<GlobalOptions>();
      const cwd = globalOpts.cwd ? globalOpts.cwd : process.cwd();

      const config = loadConfig(globalOpts.config, cwd);
      const git = new GitEngine(cwd);
      const repoRoot = await git.getRepoRoot();

      const orchestrator = new MannostreeOrchestrator(repoRoot, config);

      const force = cmdOptions.force || cmdOptions.discardUncommitted;

      const result = await orchestrator.parallelDrop({
        feature,
        force,
        keepBranch: cmdOptions.keepBranch,
        archive: cmdOptions.archive,
        yes: cmdOptions.yes,
        dryRun: globalOpts.dryRun,
      });

      formatOutput(result, globalOpts, (data, dryRun) =>
        formatParallelDropResult(data, dryRun)
      );
    });

  // parallel drop-status
  parallelCmd
    .command('drop-status <feature>')
    .description('Inspect current variant survival and drop status for an experiment')
    .action(async (feature: string) => {
      const globalOpts = program.opts<GlobalOptions>();
      const cwd = globalOpts.cwd ? globalOpts.cwd : process.cwd();

      const config = loadConfig(globalOpts.config, cwd);
      const git = new GitEngine(cwd);
      const repoRoot = await git.getRepoRoot();

      const orchestrator = new MannostreeOrchestrator(repoRoot, config);

      // Inspect experiment and variants
      const exp = await orchestrator.store.getExperiment(feature);
      const output = {
        command: 'parallel drop-status',
        ok: true,
        dry_run: false,
        result: exp
          ? {
              feature: exp.feature,
              status: exp.status,
              winner: exp.winner,
              surviving_variants: exp.variants,
              total_variants: exp.variants.length,
            }
          : null,
        warnings: exp ? [] : [`No experiment found with feature name '${feature}'.`],
        errors: [],
      };

      formatOutput(output, globalOpts, (data) => {
        if (!data) return `No experiment record found for '${feature}'.`;
        return [
          `Experiment '${data.feature}':`,
          `  Status:             ${data.status}`,
          `  Winner:             ${data.winner || 'none'}`,
          `  Surviving Variants: ${data.surviving_variants.join(', ')} (${data.total_variants} total)`,
        ].join('\n');
      });
    });

  // parallel handoff
  parallelCmd
    .command('handoff <feature>')
    .description('Generate packaged handoff report and bundle for parallel experiment winner')
    .option('--to <recipient>', 'Target recipient or agent name')
    .option('--notes <notes>', 'Additional handover notes')
    .action(async (feature: string, cmdOptions: any) => {
      const globalOpts = program.opts<GlobalOptions>();
      const cwd = globalOpts.cwd ? globalOpts.cwd : process.cwd();

      const config = loadConfig(globalOpts.config, cwd);
      const git = new GitEngine(cwd);
      const repoRoot = await git.getRepoRoot();

      const orchestrator = new MannostreeOrchestrator(repoRoot, config);

      const result = await orchestrator.parallelHandoff(feature, {
        to: cmdOptions.to,
        notes: cmdOptions.notes,
        dryRun: globalOpts.dryRun,
      });

      formatOutput(result, globalOpts, (data) => {
        return [
          `Parallel Handoff Generated for '${data.feature}':`,
          `  Winner:            ${data.winner.variant_id} (${data.winner.branch})`,
          `  Scorecard:         ${data.comparison_scorecard.length} variants compared`,
          `  Preserved Losers:  ${data.preserved_losers.map((l) => l.variant_id).join(', ') || 'none'}`,
          `  Report Saved To:   ${data.artifact_path}`,
        ].join('\n');
      });
    });
}
