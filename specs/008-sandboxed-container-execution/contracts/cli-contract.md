# CLI Contract: Movement 8 — Sandboxed Container Execution

**Feature**: Movement 8 (`008-sandboxed-container-execution`)  
**Date**: 2026-09-02T10:50:20+02:00  

---

## 1. Updated & Extended Commands

### 1. `mannostree exec`
Execute a command inside a dedicated sandboxed runtime mounted to a worktree:
```bash
mannostree exec <id> [options] -- <command...>
```

#### Options:
- `--sandbox <type>`: Sandbox runtime (`docker`, `podman`, `process`).
- `--image <image>`: Container image to run (e.g., `node:20-alpine`, `rust:latest`, `python:3.11-slim`).
- `--cpus <n>`: CPU core allocation ceiling (e.g. `2.0`).
- `--memory <limit>`: Memory quota limit (e.g. `2GB`, `512MB`).
- `--network <mode>`: Network isolation policy (`none`, `bridge`, `host`).
- `--timeout <seconds>`: Maximum execution duration before termination.
- `--dry-run`: Preview runtime CLI arguments and command invocation without executing.

#### Example Output (`--json`):
```json
{
  "command": "exec",
  "ok": true,
  "dry_run": false,
  "result": {
    "worktree_id": "feature-auth",
    "runtime": "docker",
    "image": "node:20-alpine",
    "command": "npm test",
    "exit_code": 0,
    "duration_ms": 1420,
    "stdout": "PASS tests/auth.test.ts",
    "stderr": "",
    "receipt_path": ".task/sandbox-receipt.json"
  }
}
```

---

### 2. `mannostree agent dispatch`
Dispatch an autonomous coding agent within an isolated container sandbox:
```bash
mannostree agent dispatch <id> [options]
```

#### Options:
- `--sandbox <type>`: Runtime driver (`docker`, `podman`, `process`).
- `--image <image>`: Worker container image.
- `--cpus <n>`: CPU ceiling.
- `--memory <limit>`: Memory ceiling.
- `--network <mode>`: Network policy.

---

### 3. `mannostree parallel eval`
Execute automated benchmark probes inside clean-room containers:
```bash
mannostree parallel eval <feature> [options]
```

#### Options:
- `--sandbox <type>`: Sandbox driver for clean-room execution.
- `--image <image>`: Benchmark container image.
- `--cpus <n>`: Strict CPU pinning/ceiling for reproducible benchmarks.
- `--memory <limit>`: Fixed RAM allocation to avoid paging bias.

---

### 4. `mannostree doctor`
Inspect and audit local container runtimes and daemon accessibility:
```bash
mannostree doctor [options]
```

#### Output Enhancement:
Includes `sandbox_runtimes` breakdown in JSON envelope and terminal rendering:
```text
Container Sandbox & Isolation Diagnostics:
  ✓ Docker (27.1.1): Available (Daemon active, cgroups v2 enabled)
  ✓ Podman (5.2.0): Available (Rootless mode ready)
  ✓ Process (Local): Available (Direct execution fallback)
```
