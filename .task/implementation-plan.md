# Implementation Plan: Parallel Lifecycle Safety, Partial-Failure Handling, & Winner Protection

## Overview
Hardens `parallel drop` and `ParallelEngine` against partial failures, enforces winner protection policy, accurately models dry-run/preview envelope semantics, and guarantees atomic metadata consistency.

## Tasks

### 1. `ParallelDropResult` & `ParallelEngine.dropExperiment` Refactoring
- Expand `ParallelDropResult` with `surviving_variants`, `failed_variants`, `winner_protected`, and nullable `experiment`.
- Implement winner protection when `config.cleanup?.protect_winner !== false && !force`.
- Attempt drop per candidate variant; capture individual failures without throwing unhandled exceptions.
- If any variant survives:
  - Synchronize `experiment.variants = surviving_variants`.
  - Save updated experiment record to `.mannostree/experiments/<feature>.json`.
- Only delete experiment record when 100% of variants are removed.

### 2. Orchestrator Envelope & Output Formatting
- In `orchestrator.parallelDrop`: Set `dry_run: !options.yes || !!options.dryRun`.
- In `src/cli/output.ts`: Enhance `formatParallelDropResult` to report protected winners and failure reasons.

### 3. Comprehensive Testing & Whole-Project Coverage
- Add unit tests in `tests/unit/parallel.test.ts` for preview envelope, dirty variant failure, partial survival, winner protection, and `--force` override.
- Run `npm run coverage` and record true whole-project coverage totals.

---

## Acceptance Traceability Matrix

| Requirement | Implementation Component | Test Suite |
|-------------|--------------------------|------------|
| Preview mode reports `dry_run: true` | `orchestrator.parallelDrop` | `tests/unit/parallel.test.ts` |
| Partial failure retains surviving variants | `ParallelEngine.dropExperiment` | `tests/unit/parallel.test.ts` |
| Experiment record not deleted on partial failure | `ParallelEngine.dropExperiment` | `tests/unit/parallel.test.ts` |
| Winner protected when `protect_winner: true` | `ParallelEngine.dropExperiment` | `tests/unit/parallel.test.ts` |
| Winner dropped with `--force` | `ParallelEngine.dropExperiment` | `tests/unit/parallel.test.ts` |
| Clean drop deletes experiment record | `ParallelEngine.dropExperiment` | `tests/integration/phase4.test.ts` |
