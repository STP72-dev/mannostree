import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'node:fs';
import { loadConfig } from '../../config/loader.js';
import { MannostreeOrchestrator } from '../../core/orchestrator.js';
import { GitEngine } from '../../git/engine.js';
import { formatOutput, formatIssueResult } from '../output.js';
import { GlobalOptions, IssueTrackerProvider } from '../../types/index.js';

export function registerIssueCommands(program: Command): void {
  const issueGroup = program
    .command('issue [target]')
    .description('Manage bi-directional issue tracker synchronization (Jira / Linear / GitHub Issues)')
    .option('--from-issue <num>', 'Link existing GitHub issue number', (val) => parseInt(val, 10))
    .option('--title <text>', 'Issue title')
    .action(async (target: string | undefined, cmdOptions: any) => {
      if (target && cmdOptions.fromIssue !== undefined) {
        const globalOpts = program.opts<GlobalOptions>();
        const cwd = globalOpts.cwd || process.cwd();
        const config = loadConfig(globalOpts.config, cwd);
        const git = new GitEngine(cwd);
        const repoRoot = await git.getRepoRoot();
        const orchestrator = new MannostreeOrchestrator(repoRoot, config);

        const result = await orchestrator.issue(target, {
          issue: cmdOptions.fromIssue,
          title: cmdOptions.title,
          dryRun: globalOpts.dryRun,
        });

        formatOutput(result, globalOpts, (data, dryRun) =>
          formatIssueResult(data, dryRun)
        );
      } else {
        issueGroup.help();
      }
    });

  // 1. issue ingest
  issueGroup
    .command('ingest <key>')

    .description('Ingest remote issue ticket and generate .task/task-contract.md')
    .option('-w, --worktree <id>', 'Worktree ID to bind issue to')
    .option('-p, --provider <provider>', 'Explicit issue tracker provider (jira, linear, github, generic)')
    .action(async (key: string, cmdOptions: any) => {
      const globalOpts = program.opts<GlobalOptions>();
      const cwd = globalOpts.cwd || process.cwd();
      const config = loadConfig(globalOpts.config, cwd);
      const git = new GitEngine(cwd);
      const repoRoot = await git.getRepoRoot();
      const orchestrator = new MannostreeOrchestrator(repoRoot, config);

      const result = await orchestrator.issueSyncEngine.ingestIssue({
        key,
        worktreeId: cmdOptions.worktree,
        provider: cmdOptions.provider as IssueTrackerProvider,
        dryRun: globalOpts.dryRun,
      });

      formatOutput(
        {
          command: 'issue ingest',
          ok: true,
          dry_run: globalOpts.dryRun || false,
          result: {
            key: result.record.key,
            provider: result.record.provider,
            title: result.record.title,
            status: result.record.status,
            priority: result.record.priority,
            assignee: result.record.assignee?.name,
            url: result.record.url,
            contract_path: result.contractPath,
          },
          warnings: [],
          errors: [],
        },
        globalOpts,
        (data, isDryRun) => {
          return [
            isDryRun
              ? chalk.yellow(`Plan: would ingest issue [${data.key}] (${data.provider})`)
              : chalk.green(`✔ Ingested issue [${data.key}] (${data.provider})`),
            `  ${chalk.dim('Title:')}     ${data.title}`,
            `  ${chalk.dim('Status:')}    ${data.status}`,
            `  ${chalk.dim('Assignee:')}  ${data.assignee || 'Unassigned'}`,
            `  ${chalk.dim('URL:')}       ${data.url}`,
            `  ${chalk.dim('Contract:')}  ${data.contract_path}`,
          ].join('\n');
        }
      );
    });

  // 2. issue transition
  issueGroup
    .command('transition <key> <status>')
    .description('Transition remote issue status in tracker')
    .option('-w, --worktree <id>', 'Worktree ID associated with issue')
    .option('-p, --provider <provider>', 'Explicit issue tracker provider')
    .action(async (key: string, status: string, cmdOptions: any) => {
      const globalOpts = program.opts<GlobalOptions>();
      const cwd = globalOpts.cwd || process.cwd();
      const config = loadConfig(globalOpts.config, cwd);
      const git = new GitEngine(cwd);
      const repoRoot = await git.getRepoRoot();
      const orchestrator = new MannostreeOrchestrator(repoRoot, config);

      const result = await orchestrator.issueSyncEngine.transitionIssue({
        key,
        status,
        worktreeId: cmdOptions.worktree,
        provider: cmdOptions.provider as IssueTrackerProvider,
        dryRun: globalOpts.dryRun,
      });

      formatOutput(
        {
          command: 'issue transition',
          ok: result.success,
          dry_run: globalOpts.dryRun || false,
          result,
          warnings: result.mode === 'noop' ? [result.error || 'Transition was a no-op'] : [],
          errors: result.mode === 'failed' ? [result.error || 'Transition failed'] : [],
        },
        globalOpts,
        (data, isDryRun) => {
          if (!data.success) {
            return chalk.red(`✗ Failed to transition [${data.key}]: ${data.error || 'Unknown error'}`);
          }
          return isDryRun
            ? chalk.yellow(`Plan: would transition [${data.key}] to "${data.new_status}"`)
            : chalk.green(`✔ Transitioned [${data.key}] to "${data.new_status}"`);
        }
      );
    });

  // 3. issue comment
  issueGroup
    .command('comment <key> [message]')
    .description('Post a comment to the remote issue ticket')
    .option('-f, --body-file <file>', 'Read comment body from file')
    .option('-p, --provider <provider>', 'Explicit issue tracker provider')
    .action(async (key: string, message: string | undefined, cmdOptions: any) => {
      const globalOpts = program.opts<GlobalOptions>();
      const cwd = globalOpts.cwd || process.cwd();
      const config = loadConfig(globalOpts.config, cwd);
      const git = new GitEngine(cwd);
      const repoRoot = await git.getRepoRoot();
      const orchestrator = new MannostreeOrchestrator(repoRoot, config);

      let commentBody = message || '';
      if (cmdOptions.bodyFile && fs.existsSync(cmdOptions.bodyFile)) {
        commentBody = fs.readFileSync(cmdOptions.bodyFile, 'utf-8');
      }

      const result = await orchestrator.issueSyncEngine.postComment({
        key,
        message: commentBody,
        provider: cmdOptions.provider as IssueTrackerProvider,
        dryRun: globalOpts.dryRun,
      });

      formatOutput(
        {
          command: 'issue comment',
          ok: result.success,
          dry_run: globalOpts.dryRun || false,
          result,
          warnings: [],
          errors: [],
        },
        globalOpts,
        (data, isDryRun) => {
          return isDryRun
            ? chalk.yellow(`Plan: would post comment to [${data.key}]`)
            : chalk.green(`✔ Posted comment to [${data.key}] (ID: ${data.comment_id || 'ok'})`);
        }
      );
    });

  // 4. issue sync
  issueGroup
    .command('sync [key]')
    .description('Synchronize local verification evidence and receipts to linked issue')
    .option('-w, --worktree <id>', 'Worktree ID to sync evidence from')
    .option('-p, --provider <provider>', 'Explicit issue tracker provider')
    .action(async (key: string | undefined, cmdOptions: any) => {
      const globalOpts = program.opts<GlobalOptions>();
      const cwd = globalOpts.cwd || process.cwd();
      const config = loadConfig(globalOpts.config, cwd);
      const git = new GitEngine(cwd);
      const repoRoot = await git.getRepoRoot();
      const orchestrator = new MannostreeOrchestrator(repoRoot, config);

      const result = await orchestrator.issueSyncEngine.syncEvidence({
        key,
        worktreeId: cmdOptions.worktree,
        provider: cmdOptions.provider as IssueTrackerProvider,
        dryRun: globalOpts.dryRun,
      });

      formatOutput(
        {
          command: 'issue sync',
          ok: result.commentResult.success,
          dry_run: globalOpts.dryRun || false,
          result: {
            commentResult: result.commentResult,
            evidenceSummary: result.evidenceSummary,
          },
          warnings: [],
          errors: [],
        },
        globalOpts,
        (data, isDryRun) => {
          return isDryRun
            ? chalk.yellow(`Plan: would sync verification evidence to issue ticket`)
            : chalk.green(`✔ Synchronized verification evidence to issue ticket`);
        }
      );
    });

  // 5. issue status
  issueGroup
    .command('status')
    .description('Display status and drift matrix between local worktrees and remote issue trackers')
    .option('-w, --worktree <id>', 'Inspect specific worktree')
    .action(async (cmdOptions: any) => {
      const globalOpts = program.opts<GlobalOptions>();
      const cwd = globalOpts.cwd || process.cwd();
      const config = loadConfig(globalOpts.config, cwd);
      const git = new GitEngine(cwd);
      const repoRoot = await git.getRepoRoot();
      const orchestrator = new MannostreeOrchestrator(repoRoot, config);

      const summaries = await orchestrator.issueSyncEngine.checkIssueDrift(cmdOptions.worktree);

      formatOutput(
        {
          command: 'issue status',
          ok: true,
          dry_run: false,
          result: summaries,
          warnings: [],
          errors: [],
        },
        globalOpts,
        (items) => {
          if (!items || items.length === 0) {
            return chalk.dim('No active worktrees with attached issue tickets found.');
          }

          const lines: string[] = [
            chalk.bold('\n🎫 Mannostree Issue Tracker Status & Drift Matrix:'),
            chalk.dim('─'.repeat(100)),
            `${'Worktree ID'.padEnd(20)} ${'Branch'.padEnd(25)} ${'Issue Key'.padEnd(12)} ${'Provider'.padEnd(10)} ${'Local State'.padEnd(16)} ${'Remote Status'.padEnd(15)} ${'Drift'}`,
            chalk.dim('─'.repeat(100)),
          ];

          for (const s of items) {
            const driftTag = s.drift_detected
              ? chalk.red('DRIFT DETECTED')
              : chalk.green('Clean');
            lines.push(
              `${s.worktree_id.padEnd(20)} ${s.worktree_branch.padEnd(25)} ${s.issue_key.padEnd(12)} ${s.issue_provider.padEnd(10)} ${s.local_lifecycle_state.padEnd(16)} ${s.remote_status.padEnd(15)} ${driftTag}`
            );
            if (s.drift_reason) {
              lines.push(`  ${chalk.yellow(`↳ ${s.drift_reason}`)}`);
            }
          }
          lines.push(chalk.dim('─'.repeat(100)));
          return lines.join('\n');
        }
      );
    });

  // 6. issue list
  issueGroup
    .command('list')
    .description('List open or assigned issues from configured issue tracker')
    .option('-p, --provider <provider>', 'Issue tracker provider')
    .option('-a, --assigned-to <user>', 'Filter by assignee')
    .option('-s, --status <status>', 'Filter by status')
    .action(async (cmdOptions: any) => {
      const globalOpts = program.opts<GlobalOptions>();
      const cwd = globalOpts.cwd || process.cwd();
      const config = loadConfig(globalOpts.config, cwd);
      const git = new GitEngine(cwd);
      const repoRoot = await git.getRepoRoot();
      const orchestrator = new MannostreeOrchestrator(repoRoot, config);

      const issues = await orchestrator.issueSyncEngine.listIssues(
        cmdOptions.provider as IssueTrackerProvider,
        { assignee: cmdOptions.assignedTo, status: cmdOptions.status }
      );

      formatOutput(
        {
          command: 'issue list',
          ok: true,
          dry_run: false,
          result: issues,
          warnings: [],
          errors: [],
        },
        globalOpts,
        (items) => {
          if (!items || items.length === 0) {
            return chalk.dim('No issues returned from issue tracker.');
          }

          const lines: string[] = [
            chalk.bold(`\n📋 Issue Tracker Tickets (${items.length}):`),
            chalk.dim('─'.repeat(90)),
            `${'Key'.padEnd(12)} ${'Provider'.padEnd(10)} ${'Status'.padEnd(15)} ${'Assignee'.padEnd(18)} ${'Title'}`,
            chalk.dim('─'.repeat(90)),
          ];

          for (const i of items) {
            const assignee = i.assignee?.name || 'Unassigned';
            lines.push(
              `${chalk.cyan(i.key.padEnd(12))} ${i.provider.padEnd(10)} ${i.status.padEnd(15)} ${assignee.padEnd(18)} ${i.title}`
            );
          }
          lines.push(chalk.dim('─'.repeat(90)));
          return lines.join('\n');
        }
      );
    });
}
