# Tasks: Movement 7 — Multi-Host Adapters

**Input**: Design documents from `specs/007-multi-host-adapters/`  
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/cli-contract.md`, `quickstart.md`

## Format: `- [ ] [TaskID] [P?] [Story?] Description with file path`

- **[P]**: Parallelizable (independent file targets without uncommitted task dependencies)
- **[Story]**: User story identifier (`[US1]`, `[US2]`, `[US3]`, `[US4]`)
- Explicit target file paths specified for all tasks

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Configuration options and multi-host domain mappings

- [X] T001 Extend `MannostreeConfigSchema` in `src/config/schema.ts` to support `publish.default_host` and `publish.hosts` dictionary mappings

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core domain types, Zod schemas, URL detector, and HostAdapter base registry

- [X] T002 [P] Define core types for `HostAdapterType`, `RemoteHostInfo`, `HostPublishOptions`, `HostPublishResult`, and `HostHealthStatus` in `src/types/index.ts`
- [X] T003 [P] Implement Zod validation schemas for `HostConfigEntrySchema` and `HostPublishResultSchema` in `src/metadata/schema.ts`
- [X] T004 Implement zero-dependency remote URL parser `parseRemoteUrl` and domain detector in `src/adapters/detector.ts`
- [X] T005 Implement `HostAdapter` base interface, common helper methods, and `AdapterRegistry` in `src/adapters/base.ts`

**Checkpoint**: Core types, URL parser, and adapter registry ready — user story implementations can proceed.

---

## Phase 3: User Story 1 & 2 - Remote Host Auto-Detection & Native GitLab Adapter (Priority: P1) 🎯 MVP

**Goal**: Seamless remote host detection and native PR/MR creation for GitHub, GitLab, and Generic Git remotes.

**Independent Test**: Configure GitLab and GitHub remotes, execute `mannostree pr <id> --preview` and `mannostree parallel publish <feature> --draft` to verify host auto-detection, GitLab MR formatting, and PR/MR opening.

### Tests for User Story 1 & 2
- [X] T006 [P] [US1] Unit test for remote URL parsing across SSH, HTTPS, custom ports, and self-hosted domains in `tests/unit/host-detector.test.ts`
- [X] T007 [P] [US2] Unit test for GitLab Merge Request creation (REST API v4, `glab` CLI fallback, draft mode) in `tests/unit/gitlab-adapter.test.ts`
- [X] T008 [P] [US1] Integration test for `mannostree pr` and `mannostree parallel publish` with multi-host routing in `tests/integration/multi-host-cli.test.ts`

### Implementation for User Story 1 & 2
- [X] T009 [US1] Implement `GitHubAdapter` (with `gh` CLI and REST fallback) in `src/adapters/github.ts`
- [X] T010 [US2] Implement `GitLabAdapter` (with `glab` CLI and GitLab v4 REST API) in `src/adapters/gitlab.ts`
- [X] T011 [US1] Implement `GenericAdapter` (git push and local markdown export) in `src/adapters/generic.ts`
- [X] T012 [US1] Integrate `AdapterRegistry` into `PublishEngine.publishPr` and `PublishEngine.batchPublish` in `src/core/publish.ts`
- [X] T013 [US1] Integrate multi-host routing into `ParallelEngine.publishWinner` in `src/core/parallel.ts`
- [X] T014 [US1] Update CLI commands `pr`, `parallel publish`, `fleet publish` to support `--host <type>` and `--remote <name>` in `src/cli/commands/pr.ts`, `src/cli/commands/parallel.ts`, and `src/cli/commands/fleet.ts`

**Checkpoint**: User Stories 1 and 2 functional and testable (MVP complete).

---

## Phase 4: User Story 3 - Gitea/Forgejo & Bitbucket Adapters (Priority: P2)

**Goal**: Native PR creation for Gitea/Forgejo and Atlassian Bitbucket repositories.

**Independent Test**: Configure Gitea and Bitbucket remote endpoints, run publish preview and execution tests, and verify correct API payload delivery and response handling.

### Tests for User Story 3
- [X] T015 [P] [US3] Unit test for Gitea / Forgejo PR adapter in `tests/unit/gitea-adapter.test.ts`
- [X] T016 [P] [US3] Unit test for Bitbucket Cloud and Server PR adapter in `tests/unit/bitbucket-adapter.test.ts`

### Implementation for User Story 3
- [X] T017 [US3] Implement `GiteaAdapter` (Gitea v1 REST API + `tea` CLI fallback) in `src/adapters/gitea.ts`
- [X] T018 [US3] Implement `BitbucketAdapter` (Bitbucket 2.0 REST API) in `src/adapters/bitbucket.ts`
- [X] T019 [US3] Register Gitea and Bitbucket adapters in `AdapterRegistry` in `src/adapters/base.ts`

**Checkpoint**: User Stories 1, 2, and 3 functional.

---

## Phase 5: User Story 4 - Multi-Host Credential Resolution & Doctor Diagnostics (Priority: P2)

**Goal**: Audit host adapter configuration, token environment variables, and CLI binary availability in `mannostree doctor`.

**Independent Test**: Run `mannostree doctor` with various combinations of missing/present environment tokens and CLI tools, verifying accurate diagnostic findings and remediation advice.

### Tests for User Story 4
- [X] T020 [P] [US4] Unit test for multi-host doctor diagnostics in `tests/unit/host-doctor.test.ts`

### Implementation for User Story 4
- [X] T021 [US4] Implement `auditHostAdapters` diagnostic check in `src/core/doctor.ts`
- [X] T022 [US4] Update doctor CLI output renderer to format host adapter health reports in `src/cli/commands/doctor.ts`

**Checkpoint**: All 4 user stories functional and verified.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Export types, strict lint verification, full test suite pass rate, and documentation alignment

- [X] T023 [P] Export all Movement 7 types and adapters in `src/index.ts`
- [X] T024 Run TypeScript compilation and strict lint checks via `npm run lint`
- [X] T025 Run full test suite with coverage reporting via `npm test`
- [X] T026 [P] Update CLI documentation and multi-host examples in `README.md`
- [X] T027 Validate operator workflows per `specs/007-multi-host-adapters/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies
- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories.
- **User Story 1 & 2 (Phase 3 - P1)**: Depends on Foundational.
- **User Story 3 (Phase 4 - P2)**: Depends on Foundational + US1.
- **User Story 4 (Phase 5 - P2)**: Depends on Foundational + US1/US2/US3.
- **Polish (Phase 6)**: Depends on completion of all user story implementations.

### Parallel Opportunities
- Domain types and schemas (`T002`, `T003`) can run in parallel.
- Test suites across stories (`T006`/`T007`/`T008`, `T015`/`T016`, `T020`) can be authored concurrently.
- Gitea (`T017`) and Bitbucket (`T018`) adapters can be implemented concurrently.
