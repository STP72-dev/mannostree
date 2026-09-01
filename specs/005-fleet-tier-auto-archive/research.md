# Technical Research & Decision Document: Fleet Tiering, Workspace Leases & Auto-Archive Policy

**Feature**: `005-fleet-tier-auto-archive` (Movement 4)  
**Date**: 2026-09-01  
**Status**: Completed

---

## 1. Workspace Lease Engine & Concurrency Locking

### Context & Problem
In parallel multi-agent workflows, multiple autonomous agents or CI processes can simultaneously attempt to read, write, or execute quality checks in the same worktree. Without atomic locking, operations such as `drop`, `archive`, `sync`, or agent worker dispatch can race and corrupt state or discard in-progress work.

### Decision & Design
- **Storage**: Store lease records in `.mannostree/leases/<worktree_id>.json` and record the lease reference in `.mannostree/worktrees/<worktree_id>.json`.
- **Atomic Acquisition**: Use file locking and transaction journaling in `MetadataStore.acquireLease(worktreeId, options)` to ensure only one caller can acquire a lease on an active worktree.
- **TTL Evaluation**:
  - `expires_at = ISO(Date.now() + parseDuration(ttl))`.
  - Expiration is lazily evaluated during read operations: if `new Date(lease.expires_at) <= new Date()`, the lease status is considered `expired` and can be claimed by a new holder without requiring background daemons.
- **Guard Interceptors**:
  - `orchestrator.drop`, `orchestrator.archive`, and `fleetEngine.syncFleet` check `hasActiveLease(worktreeId)`.
  - If leased and unexpired, the operation is blocked with error code `LEASE_HELD` unless the caller supplies `--force` / `--break-lease`.

### Alternatives Considered
- *In-memory mutex / daemon*: Rejected because CLI commands run in separate OS processes and must maintain zero external daemon dependencies.
- *Git branch lock refs (`refs/locks/`)*: Rejected because worktree leases represent higher-level agent workflow concepts with rich metadata (holder, purpose, TTL, heartbeat).

---

## 2. Workspace Lifecycle Tiering Engine

### Context & Problem
As parallel development scales across dozens of feature branches and experiment variants, having all worktrees simultaneously mounted on disk exhausts file descriptors, disk quotas, and IDE indexing.

### Decision & Design
- **Tier Taxonomy**:
  1. **`hot`**: Actively leased by an agent/developer or modified within `hot_threshold_hours` (default: 4h). Mounted on disk.
  2. **`warm`**: Clean, unleased, idle worktree mounted on disk.
  3. **`cold`**: Archived worktree unmounted from `.worktrees/`. Git branch ref and metadata record in `.mannostree/worktrees/<id>.json` are preserved at 0 KB disk footprint in the active worktree directory.
  4. **`pinned`**: Explicitly protected workspace (`pinned: true` in metadata) that is strictly exempt from automated tier demotion or auto-archival.
- **Dynamic Promotion & Demotion**:
  - Accessing or modifying a warm workspace promotes it to `hot`.
  - `mannostree restore <id>` transitions cold $\to$ warm/hot.
  - `mannostree fleet auto-archive` transitions warm $\to$ cold.

### Alternatives Considered
- *Deleting branches for cold tier*: Strictly rejected by Constitution Principle 1. Cold storage MUST keep the git branch and commit graph intact.

---

## 3. Auto-Archive Policy Engine

### Context & Problem
Operators need automated garbage collection to keep the fleet within resource quotas without manual per-branch tracking.

### Decision & Design
- **Configuration Schema (`fleet.policy`)**:
  ```yaml
  fleet:
    policy:
      max_active_worktrees: 8
      idle_ttl_hours: 48
      auto_archive_idle: true
      auto_archive_completed: false
      archive_dirty_policy: refuse  # refuse | stash
  ```
- **Evaluation Algorithm**:
  1. Query all active worktrees from `MetadataStore`.
  2. Filter out ineligible candidates:
     - Worktrees with `pinned === true`.
     - Worktrees with active unexpired leases (`lease.status === 'active'`).
     - Worktrees with uncommitted changes when policy is `refuse` (or auto-stash if policy is `stash`).
  3. Rank remaining candidates by Least Recently Used (LRU) order: `updated_at` / `last_accessed_at` ascending.
  4. Identify candidates exceeding `max_active_worktrees` quota or `idle_ttl_hours`.
  5. In preview/dry-run mode, output structured decision list with reasons.
  6. In execution mode (`--yes`), call `orchestrator.archive(id)` on each qualifying candidate.

---

## 4. Resource & Capacity Dashboard

### Decision & Design
- Expand `mannostree fleet status` and `mannostree fleet tier list` to output:
  - Total capacity vs active count (e.g. `5 / 8 active`).
  - Tier distribution (`hot: 2`, `warm: 3`, `cold: 4`, `pinned: 1`).
  - Active leases table (holder, worktree, TTL remaining).
  - Disk footprint aggregated across `.worktrees/` directories.
  - Machine-readable JSON/YAML output conforming to `FleetCapacityReportSchema`.
