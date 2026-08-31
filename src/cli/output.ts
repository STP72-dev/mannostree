import YAML from 'yaml';
import chalk from 'chalk';
import { CommandOutput, GlobalOptions, WorktreeRecord } from '../types/index.js';
import { DoctorReport } from '../core/doctor.js';

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
      `  ${chalk.dim('Ahead / Behind:')}  ${chalk.green(`+${record.git_state.ahead_count || 0}`)} / ${chalk.red(`-${record.git_state.behind_count || 0}`)} (vs ${record.base_branch})`,
      `  ${chalk.dim('Dirty:')}           ${record.git_state.dirty ? chalk.red('yes') : chalk.green('no')}`,
      `  ${chalk.dim('Untracked:')}       ${record.git_state.has_untracked_files ? chalk.yellow('yes') : chalk.green('no')}`,
      `  ${chalk.dim('Conflicts:')}       ${record.git_state.has_conflicts ? chalk.red('yes') : chalk.green('no')}`,
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

export function formatDoctorReport(report: DoctorReport): string {
  const lines: string[] = [
    chalk.bold.cyan('🩺 Mannostree Doctor Diagnostic Report'),
    `  ${chalk.dim('Timestamp:')}     ${report.timestamp}`,
    `  ${chalk.dim('System Health:')} ${report.healthy ? chalk.green('HEALTHY') : chalk.red('ISSUES DETECTED')}`,
    `  ${chalk.dim('Findings:')}      ${report.error_count} error(s), ${report.warning_count} warning(s)`,
  ];

  if (report.findings.length === 0) {
    lines.push(chalk.green('\n✔ All registry records, on-disk directories, and git branches are consistent.'));
  } else {
    lines.push(chalk.bold('\nDetailed Findings:'));
    for (const f of report.findings) {
      const tag =
        f.severity === 'error'
          ? chalk.red('[ERROR]')
          : f.severity === 'warning'
            ? chalk.yellow('[WARN]')
            : chalk.blue('[INFO]');
      lines.push(`  ${tag} ${f.type}: ${f.message}`);
      if (f.proposed_action) {
        lines.push(`    ${chalk.dim('Proposed Action:')} ${f.proposed_action}`);
      }
    }
  }

  if (report.proposed_repairs.length > 0) {
    lines.push(chalk.bold('\nProposed Automated Repairs:'));
    for (const r of report.proposed_repairs) {
      lines.push(`  - ${chalk.yellow(r.action)}: ${r.description}`);
    }
    lines.push(chalk.dim('\nRun `mannostree doctor --fix --yes` to apply these repairs.'));
  }

  return lines.join('\n');
}

export function formatCleanReport(
  result: { candidates: string[]; cleaned: string[]; reasons: Record<string, string> },
  dryRun: boolean
): string {
  const lines: string[] = [];

  if (result.candidates.length === 0) {
    lines.push(chalk.dim('No candidate worktrees matched cleanup filters.'));
    return lines.join('\n');
  }

  lines.push(
    dryRun
      ? chalk.yellow(`⚡ Found ${result.candidates.length} candidate worktree(s) for cleanup (DRY-RUN):`)
      : chalk.green(`✔ Cleaned ${result.cleaned.length} worktree(s):`)
  );

  for (const id of result.candidates) {
    const statusText = dryRun
      ? chalk.dim(`[candidate: ${result.reasons[id] || 'matches filter'}]`)
      : result.cleaned.includes(id)
        ? chalk.green('[removed]')
        : chalk.red('[skipped]');
    lines.push(`  - ${chalk.bold(id)} ${statusText}`);
  }

  if (dryRun) {
    lines.push(chalk.dim('\nTo perform real cleanup, pass an explicit filter and `--yes`.'));
  }

  return lines.join('\n');
}

export function formatSyncResult(
  result: { id: string; strategy: string; base_branch: string; branch: string },
  dryRun: boolean
): string {
  return [
    dryRun
      ? chalk.yellow(`Plan: would sync worktree '${result.id}' with base '${result.base_branch}' using strategy '${result.strategy}'`)
      : chalk.green(`✔ Successfully synced '${result.id}' (${result.branch}) with base '${result.base_branch}' using ${result.strategy}`),
  ].join('\n');
}

export function formatRecoverResult(
  result: { id: string; action: string; success: boolean; details: string },
  dryRun: boolean
): string {
  return [
    dryRun
      ? chalk.yellow(`Plan: would run recovery action '${result.action}' on '${result.id}'`)
      : chalk.green(`✔ Recovery action '${result.action}' completed for '${result.id}'`),
    `  ${chalk.dim('Details:')} ${result.details}`,
  ].join('\n');
}
