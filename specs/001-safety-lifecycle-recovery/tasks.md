# Tasks: Safety-First Lifecycle Recovery & Health Hardening

**Input**: Design documents from `specs/001-safety-lifecycle-recovery/`  
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/cli-contract.md`, `quickstart.md`

## Format: `- [ ] [TaskID] [P?] [Story?] Description with file path`

- **[P]**: Parallelizable (independent file targets without uncommitted task dependencies)
- **[Story]**: User story identifier (`[US1]`, `[US2]`, `[US3]`, `[US4]`, `[US5]`)
- Explicit target file paths specified for all tasks

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and directory structure for journal and archive storage

- [ ] T001 Initialize journal and archive directory paths in `src/config/schema.ts`
- [ ] T002 [P] Create journal and archive directories scaffold helper in `src/artifact/scaffold.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core type models, validation schemas, and transaction journaling foundation required across all user stories

- [ ] T003 [P] Define core types for HealthStatus, DropStatusReport, TransactionJournalEntry, ArchiveRecord, and ParallelHandoffPackage in `src/types/index.ts`
- [ ] T004 [P] Implement Zod runtime validation schemas for journal entries, health diagnostics, archives, and handoffs in `src/metadata/schema.ts`
- [ ] T005 Implement atomic transaction journal logger and snapshot rollback engine in `src/metadata/journal.ts`
- [ ] T006 Integrate transaction journaling hooks and atomic write locks in `src/metadata/store.ts`

**Checkpoint**: Core types, validation schemas, and transaction journal ready — user story implementation can proceed.

---

## Phase 3: User Story 1 - Transparent Partial Failure & Safe Retry for Parallel Cleanup (Priority: P1) 🎯 MVP

**Goal**: Enable itemized per-variant drop tracking, enforce `--discard-uncommitted --yes` while restricting `--force` to non-content blockers, preserve experiment records during partial failure, and support safe drop retries.

**Independent Test**: Create an experiment with clean and dirty variants. Run `parallel drop` without `--discard-uncommitted --yes`. Verify clean variants are removed, the dirty variant and parent experiment record are preserved, and `parallel drop-status` reports the surviving variant and retry remediation.

### Tests for User Story 1
- [ ] T007 [P] [US1] Unit test for strict flag separation (`--force` vs `--discard-uncommitted --yes`) in `tests/unit/flag-safety.test.ts`
- [ ] T008 [P] [US1] Integration test for partial drop failure, dirty variant preservation, and retry execution in `tests/integration/parallel-drop-safety.test.ts`

### Implementation for User Story 1
- [ ] T009 [US1] Implement per-variant drop execution, dirty-check validation, and partial-survival metadata retention in `src/core/parallel.ts`
- [ ] T010 [US1] Implement `parallel drop-status` query command and output formatter in `src/cli/commands/parallel.ts`
- [ ] T011 [US1] Update `parallel drop` CLI command with `--discard-uncommitted`, restricted `--force`, `--dry-run`, and `--retry` flags in `src/cli/commands/parallel.ts`

**Checkpoint**: User Story 1 fully functional and independently testable.

---

## Phase 4: User Story 2 - Persistent Experiment Health Diagnostics & Broken State Guidance (Priority: P1)

**Goal**: Proactively detect filesystem and Git reference desynchronizations, explicitly assign `BROKEN` or degraded lifecycle states, and provide actionable, non-destructive recovery guidance.

**Independent Test**: Delete an active worktree folder or branch out-of-band. Run `mannostree doctor`. Verify that the affected experiment is flagged as `BROKEN`, healthy workspaces remain unaffected, and non-destructive repair steps are output.

### Tests for User Story 2
- [ ] T012 [P] [US2] Unit test for multi-point health checks and broken state classification in `tests/unit/health-doctor.test.ts`
- [ ] T013 [P] [US2] Integration test for diagnosing out-of-band filesystem deletions and repair guidance in `tests/integration/doctor-recovery.test.ts`

### Implementation for User Story 2
- [ ] T014 [US2] Implement comprehensive health verification checks (worktree existence, git registration, branch validity, clean status) in `src/core/doctor.ts`
- [ ] T015 [US2] Add `broken` and `degraded` state transitions and non-destructive repair handlers in `src/core/orchestrator.ts`
- [ ] T016 [US2] Update `doctor` and `info` CLI commands with detailed health status and recovery advice output in `src/cli/commands/doctor.ts` and `src/cli/commands/info.ts`

**Checkpoint**: User Stories 1 and 2 functional and independently testable.

---

## Phase 5: User Story 3 - Metadata Transaction Journaling & Interrupted Operation Recovery (Priority: P2)

**Goal**: Record pre-commit mutation intents in a write-ahead journal across multi-file operations and provide automatic or command-driven recovery from interrupted runs.

**Independent Test**: Simulate an interrupted `parallel spawn` by halting execution after writing intent logs. Run `mannostree recover`. Verify that the incomplete transaction is detected, dangling worktrees/branches are identified, and safe rollback or replay succeeds.

### Tests for User Story 3
- [ ] T017 [P] [US3] Unit test for transaction intent recording, snapshot capture, and rollback execution in `tests/unit/metadata-journal.test.ts`
- [ ] T018 [P] [US3] Integration test for recovering interrupted multi-worktree operations in `tests/integration/transaction-recovery.test.ts`

### Implementation for User Story 3
- [ ] T019 [US3] Implement transaction lifecycle wrappers (`begin`, `commit`, `rollback`, `replay`) in `src/metadata/journal.ts`
- [ ] T020 [US3] Wrap `parallel spawn`, `parallel drop`, and `archive` operations with atomic transaction logging in `src/core/parallel.ts` and `src/core/orchestrator.ts`
- [ ] T021 [US3] Implement transaction recovery and audit commands in `src/cli/commands/recover.ts`

**Checkpoint**: User Stories 1, 2, and 3 functional and crash-resilient.

---

## Phase 6: User Story 4 - Archive and Restore Lifecycle for Workspaces and Experiments (Priority: P2)

**Goal**: Provide an explicit `archived` lifecycle state that unmounts physical worktrees to reclaim disk space while retaining Git branch history, metadata records, and artifact scorecards, with full on-demand restoration.

**Independent Test**: Archive an experiment with two variants. Verify worktree directories are safely removed while branches and metadata records are preserved. Run `restore` and verify worktrees are recreated at the target paths with valid Git tracking.

### Tests for User Story 4
- [ ] T022 [P] [US4] Unit test for workspace archiving, dirty checks, and restoration validation in `tests/unit/archive-restore.test.ts`
- [ ] T023 [P] [US4] Integration test for archiving and restoring multi-variant parallel experiments in `tests/integration/archive-restore-integration.test.ts`

### Implementation for User Story 4
- [ ] T024 [US4] Implement worktree de-allocation, snapshot archival, and metadata state transitions in `src/core/orchestrator.ts`
- [ ] T025 [US4] Implement worktree re-attachment, path conflict detection, and restoration validation in `src/core/orchestrator.ts`
- [ ] T026 [US4] Implement `archive` and `restore` CLI commands in `src/cli/commands/archive.ts`
- [ ] T027 [US4] Update `list` command in `src/cli/commands/list.ts` to hide archived workspaces by default and support `--archived` flag

**Checkpoint**: User Stories 1, 2, 3, and 4 functional and independently testable.

---

## Phase 7: User Story 5 - Packaged Parallel Handoff with Evidence and Loser Preservation (Priority: P3)

**Goal**: Compile winning decision rationale, comparative evaluation scorecards, and an active registry of preserved non-winning variant branches into a structured handoff artifact bundle.

**Independent Test**: Run comparison and select a winner for an experiment. Run `parallel handoff`. Verify `.task/parallel-handoff.md` and `.mannostree/experiments/<feature>-handoff.json` are created containing the complete scorecard and preserved loser branch list without deleting any branches.

### Tests for User Story 5
- [ ] T028 [P] [US5] Unit test for parallel handoff report generation and loser variant preservation in `tests/unit/parallel-handoff.test.ts`
- [ ] T029 [P] [US5] Integration test for end-to-end parallel comparison, winner pick, and handoff generation in `tests/integration/parallel-handoff.test.ts`

### Implementation for User Story 5
- [ ] T030 [US5] Implement parallel handoff compiler, scorecard aggregator, and markdown generator in `src/core/handoff.ts`
- [ ] T031 [US5] Implement `parallel handoff` CLI command and register under parallel command suite in `src/cli/commands/handoff.ts` and `src/cli/commands/parallel.ts`

**Checkpoint**: All user stories (1 through 5) functional and integrated.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Type safety, full-suite verification, quickstart validation, and documentation alignment

- [ ] T032 [P] Export all new types and commands from `src/index.ts` and `src/cli/index.ts`
- [ ] T033 Run TypeScript compilation and strict lint checks via `npm run lint`
- [ ] T034 Run full test suite with coverage reporting via `npm run coverage`
- [ ] T035 [P] Update command documentation in `docs/` and `README.md` reflecting new commands and flags
- [ ] T036 Validate operator scenarios per `specs/001-safety-lifecycle-recovery/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies
- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user story phases.
- **User Story 1 (Phase 3 - P1)**: Depends on Foundational — MVP baseline.
- **User Story 2 (Phase 4 - P1)**: Depends on Foundational — can run parallel to US1.
- **User Story 3 (Phase 5 - P2)**: Depends on Foundational + US1/US2.
- **User Story 4 (Phase 6 - P2)**: Depends on Foundational + US1.
- **User Story 5 (Phase 7 - P3)**: Depends on Foundational + US1.
- **Polish (Phase 8)**: Depends on completion of target user stories.

### Parallel Opportunities
- Foundational schema and type tasks (`T003`, `T004`) can be implemented concurrently.
- Test tasks within each phase (`T007`/`T008`, `T012`/`T013`, `T017`/`T018`, `T022`/`T023`, `T028`/`T029`) can be authored in parallel before implementation.
- User Stories 1 and 2 can proceed concurrently once Phase 2 is complete.

---

## Implementation Strategy

### MVP First (User Story 1 Baseline)
1. Complete **Phase 1: Setup** (`T001`-`T002`).
2. Complete **Phase 2: Foundational** (`T003`-`T006`).
3. Complete **Phase 3: User Story 1** (`T007`-`T011`).
4. **VALIDATE**: Run `npm test` on `flag-safety` and `parallel-drop-safety` suites.

### Incremental Feature Expansion
1. Add **User Story 2 (Health & Broken)** (`T012`-`T016`) → validate diagnostics.
2. Add **User Story 3 (Transaction Journal)** (`T017`-`T021`) → validate crash rollback.
3. Add **User Story 4 (Archive & Restore)** (`T022`-`T027`) → validate disk unmounting.
4. Add **User Story 5 (Parallel Handoff)** (`T028`-`T031`) → validate loser preservation.
5. Complete **Phase 8: Polish** (`T032`-`T036`).
