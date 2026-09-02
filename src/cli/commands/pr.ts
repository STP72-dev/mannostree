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
    .option('--no-draft', 'Create PR as ready for review')
    .option('--push', 'Push branch to remote and invoke host platform adapter to create PR/MR', false)
    .option('--host <type>', 'Override auto-detected host adapter (github, gitlab, gitea, bitbucket, generic)')
    .option('--remote <name>', 'Git remote name to use (default: origin)')
    .option('--target-base <branch>', 'Target base branch for PR/MR')
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
        host: cmdOptions.host,
        remote: cmdOptions.remote,
        targetBase: cmdOptions.targetBase,
        dryRun: globalOpts.dryRun,
      });

      formatOutput(result, globalOpts, (data, dryRun) =>
        formatPrResult(data, dryRun)
      );
    });
}
