import YAML from 'yaml';
import chalk from 'chalk';
import { CommandOutput, GlobalOptions, WorktreeRecord } from '../types/index.js';

export function formatOutput<T>(
  output: CommandOutput<T>,
  options: GlobalOptions,
  humanFormatter?: (data: T, dryRun: boolean) => string
): void {
  if (options.quiet) {
    return;
  }

  if (options.json) {
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  if (options.yaml) {
    console.log(YAML.stringify(output));
    return;
  }

  if (options.plain) {
    if (output.result && typeof output.result === 'object') {
      console.log(JSON.stringify(output.result));
    } else {
      console.log(String(output.result ?? ''));
    }
    return;
  }

  // Human-readable format
  if (output.dry_run) {
    console.log(chalk.yellow('⚡ [DRY-RUN] No changes were applied to disk or git.'));
  }

  if (humanFormatter && output.result !== undefined) {
    console.log(humanFormatter(output.result, output.dry_run));
  } else if (output.result) {
    console.log(output.result);
  }

  if (output.warnings.length > 0) {
    for (const w of output.warnings) {
      console.warn(chalk.yellow(`⚠ Warning: ${w}`));
    }
  }
}

export function formatWorktreeTable(records: WorktreeRecord[]): string {
  if (records.length === 0) {
    return chalk.dim('No tracked worktrees found.');
  }

  const headers = ['ID', 'KIND', 'BRANCH', 'BASE', 'LIFECYCLE', 'STATUS', 'PATH'];
  const rows = records.map((r) => [
    r.id,
    r.kind || 'feature',
    r.branch,
    r.base_branch,
    r.lifecycle_state,
    r.status,
    r.worktree_path,
  ]);

  const colWidths = headers.map((h, i) => {
    return Math.max(h.length, ...rows.map((row) => row[i].length));
  });

  const pad = (str: string, width: number) => str.padEnd(width);

  const headerLine = chalk.bold(
    headers.map((h, i) => pad(h, colWidths[i])).join('  ')
  );
  const separatorLine = chalk.dim(
    colWidths.map((w) => '─'.repeat(w)).join('  ')
  );
  const dataLines = rows.map((row) =>
    row.map((cell, i) => pad(cell, colWidths[i])).join('  ')
  );

  return [headerLine, separatorLine, ...dataLines].join('\n');
}

export function formatWorktreeInfo(record: WorktreeRecord & { live_health?: any }): string {
  const lines: string[] = [
    chalk.bold.cyan(`Worktree: ${record.id}`),
    `  ${chalk.dim('Feature:')}         ${record.feature_name || record.id}`,
    `  ${chalk.dim('Kind:')}            ${record.kind || 'feature'}`,
    `  ${chalk.dim('Branch:')}          ${chalk.green(record.branch)}`,
    `  ${chalk.dim('Base Branch:')}     ${chalk.yellow(record.base_branch)}`,
    `  ${chalk.dim('Worktree Path:')}   ${record.worktree_path}`,
    `  ${chalk.dim('Metadata Path:')}   ${record.metadata_path || ''}`,
    `  ${chalk.dim('Lifecycle State:')} ${chalk.magenta(record.lifecycle_state)}`,
    `  ${chalk.dim('Status:')}          ${record.status}`,
    `  ${chalk.dim('Profile:')}         ${record.profile || 'default'}`,
    `  ${chalk.dim('Created At:')}      ${record.created_at}`,
    `  ${chalk.dim('Updated At:')}      ${record.updated_at}`,
  ];

  if (record.git_state) {
    lines.push(
      chalk.bold('\nGit State:'),
      `  ${chalk.dim('Dirty:')}           ${record.git_state.dirty ? chalk.red('yes') : chalk.green('no')}`,
      `  ${chalk.dim('Untracked:')}       ${record.git_state.has_untracked_files ? chalk.yellow('yes') : chalk.green('no')}`,
      `  ${chalk.dim('Head Commit:')}     ${record.git_state.head_commit || 'unknown'}`,
      `  ${chalk.dim('Commit Message:')} ${record.git_state.head_commit_message || ''}`
    );
  }

  if (record.live_health) {
    lines.push(
      chalk.bold('\nLive Health Check:'),
      `  ${chalk.dim('Exists on Disk:')}  ${record.live_health.exists_on_disk ? chalk.green('yes') : chalk.red('no')}`,
      `  ${chalk.dim('Branch Exists:')}   ${record.live_health.branch_exists ? chalk.green('yes') : chalk.red('no')}`,
      `  ${chalk.dim('Health Status:')}   ${record.live_health.health_status === 'ok' ? chalk.green('ok') : chalk.red(record.live_health.health_status)}`
    );
  }

  return lines.join('\n');
}
