import YAML from 'yaml';
import chalk from 'chalk';
import { CommandOutput, GlobalOptions, WorktreeRecord, ExperimentRecord } from '../types/index.js';
import { DoctorReport } from '../core/doctor.js';
import { SetupApplyResult, EnvApplyResult } from '../core/setup.js';
import {
  ParallelComparisonReport,
  ParallelPickResult,
  ParallelDropResult,
} from '../core/parallel.js';
import { PrResult } from '../core/publish.js';
import { TaskValidationResult, HandoffReport } from '../core/task.js';

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

export function formatSetupResult(
  result: SetupApplyResult & { id: string; profile: string },
  dryRun: boolean
): string {
  const lines: string[] = [
    dryRun
      ? chalk.yellow(`Plan: would apply setup profile '${result.profile}' to worktree '${result.id}'`)
      : result.install_succeeded && result.validation_passed
        ? chalk.green(`✔ Setup profile '${result.profile}' applied successfully to '${result.id}'`)
        : chalk.red(`✖ Setup profile '${result.profile}' failed for '${result.id}'`),
    `  ${chalk.dim('Commands planned/run:')} ${result.commands_executed.length}`,
  ];

  for (const cmd of result.commands_executed) {
    lines.push(`    - ${chalk.dim(cmd)}`);
  }

  if (result.errors.length > 0) {
    lines.push(chalk.bold('\nErrors:'));
    for (const err of result.errors) {
      lines.push(`  ${chalk.red(err)}`);
    }
  }

  return lines.join('\n');
}

export function formatEnvResult(
  result: EnvApplyResult & { id: string },
  dryRun: boolean
): string {
  return [
    dryRun
      ? chalk.yellow(`Plan: would apply env policy mode '${result.mode}' to '${result.id}'`)
      : chalk.green(`✔ Env policy mode '${result.mode}' applied to '${result.id}'`),
    `  ${chalk.dim('Files handled:')} ${result.files_handled.length > 0 ? result.files_handled.join(', ') : 'none'}`,
  ].join('\n');
}

export function formatParallelSpawnResult(
  result: { feature: string; base_branch: string; variants: WorktreeRecord[]; experiment: ExperimentRecord },
  dryRun: boolean
): string {
  const lines: string[] = [
    dryRun
      ? chalk.yellow(`Plan: would spawn ${result.variants.length} parallel variants for feature '${result.feature}' from '${result.base_branch}'`)
      : chalk.green(`✔ Spawned ${result.variants.length} parallel variants for feature '${result.feature}':`),
  ];

  for (const v of result.variants) {
    lines.push(`  - ${chalk.bold(v.id)}: branch ${chalk.green(v.branch)} -> ${chalk.dim(v.worktree_path)}`);
  }

  return lines.join('\n');
}

export function formatParallelCompareResult(report: ParallelComparisonReport): string {
  const lines: string[] = [
    chalk.bold.cyan(`📊 Parallel Variant Comparison: ${report.feature}`),
    `  ${chalk.dim('Base Branch:')}  ${chalk.yellow(report.base_branch)}`,
    `  ${chalk.dim('Winner:')}       ${report.winner ? chalk.green.bold(report.winner) : chalk.dim('none selected')}`,
    '',
  ];

  const headers = ['VARIANT', 'BRANCH', 'AHEAD/BEHIND', 'FILES', '+ / -', 'VALIDATION', 'LIFECYCLE', 'WINNER'];
  const rows = report.variants.map((v) => [
    v.variant,
    v.branch,
    `+${v.ahead_count} / -${v.behind_count}`,
    String(v.files_changed),
    `+${v.lines_added} / -${v.lines_removed}`,
    v.validation_status,
    v.lifecycle_state,
    v.is_winner ? '★ WINNER' : '-',
  ]);

  const colWidths = headers.map((h, i) => {
    return Math.max(h.length, ...rows.map((row) => row[i].length));
  });

  const pad = (str: string, width: number) => str.padEnd(width);

  const headerLine = chalk.bold(headers.map((h, i) => pad(h, colWidths[i])).join('  '));
  const separatorLine = chalk.dim(colWidths.map((w) => '─'.repeat(w)).join('  '));
  const dataLines = rows.map((row) =>
    row.map((cell, i) => {
      if (cell.includes('WINNER')) return chalk.green.bold(pad(cell, colWidths[i]));
      if (cell === 'passed') return chalk.green(pad(cell, colWidths[i]));
      if (cell === 'failed') return chalk.red(pad(cell, colWidths[i]));
      return pad(cell, colWidths[i]);
    }).join('  ')
  );

  lines.push(headerLine, separatorLine, ...dataLines);
  return lines.join('\n');
}

export function formatParallelListResult(records: ExperimentRecord[]): string {
  if (records.length === 0) {
    return chalk.dim('No tracked parallel experiments found.');
  }

  const headers = ['FEATURE', 'BASE BRANCH', 'VARIANTS', 'STATUS', 'WINNER', 'CREATED'];
  const rows = records.map((e) => [
    e.feature,
    e.base_branch,
    String(e.variants.length),
    e.status,
    e.winner || '-',
    e.created_at,
  ]);

  const colWidths = headers.map((h, i) => {
    return Math.max(h.length, ...rows.map((row) => row[i].length));
  });

  const pad = (str: string, width: number) => str.padEnd(width);

  const headerLine = chalk.bold(headers.map((h, i) => pad(h, colWidths[i])).join('  '));
  const separatorLine = chalk.dim(colWidths.map((w) => '─'.repeat(w)).join('  '));
  const dataLines = rows.map((row) =>
    row.map((cell, i) => {
      if (cell === 'active') return chalk.cyan(pad(cell, colWidths[i]));
      if (cell === 'completed') return chalk.green(pad(cell, colWidths[i]));
      if (cell === 'cleaned') return chalk.dim(pad(cell, colWidths[i]));
      return pad(cell, colWidths[i]);
    }).join('  ')
  );

  return [headerLine, separatorLine, ...dataLines].join('\n');
}

export function formatParallelPickResult(
  result: ParallelPickResult,
  dryRun: boolean
): string {
  const lines: string[] = [
    dryRun
      ? chalk.yellow(`Plan: would pick '${result.winner}' as winning variant for feature '${result.feature}'`)
      : chalk.green(`✔ Selected '${result.winner}' as winning variant for '${result.feature}'`),
  ];

  if (result.cleaned_losers.length > 0) {
    lines.push(chalk.dim(`Cleaned ${result.cleaned_losers.length} losing variant(s): ${result.cleaned_losers.join(', ')}`));
  } else {
    lines.push(chalk.dim('Losing variants were preserved on disk and in git.'));
  }

  return lines.join('\n');
}

export function formatParallelDropResult(
  result: ParallelDropResult,
  dryRun: boolean
): string {
  const lines: string[] = [
    dryRun
      ? chalk.yellow(`Plan: would drop experiment '${result.feature}' and ${result.dropped_variants.length} variant worktree(s)`)
      : result.experiment_deleted
        ? chalk.green(`✔ Successfully dropped experiment '${result.feature}' and ${result.dropped_variants.length} variant(s)`)
        : chalk.yellow(`Found ${result.dropped_variants.length} variant(s) in experiment '${result.feature}'`),
  ];

  for (const v of result.dropped_variants) {
    lines.push(`  - ${chalk.bold(v)}`);
  }

  if (!dryRun && !result.experiment_deleted) {
    lines.push(chalk.dim('\nTo execute deletion of all variant worktrees and branches, pass `--yes`.'));
  }

  return lines.join('\n');
}

export function formatPrResult(
  result: PrResult & { id: string },
  dryRun: boolean
): string {
  const lines: string[] = [
    dryRun
      ? chalk.yellow(`Plan: would prepare PR for '${result.id}'`)
      : result.mode === 'published'
        ? chalk.green(`✔ Pull request opened for '${result.id}': ${result.pr_url || ''}`)
        : chalk.green(`✔ Pull request body prepared for '${result.id}'`),
    `  ${chalk.dim('Title:')}     ${result.title}`,
    `  ${chalk.dim('Body File:')} ${result.body_file}`,
  ];

  if (result.instructions) {
    lines.push(`  ${chalk.dim('Status:')}    ${result.instructions}`);
  }

  return lines.join('\n');
}

export function formatIssueResult(
  result: { id: string; issue_number: number; issue_title?: string },
  dryRun: boolean
): string {
  return [
    dryRun
      ? chalk.yellow(`Plan: would link issue #${result.issue_number} to '${result.id}'`)
      : chalk.green(`✔ Linked issue #${result.issue_number} (${result.issue_title || ''}) to '${result.id}'`),
  ].join('\n');
}

export function formatTaskResult(
  result: TaskValidationResult & { id: string }
): string {
  const lines: string[] = [
    chalk.bold.cyan(`📋 Task Artifact Validation: ${result.id}`),
    `  ${chalk.dim('Status:')}        ${result.complete ? chalk.green('COMPLETE') : chalk.yellow('INCOMPLETE')}`,
    `  ${chalk.dim('Score:')}         ${result.score_percentage}% (${result.total_present}/${result.total_required} present)`,
    '',
    chalk.bold('Required Artifacts:'),
  ];

  for (const [key, item] of Object.entries(result.artifacts)) {
    const mark = item.present ? chalk.green('✔') : chalk.red('✖');
    lines.push(`  ${mark} ${key}: ${chalk.dim(item.rel_path)} (${item.size_bytes} bytes)`);
  }

  return lines.join('\n');
}

export function formatHandoffResult(
  report: HandoffReport
): string {
  const lines: string[] = [
    chalk.bold.cyan(`🤝 Workspace Handoff Report: ${report.id}`),
    `  ${chalk.dim('Feature:')}         ${report.feature_name || report.id}`,
    `  ${chalk.dim('Branch:')}          ${chalk.green(report.branch)}`,
    `  ${chalk.dim('Base Branch:')}     ${chalk.yellow(report.base_branch)}`,
    `  ${chalk.dim('Lifecycle State:')} ${chalk.magenta(report.lifecycle_state)}`,
  ];

  if (report.target_recipient) {
    lines.push(`  ${chalk.dim('To Recipient:')}    ${chalk.bold(report.target_recipient)}`);
  }

  lines.push(
    chalk.bold('\nGit & Workspace State:'),
    `  ${chalk.dim('Ahead / Behind:')}  +${report.git_summary.ahead_count} / -${report.git_summary.behind_count}`,
    `  ${chalk.dim('Dirty:')}           ${report.git_summary.dirty ? chalk.red('yes') : chalk.green('no')}`,
    `  ${chalk.dim('Head Commit:')}     ${report.git_summary.head_commit || 'unknown'}`
  );

  lines.push(
    chalk.bold('\nArtifacts Completeness:'),
    `  ${chalk.dim('Complete:')}        ${report.artifacts_status.complete ? chalk.green('yes') : chalk.yellow('no')} (${report.artifacts_status.score_percentage}%)`
  );

  if (report.handoff_notes) {
    lines.push(chalk.bold('\nHandoff Notes:'), `  ${report.handoff_notes}`);
  }

  if (report.next_steps.length > 0) {
    lines.push(chalk.bold('\nRecommended Next Steps:'));
    for (const step of report.next_steps) {
      lines.push(`  - ${step}`);
    }
  }

  return lines.join('\n');
}
