# Feature Specification: Fleet Sync & Cross-Worktree Conflict Matrix

**Feature Branch**: `004-fleet-sync-conflict-matrix`  
**Created**: 2026-09-01  
**Status**: Ready for Planning  
**Input**: User description: "Movement 3: Fleet Sync & Cross-Worktree Conflict Matrix (fleet sync / conflict-matrix)"

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Fleet-Wide Base Branch Synchronization (Priority: P1) 🎯 MVP

When multiple developers or autonomous agents are working concurrently across multiple worktrees (e.g. 5 parallel feature or variant worktrees), upstream `main` frequently moves forward. Developers need a single command `mannostree fleet sync` to safely check, preview, and synchronize all active worktrees against their respective base branches without having to `cd` into each worktree individually.

**Why this priority**: Prevents stale drift across large parallel worktree fleets and eliminates tedious, error-prone manual sync loops.

**Independent Test**: Can be tested by spawning 3 worktrees, making a new commit on `main`, running `mannostree fleet sync --preview`, and verifying that all 3 worktrees are correctly identified as behind, followed by executing sync with safety checks.

**Acceptance Scenarios**:
1. **Given** multiple active worktrees with varying divergence against `main`, **When** the user runs `mannostree fleet sync --preview` (or `--dry-run`), **Then** the system reports ahead/behind status, incoming commits, and potential mergeability for each worktree without altering local branches.
2. **Given** active worktrees without dirty uncommitted files, **When** the user runs `mannostree fleet sync`, **Then** the system updates each worktree's local branch with its upstream base branch (via rebase or fast-forward merge) and logs progress.
3. **Given** a worktree with dirty uncommitted changes or an active agent session, **When** fleet sync executes, **Then** the system skips or guards that worktree, logs a clear warning, and completes synchronization for remaining clean worktrees.

---

### User Story 2 - Pairwise Cross-Worktree Conflict Matrix (Priority: P1)

When running multiple parallel experiments or parallel feature worktrees, multiple agents/developers may unknowingly edit the same files or overlapping line ranges. The developer or lead coordinator needs `mannostree fleet conflict-matrix` to inspect an $N \times N$ pairwise conflict matrix showing shared file modifications, line-level hunk overlaps, and merge collision risks across the entire fleet.

**Why this priority**: Identifies merge collisions early during parallel execution rather than discovering painful conflicts at merge or publish time.

**Independent Test**: Can be tested by creating 3 worktrees (WT1 modifying file A, WT2 modifying file A and B, WT3 modifying file C), running `mannostree fleet conflict-matrix`, and verifying that the matrix accurately flags the WT1-WT2 collision on file A while marking WT3 as independent.

**Acceptance Scenarios**:
1. **Given** $N$ active worktrees in the fleet, **When** the user runs `mannostree fleet conflict-matrix`, **Then** the system analyzes pairwise git diffs against their common base and generates an $N \times N$ matrix indicating Clean, File Overlap, or Direct Line Conflict.
2. **Given** overlapping changes between two worktrees, **When** detailed output or `--verbose` is requested, **Then** the system lists the exact conflicting file paths, line ranges, and symbols affected.
3. **Given** a conflict matrix run, **When** execution completes, **Then** the matrix report is saved to `.task/conflict-matrix.md` and structured JSON metadata in `.mannostree/fleet/conflict-matrix.json`.

---

### User Story 3 - Conflict-Aware Winner & Publish Guard (Priority: P2)

When selecting an experiment winner or preparing to publish a branch, the developer needs immediate feedback on whether the selected branch conflicts with other active worktrees in the fleet or with recently integrated branches on `main`.

**Why this priority**: Prevents promoting or publishing variants that will immediately cause merge blockage or broken builds in adjacent worktrees.

**Independent Test**: Can be tested by running `mannostree fleet conflict-matrix --target <worktree-id>`, verifying that collision risks specific to that target are summarized with actionable resolution advice.

**Acceptance Scenarios**:
1. **Given** a target worktree specified via `--target <id>`, **When** conflict analysis executes, **Then** the system outputs a focused impact report listing all sister worktrees conflicting with that target.
2. **Given** a severe line overlap between a winning variant and another active branch, **When** `mannostree parallel pick` or `publish` is previewed, **Then** the system alerts the operator to the collision hazard.

---

### User Story 4 - Automated 3-Way Merge Simulation (Priority: P2)

To determine if two diverging worktrees can be cleanly reconciled or merged, the system can perform an in-memory or temporary index 3-way merge simulation (`git merge-tree`) without touching the working tree files.

**Why this priority**: Provides 100% deterministic conflict prediction without risk of leaving dirty merge conflict markers in worktrees.

**Independent Test**: Can be tested by simulating a merge between two branches with overlapping edits on the same line, verifying that `git merge-tree` detects conflict markers and returns exact conflict hunks.

**Acceptance Scenarios**:
1. **Given** two worktrees modifying the same file, **When** the conflict matrix runs with `--deep` / `--simulate-merge`, **Then** the system executes non-destructive `git merge-tree` to verify if git can auto-merge the hunks cleanly.
2. **Given** clean separate-hunk changes in the same file, **When** simulation runs, **Then** the system classifies the pair as "Auto-Mergeable Overlap" rather than "Direct Conflict".

---

### Edge Cases

- **Dirty Worktrees during Fleet Sync**: Worktrees with uncommitted files are never force-rebased; they are skipped with clear operator instructions.
- **Detached HEAD or Missing Upstream**: If a worktree has a detached HEAD or unmapped upstream branch, the system logs a diagnostic warning and continues fleet operations.
- **Large Fleet Scale ($N > 20$)**: Pairwise $N \times N$ comparison can grow quadratically; the engine uses changed-file hash sets for $O(N)$ quick filtering before doing $O(K^2)$ line-level merge simulations on overlapping subsets.
- **Ephemeral/Orphan Branches**: Deleted branches or missing worktree directories are flagged via doctor diagnostics without crashing fleet sync.

---

## Requirements *(mandatory)*

### Functional Requirements

- **`FR-001`**: The system MUST provide `mannostree fleet sync` to evaluate and synchronize all tracked active worktrees against their respective base branches.
- **`FR-002`**: `fleet sync` MUST support `--preview` / `--dry-run` to report ahead/behind commit counts and divergence status across all worktrees without modifying branch state.
- **`FR-003`**: `fleet sync` MUST guard worktrees with uncommitted changes or active agent sessions, skipping mutation and reporting a warning.
- **`FR-004`**: `fleet sync` MUST support `--strategy <rebase|merge|ff-only>` with `ff-only` / `rebase` safety defaults.
- **`FR-005`**: The system MUST provide `mannostree fleet conflict-matrix` to compute pairwise file and line conflict matrices across all active worktrees.
- **`FR-006`**: The conflict matrix engine MUST classify pairs into: `CLEAN` (no shared files), `SHARED_FILES_CLEAN` (shared files with disjoint non-overlapping hunks), and `CONFLICT` (direct overlapping line changes).
- **`FR-007`**: The system MUST support `--simulate-merge` (or `--deep`) using non-destructive `git merge-tree` to prove auto-mergeability without modifying disk.
- **`FR-008`**: The conflict matrix MUST be rendered as an ASCII/color-coded terminal matrix table and persisted as markdown in `.task/conflict-matrix.md`.
- **`FR-009`**: The system MUST persist the latest conflict state in `.mannostree/fleet/conflict-matrix.json`.
- **`FR-010`**: The system MUST support `--target <worktree_id>` to filter conflict matrix results against a specific worktree.
- **`FR-011`**: `fleet sync` and `fleet conflict-matrix` MUST support `--json` and `--yaml` machine-readable output envelopes.
- **`FR-012`**: The system MUST support `--fail-on-conflict` exit code behavior for CI/CD pipeline gating.

---

## Key Entities & Data Model

- **`FleetSyncStatus`**: Divergence and synchronization record for each worktree (id, branch, base_branch, ahead, behind, sync_status: `SYNCED` | `BEHIND` | `AHEAD` | `DIVERGED` | `DIRTY_SKIPPED` | `FAILED`, message).
- **`FleetSyncReport`**: Aggregate report across all worktrees in the fleet.
- **`ConflictMatrixCell`**: Pairwise comparison between worktree $A$ and worktree $B$ (source_id, target_id, severity: `CLEAN` | `SHARED_FILES` | `CONFLICT`, overlapping_files: string[], conflict_hunks: array, mergeable: boolean).
- **`FleetConflictMatrixReport`**: Full $N \times N$ matrix of `ConflictMatrixCell` entries, timestamp, total worktrees analyzed, and conflict hazard count.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **`SC-001`**: Fleet synchronization accurately identifies 100% of diverged worktrees without modifying dirty workspaces.
- **`SC-002`**: Conflict matrix generation for 10 concurrent worktrees completes in under 5 seconds.
- **`SC-003`**: 100% of line-level merge collisions are detected prior to any merge/publish action.
- **`SC-004`**: All simulation checks are strictly non-destructive (0 file writes to worktrees during conflict matrix calculation).
- **`SC-005`**: 100% unit and integration test suite pass rate with 0 regressions.
