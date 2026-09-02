# Data Model: Movement 8 — Sandboxed Container Execution

**Feature**: Movement 8 (`008-sandboxed-container-execution`)  
**Date**: 2026-09-02T10:50:15+02:00  

---

## 1. Domain Entities & Type Definitions

### `SandboxRuntimeType`
Supported sandbox drivers:
```typescript
export type SandboxRuntimeType = 'docker' | 'podman' | 'process';
```

### `NetworkIsolationMode`
Network connectivity policies:
```typescript
export type NetworkIsolationMode = 'none' | 'bridge' | 'host' | 'egress-only';
```

### `SandboxResourceLimits`
Resource quotas passed to the runtime driver:
```typescript
export interface SandboxResourceLimits {
  cpus?: number;             // e.g. 1.5, 2.0, 4.0 cores
  memory?: string;           // e.g. "512MB", "1GB", "4GB"
  disk_quota?: string;       // e.g. "10GB"
  timeout_seconds?: number;  // e.g. 300
}
```

### `SandboxConfig`
Configuration entry in `.mannostree.yml`:
```typescript
export interface SandboxConfig {
  default_runtime?: SandboxRuntimeType; // default: 'process' (auto-elevates to 'docker' if available)
  default_image?: string;               // e.g. "node:20-alpine"
  default_network?: NetworkIsolationMode;
  limits?: SandboxResourceLimits;
  workdir?: string;                     // default: "/workspace"
  auto_remove?: boolean;                // default: true
  user_namespace?: boolean;             // default: true (preserves host UID:GID)
}
```

### `SandboxExecutionOptions`
Runtime invocation arguments for a single command or script execution:
```typescript
export interface SandboxExecutionOptions {
  command: string;
  args?: string[];
  image?: string;
  runtime?: SandboxRuntimeType;
  network?: NetworkIsolationMode;
  limits?: SandboxResourceLimits;
  env?: Record<string, string>;
  interactive?: boolean;
  dryRun?: boolean;
}
```

### `SandboxExecutionResult`
Result of running a command inside a sandbox:
```typescript
export interface SandboxExecutionResult {
  runtime: SandboxRuntimeType;
  container_id?: string;
  image?: string;
  exit_code: number;
  duration_ms: number;
  stdout: string;
  stderr: string;
  timed_out: boolean;
  oom_killed?: boolean;
  receipt_path?: string;
}
```

### `SandboxReceipt`
Durable receipt persisted to `.task/sandbox-receipt.json`:
```typescript
export interface SandboxReceipt {
  version: 1;
  id: string;
  worktree_id: string;
  runtime: SandboxRuntimeType;
  container_id?: string;
  image?: string;
  command: string;
  exit_code: number;
  duration_ms: number;
  peak_memory_bytes?: number;
  cpu_time_ms?: number;
  timed_out: boolean;
  oom_killed: boolean;
  timestamp: string;
}
```

### `SandboxHealthStatus`
Diagnostic health report item returned by `auditSandboxRuntimes()` in `mannostree doctor`:
```typescript
export interface SandboxHealthStatus {
  runtime: SandboxRuntimeType;
  available: boolean;
  version?: string;
  daemon_running?: boolean;
  cgroups_version?: string;
  rootless?: boolean;
  details?: string;
  error?: string;
}
```

---

## 2. Schema Validation Rules

1. **`SandboxRuntimeType`**: Must be one of `docker`, `podman`, or `process`.
2. **`NetworkIsolationMode`**: Must be one of `none`, `bridge`, `host`, or `egress-only`.
3. **`Memory Limit`**: Must be a positive numeric string with `MB`, `GB`, `m`, or `g` unit (e.g. `2GB`, `512MB`, `4g`).
4. **`CPU Limit`**: Must be a positive floating-point number $> 0$ (e.g., `0.5`, `2.0`, `8`).
5. **`Timeout`**: Must be a positive integer $\ge 1$ seconds.
