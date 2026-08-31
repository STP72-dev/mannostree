# Solution Options: Phase 2 Operational Safety & Diagnostics

## Option 1: Integrated Orchestrator with Dedicated Engine Extensions (Recommended)

### Architecture & Module Boundaries
- Extends existing Phase 1 modules without breaking contracts:
  - `src/git/engine.ts`: Add `getAheadBehindCount`, `isBranchMerged`, `syncWorktree` (with automatic abort on conflict), `repairWorktree`, `listPorcelainWorktrees`.
  - `src/core/doctor.ts`: Dedicated diagnostic analyzer evaluating registry vs disk, git refs, untracked directories, and schema health.
  - `src/core/orchestrator.ts`: Implement `status`, `sync`, `doctor`, `clean`, and `recover`.
  - `src/cli/commands/`: Add `status.ts`, `sync.ts`, `doctor.ts`, `clean.ts`, `recover.ts`.

### State Transitions & Metadata Impact
- `status`: Enriches `git_state` and returns live status without mutating metadata files on disk unless `--fetch` refreshes refs.
- `sync`: Updates worktree `git_state` and `last_activity_at` upon successful rebase/merge.
- `doctor`: Read-only. `--fix` updates registry/worktree records according to confirmed repair actions.
- `clean`: Transitions removed worktrees to `CLEANED` / archived metadata.
- `recover`: Transitions unrecoverable or damaged worktrees to `BROKEN` if repair fails, or updates metadata upon successful repair.

### Dry-Run & Confirmation Behavior
- All state-mutating commands (`sync`, `clean`, `recover`, `doctor --fix`) implement full `--dry-run` plans.
- `clean` defaults to dry-run reporting unless an explicit filter AND `--yes` are provided.
- `doctor --fix` requires explicit `--yes` for state mutations.

### Error & Exit-Code Behavior
- `ExitCode.USAGE_ERROR` (2): Missing required options, invalid flags.
- `ExitCode.VALIDATION_FAILURE` (3): Missing filters on destructive clean, schema violations.
- `ExitCode.GIT_ERROR` (4): Git command failure, sync conflict (with aborted state).
- `ExitCode.METADATA_INCONSISTENCY` (6): Doctor reports critical metadata corruption.
- `ExitCode.RECOVERABLE_BROKEN_STATE` (20): Doctor or recover encounters repairable broken state.

### Test Strategy
- Unit tests for git engine sync rollback, merge detection, ahead/behind calculation.
- Unit tests for doctor diagnostic rules across mock inconsistencies.
- Integration tests for end-to-end `status`, `sync` with conflicts, `clean` filters, `doctor --fix`, and `recover` repair flows in temp git repos.

### Failure, Recovery, Scope & Reversibility
- If sync encounters conflict, it immediately aborts (`git rebase --abort` / `git merge --abort`) and reports conflict files safely.
- Clean and recover never touch untracked worktrees or the main workspace.
- Minimal blast radius; 100% backward compatible with Phase 1.

---

## Option 2: Standalone Sub-Engine per Command Family

### Architecture & Module Boundaries
- Creates separate isolated sub-packages (`src/status/`, `src/sync/`, `src/doctor/`, `src/clean/`, `src/recover/`), each instantiating their own Git and Metadata handles.

### State Transitions & Metadata Impact
- Duplicates git status and metadata querying across sub-engines.

### Dry-Run & Confirmation Behavior
- Implements dry-run independently in each sub-engine.

### Error & Exit-Code Behavior
- Uses standard exit codes, but potential inconsistencies across sub-packages.

### Test Strategy
- Tests written per sub-package.

### Failure, Recovery, Scope & Reversibility
- Higher risk of state drift due to duplicated orchestrator logic.
- More boilerplate, heavier refactoring of Phase 1 orchestrator boundaries.

---

## Option 3: External Script Execution with CLI Shell Facade

### Architecture & Module Boundaries
- Implements shell scripts (`scripts/sync.sh`, `scripts/doctor.sh`, `scripts/clean.sh`) invoked via child processes from Node.

### State Transitions & Metadata Impact
- State transitions managed across process boundaries.

### Dry-Run & Confirmation Behavior
- Hard to enforce deterministic dry-run previews in shell scripts.

### Error & Exit-Code Behavior
- Fragile exit code parsing.

### Test Strategy
- Requires testing bash scripts across environments.

### Failure, Recovery, Scope & Reversibility
- Disqualified by ADR-001 (Mannostree is the single lifecycle layer; no external shell scripts).
- High risk of data loss on cleanup/sync.
