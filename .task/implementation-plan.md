# Implementation Plan: Phase 4 Parallel Variant Workflows

## Overview
Deliver Phase 4 Parallel Variant Workflows for **Mannostree**:
- **Experiment Schema & Persistence**:
  - Add `ExperimentRecordSchema` in `src/metadata/schema.ts`.
  - Add `saveExperiment`, `getExperiment`, `listExperiments`, `deleteExperiment` in `src/metadata/store.ts`.
- **Git Engine Shortstat**:
  - Add `getDiffShortStat` in `src/git/engine.ts`.
- **Parallel Engine (`src/core/parallel.ts`)**:
  - `spawnVariants`: Validates base branch, spawns N variant worktrees (`experiment/<feature>-v<N>`), scaffolds artifacts, and saves experiment record.
  - `compareVariants`: Reads all variant records, computes live git state and diff stats, returning structured comparison data.
  - `pickWinner`: Validates winner selection, updates worktree and experiment metadata, enforces NO AUTO-MERGE, and preserves losing variants unless `--cleanup-losers --yes` is supplied.
- **Orchestrator Integration**:
  - Expose `parallelSpawn`, `parallelCompare`, and `parallelPick` in `MannostreeOrchestrator`.
- **CLI Commands**:
  - `mannostree parallel spawn <feature> -n <count> [--base-branch <base>] [--profile <name>] [--plan-mode shared|isolated] [--dry-run]`
  - `mannostree parallel compare <feature> [--json] [--yaml]`
  - `mannostree parallel pick <feature> --winner <id_or_index> [--cleanup-losers] [--archive-losers] [--reason <text>] [--dry-run]`
- **Testing & Documentation**:
  - Unit tests for parallel engine and CLI integration tests.

---

## Detailed Specifications

### 1. `parallel spawn <feature> -n <count>`
- Feature name validated and sanitized.
- Count validated (1 <= count <= `config.parallel.max_variants`).
- Base branch explicitly resolved.
- For each variant $i \in [1..count]$:
  - id: `experiment-<feature>-v<i>`
  - branch: `experiment/<feature>-v<i>`
  - path: `.worktrees/<feature>-v<i>`
  - scaffolds `.task/` and `RESULTS.md`.
- Persists `.mannostree/experiments/<feature>.json`.

### 2. `parallel compare <feature>`
- Loads `.mannostree/experiments/<feature>.json`.
- For each variant worktree:
  - Fetches ahead/behind count vs base.
  - Fetches diff shortstat (files changed, insertions, deletions).
  - Inspects validation and review status.
  - Formats into structured comparison table / JSON envelope.

### 3. `parallel pick <feature> --winner <id_or_index>`
- Matches winner by full ID (`experiment-<feature>-v1`) or short index (`v1` or `1`).
- Sets `winner: true` on winner worktree record.
- Sets `winner: <winner_id>`, `selected_at: <ISO8601>`, `selection_reason` on experiment record.
- If `--cleanup-losers` AND `--yes`: Drops non-winning variant worktrees.
- Enforces strict no-auto-merge policy.

---

## Acceptance Traceability Matrix

| Requirement | Implementation Component | Test Suite |
|-------------|--------------------------|------------|
| Multi-variant spawn & experiment record | `ParallelEngine.spawnVariants`, `orchestrator.parallelSpawn` | `tests/unit/parallel.test.ts` |
| Side-by-side comparison & metrics | `ParallelEngine.compareVariants`, `orchestrator.parallelCompare` | `tests/unit/parallel.test.ts` |
| Explicit winner selection & no-auto-merge | `ParallelEngine.pickWinner`, `orchestrator.parallelPick` | `tests/unit/parallel.test.ts` |
| CLI `parallel` command tree | `src/cli/commands/parallel.ts` | `tests/integration/phase4.test.ts` |
| Backward compatibility | All prior modules | All test suites |
