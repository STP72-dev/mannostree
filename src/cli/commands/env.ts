import { Command } from 'commander';
import { loadConfig } from '../../config/loader.js';
import { MannostreeOrchestrator } from '../../core/orchestrator.js';
import { GitEngine } from '../../git/engine.js';
import { formatOutput, formatEnvResult } from '../output.js';
import { GlobalOptions } from '../../types/index.js';

export function registerEnvCommand(program: Command): void {
  program
    .command('env <id>')
    .description('Apply or re-apply environment file policy (copy, link, skip, generate)')
    .option('--mode <mode>', 'Env mode (copy, link, skip, generate)')
    .option('--from <path>', 'Source directory for env files (default: repository root)')
    .action(async (id: string, cmdOptions: any) => {
      const globalOpts = program.opts<GlobalOptions>();
      const cwd = globalOpts.cwd ? globalOpts.cwd : process.cwd();

      const config = loadConfig(globalOpts.config, cwd);
      const git = new GitEngine(cwd);
      const repoRoot = await git.getRepoRoot();

      const orchestrator = new MannostreeOrchestrator(repoRoot, config);

      const result = await orchestrator.env(id, {
        mode: cmdOptions.mode,
        from: cmdOptions.from,
        dryRun: globalOpts.dryRun,
      });

      formatOutput(result, globalOpts, (data, dryRun) =>
        formatEnvResult(data, dryRun)
      );
    });
}
