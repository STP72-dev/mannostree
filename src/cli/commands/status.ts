import { Command } from 'commander';
import { loadConfig } from '../../config/loader.js';
import { MannostreeOrchestrator } from '../../core/orchestrator.js';
import { GitEngine } from '../../git/engine.js';
import { formatOutput, formatWorktreeInfo } from '../output.js';
import { GlobalOptions } from '../../types/index.js';

export function registerStatusCommand(program: Command): void {
  program
    .command('status <id>')
    .description('Show live git and lifecycle status of a worktree')
    .option('--fetch', 'Fetch remote references before checking status', false)
    .action(async (id: string, cmdOptions: any) => {
      const globalOpts = program.opts<GlobalOptions>();
      const cwd = globalOpts.cwd ? globalOpts.cwd : process.cwd();

      const config = loadConfig(globalOpts.config, cwd);
      const git = new GitEngine(cwd);
      const repoRoot = await git.getRepoRoot();

      const orchestrator = new MannostreeOrchestrator(repoRoot, config);

      const result = await orchestrator.status(id, {
        fetch: cmdOptions.fetch,
      });

      formatOutput(result, globalOpts, (data) => formatWorktreeInfo(data));
    });
}
