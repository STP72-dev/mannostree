# Tasks: Autonomous Agent Contract Runner & Task Dispatch Engine

**Input**: Design documents from `specs/002-agent-contract-runner/`  
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/cli-contract.md`, `quickstart.md`

## Format: `- [ ] [TaskID] [P?] [Story?] Description with file path`

- **[P]**: Parallelizable (independent file targets without uncommitted task dependencies)
- **[Story]**: User story identifier (`[US1]`, `[US2]`, `[US3]`, `[US4]`, `[US5]`)
- Explicit target file paths specified for all tasks

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and configuration schema for agent runner and session persistence

- [X] T001 Initialize agent configuration schema (command template, timeout, env passthrough) in `src/config/schema.ts`
- [X] T002 [P] Add session storage directory scaffold helper in `src/artifact/scaffold.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core type models, validation schemas, and session persistence foundation required across all user stories

- [X] T003 [P] Define core types for TaskContract, AgentSessionRecord, QualityGateSpec, ExecutionScorecard, and FulfillmentVerificationReport in `src/types/index.ts`
- [X] T004 [P] Implement Zod validation schemas for agent sessions, contracts, quality gates, and scorecards in `src/metadata/schema.ts`
- [X] T005 Implement session record store methods (`saveSession`, `getSession`, `listSessions`) in `src/metadata/store.ts`

**Checkpoint**: Core types, validation schemas, and session storage ready — user story implementation can proceed.

---

## Phase 3: User Story 1 - Task Contract Initialization & Worker Dispatch (Priority: P1) 🎯 MVP

**Goal**: Automatically provision `.task/task-contract.md`, interpolate command templates, dispatch worker agents in isolated worktree sandboxes, and transition state to `dispatched`.

**Independent Test**: Spawn an isolated worktree, run `mannostree agent dispatch` with requirements, and verify that `.task/task-contract.md` is created, the process is launched, and worktree metadata reflects `dispatched`.

### Tests for User Story 1
- [X] T006 [P] [US1] Unit test for task contract generation and template parsing in `tests/unit/contract-parser.test.ts`
- [X] T007 [P] [US1] Integration test for single worktree agent dispatch via CLI in `tests/integration/agent-dispatch.test.ts`

### Implementation for User Story 1
- [X] T008 [US1] Implement task contract parser, markdown template generator, and checkbox reader in `src/core/contract.ts`
- [X] T009 [US1] Implement agent command template interpolator and process launcher in `src/core/agent-runner.ts`
- [X] T010 [US1] Implement `mannostree agent dispatch` CLI command in `src/cli/commands/agent.ts`

**Checkpoint**: User Story 1 fully functional and independently testable.

---

## Phase 4: User Story 2 - Multi-Role Agent Execution & Sandbox Containment (Priority: P1)

**Goal**: Confine worker execution strictly within the target worktree path, track granular lifecycle states (`planning`, `working`, `verifying`), and handle process cancellation safely.

**Independent Test**: Dispatch an agent, observe lifecycle state transitions in metadata, attempt an out-of-bounds path write, verify process containment, and cancel the run while preserving uncommitted worktree changes.

### Tests for User Story 2
- [X] T011 [P] [US2] Unit test for process containment, timeout limits, and lifecycle tracking in `tests/unit/agent-runner.test.ts`
- [X] T012 [P] [US2] Integration test for agent lifecycle transitions and safe cancellation in `tests/integration/agent-dispatch.test.ts`

### Implementation for User Story 2
- [X] T013 [US2] Implement working directory containment, boundary path validator, and timeout watchdog in `src/core/agent-runner.ts`
- [X] T014 [US2] Implement real-time agent lifecycle state transitions in `src/core/agent-runner.ts` and `src/core/orchestrator.ts`
- [X] T015 [US2] Implement `mannostree agent cancel` command and non-destructive abort handler in `src/cli/commands/agent.ts`

**Checkpoint**: User Stories 1 and 2 functional and sandboxed.

---

## Phase 5: User Story 3 - Objective Contract Fulfillment & Quality Gatekeeper (Priority: P2)

**Goal**: Independently verify that 100% of acceptance criteria checkboxes are marked complete and execute all automated quality gates (`.task/quality-gates.md`), outputting failure diagnostics on rejection.

**Independent Test**: Run `mannostree agent verify` on a workspace with unchecked criteria or failing tests; verify fulfillment rejection with diagnostic output in `.task/review.md`. Check off all criteria, fix tests, re-verify, and confirm `fulfilled` certification.

### Tests for User Story 3
- [X] T016 [P] [US3] Unit test for quality gate command execution and failure logging in `tests/unit/quality-gates.test.ts`
- [X] T017 [P] [US3] Integration test for contract verification, fulfillment rejection, and diagnostic reporting in `tests/integration/agent-fulfillment.test.ts`

### Implementation for User Story 3
- [X] T018 [US3] Implement quality gate runner (build, lint, test execution with retry support) in `src/core/quality-gates.ts`
- [X] T019 [US3] Implement contract fulfillment validator and review diagnostic compiler in `src/core/contract.ts`
- [X] T020 [US3] Implement `mannostree agent verify` CLI command in `src/cli/commands/agent.ts`

**Checkpoint**: User Stories 1, 2, and 3 functional and gatekeeper verified.

---

## Phase 6: User Story 4 - Standardized Execution Scorecards & Metric Aggregation (Priority: P2)

**Goal**: Automatically aggregate test pass counts, code diff statistics (insertions/deletions), and execution duration into `.task/scorecard.md` and session metadata for objective variant comparison.

**Independent Test**: Complete a verified agent run, inspect `.task/scorecard.md`, and verify structured metric output via `mannostree agent status`.

### Tests for User Story 4
- [X] T021 [P] [US4] Unit test for execution scorecard generation and git diff metric calculation in `tests/unit/contract-parser.test.ts`
- [X] T022 [P] [US4] Integration test for scorecard compilation during verification flow in `tests/integration/agent-fulfillment.test.ts`

### Implementation for User Story 4
- [X] T023 [US4] Implement execution scorecard compiler and markdown report generator in `src/core/contract.ts`
- [X] T024 [US4] Update `mannostree agent status` and `mannostree info` to display scorecard metrics in `src/cli/commands/agent.ts` and `src/cli/commands/info.ts`

**Checkpoint**: User Stories 1, 2, 3, and 4 functional with metric tracking.

---

## Phase 7: User Story 5 - Parallel Dispatch & Fleet Progress Dashboard (Priority: P3)

**Goal**: Concurrently dispatch worker sessions across all variants of a parallel experiment and provide a real-time fleet progress dashboard.

**Independent Test**: Create a 3-variant parallel experiment, run `mannostree agent dispatch <feature> --parallel`, and verify that all 3 variants execute concurrently and appear in the fleet progress table.

### Tests for User Story 5
- [X] T025 [P] [US5] Unit test for parallel experiment dispatch coordination in `tests/unit/agent-runner.test.ts`
- [X] T026 [P] [US5] Integration test for concurrent multi-variant parallel dispatch and fleet monitoring in `tests/integration/agent-dispatch.test.ts`

### Implementation for User Story 5
- [X] T027 [US5] Implement parallel experiment agent dispatcher in `src/core/agent-runner.ts` and `src/core/orchestrator.ts`
- [X] T028 [US5] Implement fleet progress table formatter in `src/cli/output.ts` and integrate with `src/cli/commands/agent.ts`

**Checkpoint**: All user stories (1 through 5) functional and integrated.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Type safety, strict lint verification, full test suite coverage, and documentation alignment

- [X] T029 [P] Export all agent types, runners, and commands in `src/index.ts` and `src/cli/index.ts`
- [X] T030 Run TypeScript compilation and strict lint checks via `npm run lint`
- [X] T031 Run full test suite with coverage reporting via `npm run coverage`
- [X] T032 [P] Update CLI documentation and examples in `docs/` and `README.md`
- [X] T033 Validate operator workflows per `specs/002-agent-contract-runner/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies
- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user story phases.
- **User Story 1 (Phase 3 - P1)**: Depends on Foundational — MVP baseline.
- **User Story 2 (Phase 4 - P1)**: Depends on Foundational + US1.
- **User Story 3 (Phase 5 - P2)**: Depends on Foundational + US1.
- **User Story 4 (Phase 6 - P2)**: Depends on Foundational + US3.
- **User Story 5 (Phase 7 - P3)**: Depends on Foundational + US1.
- **Polish (Phase 8)**: Depends on completion of target user stories.

### Parallel Opportunities
- Foundational types and schemas (`T003`, `T004`) can be implemented concurrently.
- Test tasks within each story phase (`T006`/`T007`, `T011`/`T012`, `T016`/`T017`, `T021`/`T022`, `T025`/`T026`) can be authored concurrently before implementation.
- User Story 3 (Quality Gatekeeper) and User Story 5 (Parallel Dispatch) can proceed concurrently once US1 completes.

---

## Implementation Strategy

### MVP First (User Story 1 Baseline)
1. Complete **Phase 1: Setup** (`T001`-`T002`).
2. Complete **Phase 2: Foundational** (`T003`-`T005`).
3. Complete **Phase 3: User Story 1** (`T006`-`T010`).
4. **VALIDATE**: Run `npm test` on `contract-parser` and `agent-dispatch` test suites.

### Incremental Feature Expansion
1. Add **User Story 2 (Sandbox Containment & Lifecycle)** (`T011`-`T015`).
2. Add **User Story 3 (Contract Fulfillment & Quality Gates)** (`T016`-`T020`).
3. Add **User Story 4 (Scorecards & Metrics)** (`T021`-`T024`).
4. Add **User Story 5 (Parallel Fleet Dispatch)** (`T025`-`T028`).
5. Complete **Phase 8: Polish** (`T029`-`T033`).
