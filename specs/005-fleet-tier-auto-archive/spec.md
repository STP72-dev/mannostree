# Feature Specification: Fleet Tiering, Workspace Leases & Auto-Archive Policy

**Feature Branch**: `005-fleet-tier-auto-archive`  
**Created**: 2026-09-01  
**Status**: Ready for Planning  
**Input**: User description: "Movement 4: Fleet Tiering, Workspace Leases & Auto-Archive Policy"

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Workspace Leases & Concurrency Protection (Priority: P1) 🎯 MVP

When multiple autonomous agents or developers operate concurrently across a worktree fleet, they risk colliding on the same workspace, accidentally dropping an active workspace, or modifying files while another agent is executing tests. Operators and autonomous runners need an explicit, lease-based locking mechanism (`mannostree fleet lease acquire/release/list`) with time-to-live (TTL) expiry to safely claim workspaces and prevent concurrent interference.

**Why this priority**: Eliminates race conditions, accidental deletion, and destructive concurrent operations across multi-agent fleets.

**Independent Test**: Can be tested by acquiring a lease on worktree A with holder "Agent-1" and TTL 1 hour, verifying that a second acquire attempt is rejected with lease collision details, verifying that drop/archive operations refuse to mutate the leased worktree without explicit override, and releasing the lease.

**Acceptance Scenarios**:
1. **Given** an available active worktree, **When** an agent runs `mannostree fleet lease acquire <id> --holder "Agent-A" --ttl 30m --purpose "Feature development"`, **Then** the lease is recorded in metadata with owner, start timestamp, expiration timestamp, and purpose.
2. **Given** a worktree with an active unexpired lease held by "Agent-A", **When** "Agent-B" attempts to acquire a lease or an operator runs `drop` or `archive`, **Then** the system rejects the operation with error details citing the active lease holder and remaining time.
3. **Given** an active lease, **When** the holder completes work and calls `mannostree fleet lease release <id>`, **Then** the lease lock is cleared and the worktree returns to unleased status.
4. **Given** an expired lease whose TTL has elapsed, **When** a new agent requests a lease or runs `fleet lease list`, **Then** the system marks the previous lease as expired and permits re-leasing or reclamation.

---

### User Story 2 - Fleet Lifecycle Tiering (Hot / Warm / Cold / Pinned) (Priority: P1)

As a team or multi-agent orchestrator managing dozens of concurrent worktrees, disk space and git worktree clutter must be controlled without losing branch history or metadata. Operators need an explicit tiering system where worktrees are classified as:
- **Hot**: Actively leased or modified within the last $X$ hours.
- **Warm**: Mounted on disk, unleased, and idle.
- **Cold / Archived**: Safely unmounted from disk (zero workspace disk overhead), with git branch, commit history, and metadata preserved in `.mannostree/worktrees/`.
- **Pinned**: Explicitly protected from automatic lifecycle transitions or pruning.

**Why this priority**: Provides clear lifecycle classification and guarantees operators can scale to 50+ concurrent branches while keeping active disk footprint minimal.

**Independent Test**: Can be tested by assigning tiers to multiple worktrees (`mannostree fleet tier set <id> --tier pinned/hot/warm`), inspecting tier status via `mannostree fleet tier list` and `mannostree fleet status`, and verifying that pinned workspaces are exempt from cold transitions.

**Acceptance Scenarios**:
1. **Given** active worktrees in the fleet, **When** the operator runs `mannostree fleet tier list`, **Then** the system displays all worktrees partitioned by their current tier (`hot`, `warm`, `cold`, `pinned`), last active timestamp, and disk usage.
2. **Given** a critical workspace, **When** the user runs `mannostree fleet tier pin <id>` (or `tier set <id> pinned`), **Then** the worktree is marked `pinned: true` in metadata.
3. **Given** a cold/archived worktree, **When** the user runs `mannostree restore <id>`, **Then** the worktree is remounted to disk and promoted to `warm` or `hot` tier.

---

### User Story 3 - Automated Auto-Archive Policy Engine (Priority: P2)

When running parallel experiments (e.g. 5 competing variants for a feature) or when idle feature branches accumulate, physical disk space degrades. The system must provide an intelligent policy engine (`mannostree fleet auto-archive`) that evaluates fleet limits (`max_active_worktrees`, `idle_ttl`, `archive_completed_experiments`) and unmounts qualifying idle/warm worktrees to cold archive tier with preview and safety guards.

**Why this priority**: Keeps the worktree directory clean and within resource budgets without deleting any git branches or losing agent task artifacts.

**Independent Test**: Can be tested by configuring a fleet limit of 2 active worktrees, creating 4 worktrees with varying idle times, running `mannostree fleet auto-archive --preview` to verify that the 2 oldest idle unpinned worktrees are flagged, and executing `mannostree fleet auto-archive --yes` to archive them safely.

**Acceptance Scenarios**:
1. **Given** fleet policy settings in `.mannostree.yaml` (e.g. `max_active: 5`, `idle_ttl: 48h`), **When** the operator runs `mannostree fleet auto-archive --preview` (or `--dry-run`), **Then** the system lists all candidate worktrees eligible for archival along with reasons (e.g., "exceeds fleet capacity quota", "idle for 72h") without modifying disk.
2. **Given** eligible candidate worktrees, **When** the user runs `mannostree fleet auto-archive --yes`, **Then** the system unmounts qualifying clean worktrees to cold tier, updates metadata, and preserves all git branches and `.task/` artifacts.
3. **Given** a worktree that is dirty (uncommitted changes), actively leased, or pinned, **When** auto-archive runs, **Then** the policy engine safely skips the worktree and outputs a detailed skip reason.

---

### User Story 4 - Fleet Quota & Capacity Dashboard (Priority: P2)

Operators and orchestration scripts need a centralized capacity dashboard (`mannostree fleet status` / `fleet dashboard`) showing total mounted worktrees, active lease count, disk footprint, tier breakdown, and policy enforcement warnings.

**Why this priority**: Provides instant system health visibility and machine-readable metrics for automated agent schedulers and human supervisors.

**Independent Test**: Can be tested by running `mannostree fleet status --json`, verifying structured metric totals for active/warm/cold counts, disk usage, active lease summaries, and warning notifications.

**Acceptance Scenarios**:
1. **Given** a configured fleet, **When** `mannostree fleet status` is executed, **Then** the system prints an ASCII/colored summary table of fleet capacity (e.g., `Active Worktrees: 4/10`, `Active Leases: 2`, `Archived: 6`, `Disk Footprint: 245 MB`).
2. **Given** structured output requested (`--json` or `--yaml`), **When** `fleet status` runs, **Then** the output conforms to `FleetStatusReportSchema` with machine-readable timestamps and numeric metrics.

---

### Edge Cases

- **Expired Leases during Operations**: If an agent crashed and left a lease active, `fleet lease break <id> --force` or `--ignore-lease` allows human operators to reclaim the workspace with audit logging.
- **Dirty Worktree Auto-Archival Attempt**: Dirty workspaces are never auto-archived by default; policy configuration can optionally permit stashing (`archive_dirty_policy: stash`) or strict refusal (`archive_dirty_policy: refuse`).
- **Quota Exceeded with All Pinned Worktrees**: If all active worktrees are pinned or actively leased, auto-archive logs an actionable warning explaining that quota limit cannot be satisfied without unpinning or releasing leases.
- **Concurrent Lease Acquisition**: Lease acquisition uses metadata atomic transactions to guarantee only one caller succeeds when competing for the same worktree lock.

---

## Requirements *(mandatory)*

### Functional Requirements

- **`FR-001`**: The system MUST support workspace leases with `mannostree fleet lease acquire <worktree_id>`, recording holder identity, TTL duration, acquisition timestamp, and purpose.
- **`FR-002`**: The system MUST support `mannostree fleet lease release <worktree_id>` to release an active lease lock.
- **`FR-003`**: The system MUST support `mannostree fleet lease list` to report all active and expired leases across the fleet.
- **`FR-004`**: The system MUST support `mannostree fleet lease renew <worktree_id> --ttl <duration>` to extend an active lease before expiration.
- **`FR-005`**: The system MUST reject `drop`, `archive`, `sync`, and concurrent `lease acquire` operations on actively leased worktrees unless explicitly forced with `--force` / `--break-lease`.
- **`FR-006`**: The system MUST support 4 workspace lifecycle tiers: `hot` (actively leased / modified), `warm` (mounted idle), `cold` (unmounted archived branch), and `pinned` (exempt from auto-transition).
- **`FR-007`**: The system MUST support `mannostree fleet tier set <worktree_id> <tier>` and `mannostree fleet tier pin/unpin <worktree_id>`.
- **`FR-008`**: The system MUST provide `mannostree fleet auto-archive` to unmount idle or excess warm worktrees based on configured retention policies.
- **`FR-009`**: `fleet auto-archive` MUST support `--preview` / `--dry-run` to simulate policy evaluation without modifying disk or worktree states.
- **`FR-010`**: `fleet auto-archive` MUST NEVER delete git branches or discard uncommitted files without explicit operator flags.
- **`FR-011`**: `fleet auto-archive` MUST skip pinned, actively leased, and dirty worktrees (unless configured with explicit stash policy).
- **`FR-012`**: The system MUST provide `mannostree fleet status` reporting total capacity, tier distribution, active leases, and disk metrics in human-readable and structured JSON/YAML formats.

---

## Key Entities & Data Model

- **`WorkspaceLease`**: `{ lease_id: string, worktree_id: string, holder: string, purpose: string, acquired_at: string, expires_at: string, ttl_seconds: number, status: 'active' | 'expired' | 'released' }`.
- **`FleetTier`**: Enumeration of `'hot' | 'warm' | 'cold' | 'pinned'`.
- **`FleetPolicyConfig`**: `{ max_active_worktrees?: number, idle_ttl_hours?: number, auto_archive_idle?: boolean, auto_archive_completed?: boolean, default_lease_ttl_minutes?: number, archive_dirty_policy?: 'refuse' | 'stash' }`.
- **`FleetCapacityReport`**: `{ analyzed_at: string, max_capacity: number, total_worktrees: number, hot_count: number, warm_count: number, cold_count: number, pinned_count: number, active_leases: WorkspaceLease[], eligible_for_archive: string[], total_disk_bytes: number }`.
- **`AutoArchiveReport`**: `{ timestamp: string, dry_run: boolean, evaluated_count: number, archived_worktrees: string[], skipped_worktrees: Array<{ id: string, reason: string }> }`.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **`SC-001`**: 100% of concurrent lease acquisition attempts on a leased worktree are safely rejected without race conditions.
- **`SC-002`**: 100% of actively leased or pinned worktrees are protected against unintentional archival or deletion.
- **`SC-003`**: Auto-archive policy evaluation for 25 worktrees completes in under 2 seconds.
- **`SC-004`**: Cold archived worktrees consume 0 KB of directory space in `.worktrees/` while preserving 100% of branch commit history and metadata records.
- **`SC-005`**: 100% test pass rate across all new unit and integration suites with zero regressions on existing commands.

---

## Assumptions & Boundaries

- **Lease Persistence**: Leases are stored durable in `.mannostree/leases/<id>.json` and tracked in `.mannostree/registry.json`.
- **TTL Time Resolution**: Expiration is calculated based on UTC ISO-8601 timestamps.
- **Non-Destructive Guarantee**: Archiving unmounts worktree directories via `git worktree remove` without `-D` (preserving branch ref), exactly as established in Phase 2 `archive`/`restore` primitives.
