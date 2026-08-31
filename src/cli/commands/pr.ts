import { Command } from 'commander';
import { loadConfig } from '../../config/loader.js';
import { MannostreeOrchestrator } from '../../core/orchestrator.js';
import { GitEngine } from '../../git/engine.js';
import { formatOutput, formatPrResult } from '../output.js';
import { GlobalOptions } from '../../types/index.js';

export function registerPrCommand(program: Command): void {
  program
    .command('pr <id>')
    .description('Assemble pull request documentation from task artifacts and optionally publish')
    .option('--title <text>', 'Custom pull request title')
    .option('--body-file <path>', 'Custom markdown file to use as PR body')
    .option('--draft', 'Create PR as draft', true)
    .option('--push', 'Push branch to remote and invoke GitHub CLI to create PR', false)
    .action(async (id: string, cmdOptions: any) => {
      const globalOpts = program.opts<GlobalOptions>();
      const cwd = globalOpts.cwd ? globalOpts.cwd : process.cwd();

      const config = loadConfig(globalOpts.config, cwd);
      const git = new GitEngine(cwd);
      const repoRoot = await git.getRepoRoot();

      const orchestrator = new MannostreeOrchestrator(repoRoot, config);

      const result = await orchestrator.pr(id, {
        title: cmdOptions.title,
        bodyFile: cmdOptions.bodyFile,
        draft: cmdOptions.draft,
        push: cmdOptions.push,
        dryRun: globalOpts.dryRun,
      });

      formatOutput(result, globalOpts, (data, dryRun) =>
        formatPrResult(data, dryRun)
      );
    });
}
