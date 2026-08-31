import { Command } from 'commander';
import { loadConfig } from '../../config/loader.js';
import { MannostreeOrchestrator } from '../../core/orchestrator.js';
import { GitEngine } from '../../git/engine.js';
import { formatOutput, formatWorktreeTable } from '../output.js';
import { GlobalOptions } from '../../types/index.js';

export function registerListCommand(program: Command): void {
  program
    .command('list')
    .description('Enumerate tracked worktrees')
    .option('--state <state>', 'Filter by lifecycle state or status')
    .option('--kind <kind>', 'Filter by branch kind')
    .option('--tag <tag>', 'Filter by tag')
    .option('--archived', 'List only archived workspaces')
    .action(async (cmdOptions: any) => {
      const globalOpts = program.opts<GlobalOptions>();
      const cwd = globalOpts.cwd ? globalOpts.cwd : process.cwd();

      const config = loadConfig(globalOpts.config, cwd);
      const git = new GitEngine(cwd);
      const repoRoot = await git.getRepoRoot();

      const orchestrator = new MannostreeOrchestrator(repoRoot, config);

      const result = await orchestrator.list({
        state: cmdOptions.state,
        kind: cmdOptions.kind,
        tag: cmdOptions.tag,
        archived: cmdOptions.archived,
      });

      formatOutput(result, globalOpts, (data) => formatWorktreeTable(data));
    });
}
