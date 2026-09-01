import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { GitEngine } from '../git/engine.js';
import { MetadataStore } from '../metadata/store.js';
import { MannostreeConfig } from '../config/schema.js';
import {
  ExperimentMatrixReport,
  ExperimentRecord,
  ExitCode,
  MannostreeError,
  MatrixProbeCategory,
  MatrixProbeSpec,
  MatrixScoringWeights,
  ParallelEvalOptions,
  VariantEvaluationSummary,
  VariantProbeResult,
  WorktreeRecord,
} from '../types/index.js';

export interface ExecuteProbeOptions {
  timeoutSeconds?: number;
}

export class MatrixEvaluator {
  constructor(
    public repoRoot: string,
    public git: GitEngine,
    public store: MetadataStore,
    public config: MannostreeConfig
  ) {}

  /**
   * Resolve probe specifications from CLI args, config, or default fallback probes.
   */
  public resolveProbes(customMatrix?: string[]): MatrixProbeSpec[] {
    if (customMatrix && customMatrix.length > 0) {
      return customMatrix.map((item, idx) => {
        const trimmed = item.trim();
        let category: MatrixProbeCategory = 'custom';
        let higherIsBetter = false;

        if (trimmed.includes('test')) {
          category = 'test';
          higherIsBetter = true;
        } else if (trimmed.includes('lint')) {
          category = 'lint';
          higherIsBetter = false;
        } else if (trimmed.includes('bench')) {
          category = 'benchmark';
          higherIsBetter = false; // default to latency ms
        } else if (trimmed.includes('size')) {
          category = 'size';
          higherIsBetter = false;
        }

        return {
          name: `probe_${idx + 1}_${category}`,
          command: trimmed,
          category,
          mandatory: category === 'test',
          timeout_seconds: 120,
          higher_is_better: higherIsBetter,
        };
      });
    }

    if (this.config.parallel?.eval_matrix && this.config.parallel.eval_matrix.length > 0) {
      return this.config.parallel.eval_matrix.map((p) => ({
        name: p.name,
        command: p.command,
        category: p.category as MatrixProbeCategory,
        mandatory: p.mandatory,
        timeout_seconds: p.timeout_seconds,
        weight: p.weight,
        higher_is_better: p.higher_is_better,
        metric_unit: p.metric_unit,
        metric_regex: p.metric_regex,
      }));
    }

    // Default built-in probe suite
    return [
      {
        name: 'unit_tests',
        command: 'npm test',
        category: 'test',
        mandatory: true,
        timeout_seconds: 120,
        higher_is_better: true,
      },
    ];
  }

  /**
   * Execute a single probe command within the worktree sandbox directory.
   */
  public async executeProbe(
    worktreePath: string,
    probe: MatrixProbeSpec,
    options: ExecuteProbeOptions = {}
  ): Promise<VariantProbeResult> {
    const timeoutMs = (probe.timeout_seconds || options.timeoutSeconds || 120) * 1000;
    const startTime = Date.now();

    return new Promise<VariantProbeResult>((resolve) => {
      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const child = spawn(probe.command, {
        cwd: worktreePath,
        shell: true,
        env: {
          ...process.env,
          MANNOSTREE_EVAL_PROBE: probe.name,
          MANNOSTREE_WORKTREE: worktreePath,
        },
      });

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGKILL');
      }, timeoutMs);

      if (child.stdout) {
        child.stdout.on('data', (chunk) => {
          stdout += chunk.toString();
        });
      }

      if (child.stderr) {
        child.stderr.on('data', (chunk) => {
          stderr += chunk.toString();
        });
      }

      child.on('error', (err) => {
        clearTimeout(timer);
        const duration = Date.now() - startTime;
        resolve({
          probe_name: probe.name,
          category: probe.category,
          command: probe.command,
          passed: false,
          exit_code: 1,
          duration_ms: duration,
          stdout,
          stderr: stderr || err.message,
        });
      });

      child.on('close', (code) => {
        clearTimeout(timer);
        const duration = Date.now() - startTime;
        const exitCode = timedOut ? 124 : (code ?? 0);
        const passed = exitCode === 0 && !timedOut;

        let numericValue: number | undefined;
        if (probe.metric_regex) {
          try {
            const match = stdout.match(new RegExp(probe.metric_regex));
            if (match && match[1]) {
              const parsed = parseFloat(match[1]);
              if (!isNaN(parsed)) {
                numericValue = parsed;
              }
            }
          } catch {
            // ignore regex failure
          }
        }

        resolve({
          probe_name: probe.name,
          category: probe.category,
          command: probe.command,
          passed,
          exit_code: exitCode,
          duration_ms: duration,
          stdout,
          stderr: timedOut ? `Probe timed out after ${timeoutMs / 1000}s.\n${stderr}` : stderr,
          numeric_value: numericValue,
          metric_unit: probe.metric_unit,
        });
      });
    });
  }

  /**
   * Evaluate a single variant across all probe specifications.
   */
  public async evaluateVariant(
    record: WorktreeRecord,
    probes: MatrixProbeSpec[],
    options: ParallelEvalOptions
  ): Promise<VariantEvaluationSummary> {
    const fullPath = path.resolve(this.repoRoot, record.worktree_path);
    const probeResults: VariantProbeResult[] = [];

    for (const probe of probes) {
      if (options.dryRun) {
        probeResults.push({
          probe_name: probe.name,
          category: probe.category,
          command: probe.command,
          passed: true,
          exit_code: 0,
          duration_ms: 0,
          stdout: '[dry-run simulated pass]',
          stderr: '',
        });
        continue;
      }

      const res = await this.executeProbe(fullPath, probe, {
        timeoutSeconds: options.timeoutSeconds,
      });
      probeResults.push(res);
    }

    // Diff metrics
    let filesChanged = 0;
    let insertions = 0;
    let deletions = 0;

    try {
      const diffStat = await this.git.getDiffShortStat(record.worktree_path, record.base_branch);
      filesChanged = diffStat.files_changed;
      insertions = diffStat.insertions;
      deletions = diffStat.deletions;
    } catch {
      // ignore diff error if brand new branch
    }

    // Extract test pass metrics
    let testsPassed = 0;
    let testsTotal = 0;
    let lintClean = true;
    let benchmarkLatencyMs: number | undefined;
    let benchmarkOpsSec: number | undefined;
    let bundleSizeBytes: number | undefined;

    for (const r of probeResults) {
      if (r.category === 'test') {
        testsTotal += 1;
        if (r.passed) testsPassed += 1;
      } else if (r.category === 'lint') {
        if (!r.passed) lintClean = false;
      } else if (r.category === 'benchmark') {
        if (r.numeric_value !== undefined) {
          if (r.metric_unit === 'ops/sec') {
            benchmarkOpsSec = r.numeric_value;
          } else {
            benchmarkLatencyMs = r.numeric_value;
          }
        } else {
          benchmarkLatencyMs = r.duration_ms;
        }
      } else if (r.category === 'size') {
        if (r.numeric_value !== undefined) {
          bundleSizeBytes = r.numeric_value;
        }
      }
    }

    // Check compliance with mandatory probes
    const mandatoryProbes = probes.filter((p) => p.mandatory);
    const compliant = mandatoryProbes.every((mp) => {
      const res = probeResults.find((r) => r.probe_name === mp.name);
      return res && res.passed;
    });

    return {
      worktree_id: record.id,
      variant_name: record.branch.replace(/^experiment\/[^-]+-/, '') || record.id,
      probe_results: probeResults,
      tests_passed: testsPassed,
      tests_total: testsTotal,
      lint_clean: lintClean,
      benchmark_latency_ms: benchmarkLatencyMs,
      benchmark_ops_sec: benchmarkOpsSec,
      bundle_size_bytes: bundleSizeBytes,
      git_diff: {
        files_changed: filesChanged,
        insertions,
        deletions,
      },
      composite_score: 0, // Calculated in computeRankings
      rank: 0,
      compliant,
    };
  }

  /**
   * Compute normalized composite scores and ranks across all variant summaries.
   */
  public computeRankings(
    summaries: VariantEvaluationSummary[],
    weights: MatrixScoringWeights
  ): VariantEvaluationSummary[] {
    if (summaries.length === 0) return [];

    // Helper for min-max normalization
    const normalize = (
      val: number | undefined,
      allVals: (number | undefined)[],
      higherIsBetter: boolean
    ): number => {
      const valid = allVals.filter((v): v is number => v !== undefined);
      if (valid.length === 0 || val === undefined) return 1.0;
      const min = Math.min(...valid);
      const max = Math.max(...valid);
      if (max === min) return 1.0;
      return higherIsBetter ? (val - min) / (max - min) : (max - val) / (max - min);
    };

    const allLatencies = summaries.map((s) => s.benchmark_latency_ms);
    const allOps = summaries.map((s) => s.benchmark_ops_sec);
    const allChurn = summaries.map((s) => s.git_diff.insertions + s.git_diff.deletions);
    const allSizes = summaries.map((s) => s.bundle_size_bytes);

    for (const s of summaries) {
      // 1. Correctness score (0.0 - 1.0)
      const testScore = s.tests_total > 0 ? s.tests_passed / s.tests_total : s.compliant ? 1.0 : 0.0;
      const lintScore = s.lint_clean ? 1.0 : 0.5;
      const correctnessNorm = testScore * 0.7 + lintScore * 0.3;

      // 2. Performance score (0.0 - 1.0)
      let perfNorm = 1.0;
      if (s.benchmark_ops_sec !== undefined) {
        perfNorm = normalize(s.benchmark_ops_sec, allOps, true);
      } else if (s.benchmark_latency_ms !== undefined) {
        perfNorm = normalize(s.benchmark_latency_ms, allLatencies, false);
      }

      // 3. Maintainability / Code Churn (0.0 - 1.0)
      const churn = s.git_diff.insertions + s.git_diff.deletions;
      const churnNorm = normalize(churn, allChurn, false);

      // 4. Size (0.0 - 1.0)
      const sizeNorm = normalize(s.bundle_size_bytes, allSizes, false);

      // Weighted sum
      let rawScore =
        (correctnessNorm * weights.correctness +
          perfNorm * weights.performance +
          churnNorm * weights.maintainability_churn +
          sizeNorm * weights.size) *
        100;

      // Penalty for non-compliance
      if (!s.compliant) {
        rawScore = Math.min(rawScore * 0.5, 49.0);
      }

      s.composite_score = Math.round(rawScore * 10) / 10;
    }

    // Sort descending by score, tie-breaking by compliance -> test pass -> churn -> id
    summaries.sort((a, b) => {
      if (b.compliant !== a.compliant) return b.compliant ? 1 : -1;
      if (b.composite_score !== a.composite_score) return b.composite_score - a.composite_score;
      if (b.tests_passed !== a.tests_passed) return b.tests_passed - a.tests_passed;
      const churnA = a.git_diff.insertions + a.git_diff.deletions;
      const churnB = b.git_diff.insertions + b.git_diff.deletions;
      if (churnA !== churnB) return churnA - churnB;
      return a.worktree_id.localeCompare(b.worktree_id);
    });

    summaries.forEach((s, idx) => {
      s.rank = idx + 1;
    });

    return summaries;
  }

  /**
   * Generate human-readable justification explaining why the top-ranked variant won.
   */
  public generateWinningJustification(
    winner: VariantEvaluationSummary,
    runnersUp: VariantEvaluationSummary[]
  ): string {
    if (!winner) return 'No eligible compliant variant found.';
    if (runnersUp.length === 0) {
      return `Variant ${winner.worktree_id} achieved composite score of ${winner.composite_score}/100 and passed all mandatory validation probes.`;
    }

    const runnerUp = runnersUp[0];
    const reasons: string[] = [];

    if (winner.tests_passed >= runnerUp.tests_passed && winner.tests_total > 0) {
      reasons.push(
        `achieved ${Math.round((winner.tests_passed / winner.tests_total) * 100)}% test pass rate`
      );
    }

    if (
      winner.benchmark_latency_ms !== undefined &&
      runnerUp.benchmark_latency_ms !== undefined &&
      winner.benchmark_latency_ms < runnerUp.benchmark_latency_ms
    ) {
      const pct = Math.round(
        ((runnerUp.benchmark_latency_ms - winner.benchmark_latency_ms) /
          runnerUp.benchmark_latency_ms) *
          100
      );
      reasons.push(
        `${pct}% lower latency (${winner.benchmark_latency_ms}ms vs ${runnerUp.benchmark_latency_ms}ms)`
      );
    }

    const churnWinner = winner.git_diff.insertions + winner.git_diff.deletions;
    const churnRunner = runnerUp.git_diff.insertions + runnerUp.git_diff.deletions;
    if (churnWinner < churnRunner) {
      reasons.push(`leaner code diff (+${winner.git_diff.insertions}/-${winner.git_diff.deletions} lines)`);
    }

    if (reasons.length === 0) {
      reasons.push(`outperformed competitor variants with composite score of ${winner.composite_score}`);
    }

    return `Variant '${winner.worktree_id}' ranked #1 (Score: ${winner.composite_score}) because it ${reasons.join(', ')} over runner-up '${runnerUp.worktree_id}' (Score: ${runnerUp.composite_score}).`;
  }

  /**
   * Generate full GFM comparison matrix markdown report.
   */
  public generateMatrixReportMarkdown(report: ExperimentMatrixReport): string {
    const winner = report.variants.find((v) => v.worktree_id === report.recommended_winner_id);

    return `# Comparative Evaluation Matrix: ${report.feature_name}

**Evaluated At**: ${report.evaluated_at}  
**Recommended Winner**: **${report.recommended_winner_id || 'None'}**  
**Winning Composite Score**: ${winner?.composite_score ?? 0} / 100  

---

## Winning Justification

${report.winning_justification}

---

## Multi-Variant Comparison Matrix

| Rank | Variant | Status | Score | Tests Passed | Lint Clean | Benchmark Latency | Code Churn (+/-) |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|
${report.variants
  .map(
    (v) =>
      `| #${v.rank} | **${v.worktree_id}** | ${v.compliant ? '✓ PASS' : '✖ FAIL'} | **${v.composite_score}** | ${v.tests_passed}/${v.tests_total} | ${v.lint_clean ? '✓' : '✖'} | ${v.benchmark_latency_ms !== undefined ? `${v.benchmark_latency_ms}ms` : '—'} | +${v.git_diff.insertions} / -${v.git_diff.deletions} |`
  )
  .join('\n')}

---

## Detailed Probe Results

${report.variants
  .map(
    (v) => `### Variant: ${v.worktree_id} (Rank #${v.rank}, Score: ${v.composite_score})
${v.probe_results
  .map(
    (r) => `- **${r.probe_name}** (\`${r.command}\`): ${r.passed ? '✓ PASSED' : '✖ FAILED'} (${r.duration_ms}ms)
${!r.passed && r.stderr ? `  \`\`\`\n  ${r.stderr.trim()}\n  \`\`\`` : ''}`
  )
  .join('\n')}
`
  )
  .join('\n')}
`;
  }

  /**
   * Full execution flow across an entire parallel experiment.
   */
  public async evaluateExperiment(
    feature: string,
    options: ParallelEvalOptions = { feature }
  ): Promise<{
    report: ExperimentMatrixReport;
    matrix_report_path: string;
    experiment: ExperimentRecord;
  }> {
    const experiment = await this.store.getExperiment(feature);
    if (!experiment) {
      throw new MannostreeError(
        `Experiment '${feature}' not found in metadata registry.`,
        ExitCode.USAGE_ERROR
      );
    }

    if (experiment.variants.length === 0) {
      throw new MannostreeError(
        `Experiment '${feature}' contains no active variants to evaluate.`,
        ExitCode.USAGE_ERROR
      );
    }

    const probes = this.resolveProbes(options.matrix);
    const weights: MatrixScoringWeights = {
      correctness: this.config.parallel?.scoring_weights?.correctness ?? 0.4,
      performance: this.config.parallel?.scoring_weights?.performance ?? 0.3,
      maintainability_churn: this.config.parallel?.scoring_weights?.maintainability_churn ?? 0.2,
      size: this.config.parallel?.scoring_weights?.size ?? 0.1,
    };

    const variantRecords: WorktreeRecord[] = [];
    for (const vId of experiment.variants) {
      const rec = await this.store.getWorktree(vId);
      if (rec) {
        variantRecords.push(rec);
      }
    }

    if (variantRecords.length === 0) {
      throw new MannostreeError(
        `None of the variants for experiment '${feature}' could be loaded from registry.`,
        ExitCode.METADATA_INCONSISTENCY
      );
    }

    // Concurrency queue
    const concurrency = options.serial ? 1 : options.concurrency || 4;
    const summaries: VariantEvaluationSummary[] = [];

    // Execute in batches
    for (let i = 0; i < variantRecords.length; i += concurrency) {
      const batch = variantRecords.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        batch.map((vRec) => this.evaluateVariant(vRec, probes, options))
      );
      summaries.push(...batchResults);
    }

    // Compute rankings
    const rankedSummaries = this.computeRankings(summaries, weights);
    const winner = rankedSummaries[0];
    const runnersUp = rankedSummaries.slice(1);
    const justification = this.generateWinningJustification(winner, runnersUp);

    let baselineComparison: ExperimentMatrixReport['baseline_comparison'];

    if (options.baseline && !options.dryRun) {
      try {
        const baselineProbeResults: VariantProbeResult[] = [];
        for (const probe of probes) {
          const res = await this.executeProbe(this.repoRoot, probe, {
            timeoutSeconds: options.timeoutSeconds,
          });
          baselineProbeResults.push(res);
        }

        const metrics: Record<string, number> = {};
        const deltas: Record<string, { delta_pct: number; improved: boolean }> = {};

        for (const bRes of baselineProbeResults) {
          if (bRes.duration_ms !== undefined) {
            metrics[`${bRes.probe_name}_duration_ms`] = bRes.duration_ms;
            if (winner && winner.benchmark_latency_ms) {
              const diff = winner.benchmark_latency_ms - bRes.duration_ms;
              const deltaPct = bRes.duration_ms > 0 ? Math.round((diff / bRes.duration_ms) * 100) : 0;
              deltas[`${bRes.probe_name}_duration_ms`] = {
                delta_pct: deltaPct,
                improved: diff <= 0,
              };
            }
          }
        }

        baselineComparison = {
          base_branch: experiment.base_branch,
          metrics,
          deltas,
        };
      } catch {
        // ignore baseline error
      }
    }

    const report: ExperimentMatrixReport = {
      feature_name: feature,
      evaluated_at: new Date().toISOString(),
      probes,
      weights,
      variants: rankedSummaries,
      recommended_winner_id: winner?.worktree_id || '',
      winning_justification: justification,
      baseline_comparison: baselineComparison,
    };


    // Determine lead worktree to save .task/matrix-report.md
    const leadRecord = variantRecords[0];
    const leadTaskDir = path.join(
      path.resolve(this.repoRoot, leadRecord.worktree_path),
      this.config.artifact_dir_name || '.task'
    );

    if (!fs.existsSync(leadTaskDir) && !options.dryRun) {
      fs.mkdirSync(leadTaskDir, { recursive: true });
    }

    const reportPath = path.join(leadTaskDir, 'matrix-report.md');
    if (!options.dryRun) {
      fs.writeFileSync(reportPath, this.generateMatrixReportMarkdown(report), 'utf-8');

      // Update experiment record
      experiment.eval_matrix = report;
      experiment.status = 'active';
      await this.store.saveExperiment(experiment);
    }

    return {
      report,
      matrix_report_path: path.relative(this.repoRoot, reportPath),
      experiment,
    };
  }
}
