# Pull Request: Mannostree Phase 2 Operational Safety & Diagnostics

## Summary
Implements Phase 2 Operational Safety & Diagnostics for **Mannostree**, delivering `status`, `sync`, `doctor`, `clean`, and `recover` commands while preserving 100% backward compatibility with Phase 1.

## Changes
- **Git & Worktree Engine Extensions**:
  - `getAheadBehindCount`: Fast, accurate commit counting vs base branch.
  - `isBranchMerged`: Merge-base ancestry checking for branch lifecycle.
  - `syncWorktree`: Safe rebase/merge with automated rollback (`git rebase --abort` / `git merge --abort`) on conflict.
  - `listPorcelainWorktrees`, `repairWorktree`, `listLocalBranches`, `fetchAll`.
- **Doctor Diagnostic Engine**:
  - Added `src/core/doctor.ts` detecting missing directories, missing branches, schema inconsistencies, unindexed files, orphan branches, and untracked folders (strictly non-mutating).
- **Core Orchestrator**:
  - Implemented `status`, `sync`, `doctor`, `clean`, and `recover` methods in `src/core/orchestrator.ts`.
- **CLI Commands & Output Formatters**:
  - Added `status.ts`, `sync.ts`, `doctor.ts`, `clean.ts`, `recover.ts` to `src/cli/commands/`.
  - Added formatters for diagnostics, cleanup summaries, and sync/recovery results in `src/cli/output.ts`.
  - Updated CLI command tree in `src/cli/index.ts`.
- **Automated Tests**:
  - Added unit test suites (`tests/unit/sync.test.ts`, `tests/unit/doctor.test.ts`, `tests/unit/clean.test.ts`, `tests/unit/recover.test.ts`) and integration suite (`tests/integration/phase2.test.ts`).
  - Total tests: 32/32 passed across 11 test suites.
- **Documentation**:
  - Updated `README.md` and durable task artifacts.

## Validation
- `npm run lint`: Passed (0 type errors).
- `npm run build`: Passed (Clean compilation to `dist/`).
- `npm test -- --run`: Passed (32/32 tests passed in 905ms).

## Review
- Independent review verdict: **PASSED**.
- All safety invariants verified (read-only diagnostics, sync conflict abort, multi-gate cleanup, untracked directory preservation).

## Safety & No-Auto-Merge Policy
- **No Automatic Merge**: Manual inspection and explicit user commands required.
- **Publishing Mode**: `prepare-only`.
