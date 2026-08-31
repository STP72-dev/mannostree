# Task Contract: Phase 2 Operational Safety & Diagnostics

## Problem
Phase 1 established the foundation for single-path workspace spawning, listing, inspecting, and dropping. However, day-to-day parallel development requires robust operational safety: inspecting live git and lifecycle status, syncing workspaces with their base branches safely, diagnosing metadata-disk-git divergence, safely cleaning up merged/stale worktrees, and recovering damaged worktrees without data loss.

## Scope
Deliver Phase 2 commands and engine capabilities while preserving 100% backward compatibility with Phase 1:
1. **`status <id> [--fetch]`**:
   - Read-only inspection (unless `--fetch` is explicitly requested to refresh remote refs).
   - Computes and displays live git state (ahead/behind counts vs base branch, dirty/untracked/conflicts, head commit) and lifecycle state + validation/review status.
2. **`sync <id> [--strategy rebase|merge|ff-only] [--fetch] [--dry-run]`**:
   - Refuses if worktree has uncommitted or untracked changes.
   - Fetches base branch if `--fetch` is set (or configured default).
   - Previews rebase/merge/ff-only actions under `--dry-run`.
   - Executes rebase/merge/ff-only safely; on conflict, aborts and restores cleanly, surfacing conflict files with exit code 4 without leaving unrecoverable state.
3. **`doctor [--json] [--fix]`**:
   - Read-only diagnostic report by default.
   - Audits all registry records against disk paths and git branches.
   - Audits metadata schema validity and identifies corruption/version drift.
   - Detects untracked worktrees located under `worktree_root` (does NOT touch them).
   - Detects orphan branches (branches with prefix `feature/` or `fix/` that have no worktree).
   - `--fix` generates an explicit repair plan and requires confirmation (`--yes`) for any destructive action.
4. **`clean [--merged] [--stale-days N] [--state S] [--dry-run] [--yes]`**:
   - Candidate-report / dry-run by default; lists candidate worktrees before taking action.
   - Non-dry destructive execution strictly requires an explicit filter (`--merged`, `--stale-days`, or `--state`) AND `--yes`.
   - Strictly protects the main working tree, dirty worktrees, unmerged worktrees (unless `--force`), and winning variants.
   - Strictly leaves untracked worktrees untouched.
5. **`recover <id> [--rebuild-metadata] [--reattach-worktree] [--reattach-branch] [--dry-run]`**:
   - Narrowly scoped, explicit repair proposal.
   - Requires one explicit repair action flag.
   - Previews proposed repair in `--dry-run`.
   - Preserves state and transitions to `BROKEN` if repair cannot be proven correct.
6. **Documentation & Tests**:
   - Full unit and integration test coverage for all new commands and error paths.
   - Complete documentation update across README, CLI spec, and lifecycle guides.

## Out-of-Scope
- Phase 3 setup profile script execution and environment copy/link/generate policies.
- Phase 4 multi-variant parallel execution (`parallel spawn`, `parallel compare`, `parallel pick`).
- Phase 5 GitHub publish flow and PR creation.
- Automatic merges or silent/unconfirmed destructive cleanups.

## Acceptance Criteria
- [ ] **Phase 1 Compatibility**: All Phase 1 commands (`spawn`, `list`, `info`, `drop`) and existing test suites continue to pass without regression.
- [ ] **`status`**: Displays exact ahead/behind vs base branch, dirty/untracked/conflict state, and lifecycle metadata. Does not write to disk or git unless `--fetch` is passed.
- [ ] **`sync`**: Refuses dirty worktrees with exit code 2/4; supports `rebase`, `merge`, `ff-only`; `--dry-run` shows exact planned git steps; aborts cleanly on conflict.
- [ ] **`doctor`**: Detects missing directories, orphan branches, schema errors, and untracked worktree directories. `--fix` generates explicit actions and requires `--yes`.
- [ ] **`clean`**: Reports candidates by default; refuses to mutate without filter and `--yes`; never touches the main worktree or untracked directories.
- [ ] **`recover`**: Proposes repairs, rebuilds metadata, reattaches worktrees/branches; sets `BROKEN` when invalid.
- [ ] **Test Coverage**: 100% passing unit and integration tests across all Phase 2 features.

## References
- `AGENTS.md`
- `CLAUDE.md`
- `docs/02-project-kickoff/cli-spec.md`
- `docs/02-project-kickoff/worktree-lifecycle.md`
- `docs/02-project-kickoff/metadata-schema.md`
- `docs/02-project-kickoff/architecture.md`

## Explicit Assumptions
- Base branch: `main` is the explicit base for the repository.
- Publishing mode: `prepare-only`.
- Parallel variants: `never`.
