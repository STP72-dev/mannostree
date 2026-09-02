# Feature Specification: Movement 8 — Sandboxed Container Execution

**Feature Branch**: `008-sandboxed-container-execution`  
**Created**: 2026-09-02T10:49:15+02:00  
**Status**: DRAFT  
**Priority**: P1 (Safety, Resource Capping & Clean-Room Reproducibility)

---

## 1. Purpose & Problem Statement

Autonomous coding agents and parallel benchmark evaluation suites execute arbitrary scripts, test suites, and build steps directly on host machines. Without isolation:
1. **Host Contamination**: Unrestricted file mutations, stray background daemons, or lingering processes can corrupt the developer machine or other active worktrees.
2. **Resource Starvation**: Unbounded agent compilation or benchmark processes can consume 100% of CPU and host RAM, freezing system responsiveness.
3. **Inconsistent Environments**: Benchmark probes and test evaluations yield nondeterministic results when depending on host-installed tools, environment variations, or network state.
4. **Security & Supply Chain Exposure**: Running untrusted AI-generated code or pulling third-party packages directly on the host poses significant security risks.

**Movement 8** introduces pluggable, container-backed sandbox execution runtimes (supporting Docker, Podman, microVMs, and unconstrained local process fallbacks) with strict CPU/memory caps, network policy controls, ephemeral container lifecycle management, and durable execution receipts.

---

## 2. User Personas & Target Users

- **Autonomous Agent Runners**: Dispatch AI agents into isolated, ephemeral containers mounted cleanly to their dedicated worktree directory with deterministic constraints.
- **Performance Engineers & Benchmark Analysts**: Run multi-variant benchmark matrices (`parallel eval`) in identical, clean-room containerized environments to ensure fair, unbiased performance scoring.
- **Platform & Security Engineers**: Enforce strict system safety policies (e.g., airgapped network mode, read-only root filesystems, capped RAM/CPU quotas) across all fleet workspaces.
- **Core CLI Developers**: Seamlessly debug commands inside containerized environments across local workstations and CI environments.

---

## 3. User Scenarios & Acceptance Criteria

### User Story 1: Sandboxed In-Worktree Command Execution (Priority: P1 - MVP)
As a developer or autonomous agent operator,  
I want to execute commands inside an isolated container mounted to a specific worktree,  
So that my build or test operations cannot pollute the host OS or exceed hardware resource budgets.

- **Acceptance Scenario 1.1 (Container Execution)**:  
  Given an active worktree `feature-auth`,  
  When I run `mannostree exec feature-auth --sandbox docker --image node:20-alpine "npm test"`,  
  Then the command executes inside an ephemeral container with the worktree mounted to the working directory,  
  And outputs standard output and error in real-time,  
  And safely removes the container upon completion.

- **Acceptance Scenario 1.2 (Resource Constraints & Enforcement)**:  
  Given resource limits specified via CLI or `.mannostree.yml` (e.g., `--cpus 2 --memory 2GB --timeout 300s`),  
  When a sandboxed task runs,  
  Then the runtime enforces CPU and RAM throttling,  
  And if the process exceeds memory limits (OOM) or timeout limits, it is terminated cleanly with a structured error envelope and exit code.

- **Acceptance Scenario 1.3 (Network Isolation Policies)**:  
  Given network policy `--network none` (airgapped) or `--network host`,  
  When a sandboxed task runs,  
  Then external network connectivity is restricted according to the selected policy.

---

### User Story 2: Sandboxed Autonomous Agent Dispatch & Quality Gates (Priority: P1)
As an agent coordinator,  
I want agent workflows (`agent dispatch` / `agent run`) to execute within sandboxed containers,  
So that agent file operations and verification gates remain strictly contained within their assigned worktree.

- **Acceptance Scenario 2.1 (Sandboxed Agent Execution)**:  
  Given a task contract in `.task/task-contract.md` in worktree `feature-payment`,  
  When running `mannostree agent dispatch feature-payment --sandbox docker --image node:20-alpine`,  
  Then the agent loop and verification commands run inside the sandbox,  
  And quality gate results are recorded in `.task/quality-gates.md`.

- **Acceptance Scenario 2.2 (Execution Receipts)**:  
  When a sandboxed agent run finishes,  
  Then an execution receipt is persisted in `.task/sandbox-receipt.json` containing runtime duration, exit code, peak memory usage, CPU time, and sandbox runtime metadata.

---

### User Story 3: Clean-Room Parallel Benchmark Evaluation (Priority: P2)
As an engineer evaluating competing parallel algorithm variants,  
I want benchmark evaluations (`parallel eval`) to run inside isolated, clean containers,  
So that scoring results are free from host background noise, cache biases, and environmental discrepancies.

- **Acceptance Scenario 3.1 (Sandboxed Benchmark Probing)**:  
  Given parallel experiment variants `experiment/sort-v1` and `experiment/sort-v2`,  
  When executing `mannostree parallel eval sort-algo --sandbox docker --image rust:1.75`,  
  Then benchmark probes execute inside dedicated clean-room containers sequentially or in parallel,  
  And performance scores and WSM composite metrics reflect clean-room container execution.

---

### User Story 4: Sandbox Runtime Diagnostics & Doctor Audits (Priority: P2)
As a systems operator,  
I want `mannostree doctor` to audit installed container runtimes and daemon health,  
So that I can identify permission issues, missing daemon connections, or unsupported cgroup settings before starting work.

- **Acceptance Scenario 4.1 (Doctor Sandbox Health Audit)**:  
  When running `mannostree doctor`,  
  Then the report checks availability and status of Docker, Podman, and container runtime CLI binaries,  
  And outputs clear diagnostic warnings if the container socket is inaccessible.

---

## 4. Functional Requirements

- **`FR-001` (Pluggable Sandbox Runtime Interface)**: The system must define an extensible `SandboxRuntime` interface supporting `run(options)` with implementations for `DockerRuntime`, `PodmanRuntime`, and `ProcessRuntime` (local fallback).
- **`FR-002` (Worktree Volume Mounting)**: The system must mount the target worktree path as the container workspace (`/workspace` by default) with configurable read-write or read-only permissions and persistent user ID mapping (`--user uid:gid`).
- **`FR-003` (Resource Quotas)**: The system must support configurable CPU ceilings (e.g. `2.0`), memory quotas (e.g. `1GB`, `4096MB`), and disk limits passed to the container runtime.
- **`FR-004` (Network Policies)**: The system must support network isolation modes (`none`, `bridge`, `host`, `egress-only`).
- **`FR-005` (Execution Timeouts)**: The system must enforce hard execution timeouts on containerized processes, forcefully killing containers that exceed duration limits.
- **`FR-006` (Interactive & Non-Interactive Streaming)**: The system must stream stdout and stderr in real-time while capturing complete terminal output for logging.
- **`FR-007` (Execution Receipts & Durable Metadata)**: The system must produce a structured `.task/sandbox-receipt.json` recording container ID, image, resource usage, execution duration, and exit code.
- **`FR-008` (Configuration Inheritance & Profiles)**: Sandbox defaults (image, CPU, memory, network, runtime) must be configurable at the root repository level (`.mannostree.yml`) and overrideable on a per-profile or per-command basis.
- **`FR-009` (Agent Dispatch Integration)**: The `agent dispatch` and `agent run` engines must support `--sandbox <type>` and `--image <image>` to encapsulate autonomous worker loops.
- **`FR-010` (Parallel Benchmark Integration)**: The `parallel eval` benchmark harness must accept `--sandbox <type>` to run performance probes in clean-room containers.
- **`FR-011` (Doctor Diagnostics Audit)**: `mannostree doctor` must inspect container daemon availability, runtime versions, and cgroup socket permissions.
- **`FR-012` (Graceful Fallback & Dry-Run Preview)**: The system must support `--dry-run` to output the exact container invocation command and arguments without spawning containers, and provide clear error messages if a requested runtime is missing.

---

## 5. Non-Functional Requirements & Safety Invariants

1. **Host Safety**: Container mounts must NEVER mount root `/`, `/home`, or parent directories beyond the designated worktree.
2. **Deterministic Cleanup**: Ephemeral containers must automatically be cleaned up on process exit or termination (`--rm` container flag and signal trapping).
3. **No Root Privilege Escalation**: Processes inside containers must run as the host user's UID/GID by default to prevent permission discrepancies on generated worktree files.
4. **Zero Lingering State**: Container failures, OOM kills, or manual cancellations must not leave orphan processes running on the host.

---

## 6. Success Criteria

- **`SC-001` (Resource Capping Accuracy)**: CPU and memory quotas are strictly respected by the container runtime within ±5% tolerance.
- **`SC-002` (Clean-Room Reproducibility)**: Benchmark probe variance between successive runs across clean-room containers is reduced by $\ge 40\%$ compared to unconstrained host runs.
- **`SC-003` (Zero Host State Leakage)**: 100% of container file mutations remain confined within the mounted worktree path.
- **`SC-004` (Fast Spawning Overhead)**: Container runtime invocation overhead is $\le 1.5$ seconds for warm container images.

---

## 7. Assumptions & Constraints

- Docker CLI or Podman CLI is installed on the host if container sandboxing is requested; if unavailable, clear actionable errors or local fallback are provided.
- Container execution images (e.g. `node:20-alpine`, `ubuntu:22.04`) are pulled or available locally.
- Worktree directories are accessible on the host filesystem and shareable via standard volume mounts.
