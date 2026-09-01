# Implementation Plan: Automated Benchmark Harness & Comparative Matrix Evaluation

**Branch**: `003-benchmark-matrix-eval` | **Date**: 2026-09-01 | **Status**: Complete  
**Feature Spec**: [`spec.md`](./spec.md) | **Technical Research**: [`research.md`](./research.md) | **Data Model**: [`data-model.md`](./data-model.md)

---

## Technical Context

- **Active Technologies**: TypeScript 5.7.3 / Node.js >= 20.0.0 (ESM `"type": "module"`), Commander CLI, Chalk, Zod, YAML, ChildProcess / Subprocess Execution.
- **Repository Architecture**: Modular engine layers (`src/core/`, `src/git/`, `src/metadata/`, `src/cli/`).
- **Persistence Pattern**: Atomic JSON persistence with metadata journaling in `.mannostree/experiments/<feature>.json` and markdown artifacts in `.task/matrix-report.md`.
- **Concurrency Model**: Controlled asynchronous task queue with configurable concurrency (`--concurrency N` or `--serial`) and timeout watchdog containment.

---

## Constitution Check

- ✅ **Safety First & Data Loss Prevention**: Evaluation probes are strictly non-destructive. No source code or uncommitted workspace files are modified.
- ✅ **Guarded Cleanup**: When `--auto-pick` selects a winning variant, losing variants remain preserved in the metadata registry until explicit user cleanup.
- ✅ **Explicit State Integrity**: Matrix results and composite scores are atomically persisted in `.mannostree/experiments/<feature>.json`.
- ✅ **Observability & Machine Readability**: Full support for `--json`, `--yaml`, `--plain`, and `--dry-run`.
- ✅ **Small Blast Radius**: Builds upon existing `ParallelEngine`, `QualityGatesRunner`, and `MetadataStore` without modifying core worktree spawning or lifecycle recovery primitives.

---

## Architecture & Component Design

### 1. Matrix Evaluation Runner (`src/core/matrix-eval.ts`)
- **Probe Specification Normalizer**: Resolves probe command sequences from CLI flags, `.mannostree.yml`, or profile defaults (`tests`, `lints`, `benchmarks`).
- **Concurrent Probe Execution Engine**: Spawns sandboxed probe subprocesses with per-probe timeouts, capturing exit codes, durations, stdout/stderr, and extracting numeric performance metrics via regex.
- **Base Branch Baseline Sampler**: Samples baseline benchmark metrics against the base branch (`main`) using a temporary detached worktree when `--baseline` is requested.
- **Scoring Engine**: Implements the Normalized Weighted Sum Model (WSM) with penalty factors for failing tests or compilation errors to produce 0–100 composite scores.
- **Report & Justification Compiler**: Generates human-readable markdown tables and structured justification text for `.task/matrix-report.md`.

### 2. Orchestrator Integration (`src/core/orchestrator.ts`)
- Implements `public async parallelEval(options: ParallelEvalOptions): Promise<CommandOutput<{ report: ExperimentMatrixReport; matrix_report_path: string; picked_winner?: string | null }>>`.
- Connects matrix evaluation results directly to winner selection (`this.parallelEngine.pickWinner`) when `--auto-pick` is enabled.

### 3. CLI Command Suite (`src/cli/commands/parallel.ts`)
- Registers `mannostree parallel eval <feature>` with options (`--matrix`, `--concurrency`, `--serial`, `--auto-pick`, `--baseline`, `--timeout`).
- Formats color-coded comparative matrix tables in terminal output.

---

## Planned Implementation Phases

1. **Phase 1: Setup & Data Model Extension**:
   - Add matrix probe & evaluation schemas in `src/metadata/schema.ts` and `src/types/index.ts`.
   - Update `ParallelConfigSchema` in `src/config/schema.ts` to support `eval_matrix` probe defaults and scoring weights.

2. **Phase 2: Matrix Evaluation Engine (`src/core/matrix-eval.ts`)**:
   - Implement `MatrixEvaluator` (probe runner, concurrency queue, metric extractor, scoring calculator, and report generator).

3. **Phase 3: Orchestrator & CLI Integration**:
   - Hook up `parallelEval` in `src/core/orchestrator.ts`.
   - Register `parallel eval` subcommand in `src/cli/commands/parallel.ts`.
   - Add table formatter in `src/cli/output.ts`.

4. **Phase 4: Verification & Automated Tests**:
   - Unit tests for metric extraction, WSM scoring, and report generation in `tests/unit/matrix-eval.test.ts`.
   - Integration tests for `parallel eval`, `--auto-pick`, `--serial`, and `--json` in `tests/integration/parallel-eval.test.ts`.
