# Task Contract: Parallel Lifecycle Safety, Partial-Failure Handling, & Winner Protection

## Problem
Auditing `parallel drop` identified three safety risks and semantic gaps:
1. **Preview Envelope Semantic Gap**: When `parallel drop` was run without `--yes` (preview mode), the output envelope reported `dry_run: false` instead of `dry_run: true`.
2. **Experiment Deletion on Partial Failure**: If dropping an individual variant failed (e.g. dirty worktree without `--force`), the error was suppressed and the experiment record was deleted from metadata, abandoning surviving worktrees without experiment tracking.
3. **Winner Protection Policy**: `parallel drop` lacked enforcement of `config.cleanup.protect_winner`, which should protect winning variants from accidental mass deletion unless `--force` is supplied.

## Scope
1. **Precise Output Envelope Semantics**:
   - Report `dry_run: true` whenever running with `--dry-run` OR without `--yes` in preview mode.
2. **Safe Partial-Failure Handling & Metadata Consistency**:
   - When dropping experiment variants, capture failures per variant (with error message).
   - If any variant survives (due to failure or winner protection), **DO NOT delete the experiment record**.
   - Update `experiment.variants` in metadata to track only the surviving variants, ensuring `doctor` and `recover` maintain a reliable audit trail.
   - Only delete the experiment record when 100% of managed variants are dropped.
   - **Archival Semantics**: When `--archive` is specified, each successfully dropped variant is archived via `store.deleteWorktree(id, archive: true)`. If all variants are dropped, the experiment entity is archived/deleted cleanly. Surviving variants remain active in the primary store.
3. **Winner Protection Policy**:
   - Respect `config.cleanup.protect_winner` (default true). If an experiment has a selected winner, preserve the winning variant unless `--force` is passed.
4. **Error Signaling & Process Exit Codes**:
   - Ensure `formatOutput` sets non-zero `process.exitCode = ExitCode.GENERIC_FAILURE` (1) whenever `output.ok === false`.
5. **Comprehensive Test Suite & Accurate Coverage Reporting**:
   - Unit and integration tests covering preview semantics, dirty variant failures, partial survival, winner protection, non-zero exit codes, and metadata synchronization.
   - Report true whole-project coverage totals.

## Out-of-Scope
- Automatically merging variants or auto-deleting unselected branches without explicit user command.

## Acceptance Criteria
- [x] `npm run lint`: 0 TypeScript type errors.
- [x] `npm run build`: Clean compilation to `dist/`.
- [x] `npm run coverage`: All tests passing with full whole-project metric reporting (62/62 tests passing).
- [x] `parallel drop` without `--yes` returns `dry_run: true`.
- [x] `parallel drop` with dirty variant fails safely, preserves dirty variant, updates experiment record with surviving variant, and does not delete experiment metadata.
- [x] `parallel drop` preserves winner variant when `protect_winner: true` unless `--force` is provided.
- [x] `parallel drop` sets non-zero process exit code (1) when encountering partial failure.

## Safety Invariants
- Base branch: `main`.
- Publishing mode: `prepare-only`.
- Never delete an experiment record while surviving variants remain managed.
- Never delete dirty worktrees without `--force`.
