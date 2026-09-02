# Implementation Plan: Movement 8 — Sandboxed Container Execution

**Feature Branch**: `008-sandboxed-container-execution`  
**Created**: 2026-09-02T10:50:35+02:00  
**Status**: DRAFT  
**Priority**: P1 (Resource Capping, Isolation & Clean-Room Benchmark Reproducibility)

---

## 1. Technical Context & System Architecture

Movement 8 introduces a dedicated **Sandbox Subsystem** (`src/sandbox/`) that isolates process execution for:
1. `mannostree exec`: Running arbitrary user/agent commands inside container volumes.
2. `mannostree agent dispatch`: Encapsulating autonomous coding agent run loops.
3. `mannostree parallel eval`: Clean-room benchmark probe matrix executions.
4. `mannostree doctor`: Diagnostic auditing of local Docker / Podman / cgroup health.

```text
src/
├── sandbox/
│   ├── base.ts         # SandboxRuntime interface, base options & SandboxRegistry
│   ├── docker.ts       # DockerRuntime implementation (CLI wrapper with --user, -v, -m, --cpus)
│   ├── podman.ts       # PodmanRuntime implementation (Rootless & SELinux :Z volume flag)
│   ├── process.ts      # ProcessRuntime implementation (Local child_process fallback)
│   ├── receipt.ts      # SandboxReceipt generator and .task/ persistence
│   └── index.ts        # Public sandbox exports and default registry factory
├── core/
│   ├── exec.ts         # ExecEngine integration with SandboxRegistry
│   ├── agent.ts        # AgentRunner integration with SandboxRegistry
│   ├── matrix-eval.ts  # MatrixEvaluator integration with SandboxRegistry
│   └── doctor.ts       # auditSandboxRuntimes diagnostic check
├── cli/
│   ├── commands/
│   │   ├── exec.ts     # Extended with --sandbox, --image, --cpus, --memory, --network
│   │   ├── agent.ts    # Extended with --sandbox, --image, --cpus, --memory, --network
│   │   ├── parallel.ts # Extended with --sandbox, --image, --cpus
│   │   └── doctor.ts   # Output renderer with sandbox diagnostic section
```

---

## 2. Constitution & Safety Check

- **Safety Invariant 1 (No Host Root Escalation)**: All container invocations inject `--user <uid>:<gid>` on POSIX platforms to ensure files created in worktrees belong to the host user.
- **Safety Invariant 2 (Bounded Mount Scope)**: Volume mounting is strictly confined to the targeted worktree directory (`<worktreePath>:/workspace`). Parent directories are never exposed.
- **Safety Invariant 3 (Deterministic Cleanup)**: Ephemeral containers always specify `--rm`, with signal handlers registered for immediate cancellation and container termination.
- **Safety Invariant 4 (Durable Execution Receipts)**: `.task/sandbox-receipt.json` records container ID, execution duration, exit code, and resource metrics.

---

## 3. Phased Implementation Roadmap

### Phase 1: Configuration, Core Domain Types & Schemas
- `src/config/schema.ts`: Add `SandboxConfigSchema` under `sandbox` key.
- `src/types/index.ts`: Add `SandboxRuntimeType`, `NetworkIsolationMode`, `SandboxResourceLimits`, `SandboxExecutionOptions`, `SandboxExecutionResult`, `SandboxReceipt`, `SandboxHealthStatus`.
- `src/metadata/schema.ts`: Add Zod validation schemas for sandbox types and receipts.

### Phase 2: Core Sandbox Runtimes & Registry
- `src/sandbox/base.ts`: `SandboxRuntime` interface and `SandboxRegistry`.
- `src/sandbox/receipt.ts`: `createSandboxReceipt` and disk writing utilities.
- `src/sandbox/docker.ts`: `DockerRuntime` with argument construction, streaming, timeout handling, and health inspection.
- `src/sandbox/podman.ts`: `PodmanRuntime` with rootless and SELinux volume mounting.
- `src/sandbox/process.ts`: `ProcessRuntime` local process fallback.
- `src/sandbox/index.ts`: Barrel export and `createDefaultSandboxRegistry()`.

### Phase 3: Engine Integrations (Exec, Agent Dispatch, Parallel Benchmark Eval, Doctor)
- `src/core/exec.ts`: Route execution through `SandboxRegistry`.
- `src/core/agent.ts`: Encapsulate agent loops inside sandbox when `--sandbox` is configured.
- `src/core/matrix-eval.ts`: Execute benchmark probes inside clean-room containers.
- `src/core/doctor.ts`: Add `auditSandboxRuntimes()` checking Docker, Podman, and daemon status.
- `src/cli/output.ts`: Render sandbox diagnostics in `mannostree doctor`.

### Phase 4: CLI Interface Updates
- Update `src/cli/commands/exec.ts`, `src/cli/commands/agent.ts`, `src/cli/commands/parallel.ts`, and `src/cli/commands/doctor.ts`.

### Phase 5: Verification & Quality Gates
- Author unit tests for each runtime driver (`tests/unit/docker-runtime.test.ts`, `tests/unit/podman-runtime.test.ts`, `tests/unit/process-runtime.test.ts`).
- Author integration tests (`tests/integration/sandbox-exec.test.ts`, `tests/unit/sandbox-doctor.test.ts`).
- Run `npm run build && npm test && npm run lint`.
- Update `README.md` and `GEMINI.md`.
