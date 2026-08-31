import { Command } from 'commander';
import { loadConfig } from '../../config/loader.js';
import { MannostreeOrchestrator } from '../../core/orchestrator.js';
import { GitEngine } from '../../git/engine.js';
import { formatOutput, formatSetupResult } from '../output.js';
import { GlobalOptions } from '../../types/index.js';

export function registerSetupCommand(program: Command): void {
  program
    .command('setup <id>')
    .description('Apply or re-apply setup profile to an existing worktree')
    .option('--profile <name>', 'Profile to apply (overrides existing profile)')
    .option('--reinstall', 'Re-run install commands even if previously executed', false)
    .action(async (id: string, cmdOptions: any) => {
      const globalOpts = program.opts<GlobalOptions>();
      const cwd = globalOpts.cwd ? globalOpts.cwd : process.cwd();

      const config = loadConfig(globalOpts.config, cwd);
      const git = new GitEngine(cwd);
      const repoRoot = await git.getRepoRoot();

      const orchestrator = new MannostreeOrchestrator(repoRoot, config);

      const result = await orchestrator.setup(id, {
        profile: cmdOptions.profile,
        reinstall: cmdOptions.reinstall,
        dryRun: globalOpts.dryRun,
      });

      formatOutput(result, globalOpts, (data, dryRun) =>
        formatSetupResult(data, dryRun)
      );
    });
}
