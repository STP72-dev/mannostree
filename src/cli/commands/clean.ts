import { Command } from 'commander';
import { loadConfig } from '../../config/loader.js';
import { MannostreeOrchestrator } from '../../core/orchestrator.js';
import { GitEngine } from '../../git/engine.js';
import { formatOutput, formatCleanReport } from '../output.js';
import { GlobalOptions } from '../../types/index.js';

export function registerCleanCommand(program: Command): void {
  program
    .command('clean')
    .description('Bulk cleanup of merged or stale worktrees')
    .option('--merged', 'Match worktrees whose branches are fully merged into base branch')
    .option('--stale-days <days>', 'Match worktrees inactive for more than N days', (val) => parseInt(val, 10))
    .option('--state <state>', 'Match worktrees with specified lifecycle state or status')
    .option('--force', 'Force cleanup even if worktree is dirty')
    .option('-y, --yes', 'Confirm execution of destructive cleanup')
    .action(async (cmdOptions: any) => {
      const globalOpts = program.opts<GlobalOptions>();
      const cwd = globalOpts.cwd ? globalOpts.cwd : process.cwd();

      const config = loadConfig(globalOpts.config, cwd);
      const git = new GitEngine(cwd);
      const repoRoot = await git.getRepoRoot();

      const orchestrator = new MannostreeOrchestrator(repoRoot, config);

      const result = await orchestrator.clean({
        merged: cmdOptions.merged,
        staleDays: cmdOptions.staleDays,
        state: cmdOptions.state,
        force: cmdOptions.force,
        yes: cmdOptions.yes,
        dryRun: globalOpts.dryRun,
      });

      formatOutput(result, globalOpts, (data, dryRun) =>
        formatCleanReport(data, dryRun)
      );
    });
}
