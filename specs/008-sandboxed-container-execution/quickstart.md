# Quickstart & Verification Guide: Movement 8 — Sandboxed Container Execution

**Feature**: Movement 8 (`008-sandboxed-container-execution`)  
**Date**: 2026-09-02T10:50:30+02:00  

---

## 1. Quickstart Walkthrough

### Step 1: Configure Sandbox Defaults in `.mannostree.yml`
```yaml
sandbox:
  default_runtime: docker
  default_image: node:20-alpine
  default_network: bridge
  limits:
    cpus: 2.0
    memory: 2GB
    timeout_seconds: 120
```

### Step 2: Audit Sandbox Runtime Availability
Verify your local Docker or Podman daemon:
```bash
mannostree doctor
```

### Step 3: Run In-Worktree Commands in a Docker Sandbox
Spawn a worktree and execute tests in an isolated Alpine container:
```bash
# Spawn worktree
mannostree spawn auth-service -b main

# Preview container invocation without running
mannostree exec auth-service --sandbox docker --image node:20-alpine --dry-run "npm test"

# Execute in Docker with strict memory ceiling
mannostree exec auth-service --sandbox docker --image node:20-alpine --memory 1GB "npm test"
```

### Step 4: Dispatch Autonomous Agent inside Sandbox
Run autonomous coding loop inside isolated container:
```bash
mannostree agent dispatch auth-service --sandbox docker --image node:20-alpine
```

### Step 5: Execute Clean-Room Parallel Benchmark Matrices
Run multi-variant benchmark evaluation with container isolation:
```bash
mannostree parallel eval sort-algo --sandbox docker --image rust:1.75 --cpus 2.0
```

### Step 6: Inspect Durable Execution Receipt
View execution stats from `.task/sandbox-receipt.json`:
```bash
cat .worktrees/auth-service/.task/sandbox-receipt.json
```
