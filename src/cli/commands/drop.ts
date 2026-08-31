import { Command } from 'commander';
import chalk from 'chalk';
import { loadConfig } from '../../config/loader.js';
import { MannostreeOrchestrator } from '../../core/orchestrator.js';
import { GitEngine } from '../../git/engine.js';
import { formatOutput } from '../output.js';
import { GlobalOptions } from '../../types/index.js';

export function registerDropCommand(program: Command): void {
  program
    .command('drop <id>')
    .description('Safely remove a worktree and its branch')
    .option('--keep-branch', 'Retain the git branch after removing worktree')
    .option('--force', 'Force removal even if worktree contains uncommitted/untracked changes')
    .option('--archive', 'Archive metadata record instead of deleting it')
    .option('-y, --yes', 'Confirm drop operation')
    .action(async (id: string, cmdOptions: any) => {
      const globalOpts = program.opts<GlobalOptions>();
      const cwd = globalOpts.cwd ? globalOpts.cwd : process.cwd();

      const config = loadConfig(globalOpts.config, cwd);
      const git = new GitEngine(cwd);
      const repoRoot = await git.getRepoRoot();

      const orchestrator = new MannostreeOrchestrator(repoRoot, config);

      const result = await orchestrator.drop(id, {
        keepBranch: cmdOptions.keepBranch,
        force: cmdOptions.force,
        archive: cmdOptions.archive,
        dryRun: globalOpts.dryRun,
      });

      formatOutput(result, globalOpts, (data, dryRun) => {
        return dryRun
          ? chalk.yellow(`Plan: would drop worktree '${data.id}' (branch removal: ${data.removed_branch})`)
          : chalk.green(`✔ Successfully dropped worktree '${data.id}'`);
      });
    });
}
