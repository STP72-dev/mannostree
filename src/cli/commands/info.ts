import { Command } from 'commander';
import { loadConfig } from '../../config/loader.js';
import { MannostreeOrchestrator } from '../../core/orchestrator.js';
import { GitEngine } from '../../git/engine.js';
import { formatOutput, formatWorktreeInfo } from '../output.js';
import { GlobalOptions } from '../../types/index.js';

export function registerInfoCommand(program: Command): void {
  program
    .command('info <id>')
    .description('Show full worktree record for a single id')
    .action(async (id: string) => {
      const globalOpts = program.opts<GlobalOptions>();
      const cwd = globalOpts.cwd ? globalOpts.cwd : process.cwd();

      const config = loadConfig(globalOpts.config, cwd);
      const git = new GitEngine(cwd);
      const repoRoot = await git.getRepoRoot();

      const orchestrator = new MannostreeOrchestrator(repoRoot, config);

      const result = await orchestrator.info(id);

      formatOutput(result, globalOpts, (data) => formatWorktreeInfo(data));
    });
}
