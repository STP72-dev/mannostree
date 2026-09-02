# Tasks: Movement 10 — Issue Tracker Bi-directional Sync (Jira / Linear / GitHub Issues)

**Input**: Design documents from `specs/010-issue-tracker-sync/`  
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/cli-contract.md`, `quickstart.md`

## Format: `- [x] [TaskID] [P?] [Story?] Description with file path`

- **[P]**: Parallelizable (independent file targets without uncommitted task dependencies)
- **[Story]**: User story identifier (`[US1]`, `[US2]`, `[US3]`, `[US4]`, `[US5]`)
- Explicit target file paths specified for all tasks

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Issue tracker configuration schema and provider options in `src/config/schema.ts`

- [x] T001 Extend `MannostreeConfigSchema` with `IssueTrackerConfigSchema` in `src/config/schema.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core domain types, Zod schemas, metadata store persistence, and base adapter registry

- [x] T002 [P] Define core types for `IssueTrackerProvider`, `IssueRecord`, `WorktreeIssueAttachment`, `IssueTransitionResult`, `IssueCommentResult`, `IssueDriftSummary`, and `IssueTrackerHealthStatus` in `src/types/index.ts`
- [x] T003 [P] Implement Zod validation schemas for `IssueRecordSchema` and `WorktreeIssueAttachmentSchema` in `src/metadata/schema.ts`
- [x] T004 Implement `MetadataStore` methods for saving/loading `.mannostree/issues/<KEY>.json` in `src/metadata/store.ts`
- [x] T005 Implement `IssueTrackerAdapter` interface and `IssueTrackerRegistry` in `src/issues/base.ts`

**Checkpoint**: Core types, store persistence, and base adapter architecture ready — user story implementations can proceed.

---

## Phase 3: User Story 1 - Issue Ingestion & Auto-Scaffolding on Spawn (Priority: P1) 🎯 MVP

**Goal**: Ingest remote issue tickets from Jira, Linear, and GitHub Issues and automatically populate `.task/task-contract.md` when spawning workspaces.

**Independent Test**: Execute `mannostree spawn feature-auth --issue PROJ-101 --dry-run` and `mannostree issue ingest PROJ-101` and verify `.task/task-contract.md` populated with issue details and `.mannostree/issues/PROJ-101.json` cached.

### Tests for User Story 1
- [x] T006 [P] [US1] Unit test for Jira REST API v3 adapter in `tests/unit/issue-jira.test.ts`
- [x] T007 [P] [US1] Unit test for Linear GraphQL API adapter in `tests/unit/issue-linear.test.ts`
- [x] T008 [P] [US1] Unit test for GitHub Issues REST API adapter in `tests/unit/issue-github.test.ts`
- [x] T009 [P] [US1] Integration test for issue ingestion and `spawn --issue` in `tests/integration/issue-sync-lifecycle.test.ts`

### Implementation for User Story 1
- [x] T010 [US1] Implement `JiraAdapter` (REST API v3, Basic Auth / PAT) in `src/issues/jira.ts`
- [x] T011 [US1] Implement `LinearAdapter` (GraphQL API, API Key Auth) in `src/issues/linear.ts`
- [x] T012 [US1] Implement `GitHubIssueAdapter` (REST API, Bearer Auth) in `src/issues/github.ts`
- [x] T013 [US1] Implement `GenericIssueAdapter` (Webhook / REST payload) in `src/issues/generic.ts`
- [x] T014 [US1] Implement `IssueSyncEngine.ingestIssue` and contract markdown scaffolder in `src/issues/engine.ts`
- [x] T015 [US1] Register `mannostree issue ingest` in `src/cli/commands/issue.ts` and extend `mannostree spawn --issue` in `src/cli/commands/spawn.ts`

**Checkpoint**: User Story 1 functional and testable (MVP complete).

---

## Phase 4: User Story 2 - Automated Lifecycle State Transitions (Priority: P1)

**Goal**: Automatically transition issue status in remote trackers when worktrees are spawned (`In Progress`), PRs opened (`In Review`), or worktrees archived/dropped (`Done`).

**Independent Test**: Run `mannostree issue transition PROJ-101 "In Review"` and verify remote status transition and local worktree metadata updates.

### Tests for User Story 2
- [x] T016 [P] [US2] Unit test for lifecycle transition mappings and idempotency in `tests/unit/issue-engine.test.ts`

### Implementation for User Story 2
- [x] T017 [US2] Implement `transitionIssue` and lifecycle state mapping in `src/issues/engine.ts`
- [x] T018 [US2] Integrate automatic issue transitions into `orchestrator.spawn`, `publishEngine.publishPr`, and `orchestrator.dropWorktree` in `src/core/orchestrator.ts`
- [x] T019 [US2] Register `mannostree issue transition` CLI command in `src/cli/commands/issue.ts`

**Checkpoint**: User Stories 1 and 2 functional.

---

## Phase 5: User Story 3 - Quality Evidence & Comment Synchronization (Priority: P2)

**Goal**: Post verification evidence receipts (`.task/RESULTS.md`), quality gate sign-offs, and markdown comments to issue tickets.

**Independent Test**: Run `mannostree issue comment PROJ-101 "test comment"` and `mannostree issue sync PROJ-101 --comment --evidence` and verify comment posted to ticket.

### Tests for User Story 3
- [x] T020 [P] [US3] Unit test for evidence comment builder and comment posting in `tests/unit/issue-comment.test.ts`

### Implementation for User Story 3
- [x] T021 [US3] Implement `postComment` and `syncEvidence` in `src/issues/engine.ts`
- [x] T022 [US3] Register `mannostree issue comment` and `mannostree issue sync` CLI commands in `src/cli/commands/issue.ts`

**Checkpoint**: User Stories 1, 2, and 3 functional.

---

## Phase 6: User Story 4 - Bi-Directional Drift Detection & Reconciliation (Priority: P2)

**Goal**: Inspect drift between local worktree lifecycle states and remote issue tracker states.

**Independent Test**: Run `mannostree issue status` and verify dashboard displaying active worktrees, linked issue keys, and drift flags.

### Tests for User Story 4
- [x] T023 [P] [US4] Unit test for issue drift detection engine in `tests/unit/issue-drift.test.ts`

### Implementation for User Story 4
- [x] T024 [US4] Implement `checkIssueDrift` and `listIssues` in `src/issues/engine.ts`
- [x] T025 [US4] Register `mannostree issue status` and `mannostree issue list` CLI commands in `src/cli/commands/issue.ts`

**Checkpoint**: User Stories 1, 2, 3, and 4 functional.

---

## Phase 7: User Story 5 - Issue Tracker Health & Credentials Doctor Audit (Priority: P2)

**Goal**: Audit issue tracker adapter configuration, API token availability, and project permissions in `mannostree doctor`.

**Independent Test**: Run `mannostree doctor` and verify presence of issue tracker diagnostics section.

### Tests for User Story 5
- [x] T026 [P] [US5] Unit test for issue tracker doctor audits in `tests/unit/issue-doctor.test.ts`

### Implementation for User Story 5
- [x] T027 [US5] Implement `auditIssueTrackers()` diagnostic check in `src/core/doctor.ts`
- [x] T028 [US5] Update doctor CLI output renderer to format issue tracker diagnostics in `src/cli/output.ts`

**Checkpoint**: All 5 user stories functional and verified.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Export types, orchestrator integration, strict lint verification, full test suite pass rate, and documentation alignment

- [x] T029 [P] Export all Movement 10 types and issue engines in `src/issues/index.ts` and `src/index.ts`
- [x] T030 Integrate `IssueSyncEngine` into `MannostreeOrchestrator` in `src/core/orchestrator.ts`
- [x] T031 Run TypeScript compilation and strict lint checks via `npm run lint`
- [x] T032 Run full test suite with coverage reporting via `npm test`
- [x] T033 [P] Update CLI documentation and issue tracker examples in `README.md` and `GEMINI.md`
- [x] T034 Validate operator workflows per `specs/010-issue-tracker-sync/quickstart.md`

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
- Individual adapters (`T010`, `T011`, `T012`, `T013`) can be implemented in parallel.
- Unit test suites (`T006`, `T007`, `T008`, `T009`, `T016`, `T020`, `T023`, `T026`) can run in parallel.
- Polish documentation and exports (`T029`, `T033`) can run in parallel.
