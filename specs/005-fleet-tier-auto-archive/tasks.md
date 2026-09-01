# Tasks: Fleet Tiering, Workspace Leases & Auto-Archive Policy

**Input**: Design documents from `specs/005-fleet-tier-auto-archive/`  
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/cli-contract.md`, `quickstart.md`

## Format: `- [ ] [TaskID] [P?] [Story?] Description with file path`

- **[P]**: Parallelizable (independent file targets without uncommitted task dependencies)
- **[Story]**: User story identifier (`[US1]`, `[US2]`, `[US3]`, `[US4]`)
- Explicit target file paths specified for all tasks

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Fleet configuration options and schema setup

- [x] T001 Extend `MannostreeConfigSchema` and `FleetConfigSchema` in `src/config/schema.ts` to support `FleetPolicyConfig` (`max_active_worktrees`, `idle_ttl_hours`, `auto_archive_idle`, `archive_dirty_policy`, `default_lease_ttl_minutes`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core domain types, Zod schemas, and MetadataStore lease/tier persistence

- [x] T002 [P] Define core types for `WorkspaceLease`, `FleetTier`, `FleetPolicyConfig`, `FleetCapacityReport`, and `AutoArchiveReport` in `src/types/index.ts`
- [x] T003 [P] Implement Zod validation schemas for `WorkspaceLeaseSchema`, `FleetCapacityReportSchema`, and `AutoArchiveReportSchema` in `src/metadata/schema.ts`
- [x] T004 Add lease persistence methods (`saveLease`, `getLease`, `listLeases`, `deleteLease`) and atomic lock operations in `src/metadata/store.ts`

**Checkpoint**: Core types, validation schemas, and metadata lease methods ready — user story implementation can proceed.

---

## Phase 3: User Story 1 - Workspace Leases & Concurrency Protection (Priority: P1) 🎯 MVP

**Goal**: Acquire, renew, release, and list exclusive workspace leases with lazy TTL expiration and drop/archive/sync guard protection.

**Independent Test**: Acquire lease on `wt1` with holder `Agent-A` and TTL 1h, verify concurrent acquisition rejection, verify `drop` rejection, release lease, and verify re-acquisition succeeds.

### Tests for User Story 1
- [x] T005 [P] [US1] Unit test for lease acquisition, TTL expiration, renewal, release, and force breaking in `tests/unit/fleet-lease.test.ts`
- [x] T006 [P] [US1] Unit test for lease safety guard interception during drop, archive, and sync in `tests/unit/fleet-lease.test.ts`
- [x] T007 [P] [US1] Integration test for `mannostree fleet lease acquire/release/renew/list` CLI commands in `tests/integration/fleet-tier-cli.test.ts`

### Implementation for User Story 1
- [x] T008 [US1] Implement lease management methods (`acquireLease`, `releaseLease`, `renewLease`, `listLeases`, `checkLeaseGuard`) in `src/core/fleet.ts`
- [x] T009 [US1] Add lease guard interception to `orchestrator.drop`, `orchestrator.archive`, and `fleetEngine.syncFleet` in `src/core/orchestrator.ts` and `src/core/fleet.ts`
- [x] T010 [US1] Register `fleet lease acquire`, `fleet lease release`, `fleet lease renew`, and `fleet lease list` CLI commands in `src/cli/commands/fleet.ts`

**Checkpoint**: User Story 1 functional and independently testable.

---

## Phase 4: User Story 2 - Fleet Lifecycle Tiering (Hot / Warm / Cold / Pinned) (Priority: P1)

**Goal**: Classify worktrees into `hot`, `warm`, `cold`, and `pinned` tiers with explicit tier setting and pin/unpin commands.

**Independent Test**: Pin worktree `wt1`, assign tier `warm` to `wt2`, list tiers via `fleet tier list`, verify pinned exemption.

### Tests for User Story 2
- [x] T011 [P] [US2] Unit test for tier classification, dynamic tier computation, and pin/unpin operations in `tests/unit/fleet-tier.test.ts`
- [x] T012 [P] [US2] Integration test for `mannostree fleet tier set/pin/unpin/list` CLI commands in `tests/integration/fleet-tier-cli.test.ts`

### Implementation for User Story 2
- [x] T013 [US2] Implement tier computation, tier setting, and pin/unpin methods in `src/core/fleet.ts`
- [x] T014 [US2] Add tier orchestration methods in `src/core/orchestrator.ts`
- [x] T015 [US2] Register `fleet tier set`, `fleet tier pin`, `fleet tier unpin`, and `fleet tier list` CLI commands in `src/cli/commands/fleet.ts`

**Checkpoint**: User Stories 1 and 2 functional.

---

## Phase 5: User Story 3 - Automated Auto-Archive Policy Engine (Priority: P2)

**Goal**: Evaluate quota and idle retention policies to unmount eligible warm worktrees to cold archive tier with preview and safety guards.

**Independent Test**: Configure max active quota of 2, spawn 4 worktrees with 1 pinned and 1 leased, run `mannostree fleet auto-archive --preview` to verify 2 unpinned/unleased candidates flagged, run with `--yes` to archive them cleanly.

### Tests for User Story 3
- [x] T016 [P] [US3] Unit test for LRU candidate evaluation, quota limits, idle TTL, and safety skip guards in `tests/unit/auto-archive.test.ts`
- [x] T017 [P] [US3] Integration test for `mannostree fleet auto-archive [--preview] [--yes]` CLI commands in `tests/integration/fleet-tier-cli.test.ts`

### Implementation for User Story 3
- [x] T018 [US3] Implement auto-archive policy evaluation and execution engine in `src/core/fleet.ts`
- [x] T019 [US3] Implement `fleetAutoArchive` orchestration method in `src/core/orchestrator.ts`
- [x] T020 [US3] Register `fleet auto-archive` CLI command in `src/cli/commands/fleet.ts`

**Checkpoint**: User Stories 1, 2, and 3 functional.

---

## Phase 6: User Story 4 - Fleet Quota & Capacity Dashboard (Priority: P2)

**Goal**: Display comprehensive capacity overview, tier breakdown, active leases, and disk metrics in human-readable and machine-readable formats.

**Independent Test**: Run `mannostree fleet status --json`, verify JSON payload matches `FleetCapacityReportSchema` with accurate numeric counts.

### Tests for User Story 4
- [x] T021 [P] [US4] Unit test for capacity calculation, disk footprint estimation, and dashboard report generation in `tests/unit/fleet-tier.test.ts`
- [x] T022 [P] [US4] Integration test for `mannostree fleet status` CLI output formatting in `tests/integration/fleet-tier-cli.test.ts`

### Implementation for User Story 4
- [x] T023 [US4] Implement `getFleetCapacityReport` and dashboard formatter in `src/core/fleet.ts`
- [x] T024 [US4] Update `mannostree fleet status` in `src/cli/commands/fleet.ts` and `src/core/orchestrator.ts`

**Checkpoint**: All 4 user stories functional and verified.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Export types, strict lint verification, full test suite pass rate, and documentation alignment

- [x] T025 [P] Export all lease, tier, policy, and report types in `src/index.ts`
- [x] T026 Run TypeScript compilation and strict lint checks via `npm run lint`
- [x] T027 Run full test suite with coverage reporting via `npm test`
- [x] T028 [P] Update CLI documentation and examples in `README.md`
- [x] T029 Validate operator workflows per `specs/005-fleet-tier-auto-archive/quickstart.md`


---

## Dependencies & Execution Order

### Phase Dependencies
- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user story phases.
- **User Story 1 (Phase 3 - P1)**: Depends on Foundational.
- **User Story 2 (Phase 4 - P1)**: Depends on Foundational + US1.
- **User Story 3 (Phase 5 - P2)**: Depends on Foundational + US2.
- **User Story 4 (Phase 6 - P2)**: Depends on Foundational + US2.
- **Polish (Phase 7)**: Depends on completion of all user story implementations.

### Parallel Opportunities
- Foundational types and schemas (`T002`, `T003`) can be implemented concurrently.
- Test tasks within each story phase (`T005`/`T006`/`T007`, `T011`/`T012`, `T016`/`T017`, `T021`/`T022`) can be authored concurrently before implementation.
- User Story 3 (Auto-Archive) and User Story 4 (Dashboard) can proceed in parallel once US2 completes.
