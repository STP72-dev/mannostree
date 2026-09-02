# Tasks: Movement 9 — Cross-Repository Poly-Worktree Orchestration

**Input**: Design documents from `specs/009-cross-repo-poly-worktree/`  
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/cli-contract.md`, `quickstart.md`

## Format: `- [ ] [TaskID] [P?] [Story?] Description with file path`

- **[P]**: Parallelizable (independent file targets without uncommitted task dependencies)
- **[Story]**: User story identifier (`[US1]`, `[US2]`, `[US3]`, `[US4]`, `[US5]`)
- Explicit target file paths specified for all tasks

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Multi-repository manifest parser and configuration schema in `src/poly/manifest.ts` and `src/config/schema.ts`

- [ ] T001 Extend `MannostreeConfigSchema` in `src/config/schema.ts` and implement `.mannostree.poly.yml` loader/validator in `src/poly/manifest.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core domain types, Zod validation schemas, store persistence methods, and base PolyEngine class

- [ ] T002 [P] Define core types for `PolyManifestConfig`, `PolyRepoMemberConfig`, `PolyLinkRule`, `PolyLinkRecord`, `PolyWorktreeGroupRecord`, and `PolyReleaseManifest` in `src/types/index.ts`
- [ ] T003 [P] Implement Zod validation schemas for `PolyManifestConfigSchema`, `PolyLinkRecordSchema`, `PolyWorktreeGroupRecordSchema`, and `PolyReleaseManifestSchema` in `src/metadata/schema.ts`
- [ ] T004 Implement `MetadataStore` methods for saving/loading `.mannostree/poly-registry.json` and `.mannostree/poly-links.json` in `src/metadata/store.ts`
- [ ] T005 Implement base `PolyEngine` class in `src/poly/engine.ts` with member repository path resolution and pre-flight validation

**Checkpoint**: Core types, schemas, and poly store ready — user story implementations can proceed.

---

## Phase 3: User Story 1 - Coordinated Poly-Worktree Spawning & Decommissioning (Priority: P1) 🎯 MVP

**Goal**: Atomic all-or-nothing worktree creation across multiple repositories with automated rollback stack and safe drop.

**Independent Test**: Execute `mannostree poly spawn <feature> --base main` across multi-repo cluster and verify matched worktrees created in each repository with `.mannostree/poly-registry.json` record.

### Tests for User Story 1
- [ ] T006 [P] [US1] Unit test for `PolyEngine.spawn` atomic execution and rollback stack in `tests/unit/poly-spawn.test.ts`
- [ ] T007 [P] [US1] Unit test for `PolyEngine.drop` and decommissioning in `tests/unit/poly-drop.test.ts`
- [ ] T008 [P] [US1] Integration test for `mannostree poly spawn` and `poly drop` CLI commands in `tests/integration/poly-lifecycle.test.ts`

### Implementation for User Story 1
- [ ] T009 [US1] Implement atomic multi-repo `spawnPolyWorktree` with rollback stack in `src/poly/engine.ts`
- [ ] T010 [US1] Implement multi-repo `dropPolyWorktree` with safe flag handling (`--discard-uncommitted --yes`) in `src/poly/engine.ts`
- [ ] T011 [US1] Register `poly spawn` and `poly drop` CLI commands in `src/cli/commands/poly.ts`

**Checkpoint**: User Story 1 functional and testable (MVP complete).

---

## Phase 4: User Story 2 - Cross-Repository Dependency Inter-Wiring (Priority: P1)

**Goal**: Automated local dependency package linking (`npm`, `python`, `go`, `cargo`, `symlink`) across paired worktrees.

**Independent Test**: Run `mannostree poly link <feature>` and verify dependency linkage in target worktrees and metadata record in `.mannostree/poly-links.json`.

### Tests for User Story 2
- [ ] T012 [P] [US2] Unit test for cross-repo package linkers (`npm`, `python`, `go`, `cargo`, `symlink`) in `tests/unit/poly-link.test.ts`

### Implementation for User Story 2
- [ ] T013 [US2] Implement link strategies (`npm link`, Python editable `-e`, Go `replace`, Cargo `[patch]`, `symlink`) in `src/poly/link.ts`
- [ ] T014 [US2] Implement `linkPolyGroup` and `unlinkPolyGroup` in `src/poly/engine.ts`
- [ ] T015 [US2] Register `poly link` and `poly unlink` CLI commands in `src/cli/commands/poly.ts`

**Checkpoint**: User Stories 1 and 2 functional.

---

## Phase 5: User Story 3 - Coordinated Fleet Sync, Status Matrix & Exec (Priority: P2)

**Goal**: Synchronize base branches, inspect cross-repo conflict status, and execute commands concurrently across member worktrees.

**Independent Test**: Run `mannostree poly sync <feature>`, `mannostree poly status`, and `mannostree poly exec <feature> "npm test" --parallel`.

### Tests for User Story 3
- [ ] T016 [P] [US3] Unit test for `poly sync`, `poly status`, and `poly exec` in `tests/unit/poly-sync-status.test.ts`

### Implementation for User Story 3
- [ ] T017 [US3] Implement `syncPolyGroup`, `getPolyStatus`, and `execPolyCommand` in `src/poly/engine.ts`
- [ ] T018 [US3] Register `poly sync`, `poly status`, and `poly exec` CLI commands in `src/cli/commands/poly.ts`

**Checkpoint**: User Stories 1, 2, and 3 functional.

---

## Phase 6: User Story 4 - Coordinated Poly-Publish & Joint Pull Request Manifest (Priority: P2)

**Goal**: Publish pull requests across all member repositories with embedded sibling PR cross-links and joint release manifests.

**Independent Test**: Run `mannostree poly pr <feature> --push --draft` and verify PR creation across member repos with markdown sibling links.

### Tests for User Story 4
- [ ] T019 [P] [US4] Unit test for multi-host joint poly PR publisher in `tests/unit/poly-publish.test.ts`

### Implementation for User Story 4
- [ ] T020 [US4] Implement `PolyPublishEngine.publishPolyPR` and release manifest builder in `src/poly/publish.ts`
- [ ] T021 [US4] Register `poly pr` CLI command in `src/cli/commands/poly.ts`

**Checkpoint**: User Stories 1, 2, 3, and 4 functional.

---

## Phase 7: User Story 5 - Poly-Doctor Diagnostics & Health Audit (Priority: P2)

**Goal**: Audit poly-repository manifests, verify member repo paths, git remote connectivity, and active cross-link integrity in `mannostree doctor`.

**Independent Test**: Run `mannostree doctor` and verify presence of poly-repository cluster diagnostics.

### Tests for User Story 5
- [ ] T022 [P] [US5] Unit test for poly-repository health audits in `tests/unit/poly-doctor.test.ts`

### Implementation for User Story 5
- [ ] T023 [US5] Implement `auditPolyRepositories()` diagnostic check in `src/core/doctor.ts`
- [ ] T024 [US5] Update doctor CLI output renderer to format poly-repository diagnostics in `src/cli/output.ts`

**Checkpoint**: All 5 user stories functional and verified.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Export types, orchestrator integration, strict lint verification, full test suite pass rate, and documentation alignment

- [ ] T025 [P] Export all Movement 9 types and poly engines in `src/poly/index.ts` and `src/index.ts`
- [ ] T026 Integrate `PolyEngine` and `PolyPublishEngine` into `MannostreeOrchestrator` in `src/core/orchestrator.ts`
- [ ] T027 Run TypeScript compilation and strict lint checks via `npm run lint`
- [ ] T028 Run full test suite with coverage reporting via `npm test`
- [ ] T029 [P] Update CLI documentation and multi-repo examples in `README.md` and `GEMINI.md`
- [ ] T030 Validate operator workflows per `specs/009-cross-repo-poly-worktree/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies
- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories.
- **User Story 1 (Phase 3 - P1)**: Depends on Foundational (MVP).
- **User Story 2 (Phase 4 - P1)**: Depends on Foundational + US1.
- **User Story 3 (Phase 5 - P2)**: Depends on Foundational + US1.
- **User Story 4 (Phase 6 - P2)**: Depends on Foundational + US1.
- **User Story 5 (Phase 7 - P2)**: Depends on Foundational + US1.
- **Polish (Phase 8)**: Depends on completion of all user story implementations.

### Parallel Opportunities
- Types and schemas (`T002`, `T003`) can run concurrently.
- Unit test suites (`T006`, `T007`, `T008`, `T012`, `T016`, `T019`, `T022`) can run in parallel.
- Polish documentation and exports (`T025`, `T029`) can run in parallel.
