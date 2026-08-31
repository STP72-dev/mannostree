# Solution Options: Parallel Lifecycle Safety & Partial Failure Handling

## Option 1: Partial-State Reconciliation with Surviving Variant Synchronization (Recommended)

### Architecture & Module Boundaries
- `ParallelEngine.dropExperiment`:
  - Protects winner if `config.cleanup?.protect_winner` is enabled and `!force`.
  - Attempts dropping each non-protected variant, capturing errors individually.
  - If all variants are dropped, removes experiment record via `store.deleteExperiment()`.
  - If any variant survives (protected winner or error), synchronizes `experiment.variants = surviving_variants`, marks status `active` or `completed`, and saves updated experiment record.
- `orchestrator.parallelDrop`:
  - Sets `dry_run: true` when `!yes` or `dryRun: true`.
  - Emits descriptive warnings/errors.

### Safety & Recoverability
- Zero orphaned worktrees; 100% consistent registry and metadata state.

---

## Option 2: Strict Preflight Check with Fail-Fast Abort

### Architecture & Module Boundaries
- Checks all variants for dirty status and conflicts up front; if any single variant fails, aborts entire drop without deleting any variant.

### Safety & Recoverability
- Safe, but prevents dropping valid clean variants if one variant has a detached worktree or unresolvable error.

---

## Option 3: Silent Suppression & Unconditional Deletion

### Architecture & Module Boundaries
- Drops variants with try/catch ignoring errors and unconditionally deletes experiment record.

### Safety & Recoverability
- Violates safety invariants by abandoning surviving worktrees without experiment tracking.
- Disqualified.
