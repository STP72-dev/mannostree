import { Command } from 'commander';
import { loadConfig } from '../../config/loader.js';
import { MannostreeOrchestrator } from '../../core/orchestrator.js';
import { GitEngine } from '../../git/engine.js';
import { GlobalOptions } from '../../types/index.js';

export function registerExecCommand(program: Command): void {
  program
    .command('exec <id> [command...]')
    .description('Run a command inside a worktree directory with profile environment')
    .allowUnknownOption()
    .action(async (id: string, commandArgs: string[]) => {
      const globalOpts = program.opts<GlobalOptions>();
      const cwd = globalOpts.cwd ? globalOpts.cwd : process.cwd();

      const config = loadConfig(globalOpts.config, cwd);
      const git = new GitEngine(cwd);
      const repoRoot = await git.getRepoRoot();

      const orchestrator = new MannostreeOrchestrator(repoRoot, config);

      const res = await orchestrator.exec(id, commandArgs, {
        inheritStdio: true,
      });

      process.exit(res.exitCode);
    });
}
