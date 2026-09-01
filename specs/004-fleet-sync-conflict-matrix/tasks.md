# Tasks: Fleet Sync & Cross-Worktree Conflict Matrix

**Input**: Design documents from `specs/004-fleet-sync-conflict-matrix/`  
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/cli-contract.md`, `quickstart.md`

## Format: `- [x] [TaskID] [P?] [Story?] Description with file path`

- **[P]**: Parallelizable (independent file targets without uncommitted task dependencies)
- **[Story]**: User story identifier (`[US1]`, `[US2]`, `[US3]`, `[US4]`)
- Explicit target file paths specified for all tasks

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Fleet configuration options and CLI entrypoint setup

- [x] T001 Extend `MannostreeConfigSchema` in `src/config/schema.ts` to support optional `fleet` configuration defaults

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core domain types, Zod schemas, and Git simulation primitives required across all user stories

- [x] T002 [P] Define core types for `FleetSyncStatusType`, `WorktreeSyncStatus`, `FleetSyncReport`, `ConflictSeverity`, `ConflictHunkDetail`, `ConflictMatrixCell`, `FleetConflictMatrixReport`, `FleetSyncOptions`, and `FleetConflictMatrixOptions` in `src/types/index.ts`
- [x] T003 [P] Implement Zod validation schemas for `FleetSyncStatusSchema`, `FleetSyncReportSchema`, `ConflictMatrixCellSchema`, and `FleetConflictMatrixReportSchema` in `src/metadata/schema.ts`
- [x] T004 Add in-memory 3-way merge simulation (`simulateMergeTree`) and changed file discovery (`getChangedFilesAgainstBase`) in `src/git/engine.ts`

**Checkpoint**: Core types, validation schemas, and git primitives ready — user story implementation can proceed.

---

## Phase 3: User Story 1 - Fleet-Wide Base Branch Synchronization (Priority: P1) 🎯 MVP

**Goal**: Concurrently inspect, preview, and synchronize all active worktrees against upstream base branches with dirty-state guarding.

**Independent Test**: Create 3 worktrees, commit to `main`, run `mannostree fleet sync --preview` to verify divergence detection, followed by `mannostree fleet sync` to update clean branches while skipping dirty worktrees.

### Tests for User Story 1
- [x] T005 [P] [US1] Unit test for fleet synchronization preview, safety guards, and divergence detection in `tests/unit/fleet-sync.test.ts`
- [x] T006 [P] [US1] Integration test for `mannostree fleet sync` CLI execution in `tests/integration/fleet-cli.test.ts`

### Implementation for User Story 1
- [x] T007 [US1] Implement `FleetEngine.syncFleet` with dirty/session guards and safe strategy execution in `src/core/fleet.ts`
- [x] T008 [US1] Implement `fleetSync` orchestration method in `src/core/orchestrator.ts`
- [x] T009 [US1] Register `fleet sync` CLI command in `src/cli/commands/fleet.ts`

**Checkpoint**: User Story 1 functional and independently testable.

---

## Phase 4: User Story 2 - Pairwise Cross-Worktree Conflict Matrix (Priority: P1)

**Goal**: Compute $N \times N$ pairwise cross-worktree conflict matrix across all active worktrees and persist `.task/conflict-matrix.md` and `.mannostree/fleet/conflict-matrix.json`.

**Independent Test**: Spawn 3 worktrees (2 modifying the same file, 1 independent), run `mannostree fleet conflict-matrix`, verify that the $3 \times 3$ matrix flags the collision pair and marks the third clean.

### Tests for User Story 2
- [x] T010 [P] [US2] Unit test for pairwise changed-file intersection and matrix cell classification in `tests/unit/conflict-matrix.test.ts`
- [x] T011 [P] [US2] Integration test for `mannostree fleet conflict-matrix` CLI command in `tests/integration/fleet-cli.test.ts`

### Implementation for User Story 2
- [x] T012 [US2] Implement 2-stage conflict matrix calculation engine in `src/core/fleet.ts`
- [x] T013 [US2] Implement markdown table compiler (`.task/conflict-matrix.md`) and JSON metadata persistence in `src/core/fleet.ts`
- [x] T014 [US2] Implement terminal matrix formatter and register `fleet conflict-matrix` in `src/cli/commands/fleet.ts`

**Checkpoint**: User Stories 1 and 2 functional with fleet-wide conflict detection.

---

## Phase 5: User Story 3 - Conflict-Aware Target Filter & Publish Guard (Priority: P2)

**Goal**: Filter conflict matrix for a specific worktree target (`--target <id>`) and support CI/CD pipeline gating (`--fail-on-conflict`).

**Independent Test**: Run `mannostree fleet conflict-matrix --target <id> --fail-on-conflict`, verify non-zero exit code when collisions exist and exit code 0 when clean.

### Tests for User Story 3
- [x] T015 [P] [US3] Unit test for target worktree filtering and `--fail-on-conflict` behavior in `tests/unit/conflict-matrix.test.ts`
- [x] T016 [P] [US3] Integration test for target-focused conflict analysis and gating in `tests/integration/fleet-cli.test.ts`

### Implementation for User Story 3
- [x] T017 [US3] Implement target filtering in `FleetEngine.computeConflictMatrix` in `src/core/fleet.ts`
- [x] T018 [US3] Add `--fail-on-conflict` and `--target` flag handling in `src/cli/commands/fleet.ts` and `src/core/orchestrator.ts`

**Checkpoint**: User Stories 1, 2, and 3 functional with target filtering and CI gating.

---

## Phase 6: User Story 4 - Automated 3-Way Merge Simulation (Priority: P2)

**Goal**: Simulate in-memory 3-way merges via `git merge-tree` to distinguish clean non-overlapping hunks from direct line collision hazards.

**Independent Test**: Create 2 worktrees editing different parts of the same file, run `mannostree fleet conflict-matrix --simulate-merge`, and verify the pair is classified as `SHARED_FILES_CLEAN` (auto-mergeable) rather than `CONFLICT`.

### Tests for User Story 4
- [x] T019 [P] [US4] Unit test for in-memory `git merge-tree` parser and hunk conflict extractor in `tests/unit/conflict-matrix.test.ts`
- [x] T020 [P] [US4] Integration test for `--simulate-merge` / `--deep` CLI option in `tests/integration/fleet-cli.test.ts`

### Implementation for User Story 4
- [x] T021 [US4] Implement deep 3-way in-memory simulation in `FleetEngine.computeConflictMatrix` in `src/core/fleet.ts`
- [x] T022 [US4] Add `--simulate-merge` flag in `src/cli/commands/fleet.ts` and `src/core/orchestrator.ts`

**Checkpoint**: All user stories (1 through 4) fully functional and verified.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Type safety, strict lint verification, full test suite coverage, and documentation alignment

- [x] T023 [P] Export all fleet types, engines, and schemas in `src/index.ts`
- [x] T024 Register `registerFleetCommand` in `src/cli/index.ts`
- [x] T025 Run TypeScript compilation and strict lint checks via `npm run lint`
- [x] T026 Run full test suite with coverage reporting via `npm test`
- [x] T027 [P] Update CLI documentation and examples in `README.md`
- [x] T028 Validate operator workflows per `specs/004-fleet-sync-conflict-matrix/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies
- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user story phases.
- **User Story 1 (Phase 3 - P1)**: Depends on Foundational.
- **User Story 2 (Phase 4 - P1)**: Depends on Foundational + US1.
- **User Story 3 (Phase 5 - P2)**: Depends on Foundational + US2.
- **User Story 4 (Phase 6 - P2)**: Depends on Foundational + US2.
- **Polish (Phase 7)**: Depends on completion of target user stories.

### Parallel Opportunities
- Foundational types and schemas (`T002`, `T003`) can be implemented concurrently.
- Test tasks within each story phase (`T005`/`T006`, `T010`/`T011`, `T015`/`T016`, `T019`/`T020`) can be authored concurrently before implementation.
- User Story 3 (Target Filter/Gating) and User Story 4 (3-Way Merge Simulation) can proceed in parallel once US2 completes.
