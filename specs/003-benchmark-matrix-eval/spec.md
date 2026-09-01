# Feature Specification: Automated Benchmark Harness & Comparative Matrix Evaluation

**Feature Branch**: `003-benchmark-matrix-eval`  
**Created**: 2026-09-01  
**Status**: Draft  
**Input**: User description: "Movement 2: Automated Benchmark Harness and Comparative Matrix Evaluation (mannostree parallel eval, automated test/lint/benchmark matrix, multi-variant scoring)"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Multi-Variant Matrix Evaluation Dispatch (Priority: P1) 🎯 MVP

When a developer or AI fleet generates multiple parallel variant worktrees to solve a problem (e.g. 3 competing algorithms or architectural designs), the developer needs to evaluate all variants under identical test and benchmark conditions with a single command. The system concurrently executes configured evaluation probes (unit tests, linters, benchmark scripts, bundle size calculations) across all variants without manual per-directory commands.

**Why this priority**: Removes tedious manual testing across separate worktree paths and ensures all variants are evaluated under consistent, reproducible execution conditions.

**Independent Test**: Can be tested by creating a 2-variant parallel experiment, running `mannostree parallel eval <feature>`, verifying that tests and checks execute across both variant sandboxes, and confirming that evaluation results are recorded in metadata.

**Acceptance Scenarios**:

1. **Given** an experiment with 2 or more variants, **When** the user runs `mannostree parallel eval <feature>`, **Then** the system executes the default validation and benchmark suites across all variants in parallel and records results in experiment metadata.
2. **Given** custom probe commands specified via CLI (`--matrix "npm test, npm run bench"`), **When** evaluation runs, **Then** the system executes the specified probe sequence in each variant workspace sandbox.
3. **Given** a dry-run invocation (`--dry-run`), **When** the user previews evaluation, **Then** the system displays the probes and target worktrees that would be executed without invoking subprocesses.

---

### User Story 2 - Standardized Matrix Metric Collection & Custom Probes (Priority: P1)

To evaluate variants comprehensively, the harness must collect diverse quantitative dimensions: functional correctness (test pass counts/rates), code quality (linter warnings/errors), performance (execution latency, throughput, benchmark durations), footprint (bundle/binary size, file count), and code churn (insertions, deletions, changed files).

**Why this priority**: Single-metric evaluation (e.g. only test pass) is insufficient for choosing between competing architectures; multidimensional metrics provide a complete engineering picture.

**Independent Test**: Can be tested by executing a matrix evaluation on variants with different characteristics (e.g., Variant 1 faster with more lines, Variant 2 smaller with fewer dependencies), and verifying that all metric dimensions are accurately captured in the resulting report.

**Acceptance Scenarios**:

1. **Given** an evaluated variant, **When** tests and benchmarks complete, **Then** the system records test pass/fail counts, total execution duration, benchmark score, bundle/artifact size, and git diff statistics.
2. **Given** a probe that outputs structured numeric metrics (e.g. ops/sec, milliseconds, or bytes), **When** the probe finishes, **Then** the system extracts and normalizes the metric values for comparative ranking.
3. **Given** a failing probe in one variant (e.g. runtime exception), **When** other variants succeed, **Then** the system isolates the failure to that variant, records the error diagnostic, and completes evaluation for remaining variants.

---

### User Story 3 - Comparative Matrix Table & Automated Scoring (Priority: P2)

After running evaluation probes across all variants, the system compiles a side-by-side comparative matrix table. It normalizes metrics into a composite score (0–100) based on configurable weights (e.g., correctness 40%, performance 30%, maintainability/code churn 20%, size 10%), rendering a clear comparison table with highlighted best/worst performers.

**Why this priority**: Translates complex multi-dimensional raw data into an immediate, intuitive, and objective decision matrix for developers and lead reviewer agents.

**Independent Test**: Can be tested by running evaluation across multiple variants, viewing the terminal output and `.task/matrix-report.md`, and confirming the presence of normalized composite scores and side-by-side metric tables.

**Acceptance Scenarios**:

1. **Given** completed matrix evaluations across variants, **When** results are rendered, **Then** the system displays a side-by-side comparative table highlighting best and worst values per metric dimension.
2. **Given** configured scoring weights in `.mannostree.yml` or CLI options, **When** composite scores are calculated, **Then** each variant receives a normalized score reflecting its weighted performance across all probes.
3. **Given** an evaluation run, **When** completion finishes, **Then** the system persists the full comparison table to `.task/matrix-report.md` in the experiment workspace and updates `.mannostree/experiments/<feature>.json`.

---

### User Story 4 - Automated Winner Recommendation & Justification Engine (Priority: P2)

Developers and autonomous orchestrators need actionable decision support. The system analyzes the comparative matrix and automatically formulates a clear winner recommendation accompanied by a detailed justification explaining why the winning variant scored highest and what trade-offs were made against losing variants.

**Why this priority**: Eliminates guesswork and provides durable, audit-ready justification for architectural choices.

**Independent Test**: Can be tested by evaluating an experiment where Variant A clearly outperforms Variant B in speed and test coverage, verifying that the generated report names Variant A as the recommended winner and details specific metric advantages.

**Acceptance Scenarios**:

1. **Given** a completed evaluation matrix, **When** scores are computed, **Then** the system identifies the highest-scoring compliant variant as the recommended winner.
2. **Given** a recommended winner, **When** the report is generated, **Then** the system produces a structured justification paragraph citing exact test pass rates, speed improvements, and diff metrics over competitor variants.
3. **Given** the `--pick` or `--auto-pick` flag with `mannostree parallel eval`, **When** evaluation completes with an undisputed winner, **Then** the system automatically invokes winner selection (`parallel pick`) and preserves non-winning variants.

---

### User Story 5 - Baseline Comparison & Regression Guard (Priority: P3)

To ensure that no selected variant introduces regressions compared to the existing codebase, the evaluation harness can run probes against the base branch (`main`) as a baseline reference.

**Why this priority**: Protects production stability by verifying that winning variants not only beat sister variants, but also strictly improve or maintain base branch benchmarks.

**Independent Test**: Can be tested by evaluating variants against a base branch baseline, verifying that delta metrics (e.g. +15% faster than `main`, +0 test regressions) appear in the comparison table.

**Acceptance Scenarios**:

1. **Given** an experiment evaluated with `--baseline`, **When** the harness runs, **Then** the system samples baseline metrics from the base branch and displays relative percentage deltas (e.g. `+12% speedup vs main`).
2. **Given** a variant that introduces a performance regression against the base branch, **When** ranking is calculated, **Then** the system flags a regression warning and penalizes the composite score.

---

### Edge Cases

- **Probe Timeout / Runaway Benchmark**: If a benchmark or test probe hangs beyond the per-probe timeout limit, the system terminates the probe subprocess, records a `timeout` result for that variant/probe, and continues evaluating other probes and variants.
- **Partial Variant Compilation Failure**: If one variant fails to compile while others succeed, the failing variant receives 0 correctness score, its error log is captured in `.task/matrix-report.md`, and remaining variants complete evaluation normally.
- **Identical Scores / Tie-Breaker**: If two variants produce identical composite scores, the system breaks ties deterministically using primary criteria order: Correctness > Test Execution Speed > Smaller Code Diff > Creation Order.
- **Missing Custom Probes in Worktree**: If a probe command does not exist in a variant's `package.json` or project scripts, the system records a skipped probe notice with a clear warning without crashing the evaluation run.
- **Resource Contention on Host**: When running heavy benchmarks across multiple variants concurrently, the user can pass `--concurrency N` (or `--serial`) to run benchmarks sequentially to prevent CPU/IO throttling skewing results.

---

## Requirements *(mandatory)*

### Functional Requirements

- **`FR-001`**: The system MUST provide a CLI command `mannostree parallel eval <feature>` to execute comparative evaluation matrices across all variants in an experiment.
- **`FR-002`**: The evaluation harness MUST support custom probe sequences specified via `--matrix <probes...>` flag or configured in `.mannostree.yml` under `parallel.eval_matrix`.
- **`FR-003`**: The system MUST support standard probe categories: validation/test suites, lint checks, benchmark commands, bundle/artifact size checks, and git diff statistics.
- **`FR-004`**: The evaluation runner MUST support configurable concurrency (`--concurrency <N>` or `--serial`) and per-probe timeouts to avoid benchmark skew or infinite loops.
- **`FR-005`**: The system MUST record per-probe execution time, exit code, stdout, stderr, and extracted numeric metrics for every variant.
- **`FR-006`**: The system MUST calculate a normalized composite score (0–100) per variant based on configurable metric weights.
- **`FR-007`**: The system MUST generate a durable, human-readable markdown comparison report at `.task/matrix-report.md` in the experiment directory or lead worktree.
- **`FR-008`**: The system MUST update `.mannostree/experiments/<feature>.json` with a structured `eval_matrix` record containing all probe results, scores, and timestamp.
- **`FR-009`**: The CLI output MUST format a side-by-side comparison table highlighting best values (green) and worst values (red/dim).
- **`FR-010`**: The system MUST formulate an automated winner recommendation with human-readable justification citing specific performance and quality deltas.
- **`FR-011`**: The system MUST support an `--auto-pick` flag to immediately promote the top-ranked compliant variant via the winner selection engine while preserving losing variants.
- **`FR-012`**: The system MUST support an optional `--baseline` flag to execute probes against the base branch and report relative delta comparisons.
- **`FR-013`**: All evaluation commands MUST support `--json` and `--yaml` machine-readable output envelopes with exit code 0 on successful evaluation.
- **`FR-014`**: The system MUST support `--dry-run` to preview probe commands and target worktrees without executing subprocesses.
- **`FR-015`**: The evaluation process MUST be strictly read-only and non-destructive with respect to variant source code and uncommitted files.

---

## Key Entities & Data Model

- **`MatrixProbeSpec`**: Definition of an evaluation probe (name, command, category: `test` | `lint` | `benchmark` | `size` | `custom`, timeout, weight, optional regex metric extractor).
- **`VariantProbeResult`**: Outcome of a probe executed on a specific variant (probe name, exit code, duration ms, passed boolean, raw output, extracted metric value).
- **`VariantEvaluationSummary`**: Aggregated metrics for a single variant (worktree ID, probe results, git diff stats, composite score, rank).
- **`ExperimentMatrixReport`**: Complete evaluation matrix across all variants (feature name, timestamp, probes evaluated, variant summaries, recommended winner ID, winning justification, baseline comparisons).
- **`MatrixScoringWeights`**: Normalized weighting dictionary (correctness, performance, code churn, size).

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **`SC-001`**: 100% of active variants in an experiment are evaluated consistently across all configured matrix probes without cross-worktree contamination.
- **`SC-002`**: Evaluation matrix completes and renders side-by-side comparison tables within 30 seconds for standard test/lint suites.
- **`SC-003`**: Zero source code modifications or uncommitted worktree changes introduced during evaluation.
- **`SC-004`**: Automated scoring produces deterministic, mathematically reproducible composite rankings and justifications.
- **`SC-005`**: 100% of probe failures are isolated to the offending variant without crashing the broader fleet evaluation run.
- **`SC-006`**: All unit and integration test suites pass with 100% success and 0 regressions against existing functionality.
