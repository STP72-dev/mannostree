# Data Model: Automated Benchmark Harness & Comparative Matrix Evaluation

## Overview
This document defines TypeScript interfaces, Zod runtime validation schemas, and persistence models for the **Automated Benchmark Harness & Comparative Matrix Evaluation Engine**.

---

## TypeScript Domain Models

```typescript
export type MatrixProbeCategory = 'test' | 'lint' | 'benchmark' | 'size' | 'custom';

export interface MatrixProbeSpec {
  name: string;
  command: string;
  category: MatrixProbeCategory;
  mandatory?: boolean;
  timeout_seconds?: number;
  weight?: number;
  higher_is_better?: boolean;
  metric_unit?: string;
  metric_regex?: string; // Optional regex to capture numeric value from stdout
}

export interface VariantProbeResult {
  probe_name: string;
  category: MatrixProbeCategory;
  command: string;
  passed: boolean;
  exit_code: number;
  duration_ms: number;
  stdout: string;
  stderr: string;
  numeric_value?: number;
  metric_unit?: string;
}

export interface VariantEvaluationSummary {
  worktree_id: string;
  variant_name: string;
  probe_results: VariantProbeResult[];
  tests_passed: number;
  tests_total: number;
  lint_clean: boolean;
  benchmark_latency_ms?: number;
  benchmark_ops_sec?: number;
  bundle_size_bytes?: number;
  git_diff: {
    files_changed: number;
    insertions: number;
    deletions: number;
  };
  composite_score: number; // 0 - 100
  rank: number; // 1 = Winner
  compliant: boolean; // Passes all mandatory probes
}

export interface MatrixScoringWeights {
  correctness: number; // e.g. 0.40
  performance: number; // e.g. 0.30
  maintainability_churn: number; // e.g. 0.20
  size: number; // e.g. 0.10
}

export interface ExperimentMatrixReport {
  feature_name: string;
  evaluated_at: string;
  probes: MatrixProbeSpec[];
  weights: MatrixScoringWeights;
  variants: VariantEvaluationSummary[];
  recommended_winner_id: string;
  winning_justification: string;
  baseline_comparison?: {
    base_branch: string;
    metrics: Record<string, number>;
    deltas: Record<string, { delta_pct: number; improved: boolean }>;
  };
}

export interface ParallelEvalOptions {
  feature: string;
  matrix?: string[];
  concurrency?: number;
  serial?: boolean;
  autoPick?: boolean;
  baseline?: boolean;
  timeoutSeconds?: number;
  dryRun?: boolean;
}
```

---

## Zod Validation Schemas (`src/metadata/schema.ts`)

```typescript
export const MatrixProbeCategorySchema = z.enum(['test', 'lint', 'benchmark', 'size', 'custom']);

export const MatrixProbeSpecSchema = z.object({
  name: z.string(),
  command: z.string(),
  category: MatrixProbeCategorySchema,
  mandatory: z.boolean().optional(),
  timeout_seconds: z.number().int().positive().optional(),
  weight: z.number().nonnegative().optional(),
  higher_is_better: z.boolean().optional(),
  metric_unit: z.string().optional(),
  metric_regex: z.string().optional(),
});

export const VariantProbeResultSchema = z.object({
  probe_name: z.string(),
  category: MatrixProbeCategorySchema,
  command: z.string(),
  passed: z.boolean(),
  exit_code: z.number().int(),
  duration_ms: z.number().nonnegative(),
  stdout: z.string(),
  stderr: z.string(),
  numeric_value: z.number().optional(),
  metric_unit: z.string().optional(),
});

export const VariantEvaluationSummarySchema = z.object({
  worktree_id: z.string(),
  variant_name: z.string(),
  probe_results: z.array(VariantProbeResultSchema),
  tests_passed: z.number().int().nonnegative(),
  tests_total: z.number().int().nonnegative(),
  lint_clean: z.boolean(),
  benchmark_latency_ms: z.number().optional(),
  benchmark_ops_sec: z.number().optional(),
  bundle_size_bytes: z.number().optional(),
  git_diff: z.object({
    files_changed: z.number().int().nonnegative(),
    insertions: z.number().int().nonnegative(),
    deletions: z.number().int().nonnegative(),
  }),
  composite_score: z.number().min(0).max(100),
  rank: z.number().int().positive(),
  compliant: z.boolean(),
});

export const ExperimentMatrixReportSchema = z.object({
  feature_name: z.string(),
  evaluated_at: z.string(),
  probes: z.array(MatrixProbeSpecSchema),
  weights: z.object({
    correctness: z.number(),
    performance: z.number(),
    maintainability_churn: z.number(),
    size: z.number(),
  }),
  variants: z.array(VariantEvaluationSummarySchema),
  recommended_winner_id: z.string(),
  winning_justification: z.string(),
  baseline_comparison: z
    .object({
      base_branch: z.string(),
      metrics: z.record(z.string(), z.number()),
      deltas: z.record(
        z.string(),
        z.object({
          delta_pct: z.number(),
          improved: z.boolean(),
        })
      ),
    })
    .optional(),
});
```

---

## Metadata Storage Evolution

In `.mannostree/experiments/<feature>.json`, the schema is extended with an optional `eval_matrix` property:

```json
{
  "version": 1,
  "feature_name": "auth-spike",
  "base_branch": "main",
  "created_at": "2026-09-01T10:00:00.000Z",
  "updated_at": "2026-09-01T10:30:00.000Z",
  "status": "evaluated",
  "variants": [
    "auth-spike-v1",
    "auth-spike-v2"
  ],
  "winner": "auth-spike-v1",
  "eval_matrix": {
    "feature_name": "auth-spike",
    "evaluated_at": "2026-09-01T10:30:00.000Z",
    "recommended_winner_id": "auth-spike-v1",
    "winning_justification": "Variant 1 achieved 100% test pass rate with 35% lower latency (120ms vs 185ms) and 42 fewer lines changed.",
    "variants": [
      {
        "worktree_id": "auth-spike-v1",
        "variant_name": "v1",
        "composite_score": 92.5,
        "rank": 1,
        "compliant": true
      },
      {
        "worktree_id": "auth-spike-v2",
        "variant_name": "v2",
        "composite_score": 78.0,
        "rank": 2,
        "compliant": true
      }
    ]
  }
}
```
