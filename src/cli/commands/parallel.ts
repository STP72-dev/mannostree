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

      const result = await orchestrator.parallelDrop({
        feature,
        force: cmdOptions.force,
        keepBranch: cmdOptions.keepBranch,
        archive: cmdOptions.archive,
        yes: cmdOptions.yes,
        dryRun: globalOpts.dryRun,
      });

      formatOutput(result, globalOpts, (data, dryRun) =>
        formatParallelDropResult(data, dryRun)
      );
    });
}
