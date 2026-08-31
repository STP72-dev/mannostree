import { Command } from 'commander';
import { loadConfig } from '../../config/loader.js';
import { MannostreeOrchestrator } from '../../core/orchestrator.js';
import { GitEngine } from '../../git/engine.js';
import { formatOutput, formatTaskResult } from '../output.js';
import { GlobalOptions } from '../../types/index.js';

export function registerTaskCommand(program: Command): void {
  program
    .command('task <id>')
    .description('Validate and inspect durable task artifacts (.task/) for a worktree')
    .option('--validate', 'Validate completeness of required artifact files', true)
    .action(async (id: string, cmdOptions: any) => {
      const globalOpts = program.opts<GlobalOptions>();
      const cwd = globalOpts.cwd ? globalOpts.cwd : process.cwd();

      const config = loadConfig(globalOpts.config, cwd);
      const git = new GitEngine(cwd);
      const repoRoot = await git.getRepoRoot();

      const orchestrator = new MannostreeOrchestrator(repoRoot, config);

      const result = await orchestrator.task(id, {
        validate: cmdOptions.validate,
      });

      formatOutput(result, globalOpts, (data) =>
        formatTaskResult(data)
      );
    });
}
