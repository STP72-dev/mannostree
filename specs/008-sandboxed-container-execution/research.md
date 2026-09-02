# Technical Research & Architecture Decisions: Movement 8 — Sandboxed Container Execution

**Feature**: Movement 8 (`008-sandboxed-container-execution`)  
**Date**: 2026-09-02T10:50:00+02:00  

---

## 1. Architectural Strategy & Design Choices

### Decision 1: Pluggable `SandboxRuntime` Hierarchy with Zero Mandatory Host Daemon Lock-in

- **Decision**: Define a lightweight, decoupled `SandboxRuntime` interface with concrete implementations for `DockerRuntime`, `PodmanRuntime`, and `ProcessRuntime` (local fallback).
- **Rationale**:
  - Developers and CI environments may use Docker, rootless Podman, or lack container engines entirely.
  - Pluggable runtimes allow seamless transitions: Docker on local workstations, Podman in restricted CI runners, and Process runtime as an instant, zero-dependency local fallback.
- **Alternatives Considered**:
  - *Hardcoding Docker CLI only*: Too restrictive for rootless environments or machines where Docker daemon is not active.
  - *Direct Docker Engine SDK / REST Socket Connection*: Adds heavy external npm dependencies (`dockerode`) and complex socket credential management. Executing native CLI binaries (`docker run`, `podman run`) provides zero-dependency compatibility, uses host auth/proxies automatically, and preserves streaming output.

---

### Decision 2: UID/GID Mapping & Worktree Permission Invariants

- **Decision**: Automatically inject host user identifiers (`--user ${process.getuid()}:${process.getgid()}` on POSIX platforms) into container execution arguments.
- **Rationale**:
  - When containers run as root by default, files generated inside `.task/` or source code become owned by `root`, preventing developers from editing or deleting them on the host.
  - Preserving host UID/GID ensures 100% permission parity between host and container file operations.
- **Alternatives Considered**:
  - *Chmodding files post-execution*: Prone to failure if root creates read-only files or if the container crashes before cleanup.

---

### Decision 3: Ephemeral Container Lifecycle & Guaranteed Cleanup

- **Decision**:
  - Containers always run with `--rm` and an explicit unique name (`--name mannostree-<id>-<timestamp>`).
  - Attach process signal handlers (`SIGINT`, `SIGTERM`, `beforeExit`) to forcefully stop and prune containers if the host CLI process is interrupted.
- **Rationale**:
  - Prevents orphan container sprawl and leaks of disk space or cgroup resources when long-running agent loops or benchmark runs are interrupted.
- **Alternatives Considered**:
  - *Persistent background containers per worktree*: High memory overhead and complex lifecycle sync.

---

### Decision 4: Execution Receipt Artifact Standard (`.task/sandbox-receipt.json`)

- **Decision**: Persist structured execution receipts containing container metadata, exit code, duration, peak memory estimates, and command string into `.task/sandbox-receipt.json`.
- **Rationale**:
  - Aligns with Mannostree's **Artifact-First Workflow** rule (durable files beat transient terminal output).
  - Enables subsequent analysis by `parallel compare`, `quality-gates`, and agent handoffs.

---

## 2. Resource Limit & Network Translation Matrix

| Setting | CLI Flag | Docker Argument | Podman Argument | Process Runtime (Fallback) |
| :--- | :--- | :--- | :--- | :--- |
| **CPU Ceiling** | `--cpus 2.0` | `--cpus 2.0` | `--cpus 2.0` | Process nice / advisory |
| **Memory Quota** | `--memory 2GB` | `-m 2g --memory-swap 2g` | `-m 2g --memory-swap 2g` | `NODE_OPTIONS=--max-old-space-size` |
| **Network Policy** | `--network none` | `--network none` | `--network none` | Offline environment vars |
| **Execution Timeout** | `--timeout 60s` | Process spawn timeout | Process spawn timeout | Process spawn timeout |
| **Workspace Mount** | Default | `-v <wt>:/workspace -w /workspace` | `-v <wt>:/workspace:Z -w /workspace` | `cwd: <wt>` |
| **User Identity** | Automatic | `--user <uid>:<gid>` | `--user <uid>:<gid>` | Host process user |
