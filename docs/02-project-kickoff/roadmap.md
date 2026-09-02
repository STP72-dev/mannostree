# Mannostree Project Roadmap & Delivery Log

**Status**: 100% Complete (Movements 1–10 Delivered & Verified)  
**Test Suite Coverage**: 78 test suites, 189 tests passing (100%)

---

## 1. Architectural Movements & Delivery Status

### ✅ Movement 1: Core Safety Invariants, Lifecycle Machine & Journaled Recovery
- **Branch / Spec**: `001-safety-lifecycle-recovery`
- **Delivered**: Base branch resolution hierarchy (CLI $\to$ profile $\to$ config $\to$ repo $\to$ remote), split atomic metadata persistence (`.mannostree/worktrees/<id>.json`), transaction write-ahead journaling (`.mannostree/journal/`), safe base synchronization with auto-conflict abort, deep diagnostic audit (`doctor`), and targeted disaster recovery (`recover`).
- **Commands**: `spawn`, `drop`, `list`, `info`, `status`, `sync`, `doctor`, `recover`, `clean`, `archive`, `restore`.

### ✅ Movement 2: Autonomous Agent Contract Runner & Verification Scorecard
- **Branch / Spec**: `002-agent-contract-runner`
- **Delivered**: AI agent prompt dispatch into prepared workspaces, `.task/task-contract.md` parsing, live execution stage monitoring, acceptance criteria verification, and scorecard generation.
- **Commands**: `agent dispatch`, `agent status`, `agent cancel`, `agent verify`.

### ✅ Movement 3: Automated Benchmark Harness & Pareto Matrix Evaluation
- **Branch / Spec**: `003-benchmark-matrix-eval`
- **Delivered**: Concurrent multi-variant evaluation matrices across test, lint, and benchmark probes, Weighted Sum Model scoring, Pareto-optimal winner recommendations, and automated promotion.
- **Commands**: `parallel eval`, `parallel pick`.

### ✅ Movement 4: Distributed Fleet Synchronization & Conflict Collision Matrix
- **Branch / Spec**: `004-fleet-sync-conflict-matrix`
- **Delivered**: Fleet-wide divergence preview, $N \times N$ pairwise 3-way semantic merge collision matrix simulations, and upstream branch rebasing with safety guards.
- **Commands**: `fleet sync`, `fleet conflict-matrix`.

### ✅ Movement 5: Fleet Tiering, Dynamic Leases & Auto-Archive Policies
- **Branch / Spec**: `005-fleet-tier-auto-archive`
- **Delivered**: Exclusive workspace concurrency lease locks with TTL (`.mannostree/leases/<id>.json`), lifecycle tiering (`hot`, `warm`, `cold`, `pinned`), capacity quota tracking, and automated retention auto-archival.
- **Commands**: `fleet lease`, `fleet tier`, `fleet auto-archive`, `fleet capacity`.

### ✅ Movement 6: Parallel Winner Publishing & Release Merge-Sync
- **Branch / Spec**: `006-parallel-publish-merge-sync`
- **Delivered**: Parallel winner promotion with auto-compiled benchmark comparison tables, candidate release trunk assembly (`fleet merge-sync`), and batch PR publishing (`fleet publish`).
- **Commands**: `parallel publish`, `fleet merge-sync`, `fleet publish`.

### ✅ Movement 7: Multi-Host Git Remote Adapters
- **Branch / Spec**: `007-multi-host-adapters`
- **Delivered**: Pluggable remote Git hosting drivers supporting GitHub Enterprise, GitLab (Cloud/Self-Hosted), Gitea/Forgejo, and Atlassian Bitbucket with zero secret leakage.
- **Commands**: `pr --host`, `parallel publish --host`, `doctor`.

### ✅ Movement 8: Sandboxed Container Execution Engine
- **Branch / Spec**: `008-sandboxed-container-execution`
- **Delivered**: Pluggable clean-room container sandboxing across Docker, Rootless Podman, and direct Process fallback with POSIX user/group ID mapping, resource caps (CPU, memory, timeout), and durable `.task/sandbox-receipt.json` records.
- **Commands**: `exec --sandbox`, `agent dispatch --sandbox`, `parallel eval --sandbox`.

### ✅ Movement 9: Cross-Repository Poly-Worktree Orchestration
- **Branch / Spec**: `009-cross-repo-poly-worktree`
- **Delivered**: Multi-repository poly-worktree cluster management (`.mannostree.poly.yml`), local package dependency wiring (npm, pip, cargo, symlinks), composite status matrix, and coordinated multi-repo release pull requests.
- **Commands**: `poly spawn`, `poly link`, `poly unlink`, `poly sync`, `poly status`, `poly exec`, `poly pr`, `poly drop`.

### ✅ Movement 10: Bi-Directional Issue Tracker Synchronization
- **Branch / Spec**: `010-issue-tracker-sync`
- **Delivered**: Ticket requirement ingestion (Jira REST API v3, Linear GraphQL, GitHub Issues REST, Generic Webhooks), automated `.task/task-contract.md` scaffolding from ticket bodies, automated lifecycle transitions, evidence comments, and status drift inspection.
- **Commands**: `issue ingest`, `issue transition`, `issue comment`, `issue sync`, `issue status`, `issue list`, `spawn --issue`.

---

## 2. Production Architecture

```text
src/
  ├── cli/                        # Commander CLI interface & formatted output renderers
  │   └── commands/               # Modular command registrations (spawn, parallel, fleet, poly, issue, etc.)
  ├── config/                     # Configuration loader, defaults & Zod schemas (.mannostree.yml)
  ├── core/                       # Orchestrator core, doctor diagnostics, setup & task engine
  ├── git/                        # Git engine, base branch resolver & worktree driver
  ├── metadata/                   # Atomic metadata store, schemas & transaction journal
  ├── parallel/                   # Parallel variant engine & Pareto matrix evaluator
  ├── agent/                      # Autonomous agent runner, scorecard & execution engine
  ├── fleet/                      # Fleet sync, conflict collision matrix, tiering, leases & auto-archive
  ├── publish/                    # Multi-host remote publishing & release candidate merge-sync
  ├── sandbox/                    # Container execution drivers (Docker, Podman, Process)
  ├── poly/                       # Cross-repo poly-worktree engine & package linkers
  └── issues/                     # Pluggable issue tracker adapters & sync engine
```
