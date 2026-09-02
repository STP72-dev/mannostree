import { Command } from 'commander';
import chalk from 'chalk';
import YAML from 'yaml';
import { registerSpawnCommand } from './commands/spawn.js';
import { registerListCommand } from './commands/list.js';
import { registerInfoCommand } from './commands/info.js';
import { registerDropCommand } from './commands/drop.js';
import { registerStatusCommand } from './commands/status.js';
import { registerSyncCommand } from './commands/sync.js';
import { registerDoctorCommand } from './commands/doctor.js';
import { registerCleanCommand } from './commands/clean.js';
import { registerRecoverCommand } from './commands/recover.js';
import { registerSetupCommand } from './commands/setup.js';
import { registerEnvCommand } from './commands/env.js';
import { registerExecCommand } from './commands/exec.js';
import { registerParallelCommand } from './commands/parallel.js';
import { registerPrCommand } from './commands/pr.js';
import { registerIssueCommands } from './commands/issue.js';
import { registerTaskCommand } from './commands/task.js';
import { registerHandoffCommand } from './commands/handoff.js';
import { registerArchiveCommand } from './commands/archive.js';
import { registerAgentCommand } from './commands/agent.js';
import { registerFleetCommand } from './commands/fleet.js';
import { registerPolyCommands } from './commands/poly.js';

import { ExitCode, GlobalOptions, MannostreeError } from '../types/index.js';

export function createProgram(): Command {
  const program = new Command();

  program
    .name('mannostree')
    .description('Developer workspace lifecycle manager — git worktrees for parallel task execution and agent workflows')
    .version('0.1.0')
    .option('--json', 'Structured JSON output')
    .option('--yaml', 'Structured YAML output')
    .option('--plain', 'Minimal plain text output')
    .option('-v, --verbose', 'Verbose logging output')
    .option('-q, --quiet', 'Suppress non-essential output')
    .option('--dry-run', 'Simulate actions without modifying disk or git')
    .option('--config <file>', 'Path to custom .mannostree.yml config file')
    .option('--profile <name>', 'Configuration profile to apply')
    .option('--cwd <path>', 'Run as if invoked from specified directory')
    .option('--no-color', 'Disable ANSI colors');

  // Phase 1 commands
  registerSpawnCommand(program);
  registerListCommand(program);
  registerInfoCommand(program);
  registerDropCommand(program);

  // Phase 2 commands
  registerStatusCommand(program);
  registerSyncCommand(program);
  registerDoctorCommand(program);
  registerCleanCommand(program);
  registerRecoverCommand(program);
  registerArchiveCommand(program);

  // Phase 3 commands
  registerSetupCommand(program);
  registerEnvCommand(program);
  registerExecCommand(program);

  // Phase 4 commands
  registerParallelCommand(program);

  // Phase 5 commands
  registerPrCommand(program);
  registerIssueCommands(program);
  registerTaskCommand(program);
  registerHandoffCommand(program);


  // Movement 1, 3 & 9 commands
  registerAgentCommand(program);
  registerFleetCommand(program);
  registerPolyCommands(program);

  return program;
}



export async function runCli(argv: string[] = process.argv): Promise<void> {
  const program = createProgram();

  try {
    await program.parseAsync(argv);
  } catch (err: any) {
    const opts = program.opts<GlobalOptions>();
    const exitCode = err instanceof MannostreeError ? err.exitCode : ExitCode.GENERIC_FAILURE;

    if (opts.json) {
      console.error(
        JSON.stringify(
          {
            command: program.args[0] || 'unknown',
            ok: false,
            dry_run: !!opts.dryRun,
            warnings: [],
            errors: [err.message || 'Unknown error occurred'],
            details: err.details || null,
          },
          null,
          2
        )
      );
    } else if (opts.yaml) {
      console.error(
        YAML.stringify({
          command: program.args[0] || 'unknown',
          ok: false,
          dry_run: !!opts.dryRun,
          warnings: [],
          errors: [err.message || 'Unknown error occurred'],
          details: err.details || null,
        })
      );
    } else {
      console.error(chalk.red(`✖ Error: ${err.message}`));
      if (opts.verbose && err.stack) {
        console.error(chalk.dim(err.stack));
      }
    }

    process.exit(exitCode);
  }
}
