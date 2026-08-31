# Research & Technical Decisions: Parallel Lifecycle Safety & Partial Failure

## Research Findings & Architectural Decisions

### 1. Partial-Failure Invariant & Metadata Consistency
- **Source**: `AGENTS.md` Hard Project Rules & ADR-002 (Atomic Metadata Store).
- **Findings**:
  - Dropping an experiment is a multi-step operation over N variant worktrees and 1 experiment metadata record.
  - If any variant cannot be dropped (e.g. dirty changes without `--force`), deleting the experiment record breaks referential integrity and prevents future `parallel list` or `parallel drop` from knowing about those variants.
- **Decision**:
  - `dropExperiment` must execute in 3 stages:
    1. Check winner protection and identify variants to drop.
    2. Attempt drop on each candidate variant, collecting success and failure per variant.
    3. If all variants dropped -> delete experiment record via `store.deleteExperiment()`.
    4. If some variants survived -> update `experiment.variants = surviving_variants`, save experiment record, and return detailed warnings/errors in the output envelope.

### 2. Envelope Dry-Run & Preview Semantics
- **Source**: CLI Specification (`docs/02-project-kickoff/cli-spec.md`).
- **Findings**:
  - A mutating command executed without required confirmation (`-y, --yes`) is functionally a dry-run preview.
- **Decision**:
  - Mark `dry_run: true` in the output envelope whenever `!options.yes` or `options.dryRun` is true.

### 3. Winner Protection Policy
- **Source**: `.mannostree.yml` schema (`cleanup.protect_winner`).
- **Findings**:
  - When an experiment has chosen a winner, the user intends to preserve the winning implementation for review or publishing.
- **Decision**:
  - Check `config.cleanup?.protect_winner !== false` and `!options.force`. If true and `vId === experiment.winner`, skip dropping the winner, record `winner_protected: winnerId`, and keep winner in `surviving_variants`.
