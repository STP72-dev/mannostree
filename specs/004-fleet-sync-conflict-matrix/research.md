# Technical Research: Fleet Sync & Cross-Worktree Conflict Matrix

**Feature**: `004-fleet-sync-conflict-matrix`  
**Date**: 2026-09-01  

---

## 1. Fleet Divergence & Safe Multi-Worktree Synchronization

### Decision
Implement `FleetEngine.syncFleet(options)` using per-worktree safety checks:
1. Query registry for all active worktree records.
2. For each worktree, run `git.getRepoStatus(worktree_path)` to ensure `clean: true`. If uncommitted changes exist or an active agent session is running, mark as `DIRTY_SKIPPED`.
3. Compute `git.getAheadBehind(worktree_path, base_branch)`.
4. In preview mode (`--preview` or `--dry-run`), return divergence report without running `git merge` / `git rebase`.
5. In execution mode, run `git merge --ff-only` or `git rebase <base_branch>` safely inside the worktree directory. If rebase fails with conflicts, abort immediately (`git rebase --abort`) and mark as `FAILED_CONFLICT`.

### Rationale
- Strictly prevents dirty working trees from getting corrupted or having conflict markers introduced during background sync.
- Fails fast and preserves clean git state.

---

## 2. Fast $N \times N$ Pairwise Conflict Matrix Calculation

### Decision
Implement 2-stage hierarchical collision detection in `FleetEngine.computeConflictMatrix(options)`:
- **Stage 1 (File-Level Hash Set Intersection - $O(N)$)**:
  - For each active worktree $i$, retrieve changed files against its base branch: `git diff --name-only <base_branch>...<branch>`.
  - Store modified file set $S_i$.
  - For any pair $(i, j)$, compute intersection $S_i \cap S_j$. If empty, cell is marked `CLEAN`.
- **Stage 2 (In-Memory 3-Way Merge Simulation - $O(K^2)$)**:
  - For pairs where $S_i \cap S_j \neq \emptyset$, execute `git merge-tree $(git merge-base branch_i branch_j) branch_i branch_j`.
  - `git merge-tree` simulates the 3-way merge in memory without modifying any worktrees or git index.
  - If output contains conflict markers (`<<<<<<<`), classify cell as `CONFLICT` with exact file and line ranges.
  - If output merges cleanly (disjoint hunks in same file), classify as `SHARED_FILES_CLEAN`.

### Rationale
- Completely avoids false positives where two worktrees edit different parts of the same large file (e.g. `package.json` or `src/index.ts`).
- 100% non-destructive and fast.

---

## 3. Terminal & Markdown Visualization

### Decision
Render visual $N \times N$ matrix in terminal using chalk-coded cells:
- `.` (Green): Clean / Disjoint
- `~` (Yellow): Shared files (disjoint hunks)
- `!` (Red / Bold): Direct merge conflict hazard

And output a markdown table to `.task/conflict-matrix.md` with detailed breakdown of all conflicting files and symbols.
