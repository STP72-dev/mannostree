# Tasks: Movement 8 — Sandboxed Container Execution

**Input**: Design documents from `specs/008-sandboxed-container-execution/`  
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/cli-contract.md`, `quickstart.md`

## Format: `- [ ] [TaskID] [P?] [Story?] Description with file path`

- **[P]**: Parallelizable (independent file targets without uncommitted task dependencies)
- **[Story]**: User story identifier (`[US1]`, `[US2]`, `[US3]`, `[US4]`)
- Explicit target file paths specified for all tasks

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Configuration options and sandbox policy settings in `.mannostree.yml`

- [ ] T001 Extend `MannostreeConfigSchema` in `src/config/schema.ts` to support `sandbox` configuration section (default runtime, default image, network, limits, user namespace)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core domain types, Zod validation schemas, SandboxReceipt generator, and base SandboxRuntime interface

- [ ] T002 [P] Define core types for `SandboxRuntimeType`, `NetworkIsolationMode`, `SandboxResourceLimits`, `SandboxExecutionOptions`, `SandboxExecutionResult`, `SandboxReceipt`, and `SandboxHealthStatus` in `src/types/index.ts`
- [ ] T003 [P] Implement Zod validation schemas for `SandboxConfigSchema`, `SandboxResourceLimitsSchema`, `SandboxReceiptSchema`, and `SandboxHealthStatusSchema` in `src/metadata/schema.ts`
- [ ] T004 Implement `SandboxReceipt` generator and `.task/sandbox-receipt.json` disk writer in `src/sandbox/receipt.ts`
- [ ] T005 Implement `SandboxRuntime` base interface, common execution utilities, and `SandboxRegistry` in `src/sandbox/base.ts`

**Checkpoint**: Core types, schemas, and runtime registry ready — user story implementations can proceed.

---

## Phase 3: User Story 1 - Sandboxed In-Worktree Command Execution (Priority: P1) 🎯 MVP

**Goal**: Execute commands inside isolated Docker, Podman, or Process containers with resource quotas, network isolation, and UID preservation.

**Independent Test**: Execute `mannostree exec <id> --sandbox docker --image node:20-alpine "npm test"` and verify container creation, real-time streaming, UID ownership, and receipt generation.

### Tests for User Story 1
- [ ] T006 [P] [US1] Unit test for `ProcessRuntime` local execution fallback in `tests/unit/process-runtime.test.ts`
- [ ] T007 [P] [US1] Unit test for `DockerRuntime` argument construction, UID mapping, and resource capping in `tests/unit/docker-runtime.test.ts`
- [ ] T008 [P] [US1] Unit test for `PodmanRuntime` rootless and SELinux volume mounting in `tests/unit/podman-runtime.test.ts`
- [ ] T009 [P] [US1] Integration test for `mannostree exec` with sandbox execution in `tests/integration/sandbox-exec.test.ts`

### Implementation for User Story 1
- [ ] T010 [US1] Implement `ProcessRuntime` in `src/sandbox/process.ts`
- [ ] T011 [US1] Implement `DockerRuntime` in `src/sandbox/docker.ts`
- [ ] T012 [US1] Implement `PodmanRuntime` in `src/sandbox/podman.ts`
- [ ] T013 [US1] Implement default sandbox factory `createDefaultSandboxRegistry()` in `src/sandbox/index.ts`
- [ ] T014 [US1] Integrate `SandboxRegistry` into `ExecEngine` and `MannostreeOrchestrator.exec` in `src/core/exec.ts` and `src/core/orchestrator.ts`
- [ ] T015 [US1] Update `mannostree exec` CLI command options (`--sandbox`, `--image`, `--cpus`, `--memory`, `--network`, `--timeout`, `--dry-run`) in `src/cli/commands/exec.ts`

**Checkpoint**: User Story 1 functional and testable (MVP complete).

---

## Phase 4: User Story 2 - Sandboxed Agent Dispatch & Quality Gates (Priority: P1)

**Goal**: Encapsulate autonomous coding agent runs and quality gate verifications within isolated container runtimes.

**Independent Test**: Run `mannostree agent dispatch <id> --sandbox docker` and verify that the agent loop, shell commands, and quality gates execute within the container with results recorded in `.task/`.

### Tests for User Story 2
- [ ] T016 [P] [US2] Unit test for sandboxed agent dispatch and quality gate runner in `tests/unit/sandbox-agent.test.ts`

### Implementation for User Story 2
- [ ] T017 [US2] Integrate `SandboxRegistry` into `AgentRunner.dispatch` and `AgentRunner.run` in `src/core/agent.ts`
- [ ] T018 [US2] Update `mannostree agent dispatch` and `agent run` CLI commands with sandbox flags in `src/cli/commands/agent.ts`

**Checkpoint**: User Stories 1 and 2 functional.

---

## Phase 5: User Story 3 - Clean-Room Parallel Benchmark Evaluation (Priority: P2)

**Goal**: Run multi-variant benchmark evaluation matrices (`parallel eval`) in reproducible clean-room containers.

**Independent Test**: Run `mannostree parallel eval <feature> --sandbox docker --cpus 2.0` and verify probe execution in isolated containers with WSM score compilation.

### Tests for User Story 3
- [ ] T019 [P] [US3] Unit test for clean-room parallel benchmark matrix eval in `tests/unit/sandbox-matrix-eval.test.ts`

### Implementation for User Story 3
- [ ] T020 [US3] Integrate `SandboxRegistry` into `MatrixEvaluator.evaluateVariants` in `src/core/matrix-eval.ts`
- [ ] T021 [US3] Update `mannostree parallel eval` CLI command with sandbox options in `src/cli/commands/parallel.ts`

**Checkpoint**: User Stories 1, 2, and 3 functional.

---

## Phase 6: User Story 4 - Sandbox Runtime Diagnostics & Doctor Audits (Priority: P2)

**Goal**: Audit container runtimes (Docker, Podman) and daemon status in `mannostree doctor`.

**Independent Test**: Run `mannostree doctor` and verify presence of container sandbox diagnostics and cgroup status.

### Tests for User Story 4
- [ ] T022 [P] [US4] Unit test for sandbox doctor diagnostic checks in `tests/unit/sandbox-doctor.test.ts`

### Implementation for User Story 4
- [ ] T023 [US4] Implement `auditSandboxRuntimes()` diagnostic check in `src/core/doctor.ts`
- [ ] T024 [US4] Update doctor CLI output renderer to format sandbox runtime diagnostics in `src/cli/output.ts`

**Checkpoint**: All 4 user stories functional and verified.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Export types, strict lint verification, full test suite pass rate, and documentation alignment

- [ ] T025 [P] Export all Movement 8 types and sandbox drivers in `src/index.ts`
- [ ] T026 Run TypeScript compilation and strict lint checks via `npm run lint`
- [ ] T027 Run full test suite with coverage reporting via `npm test`
- [ ] T028 [P] Update CLI documentation and container sandbox examples in `README.md` and `GEMINI.md`
- [ ] T029 Validate operator workflows per `specs/008-sandboxed-container-execution/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies
- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories.
- **User Story 1 (Phase 3 - P1)**: Depends on Foundational (MVP).
- **User Story 2 (Phase 4 - P1)**: Depends on Foundational + US1.
- **User Story 3 (Phase 5 - P2)**: Depends on Foundational + US1.
- **User Story 4 (Phase 6 - P2)**: Depends on Foundational + US1.
- **Polish (Phase 7)**: Depends on completion of all user story implementations.

### Parallel Opportunities
- Types and schemas (`T002`, `T003`) can run in parallel.
- Runtime driver unit tests (`T006`, `T007`, `T008`, `T009`) can run concurrently.
- Polish documentation and exports (`T025`, `T028`) can run in parallel.
