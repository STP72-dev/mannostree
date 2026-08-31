# Feature Specification: Safety-First Lifecycle Recovery and Health Hardening

**Feature Branch**: `001-safety-lifecycle-recovery`  
**Created**: 2026-08-31  
**Status**: Draft  
**Input**: User description: "For Mannostree, I’d use a safety-first decision stack: choose features by risk reduction and lifecycle clarity before adding convenience. For the next Mannostree iteration, I’d evaluate: 1. parallel retry/drop-status for failed variant cleanup; 2. Persistent experiment health / BROKEN status with recovery guidance; 3. Archive-and-restore lifecycle for worktrees and experiments; 4. Transaction journal for metadata changes across registry and records; 5. parallel handoff that packages winner decision, comparison evidence, and preserved losers."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Transparent Partial Failure & Safe Retry for Parallel Cleanup (Priority: P1)

When dropping parallel variants, an operation might fail midway (for example, due to uncommitted dirty changes or locked files in a specific worktree). The developer needs immediate visibility into which variants succeeded, which failed, and why, alongside an explicit retry mechanism that safely cleans up remaining dropped targets without endangering intact worktrees or deleting experiment records prematurely.

**Why this priority**: Prevents catastrophic metadata desynchronization and data loss during multi-worktree cleanup operations, ensuring every drop outcome is auditable and repeatable.

**Independent Test**: Can be tested by creating an experiment with three variants, making one variant dirty, running a drop command, observing that the drop status accurately reflects the single failure while preserving the surviving variant and experiment record, and subsequently running a retry once the failure condition is resolved.

**Acceptance Scenarios**:

1. **Given** an experiment with multiple variants where one variant has uncommitted local modifications, **When** the user attempts to drop the experiment without `--discard-uncommitted --yes`, **Then** the system removes only clean variants, preserves the dirty variant and its metadata record, flags the experiment drop status as partially completed, and outputs an itemized summary of successful and failed deletions.
2. **Given** an experiment in a partially-dropped state, **When** the user inspects the drop status, **Then** the system displays the surviving variants, the failure reason for each (e.g., uncommitted changes), and the exact corrective action required to proceed (e.g., commit/stash changes or supply `--discard-uncommitted --yes`).
3. **Given** an experiment with partially dropped variants where the blocking issues are resolved, **When** the user issues a retry drop command (or supplies `--discard-uncommitted --yes`), **Then** the system completes the cleanup of remaining variants and transitions the experiment record to deleted only when all variants have been safely removed.

---

### User Story 2 - Persistent Experiment Health Diagnostics & Broken State Guidance (Priority: P1)

When workspace files, git branches, or metadata records are corrupted, moved, or deleted outside the CLI, the system must detect the divergence, persistently flag the affected experiment or worktree as `BROKEN` or degraded, and provide clear, step-by-step diagnostic and recovery advice.

**Why this priority**: Eliminates silent failures, cryptic errors, and cascade corruption when external tools or manual user actions desynchronize the filesystem from tracking metadata.

**Independent Test**: Can be tested by manually deleting a worktree directory or branch associated with an experiment, running health diagnostics, verifying the experiment is explicitly marked `BROKEN` in the registry and experiment records, and confirming actionable repair suggestions are provided.

**Acceptance Scenarios**:

1. **Given** a worktree whose underlying directory or branch reference has been removed externally, **When** a diagnostic check is executed or the experiment is queried, **Then** the system marks the entity status as `BROKEN`, records the specific missing components in the health summary, and keeps other healthy workspaces unaffected.
2. **Given** an experiment in `BROKEN` status, **When** the user requests recovery information, **Then** the system provides non-destructive remediation steps (such as re-attaching metadata, recreating missing worktree links, or performing an explicit forced prune).
3. **Given** a repaired experiment where missing references have been restored, **When** a health check is re-run, **Then** the system clears the `BROKEN` status and transitions the record back to its valid operational state.

---

### User Story 3 - Metadata Transaction Journaling & Interrupted Operation Recovery (Priority: P2)

When multi-step lifecycle commands (such as spawning N parallel variants or recording winner selection across multiple files) are interrupted by process termination or system crashes, a durable transaction journal logs the planned intent and step completions. This allows users to inspect pending transitions and safely roll back or replay interrupted operations.

**Why this priority**: Protects metadata integrity across multiple concurrent file writes (registry, worktree records, and experiment records), guaranteeing deterministic state recovery after unexpected aborts.

**Independent Test**: Can be tested by simulating an interruption during a multi-variant creation phase, running a recovery audit, and verifying that the journal identifies incomplete transactions and offers an automated replay or safe rollback.

**Acceptance Scenarios**:

1. **Given** an operation that modifies multiple metadata files, **When** the operation begins, **Then** an atomic journal entry is created recording the transaction ID, intended changes, and initial state.
2. **Given** an uncommitted or interrupted transaction from an aborted command, **When** the user runs a recovery check, **Then** the system reports the incomplete transaction, highlights dangling worktree or branch allocations, and prompts for rollback or completion.
3. **Given** a successful transaction completion, **When** the final write succeeds, **Then** the journal entry is marked committed, ensuring zero runtime overhead for subsequent read operations.

---

### User Story 4 - Archive and Restore Lifecycle for Workspaces and Experiments (Priority: P2)

Developers often complete an experiment or put a feature on hold but want to reclaim disk space without losing the branch history, metadata records, or comparison decisions. An archive command unlinks the active worktree while preserving durable metadata and git branch points, and a restore command brings the workspace back to an active state on demand.

**Why this priority**: Reclaims disk storage and keeps active workspace listings clean while upholding the core principle of non-destructive loser variant and historical experiment preservation.

**Independent Test**: Can be tested by creating an experiment, archiving it, verifying that physical worktree directories are safely removed while branch references and metadata transition to `archived`, and subsequently restoring the experiment to regain full active worktree directories.

**Acceptance Scenarios**:

1. **Given** an active workspace or finished parallel experiment, **When** the user requests an archive action, **Then** the system verifies there are no uncommitted changes, de-allocates the physical worktree folder, and updates the lifecycle state to `archived` while retaining all metadata and branch references.
2. **Given** an archived workspace or experiment, **When** the user lists workspaces, **Then** archived items are hidden by default from active listings but visible when explicitly requested.
3. **Given** an archived experiment, **When** the user requests restoration, **Then** the system recreates the worktrees at the configured path, restores metadata to active state, and validates git branch synchronization.

---

### User Story 5 - Packaged Parallel Handoff with Evidence and Loser Preservation (Priority: P3)

When a winning variant is selected in a parallel experiment, the developer needs to generate a comprehensive handoff package. This package bundles the winner decision rationale, comparison scorecards, benchmark/validation evidence, and a registry of preserved non-winning variants for downstream team review or PR preparation without prematurely deleting alternative explorations.

**Why this priority**: Bridges the parallel exploration phase and team collaboration by formalizing decision artifacts while honoring the non-deletion invariant for losing variants.

**Independent Test**: Can be tested by running an experiment comparison, selecting a winning variant, generating the parallel handoff bundle, and verifying that the resulting artifact contains structured comparison metrics, winner justification, and metadata references to all preserved losing variants.

**Acceptance Scenarios**:

1. **Given** an experiment with a chosen winner and comparison metrics, **When** the user generates a parallel handoff, **Then** the system creates a durable handoff report containing the winning branch summary, validation scorecard, and references to all preserved non-winning variants.
2. **Given** a generated parallel handoff, **When** downstream publishing or PR preparation is initiated, **Then** the system attaches the handoff evidence to the change proposal while leaving losing branches untouched in the repository.

---

### Edge Cases

- **Partial Drop with Missing Directory**: If a variant worktree directory was already deleted manually before running drop, the drop process must treat the directory removal as satisfied, clean up the metadata, and not abort the deletion of remaining variants.
- **Interrupted Archive Operation**: If an archive operation is interrupted midway through unlinking worktrees, the transaction journal must identify which worktrees were unlinked and allow the archive command to resume safely.
- **Restoring to an Occupied Path**: If a user attempts to restore an archived worktree into a directory path that has since been occupied by a new folder or file, the system must refuse to overwrite the existing path and prompt for an explicit alternative or resolution.
- **Winner Modification During Broken State**: If an experiment is flagged `BROKEN`, the system must prohibit selecting or changing the winning variant until health diagnostics confirm the experiment references are repaired.
- **Archiving or Dropping Dirty Workspaces**: If a worktree targeted for drop or archiving contains uncommitted or untracked changes, the operation must halt and preserve the worktree unless the user explicitly provides `--discard-uncommitted --yes`. Passing `--force` alone MUST NOT discard uncommitted changes; `--force` is restricted to non-content operational blockers (e.g. bypassing lock files or broken metadata references).

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST record per-variant outcome status (success, failed, skipped, reason) during any batch drop operation.
- **FR-002**: System MUST retain the parent experiment metadata record whenever one or more variants fail to drop, updating the active variant list to reflect surviving workspaces.
- **FR-003**: System MUST provide an explicit drop-status query and retry command to resume cleanup for surviving variants of partially dropped experiments.
- **FR-004**: System MUST perform automatic health verification during diagnostic and status commands, validating that referenced worktree paths, git branches, and metadata records exist and match.
- **FR-005**: System MUST assign a `BROKEN` lifecycle status to any experiment or worktree with missing, corrupted, or mismatched underlying git or filesystem resources.
- **FR-006**: System MUST output structured, non-destructive recovery recommendations whenever a `BROKEN` or degraded state is detected.
- **FR-007**: System MUST log multi-file metadata operations into a durable transaction journal before committing changes to the registry or record files.
- **FR-008**: System MUST provide a recovery mechanism that reads the transaction journal to detect aborted operations, dangling resource allocations, and uncommitted metadata writes.
- **FR-009**: System MUST support an `archived` lifecycle state that unmounts physical worktree directories while preserving git branch pointers, task artifacts, and experiment metadata.
- **FR-010**: System MUST support restoring archived worktrees and experiments back into active status with full filesystem validation.
- **FR-011**: System MUST prevent archiving or dropping any worktree containing uncommitted modifications unless the user explicitly provides `--discard-uncommitted --yes`.
- **FR-012**: System MUST restrict the `--force` flag solely to bypassing non-content operational blockers (e.g., stale lock files, missing parent directory links, or external process warnings), strictly prohibiting `--force` from silently discarding uncommitted code modifications.
- **FR-013**: System MUST generate a structured parallel handoff artifact documenting the winning variant, decision rationale, comparison scorecards, and preserved losing variant branches.
- **FR-014**: System MUST never automatically delete non-winning variants during winner selection, handoff generation, or publish preparation.
- **FR-015**: All health, status, drop-status, and recovery commands MUST support both human-readable text and machine-readable structured output formats.
- **FR-016**: All destructive cleanup, repair, and archive actions MUST support a preview mode (`--dry-run`) indicating planned actions without modifying files or git state.

---

### Key Entities

- **Experiment Health Record**: Captures the operational health of an experiment, containing status (`HEALTHY`, `DEGRADED`, `BROKEN`), timestamp of last verification, list of anomalies (e.g., missing branch, missing directory, corrupt metadata), and suggested repair actions.
- **Drop Status Report**: Captures the state of a parallel cleanup action, itemizing which variant IDs were removed, which variants survived, specific error codes/messages for failures, and whether the experiment record is retained.
- **Transaction Journal Entry**: An append-only record representing an in-flight or completed metadata transition, containing transaction ID, timestamp, operation type (spawn, drop, pick, archive), target files, rollback instructions, and commit status.
- **Archive Record**: Captures the archived state of a worktree or experiment, preserving the original base branch, head commit SHA, metadata history, artifact locations, and archival timestamp while marking the worktree path unallocated.
- **Parallel Handoff Package**: A composite artifact bundling the experiment configuration, winner selection decision, comparative evaluation matrix (performance, test results, code size), reviewer notes, and inventory of preserved variant branches.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Zero unhandled exceptions or metadata corruption when multi-worktree operations (spawn, drop, archive) are aborted or encounter individual variant failures.
- **SC-002**: 100% of partially failed drop operations retain surviving worktrees and allow complete cleanup via a subsequent retry invocation without manual file editing.
- **SC-003**: Health diagnostics accurately identify 100% of simulated out-of-band deletions (missing worktree folder, deleted branch, invalid JSON record) and categorize them with actionable guidance.
- **SC-004**: Archiving an experiment frees 100% of the active worktree disk footprint while retaining all branch history and metadata records for future restoration.
- **SC-005**: 100% of generated parallel handoff packages include complete winner rationale and explicit references to all preserved non-winning variants without triggering any automatic branch deletion.
- **SC-006**: All diagnostic, status, and recovery operations return verifiable outputs within 2 seconds for experiments with up to 10 parallel variants.
- **SC-007**: 0 instances of uncommitted user code destroyed when running commands with `--force` unless `--discard-uncommitted --yes` is explicitly provided.

---

## Assumptions

1. **Git Worktree Capabilities**: The environment supports standard Git worktree operations (`git worktree add`, `git worktree remove`, `git worktree prune`).
2. **Metadata Storage Location**: Persistent metadata remains within the designated repository metadata directory (`.mannostree/`) and follows standard JSON-compatible formatting.
3. **Preservation Policy**: In accordance with project core rules, losing variants are never deleted automatically and must be preserved until the user issues an explicit cleanup command.
4. **Non-Destructive Defaults**: Recovery and doctor operations never perform destructive actions (e.g., deleting branches or forcing directory overwrites) without explicit user confirmation or flags.
5. **Strict Flag Separation**: Operational bypasses (`--force`) and data-discarding actions (`--discard-uncommitted --yes`) are strictly segregated to prevent accidental data loss.
6. **Path Resolution**: Restoring an archived worktree uses the configured worktree root path unless an alternative is explicitly specified.

