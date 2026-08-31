import { Command } from 'commander';
import { loadConfig } from '../../config/loader.js';
import { MannostreeOrchestrator } from '../../core/orchestrator.js';
import { GitEngine } from '../../git/engine.js';
import { formatOutput, formatHandoffResult } from '../output.js';
import { GlobalOptions } from '../../types/index.js';

export function registerHandoffCommand(program: Command): void {
  program
    .command('handoff <id>')
    .description('Generate a complete handoff summary for a successor agent or human reviewer')
    .option('--to <name>', 'Target recipient agent or reviewer name')
    .option('--notes <text>', 'Additional context or instructions for recipient')
    .action(async (id: string, cmdOptions: any) => {
      const globalOpts = program.opts<GlobalOptions>();
      const cwd = globalOpts.cwd ? globalOpts.cwd : process.cwd();

      const config = loadConfig(globalOpts.config, cwd);
      const git = new GitEngine(cwd);
      const repoRoot = await git.getRepoRoot();

      const orchestrator = new MannostreeOrchestrator(repoRoot, config);

      const result = await orchestrator.handoff(id, {
        to: cmdOptions.to,
        notes: cmdOptions.notes,
      });

      formatOutput(result, globalOpts, (data) =>
        formatHandoffResult(data)
      );
    });
}
