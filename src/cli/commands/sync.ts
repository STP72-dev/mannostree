import { Command } from 'commander';
import { loadConfig } from '../../config/loader.js';
import { MannostreeOrchestrator } from '../../core/orchestrator.js';
import { GitEngine } from '../../git/engine.js';
import { formatOutput, formatSyncResult } from '../output.js';
import { GlobalOptions } from '../../types/index.js';

export function registerSyncCommand(program: Command): void {
  program
    .command('sync <id>')
    .description('Update a worktree against its explicit base branch')
    .option('--strategy <strategy>', 'Sync strategy (rebase, merge, ff-only)', 'rebase')
    .option('--no-fetch', 'Skip fetching from remote before syncing')
    .action(async (id: string, cmdOptions: any) => {
      const globalOpts = program.opts<GlobalOptions>();
      const cwd = globalOpts.cwd ? globalOpts.cwd : process.cwd();

      const config = loadConfig(globalOpts.config, cwd);
      const git = new GitEngine(cwd);
      const repoRoot = await git.getRepoRoot();

      const orchestrator = new MannostreeOrchestrator(repoRoot, config);

      const result = await orchestrator.sync(id, {
        strategy: cmdOptions.strategy,
        fetch: cmdOptions.fetch,
        dryRun: globalOpts.dryRun,
      });

      formatOutput(result, globalOpts, (data, dryRun) =>
        formatSyncResult(data, dryRun)
      );
    });
}
