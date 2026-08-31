import { Command } from 'commander';
import { loadConfig } from '../../config/loader.js';
import { MannostreeOrchestrator } from '../../core/orchestrator.js';
import { GitEngine } from '../../git/engine.js';
import { formatOutput, formatIssueResult } from '../output.js';
import { GlobalOptions } from '../../types/index.js';

export function registerIssueCommand(program: Command): void {
  program
    .command('issue <id>')
    .description('Link a GitHub issue to a worktree workspace')
    .requiredOption('--from-issue <num>', 'Issue number to link', (val) => parseInt(val, 10))
    .option('--title <text>', 'Issue title')
    .action(async (id: string, cmdOptions: any) => {
      const globalOpts = program.opts<GlobalOptions>();
      const cwd = globalOpts.cwd ? globalOpts.cwd : process.cwd();

      const config = loadConfig(globalOpts.config, cwd);
      const git = new GitEngine(cwd);
      const repoRoot = await git.getRepoRoot();

      const orchestrator = new MannostreeOrchestrator(repoRoot, config);

      const result = await orchestrator.issue(id, {
        issue: cmdOptions.fromIssue,
        title: cmdOptions.title,
        dryRun: globalOpts.dryRun,
      });

      formatOutput(result, globalOpts, (data, dryRun) =>
        formatIssueResult(data, dryRun)
      );
    });
}
