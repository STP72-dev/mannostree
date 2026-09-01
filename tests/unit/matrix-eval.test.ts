import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { MatrixEvaluator } from '../../src/core/matrix-eval.js';
import { GitEngine } from '../../src/git/engine.js';
import { MetadataStore } from '../../src/metadata/store.js';
import { loadConfig } from '../../src/config/loader.js';
import { VariantEvaluationSummary, MatrixScoringWeights } from '../../src/types/index.js';

describe('MatrixEvaluator Unit Tests', () => {
  let tempRepo: string;
  let evaluator: MatrixEvaluator;

  beforeEach(() => {
    tempRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'mannostree-matrix-eval-unit-'));
    execSync('git init -b main', { cwd: tempRepo });
    execSync('git config user.name "Matrix Tester"', { cwd: tempRepo });
    execSync('git config user.email "matrix@example.com"', { cwd: tempRepo });
    fs.writeFileSync(path.join(tempRepo, 'README.md'), '# Matrix\n', 'utf-8');
    execSync('git add README.md && git commit -m "Init"', { cwd: tempRepo });

    const config = loadConfig(undefined, tempRepo);
    const git = new GitEngine(tempRepo);
    const store = new MetadataStore(tempRepo, config);
    evaluator = new MatrixEvaluator(tempRepo, git, store, config);
  });

  afterEach(() => {
    fs.rmSync(tempRepo, { recursive: true, force: true });
  });

  it('resolves probe specifications correctly from CLI strings', () => {
    const probes = evaluator.resolveProbes(['npm test', 'npm run lint', 'node bench.js']);
    expect(probes.length).toBe(3);
    expect(probes[0].category).toBe('test');
    expect(probes[0].mandatory).toBe(true);
    expect(probes[1].category).toBe('lint');
    expect(probes[2].category).toBe('benchmark');
  });

  it('executes a probe in directory and parses exit codes and durations', async () => {
    const res = await evaluator.executeProbe(tempRepo, {
      name: 'echo_test',
      command: 'echo "score: 42"',
      category: 'custom',
      metric_regex: 'score:\\s*([0-9]+)',
      metric_unit: 'points',
    });

    expect(res.passed).toBe(true);
    expect(res.exit_code).toBe(0);
    expect(res.duration_ms).toBeGreaterThanOrEqual(0);
    expect(res.numeric_value).toBe(42);
    expect(res.metric_unit).toBe('points');
  });

  it('calculates WSM normalized composite scores and ranks variants deterministically', () => {
    const weights: MatrixScoringWeights = {
      correctness: 0.4,
      performance: 0.3,
      maintainability_churn: 0.2,
      size: 0.1,
    };

    const summaries: VariantEvaluationSummary[] = [
      {
        worktree_id: 'var-v1',
        variant_name: 'v1',
        probe_results: [],
        tests_passed: 10,
        tests_total: 10,
        lint_clean: true,
        benchmark_latency_ms: 100, // Faster
        git_diff: { files_changed: 2, insertions: 50, deletions: 10 },
        composite_score: 0,
        rank: 0,
        compliant: true,
      },
      {
        worktree_id: 'var-v2',
        variant_name: 'v2',
        probe_results: [],
        tests_passed: 10,
        tests_total: 10,
        lint_clean: true,
        benchmark_latency_ms: 200, // Slower
        git_diff: { files_changed: 4, insertions: 150, deletions: 30 },
        composite_score: 0,
        rank: 0,
        compliant: true,
      },
    ];

    const ranked = evaluator.computeRankings(summaries, weights);
    expect(ranked.length).toBe(2);
    expect(ranked[0].worktree_id).toBe('var-v1');
    expect(ranked[0].rank).toBe(1);
    expect(ranked[0].composite_score).toBeGreaterThan(ranked[1].composite_score);
    expect(ranked[1].rank).toBe(2);
  });

  it('synthesizes meaningful winning justification text', () => {
    const winner: VariantEvaluationSummary = {
      worktree_id: 'auth-v1',
      variant_name: 'v1',
      probe_results: [],
      tests_passed: 10,
      tests_total: 10,
      lint_clean: true,
      benchmark_latency_ms: 50,
      git_diff: { files_changed: 2, insertions: 40, deletions: 10 },
      composite_score: 95.0,
      rank: 1,
      compliant: true,
    };

    const runnerUp: VariantEvaluationSummary = {
      worktree_id: 'auth-v2',
      variant_name: 'v2',
      probe_results: [],
      tests_passed: 10,
      tests_total: 10,
      lint_clean: true,
      benchmark_latency_ms: 100,
      git_diff: { files_changed: 5, insertions: 120, deletions: 40 },
      composite_score: 75.0,
      rank: 2,
      compliant: true,
    };

    const justification = evaluator.generateWinningJustification(winner, [runnerUp]);
    expect(justification).toContain("Variant 'auth-v1' ranked #1");
    expect(justification).toContain('lower latency');
    expect(justification).toContain('leaner code diff');
  });

  it('generates structured GFM markdown report with ranking table', () => {
    const report = {
      feature_name: 'test-matrix',
      evaluated_at: '2026-09-01T10:00:00.000Z',
      probes: [{ name: 'test', command: 'npm test', category: 'test' as const }],
      weights: { correctness: 0.4, performance: 0.3, maintainability_churn: 0.2, size: 0.1 },
      variants: [
        {
          worktree_id: 'test-v1',
          variant_name: 'v1',
          probe_results: [{ probe_name: 'test', category: 'test' as const, command: 'npm test', passed: true, exit_code: 0, duration_ms: 50, stdout: '', stderr: '' }],
          tests_passed: 5,
          tests_total: 5,
          lint_clean: true,
          benchmark_latency_ms: 50,
          git_diff: { files_changed: 1, insertions: 10, deletions: 2 },
          composite_score: 95.0,
          rank: 1,
          compliant: true,
        },
      ],
      recommended_winner_id: 'test-v1',
      winning_justification: 'Variant 1 won on all metrics.',
    };

    const markdown = evaluator.generateMatrixReportMarkdown(report);
    expect(markdown).toContain('# Comparative Evaluation Matrix: test-matrix');
    expect(markdown).toContain('**Recommended Winner**: **test-v1**');
    expect(markdown).toContain('| #1 | **test-v1** | ✓ PASS | **95** |');
  });
});


