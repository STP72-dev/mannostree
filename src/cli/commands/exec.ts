import { Command } from 'commander';
import { loadConfig } from '../../config/loader.js';
import { MannostreeOrchestrator } from '../../core/orchestrator.js';
import { GitEngine } from '../../git/engine.js';
import { formatOutput } from '../output.js';
import { GlobalOptions, SandboxRuntimeType, NetworkIsolationMode } from '../../types/index.js';

export function registerExecCommand(program: Command): void {
  program
    .command('exec <id> [command...]')
    .description('Run a command inside a worktree directory with optional container sandbox isolation')
    .option('--sandbox <type>', 'Sandbox runtime driver (docker, podman, process)')
    .option('--image <name>', 'Container image for docker or podman sandboxes')
    .option('--cpus <n>', 'CPU core ceiling limit (e.g. 2.0)', parseFloat)
    .option('--memory <limit>', 'Memory quota limit (e.g. 2GB, 512MB)')
    .option('--network <mode>', 'Network isolation policy (none, bridge, host, egress-only)')
    .option('--timeout <seconds>', 'Execution timeout in seconds', parseInt)
    .allowUnknownOption()
    .action(async (id: string, commandArgs: string[], cmdOptions: any) => {
      const globalOpts = program.opts<GlobalOptions>();
      const cwd = globalOpts.cwd ? globalOpts.cwd : process.cwd();

      const config = loadConfig(globalOpts.config, cwd);
      const git = new GitEngine(cwd);
      const repoRoot = await git.getRepoRoot();

      const orchestrator = new MannostreeOrchestrator(repoRoot, config);

      const isJson = !!globalOpts.json;
      const isPlain = !!globalOpts.plain;

      const res = await orchestrator.exec(id, commandArgs, {
        inheritStdio: !isJson && !isPlain && !cmdOptions.sandbox && !globalOpts.dryRun,
        sandbox: cmdOptions.sandbox as SandboxRuntimeType,
        image: cmdOptions.image,
        cpus: cmdOptions.cpus,
        memory: cmdOptions.memory,
        network: cmdOptions.network as NetworkIsolationMode,
        timeout: cmdOptions.timeout,
        dryRun: globalOpts.dryRun,
      });

      if (isJson || isPlain || globalOpts.yaml) {
        formatOutput(
          {
            command: 'exec',
            ok: res.ok,
            dry_run: !!globalOpts.dryRun,
            result: res.result,
            warnings: [],
            errors: res.exitCode !== 0 ? [res.stderr || `Command exited with code ${res.exitCode}`] : [],
          },
          globalOpts,
          (data) => data.stdout || ''
        );
      } else if (cmdOptions.sandbox || globalOpts.dryRun) {
        if (res.stdout) process.stdout.write(res.stdout + '\n');
        if (res.stderr) process.stderr.write(res.stderr + '\n');
      }

      if (res.exitCode !== 0 && !isJson && !isPlain && !globalOpts.yaml) {
        process.exit(res.exitCode);
      }
    });
}
