# Research & Technical Decisions: Phase 2 Operational Safety & Diagnostics

## Context & Objectives
Phase 2 expands Mannostree with operational safety and diagnostic tools (`status`, `sync`, `doctor`, `clean`, `recover`). These commands interact directly with git refs, worktree admin directories, and metadata records, demanding strict safety invariants to prevent data loss or silent corruption.

## Research Findings & Decision Impact

### 1. Ahead / Behind Calculation & Merge Inspection
- **Source**: Git rev-list documentation (`https://git-scm.com/docs/git-rev-list`) & merge-base documentation (`https://git-scm.com/docs/git-merge-base`).
- **Date Accessed**: 2026-08-31
- **Findings**:
  - `git rev-list --left-right --count <base>...<branch>` returns `<behind>\t<ahead>` in a single fast, machine-readable command.
  - `git merge-base --is-ancestor <branch> <base>` returns exit code 0 if `<branch>` is fully merged into `<base>` and exit code 1 if unmerged.
- **Decision Impact**: Implement `getAheadBehindCount(worktreePath, baseBranch, branch)` and `isBranchMerged(branch, baseBranch)` directly in `GitEngine`.

### 2. Machine-Readable Git Worktree Plumbing
- **Source**: Git worktree documentation (`https://git-scm.com/docs/git-worktree`).
- **Date Accessed**: 2026-08-31
- **Findings**:
  - `git worktree list --porcelain` outputs structured lines:
    ```text
    worktree /path/to/worktree
    HEAD commit_hash
    branch refs/heads/branch_name
    ```
  - `git worktree repair [<path>...]` repairs gitdir references if paths were moved.
  - `git worktree prune` prunes administrative files for deleted worktrees.
- **Decision Impact**: Use `git worktree list --porcelain` in `GitEngine` to inspect git's internal worktree tracking, and treat `prune`/`repair` as explicit state-mutating actions executed only during verified recovery or cleanup.

### 3. Safe Synchronization (`sync`)
- **Source**: Git rebase/merge error handling.
- **Date Accessed**: 2026-08-31
- **Findings**:
  - When rebase or merge encounters conflicts, it leaves uncommitted conflict markers and dirty git state.
  - To guarantee recoverability and atomicity, `sync` must:
    1. Verify worktree is clean before starting.
    2. Attempt rebase/merge.
    3. On failure, immediately invoke `git rebase --abort` or `git merge --abort`, capture conflict files via status output, and return exit code 4 with clear conflict diagnostics.
- **Decision Impact**: Implement automated rollback/abort in `GitEngine.syncWorktree()` to ensure failed sync operations never leave a dirty, detached, or corrupted worktree state.

### 4. Non-Destructive Diagnostics (`doctor`)
- **Source**: Architectural ADR-001 and ADR-007.
- **Date Accessed**: 2026-08-31
- **Findings**:
  - `doctor` must remain 100% read-only unless `--fix` is passed.
  - When `--fix` is passed, it must present a concrete preview plan of proposed repairs and require `--yes` to prevent accidental deletions.
  - Untracked worktrees (directories in `worktree_root` not in `registry.json`) must only be reported as informational anomalies and NEVER deleted or altered automatically.
- **Decision Impact**: Design `DoctorReport` with categorized findings (`MISSING_DISK`, `ORPHAN_BRANCH`, `SCHEMA_ERROR`, `UNTRACKED_DIR`) and distinct read-only vs repair plan modes.

### 5. Safe Bulk Cleanup (`clean`)
- **Source**: CLAUDE.md & cli-spec.md cleanup rules.
- **Date Accessed**: 2026-08-31
- **Findings**:
  - `clean` without arguments or without `--yes` must execute as a dry-run candidate report.
  - Must evaluate multiple safety filters: `--merged`, `--stale-days <N>`, `--state <S>`.
  - Must skip dirty worktrees (unless `--force`), protected winners, and main repository root.
- **Decision Impact**: Implement `MannostreeOrchestrator.clean()` with strict multi-gate validation.
