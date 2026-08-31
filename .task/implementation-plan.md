# Implementation Plan: Phase 2 Operational Safety & Diagnostics

## Overview
Implement Phase 2 commands and system components for **Mannostree**:
- `status <id> [--fetch]`: Live git ahead/behind, dirty/untracked/conflict, and lifecycle state.
- `sync <id> [--strategy rebase|merge|ff-only] [--fetch] [--dry-run]`: Safe branch synchronization with automatic rollback on conflict.
- `doctor [--json] [--fix] [--yes]`: Comprehensive health diagnostics for registry vs disk, git refs, orphan branches, untracked worktrees, and repair plans.
- `clean [--merged] [--stale-days N] [--state S] [--dry-run] [--yes] [--force]`: Safe candidate-reported bulk cleanup of eligible worktrees.
- `recover <id> [--rebuild-metadata] [--reattach-worktree] [--reattach-branch] [--dry-run] [--yes]`: Targeted repair proposal for broken workspaces.

---

## Detailed Command Specifications

### 1. `status <id> [--fetch]`
- Read-only by default (no disk/git mutations).
- If `--fetch` is provided, fetches the latest refs for the base branch from `origin`.
- Computes:
  - `ahead_count` and `behind_count` relative to `base_branch`.
  - `dirty`, `has_untracked_files`, `has_conflicts`.
  - Head commit hash and commit subject.
  - Lifecycle state and status.
  - Validation status and Review status (from metadata/artifacts).

### 2. `sync <id> [--strategy rebase|merge|ff-only] [--fetch] [--dry-run]`
- Safety Gate: If worktree is dirty or has untracked changes, refuse immediately with `ExitCode.USAGE_ERROR` (2) unless clean.
- If `--fetch` is enabled (or configured default), fetches base ref.
- In `--dry-run`: Previews the exact command that would execute (`git rebase <base>`, `git merge <base>`, or `git merge --ff-only <base>`).
- In real execution:
  - Runs rebase / merge in the worktree directory.
  - On conflict or error: immediately invokes `git rebase --abort` or `git merge --abort`, captures conflicting files, and throws `MannostreeError` (`ExitCode.GIT_ERROR` / 4) with conflict details, leaving the worktree in its original clean state.
  - On success: refreshes `git_state` and `last_activity_at`.

### 3. `doctor [--json] [--fix] [--yes]`
- Diagnoses:
  - `MISSING_DISK`: Tracked in registry, but directory missing on disk.
  - `MISSING_BRANCH`: Tracked in registry, but branch missing in git.
  - `SCHEMA_ERROR`: Worktree or registry JSON fails schema validation or version mismatch.
  - `UNTRACKED_DIR`: Directory exists under `worktree_root`, but not tracked in registry (Informational only; NEVER touched).
  - `ORPHAN_BRANCH`: Branch with worktree prefix exists in git, but has no active worktree record.
- `--fix` without `--yes`: Returns proposed concrete repair actions and exits without mutating.
- `--fix --yes`: Applies safe, non-destructive repair actions (e.g. re-registering metadata, pruning dead registry entries).

### 4. `clean [--merged] [--stale-days N] [--state S] [--dry-run] [--yes] [--force]`
- Candidate report by default (`--dry-run` default true).
- If `--yes` is supplied, requires at least one explicit filter (`--merged`, `--stale-days`, `--state`) to execute destruction.
- Evaluation rules:
  - `--merged`: Checks if worktree branch is ancestor of base branch (`git merge-base --is-ancestor`).
  - `--stale-days <N>`: Checks if `last_activity_at` or `updated_at` is older than N days.
  - `--state <S>`: Matches lifecycle_state or status.
- Safety:
  - NEVER removes main repo root.
  - Refuses dirty worktrees unless `--force`.
  - Protects winner variants (if `parallel.winner` is true and `cleanup.protect_winner` is true).
  - NEVER touches untracked directories.

### 5. `recover <id> [--rebuild-metadata] [--reattach-worktree] [--reattach-branch] [--dry-run] [--yes]`
- Evaluates damage to worktree `<id>`.
- Requires exactly one explicit repair mode (`--rebuild-metadata`, `--reattach-worktree`, `--reattach-branch`).
- Previews the action in `--dry-run`.
- Executes repair when `--yes` is passed; if repair cannot be proven or fails, sets `lifecycle_state: 'BROKEN'`.

---

## Dependency-Ordered Implementation Tasks
1. **Task 1: Extend `GitEngine`**: Add `getAheadBehindCount`, `isBranchMerged`, `syncWorktree`, `listPorcelainWorktrees`, `repairWorktree`, `fetchAll`.
2. **Task 2: Implement Diagnostic Analyzer (`DoctorEngine`)**: Create `src/core/doctor.ts` to inspect inconsistencies and formulate repair plans.
3. **Task 3: Extend `MannostreeOrchestrator`**: Implement `status()`, `sync()`, `doctor()`, `clean()`, and `recover()`.
4. **Task 4: CLI Command Registration & Output Formatting**: Add `src/cli/commands/status.ts`, `sync.ts`, `doctor.ts`, `clean.ts`, `recover.ts`, and enrich `src/cli/output.ts`.
5. **Task 5: Test Suite Expansion**: Unit tests for sync rollback, merge checks, doctor rules, clean filters, and integration tests for all 5 commands.
6. **Task 6: Documentation Updates**: Update `README.md`, `CLAUDE.md`, and generate Phase 2 delivery artifacts.

---

## Risk Register & Pre-Mortem

| Risk / Failure Mode | Impact | Prevention & Mitigation |
|---------------------|--------|--------------------------|
| Sync conflict leaves dirty merge state in workspace | Workspace broken for user | Automated `git rebase --abort` / `git merge --abort` on error; reports conflict files safely. |
| Bulk clean deletes uncommitted user changes | Data loss | Hard gate checking `isWorktreeDirty`; skips dirty worktrees unless `--force`. |
| Doctor mistakenly deletes untracked directory | Destroys foreign folders | Untracked directories are strictly read-only informational findings; doctor never deletes them. |
| Clean runs accidentally on all workspaces | Unintended deletion | Non-dry clean requires explicit filter (`--merged`, `--stale-days`, or `--state`) AND `--yes`. |
| Status command makes slow remote network calls | Degrades CLI responsiveness | `--fetch` is opt-in; status is cheap local git query by default. |

---

## Acceptance-to-Test Traceability Matrix

| Acceptance Criteria | Implementation Component | Test Suite |
|---------------------|--------------------------|------------|
| Status reports ahead/behind, dirty, conflicts | `GitEngine.getGitState`, `orchestrator.status` | `tests/unit/status.test.ts`, `tests/integration/status.test.ts` |
| Sync safely syncs and aborts on conflict | `GitEngine.syncWorktree`, `orchestrator.sync` | `tests/unit/sync.test.ts`, `tests/integration/sync.test.ts` |
| Doctor identifies missing disk, branches, schemas | `DoctorEngine.diagnose`, `orchestrator.doctor` | `tests/unit/doctor.test.ts`, `tests/integration/doctor.test.ts` |
| Clean candidate report & safe filtered execution | `orchestrator.clean` | `tests/unit/clean.test.ts`, `tests/integration/clean.test.ts` |
| Recover repairs broken metadata/worktrees | `orchestrator.recover` | `tests/unit/recover.test.ts`, `tests/integration/recover.test.ts` |
| Full Phase 1 backward compatibility | All Phase 1 modules | `tests/integration/cli.test.ts`, `tests/integration/bin.test.ts` |
