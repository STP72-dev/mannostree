# Tasks: Movement 5 — Parallel Publish & Multi-Branch Merge-Sync

**Input**: Design documents from `specs/006-parallel-publish-merge-sync/`  
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/cli-contract.md`, `quickstart.md`

## Format: `- [ ] [TaskID] [P?] [Story?] Description with file path`

- **[P]**: Parallelizable (independent file targets without uncommitted task dependencies)
- **[Story]**: User story identifier (`[US1]`, `[US2]`, `[US3]`, `[US4]`)
- Explicit target file paths specified for all tasks

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Configuration options and directory schemas

- [x] T001 Extend `MannostreeConfigSchema` in `src/config/schema.ts` to support `releases_dir_name` (default: `'releases'`) and `publish.default_draft`
 
 ---
 
 ## Phase 2: Foundational (Blocking Prerequisites)
 
 **Purpose**: Core domain types, Zod schemas, and MetadataStore release manifest persistence
 
 - [x] T002 [P] Define core types for `ParallelPublishResult`, `ParallelPublishOptions`, `FleetMergeSyncCandidate`, `FleetMergeSyncReport`, `FleetMergeSyncOptions`, `FleetBatchPublishReport`, `FleetBatchPublishOptions`, and `ReleaseManifestRecord` in `src/types/index.ts`
 - [x] T003 [P] Implement Zod validation schemas for `ParallelPublishResultSchema`, `FleetMergeSyncReportSchema`, `FleetBatchPublishReportSchema`, and `ReleaseManifestRecordSchema` in `src/metadata/schema.ts`
 - [x] T004 Add release manifest persistence methods (`saveReleaseManifest`, `getReleaseManifest`, `listReleaseManifests`) in `src/metadata/store.ts`
 
 **Checkpoint**: Core types, validation schemas, and metadata release store methods ready — user story implementation can proceed.
 
 ---
 
 ## Phase 3: User Story 1 & 2 - Parallel Winner Publishing & Benchmark Embedding (Priority: P1) 🎯 MVP
 
 **Goal**: Single-command publishing (`mannostree parallel publish <feature>`) verifying winning variant, compiling task artifacts, embedding benchmark matrices, pushing branch, and opening PR.
 
 **Independent Test**: Create an experiment with 2 variants, pick a winner, run `parallel publish --preview` to inspect compiled PR markdown with benchmark matrix, and run `parallel publish --draft` to verify branch push and PR creation.
 
 ### Tests for User Story 1 & 2
 - [x] T005 [P] [US1] Unit test for parallel winner validation, quality gate verification, PR body compilation, and offline fallback in `tests/unit/parallel-publish.test.ts`
 - [x] T006 [P] [US2] Unit test for multi-variant benchmark scorecard and solution options Markdown table generation in `tests/unit/parallel-publish.test.ts`
 - [x] T007 [P] [US1] Integration test for `mannostree parallel publish <feature> [--preview] [--draft]` CLI commands in `tests/integration/parallel-publish-cli.test.ts`
 
 ### Implementation for User Story 1 & 2
 - [x] T008 [US1] Implement rich PR body builder in `src/core/publish.ts` compiling task artifacts, executive summary, quality gate logs, and reference branches
 - [x] T009 [US2] Implement multi-variant benchmark matrix embedding in `src/core/publish.ts` and `src/core/parallel.ts`
 - [x] T010 [US1] Implement `publishWinner` method with explicit winner check and `GhExecutor` integration in `src/core/parallel.ts`
 - [x] T011 [US1] Add `parallelPublish` orchestration method in `src/core/orchestrator.ts`
 - [x] T012 [US1] Register `parallel publish <feature>` CLI command in `src/cli/commands/parallel.ts`
 
 **Checkpoint**: User Stories 1 and 2 functional and testable.
 
 ---
 
 ## Phase 4: User Story 3 - Fleet Multi-Branch Release Assembly & Merge Simulation (Priority: P2)
 
 **Goal**: Simulate in-memory 3-way merges for candidate branches into a shared integration trunk (`mannostree fleet merge-sync --target <branch>`) and assemble clean release branches.
 
 **Independent Test**: Create 3 feature branches (2 clean, 1 conflicting), run `fleet merge-sync --target staging --preview` to identify the conflicting branch, filter candidates, and execute `fleet merge-sync --target staging --yes` to assemble the clean release branch and generate `.mannostree/releases/staging.json`.
 
 ### Tests for User Story 3
 - [x] T013 [P] [US3] Unit test for sequential in-memory 3-way merge simulations, conflict detection, and atomic abort in `tests/unit/fleet-merge-sync.test.ts`
 - [x] T014 [P] [US3] Unit test for release branch assembly and release manifest recording in `tests/unit/fleet-merge-sync.test.ts`
 - [x] T015 [P] [US3] Integration test for `mannostree fleet merge-sync --target <branch> [--preview] [--yes]` CLI commands in `tests/integration/fleet-merge-sync-cli.test.ts`
 
 ### Implementation for User Story 3
 - [x] T016 [US3] Implement `mergeSync` pre-flight in-memory merge simulation and release assembly in `src/core/fleet.ts`
 - [x] T017 [US3] Add `fleetMergeSync` orchestration method in `src/core/orchestrator.ts`
 - [x] T018 [US3] Register `fleet merge-sync` CLI command in `src/cli/commands/fleet.ts`
 
 **Checkpoint**: User Stories 1, 2, and 3 functional.
 
 ---
 
 ## Phase 5: User Story 4 - Batch Fleet Multi-PR Publishing (Priority: P2)
 
 **Goal**: Batch-publish pull requests across multiple completed worktrees (`mannostree fleet publish [--all] [--selected <ids>]`).
 
 **Independent Test**: Select 2 completed worktrees, run `mannostree fleet publish --all --draft`, verify that both PRs are created, active concurrency leases are released, and a structured batch report is returned.
 
 ### Tests for User Story 4
 - [x] T019 [P] [US4] Unit test for batch worktree publishing, lease clearance, and skip handling in `tests/unit/fleet-batch-publish.test.ts`
 - [x] T020 [P] [US4] Integration test for `mannostree fleet publish [--all] [--selected]` CLI commands in `tests/integration/fleet-merge-sync-cli.test.ts`
 
 ### Implementation for User Story 4
 - [x] T021 [US4] Implement `batchPublish` in `src/core/publish.ts` and `src/core/fleet.ts`
 - [x] T022 [US4] Add `fleetBatchPublish` orchestration method in `src/core/orchestrator.ts`
 - [x] T023 [US4] Register `fleet publish` CLI command in `src/cli/commands/fleet.ts`
 
 **Checkpoint**: All 4 user stories functional and verified.
 
 ---
 
 ## Phase 6: Polish & Cross-Cutting Concerns
 
 **Purpose**: Export types, strict lint verification, full test suite pass rate, and documentation alignment
 
 - [x] T024 [P] Export all Movement 5 types in `src/index.ts`
 - [x] T025 Run TypeScript compilation and strict lint checks via `npm run lint`
 - [x] T026 Run full test suite with coverage reporting via `npm test`
 - [x] T027 [P] Update CLI documentation and examples in `README.md`
 - [x] T028 Validate operator workflows per `specs/006-parallel-publish-merge-sync/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies
- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user story phases.
- **User Story 1 & 2 (Phase 3 - P1)**: Depends on Foundational.
- **User Story 3 (Phase 4 - P2)**: Depends on Foundational.
- **User Story 4 (Phase 5 - P2)**: Depends on Foundational + US1.
- **Polish (Phase 6)**: Depends on completion of all user story implementations.

### Parallel Opportunities
- Foundational types and schemas (`T002`, `T003`) can be implemented concurrently.
- Test tasks within each story phase (`T005`/`T006`/`T007`, `T013`/`T014`/`T015`, `T019`/`T020`) can be authored concurrently before implementation.
- User Story 3 (Merge-Sync) and User Story 4 (Batch Publish) can proceed concurrently once US1 completes.
