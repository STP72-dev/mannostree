# Feature Specification: Autonomous Agent Contract Runner & Worker Task Dispatch Engine

**Feature Branch**: `002-agent-contract-runner`  
**Created**: 2026-09-01  
**Status**: Draft  
**Input**: User description: "Movement 1: Autonomous Agent Contract Runner & Worker Task Dispatch Engine (mannostree agent dispatch, contract fulfillment verification, structured scorecards)"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Task Contract Initialization & Worker Dispatch (Priority: P1) 🎯 MVP

A developer wants to delegate a coding task or exploration across one or more isolated worktrees. Instead of manually explaining requirements in interactive chat, the developer issues a dispatch command. The system generates an actionable task contract file containing problem scope, explicit acceptance criteria, and quality gates, initializes the workspace sandbox, and launches the assigned worker agent with clear operating boundaries.

**Why this priority**: Eliminates manual context switching and provides an unambiguous, durable specification bridge between developer intent and autonomous agent execution.

**Independent Test**: Can be tested by creating an isolated workspace, running an agent dispatch command with a task description, verifying that a structured `.task/task-contract.md` is populated, the workspace lifecycle state transitions to `dispatched`, and the worker agent receives the contract in its sandbox.

**Acceptance Scenarios**:

1. **Given** an isolated worktree created from an explicit base branch, **When** the developer dispatches a task with title, requirements, and quality criteria, **Then** the system writes a standardized task contract into `.task/task-contract.md` and transitions the worktree lifecycle state to `dispatched`.
2. **Given** an existing task contract in a worktree, **When** the developer inspects the dispatch status, **Then** the system displays the assigned role, active state, task contract path, and elapsed execution time.
3. **Given** a worktree with an active dispatch, **When** the worker begins execution, **Then** the system records the agent session ID in worktree metadata without allowing modifications to branches or registry outside the sandbox.

---

### User Story 2 - Multi-Role Agent Execution & Sandbox Containment (Priority: P1)

When autonomous agents implement complex features, they operate in structured stages (such as planning, implementing, and verifying). The system must track each lifecycle transition in metadata, guarantee that the agent cannot escape its worktree directory, and log all tool interactions and console outputs into durable workspace logs.

**Why this priority**: Enforces project security and state integrity, ensuring worker agents cannot corrupt repository-level metadata or leak changes into sibling worktrees.

**Independent Test**: Can be tested by simulating an agent session transitioning across planning, working, and verifying states, attempting a file operation targeting the parent repository root, and verifying that the out-of-bounds operation is rejected while lifecycle transitions are recorded in metadata.

**Acceptance Scenarios**:

1. **Given** an agent running inside a worktree sandbox, **When** the agent transitions between planning, implementing, and verifying, **Then** the worktree metadata updates in real-time to reflect the active lifecycle phase (`planning`, `working`, `verifying`).
2. **Given** an executing agent, **When** any file modification or command is invoked, **Then** the system strictly confines execution to the target worktree root path, preventing writes to `.git`, `.mannostree`, or sibling worktrees.
3. **Given** an unexpected agent termination or error, **When** the session halts, **Then** the system captures the failure reason in `.task/review.md` and flags the worktree state as `execution_failed` while preserving all uncommitted changes for forensics.

---

### User Story 3 - Objective Contract Fulfillment & Quality Gatekeeper (Priority: P2)

Once a worker agent signals task completion, the system must independently verify that all acceptance criteria checkboxes in `.task/task-contract.md` are marked complete, all mandatory quality gates in `.task/quality-gates.md` (build, lint, unit tests) have passed, and no uncommitted scratch files remain in an invalid state.

**Why this priority**: Guarantees that completed agent tasks meet strict quality and functional standards before human review, winner selection, or PR creation.

**Independent Test**: Can be tested by providing a workspace with passing tests and fully checked contract items, running fulfillment verification, observing a `fulfilled` status, and comparing against a workspace with failing tests where fulfillment is rejected with specific unmet criteria.

**Acceptance Scenarios**:

1. **Given** a workspace where all contract acceptance criteria are marked complete and all configured quality gates pass, **When** contract verification is evaluated, **Then** the system certifies the workspace as `fulfilled` and marks it ready for comparison and review.
2. **Given** a workspace where one or more acceptance criteria are unchecked or a quality gate test fails, **When** contract verification is evaluated, **Then** the system rejects fulfillment, records the specific unmet criteria in `.task/review.md`, and transitions the state to `fulfillment_rejected`.
3. **Given** a rejected contract, **When** the developer or a follow-up agent fixes the issues and re-evaluates verification, **Then** the system re-runs quality checks and updates the status to `fulfilled` once all conditions are met.

---

### User Story 4 - Standardized Execution Scorecards & Metric Aggregation (Priority: P2)

To evaluate and compare agent efficiency across parallel variants, the system compiles a structured scorecard. This scorecard aggregates execution duration, lines of code added/removed, test pass rates, test execution times, lint warnings, and estimated operational resource usage.

**Why this priority**: Provides quantitative, evidence-backed metrics for side-by-side variant comparison, enabling objective winner selection.

**Independent Test**: Can be tested by running verification on a completed workspace, verifying that `.task/scorecard.md` and `.mannostree/worktrees/<id>.json` are populated with structured execution metrics including test counts, code diff statistics, and execution duration.

**Acceptance Scenarios**:

1. **Given** a completed agent execution, **When** verification completes, **Then** the system compiles a detailed `.task/scorecard.md` summarizing build status, test pass counts, code changes (additions/deletions), and execution time.
2. **Given** compiled scorecards across multiple variants, **When** the developer queries variant info, **Then** the system presents scorecard metrics in both human-readable and structured machine-readable formats.

---

### User Story 5 - Parallel Dispatch & Fleet Progress Dashboard (Priority: P3)

When running an experiment with multiple parallel variants (e.g. 3 alternative implementations of a feature), the developer needs to dispatch tasks to all variants simultaneously and monitor fleet progress from a single consolidated dashboard.

**Why this priority**: Maximizes development velocity by enabling concurrent exploration of alternative technical designs with real-time status visibility.

**Independent Test**: Can be tested by spawning a 3-variant experiment, running parallel dispatch with a single command, and observing real-time progress tracking for all 3 variants from the fleet dashboard.

**Acceptance Scenarios**:

1. **Given** a parallel experiment with N variants, **When** the developer issues a parallel dispatch command, **Then** the system instantiates task contracts across all variant worktrees and initiates concurrent worker sessions.
2. **Given** N running variant sessions, **When** the developer views the parallel status, **Then** the system renders a real-time table displaying current stage, active contract items, and health status for every variant in the experiment.

---

### Edge Cases

- **Agent Timeout / Infinite Loop**: If an agent process exceeds the configured timeout threshold without emitting progress, the system terminates the process, marks the session as `timed_out`, and preserves the workspace files for review.
- **Contract Modification Tampering**: If an agent deletes or corrupts the task contract structure rather than checking off criteria, fulfillment verification detects schema corruption, rejects the run, and flags the anomaly.
- **Flaky Quality Gate Tests**: If a quality gate test suite fails intermittently, the verification command supports a bounded retry count (`--retries N`) before declaring gate failure.
- **Missing Test Suite in Worktree**: If a task contract requires quality gate verification but no test script is configured, the system flags a missing configuration warning and halts without assuming a false-positive pass.
- **Concurrent Dispatch Conflict**: If a dispatch command is issued to an already active workspace, the system refuses to overwrite the running session unless explicitly cancelled or forced.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST support creating and updating structured task contracts in `.task/task-contract.md` with problem description, scope, acceptance criteria checklist, and quality gates.
- **FR-002**: System MUST provide a command (`mannostree agent dispatch`) to initiate agent execution sessions for single worktrees or parallel experiment groups.
- **FR-003**: System MUST track granular agent lifecycle states (`dispatched`, `planning`, `working`, `verifying`, `fulfilled`, `execution_failed`, `fulfillment_rejected`).
- **FR-004**: System MUST strictly isolate worker execution within the designated worktree filesystem path, preventing out-of-bounds filesystem modifications.
- **FR-005**: System MUST verify that 100% of acceptance criteria checklist items in `.task/task-contract.md` are marked complete before certifying contract fulfillment.
- **FR-006**: System MUST execute and validate all quality gates defined in `.task/quality-gates.md` (e.g. compilation, linting, unit tests) during contract fulfillment verification.
- **FR-007**: System MUST record detailed failure explanations in `.task/review.md` whenever verification rejects a task contract or encounters quality gate failures.
- **FR-008**: System MUST generate a structured `.task/scorecard.md` capturing test pass counts, code diff statistics, and execution duration upon completion.
- **FR-009**: System MUST support configurable execution timeout limits, terminating runaway agent processes safely and recording timeout diagnostics.
- **FR-010**: System MUST support concurrent dispatch across all variants of a parallel experiment group.
- **FR-011**: System MUST provide a real-time progress inspection command (`mannostree agent status`) displaying active contract items and stage for all active sessions.
- **FR-012**: System MUST preserve all uncommitted workspace changes when an agent session fails or is aborted, preventing data loss.
- **FR-013**: System MUST support non-interactive execution mode (`--json`) for all agent dispatch, status, and verification commands.
- **FR-014**: System MUST support a preview mode (`--dry-run`) indicating planned contract generation and command dispatches without modifying files or spawning processes.

---

### Key Entities

- **Task Contract**: A durable document (`.task/task-contract.md`) specifying the problem scope, inputs, acceptance criteria checklist (`- [ ]`), quality gates, and safety constraints.
- **Agent Dispatch Session**: A record tracking an active or past agent execution, containing session ID, agent role (planner, worker, verifier), target worktree path, start time, end time, current lifecycle state, and exit code.
- **Quality Gate Specification**: A structured record (`.task/quality-gates.md`) detailing automated validation commands (build, lint, test, coverage threshold) and their passing conditions.
- **Execution Scorecard**: A structured report (`.task/scorecard.md`) capturing quantitative outcomes, including test pass/fail counts, lines of code changed, execution time, and lint results.
- **Review Artifact**: A diagnostic file (`.task/review.md`) capturing review findings, unmet acceptance criteria, failing test output, and actionable remediation instructions.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of dispatched tasks generate a valid, schema-compliant `.task/task-contract.md` before execution begins.
- **SC-002**: Zero unauthorized file writes or git reference modifications outside the target worktree sandbox across all agent runs.
- **SC-003**: 100% of incomplete acceptance criteria or failing quality gates are caught by fulfillment verification and reported with actionable remediation in `.task/review.md`.
- **SC-004**: 100% of fulfilled tasks produce a complete `.task/scorecard.md` containing verifiable test results and diff statistics.
- **SC-005**: Parallel dispatch to up to 5 concurrent variants initiates and tracks all sessions without race conditions or metadata collisions.
- **SC-006**: Dispatch, status, and verification commands execute and return status in under 1.5 seconds (excluding the agent's internal coding duration).

---

## Assumptions

1. **Agent Integration Interface**: Worker agents interact with worktrees via standard filesystem tools, shell commands, or agent adapters that read `.task/task-contract.md`.
2. **Quality Gate Tooling**: Project build and test commands are configured in `.mannostree.yml` or discoverable via project metadata (`package.json`, `Makefile`, etc.).
3. **Sandbox Enforcement**: Filesystem and command boundaries are enforced at the process working directory and path resolution layer.
4. **Non-Destructive Failure**: Failed agent runs leave workspace files intact for human inspection and recovery.
