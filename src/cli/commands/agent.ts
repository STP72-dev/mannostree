import { Command } from 'commander';
import chalk from 'chalk';
import { loadConfig } from '../../config/loader.js';
import { MannostreeOrchestrator } from '../../core/orchestrator.js';
import { GitEngine } from '../../git/engine.js';
import { formatOutput } from '../output.js';
import { GlobalOptions } from '../../types/index.js';

export function registerAgentCommand(program: Command): void {
  const agentCmd = program
    .command('agent')
    .description('Manage autonomous worker agent dispatch, execution, and verification');

  // agent dispatch
  agentCmd
    .command('dispatch <target>')
    .description('Dispatch a worker agent into an isolated worktree or experiment group')
    .option('--role <role>', 'Assigned agent role (planner, worker, verifier)', 'worker')
    .option('--command <cmd>', 'Override agent executable command template')
    .option('--contract <file>', 'Use pre-existing contract markdown file')
    .option('--title <title>', 'Task title')
    .option('--problem <text>', 'Problem statement description')
    .option('--scope <items...>', 'Scope deliverable items')
    .option('--timeout <seconds>', 'Execution timeout in seconds', (val) => parseInt(val, 10))
    .option('--parallel', 'Dispatch to all variants in an experiment', false)
    .option('--sandbox <type>', 'Sandbox runtime driver (docker, podman, process)')
    .option('--image <image>', 'Container image for sandbox execution')
    .option('--cpus <n>', 'CPU core ceiling limit', parseFloat)
    .option('--memory <limit>', 'Memory quota limit (e.g. 2GB)')
    .option('--network <mode>', 'Network isolation policy (none, bridge, host)')
    .action(async (target: string, cmdOptions: any) => {
      const globalOpts = program.opts<GlobalOptions>();
      const cwd = globalOpts.cwd ? globalOpts.cwd : process.cwd();

      const config = loadConfig(globalOpts.config, cwd);
      const git = new GitEngine(cwd);
      const repoRoot = await git.getRepoRoot();

      const orchestrator = new MannostreeOrchestrator(repoRoot, config);

      const result = await orchestrator.agentDispatch({
        target,
        role: cmdOptions.role,
        command: cmdOptions.command,
        contract: cmdOptions.contract,
        title: cmdOptions.title,
        problemStatement: cmdOptions.problem,
        scope: cmdOptions.scope,
        criteria: cmdOptions.criteria,
        timeoutSeconds: cmdOptions.timeout,
        parallel: cmdOptions.parallel,
        dryRun: globalOpts.dryRun,
        sandbox: cmdOptions.sandbox,
        image: cmdOptions.image,
        cpus: cmdOptions.cpus,
        memory: cmdOptions.memory,
        network: cmdOptions.network,
      });

      formatOutput(result, globalOpts, (data, dryRun) => {
        const lines: string[] = [];
        lines.push(
          chalk.bold(
            dryRun
              ? `[DRY-RUN] Would dispatch agent session(s) for '${target}':`
              : `Dispatched agent session(s) for '${target}':`
          )
        );

        for (const s of data.sessions) {
          lines.push(`  Session ID:    ${chalk.cyan(s.session_id)}`);
          lines.push(`  Worktree:      ${s.worktree_id}`);
          lines.push(`  Role:          ${s.role}`);
          lines.push(`  State:         ${chalk.green(s.state)}`);
          lines.push(`  Contract:      ${s.contract_path}`);
          lines.push(`  Command:       ${chalk.dim(s.command)}`);
          if (s.pid) lines.push(`  PID:           ${s.pid}`);
          lines.push('');
        }

        return lines.join('\n');
      });
    });

  // agent status
  agentCmd
    .command('status [target]')
    .description('Inspect active or completed agent execution sessions')
    .action(async (target?: string) => {
      const globalOpts = program.opts<GlobalOptions>();
      const cwd = globalOpts.cwd ? globalOpts.cwd : process.cwd();

      const config = loadConfig(globalOpts.config, cwd);
      const git = new GitEngine(cwd);
      const repoRoot = await git.getRepoRoot();

      const orchestrator = new MannostreeOrchestrator(repoRoot, config);

      const result = await orchestrator.agentStatus({ target });

      formatOutput(result, globalOpts, (data) => {
        if (data.sessions.length === 0) {
          return target
            ? `No agent sessions found for '${target}'.`
            : 'No active or historical agent sessions found in metadata.';
        }

        const lines: string[] = [chalk.bold(`Agent Sessions (${data.sessions.length}):`), ''];

        for (const s of data.sessions) {
          const stateColor =
            s.state === 'fulfilled'
              ? chalk.green
              : s.state === 'working' || s.state === 'dispatched'
              ? chalk.yellow
              : chalk.red;

          lines.push(
            `• ${chalk.cyan(s.session_id)} | ${chalk.bold(s.worktree_id)} | Role: ${s.role} | State: ${stateColor(s.state.toUpperCase())}`
          );
          lines.push(`  Started:  ${s.started_at}`);
          if (s.ended_at) lines.push(`  Ended:    ${s.ended_at} (${s.duration_seconds}s)`);
          lines.push(`  Contract: ${s.contract_path}`);
          if (s.scorecard_path) lines.push(`  Scorecard: ${s.scorecard_path}`);
          if (s.error) lines.push(`  Error:    ${chalk.red(s.error)}`);
          lines.push('');
        }

        return lines.join('\n');
      });
    });

  // agent verify
  agentCmd
    .command('verify <target>')
    .description('Independently verify contract fulfillment and automated quality gates')
    .option('--retries <count>', 'Number of retries for flaky quality gates', (val) => parseInt(val, 10), 0)
    .action(async (target: string, cmdOptions: any) => {
      const globalOpts = program.opts<GlobalOptions>();
      const cwd = globalOpts.cwd ? globalOpts.cwd : process.cwd();

      const config = loadConfig(globalOpts.config, cwd);
      const git = new GitEngine(cwd);
      const repoRoot = await git.getRepoRoot();

      const orchestrator = new MannostreeOrchestrator(repoRoot, config);

      const result = await orchestrator.agentVerify({
        target,
        retries: cmdOptions.retries,
        dryRun: globalOpts.dryRun,
      });

      formatOutput(result, globalOpts, (data) => {
        const { report, scorecard, scorecard_path } = data;
        const statusColor = report.status === 'fulfilled' ? chalk.green : chalk.red;

        const lines: string[] = [
          chalk.bold(`Verification Result for '${report.worktree_id}': ${statusColor(report.status.toUpperCase())}`),
          `  Verified At:          ${report.verified_at}`,
          `  Criteria Completed:   ${report.completed_criteria} / ${report.total_criteria}`,
          `  Quality Gates Passed: ${report.quality_gates.passed ? chalk.green('YES') : chalk.red('NO')}`,
          `  Scorecard Saved To:   ${scorecard_path}`,
          '',
          chalk.bold('Diff Statistics:'),
          `  Files Changed:        ${scorecard.git_diff.files_changed}`,
          `  Insertions:           +${scorecard.git_diff.insertions}`,
          `  Deletions:            -${scorecard.git_diff.deletions}`,
        ];

        if (report.status === 'rejected') {
          lines.push('');
          lines.push(chalk.yellow.bold('Remediation Required:'));
          for (const step of report.remediation_steps) {
            lines.push(`  • ${step}`);
          }
        }

        return lines.join('\n');
      });
    });

  // agent cancel
  agentCmd
    .command('cancel <target>')
    .description('Cancel an active agent execution session safely')
    .option('-f, --force', 'Send SIGKILL instead of SIGTERM', false)
    .action(async (target: string, cmdOptions: any) => {
      const globalOpts = program.opts<GlobalOptions>();
      const cwd = globalOpts.cwd ? globalOpts.cwd : process.cwd();

      const config = loadConfig(globalOpts.config, cwd);
      const git = new GitEngine(cwd);
      const repoRoot = await git.getRepoRoot();

      const orchestrator = new MannostreeOrchestrator(repoRoot, config);

      const result = await orchestrator.agentCancel({
        target,
        force: cmdOptions.force,
      });

      formatOutput(result, globalOpts, (data) => {
        if (!data.session) {
          return `No active session found for '${target}'.`;
        }
        return `Cancelled session ${chalk.cyan(data.session.session_id)} for '${target}'. Workspace changes preserved.`;
      });
    });
}
