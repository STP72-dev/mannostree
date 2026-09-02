# CLAUDE.md

## Project context
This repository is for **Mannostree**: a developer CLI and autonomous agent orchestration platform that manages isolated git worktrees as first-class, stateful development workspaces.

The product manages:
- single-task isolated workspace development
- explicit, deterministic base-branch resolution
- multi-variant experiments for the same feature with automated benchmark matrix evaluation
- Pareto-optimal winner selection and side-by-side metric comparison
- autonomous worker agent prompt dispatch, clean-room container sandboxes, and contract scorecards
- distributed fleet synchronization, 3-way semantic conflict matrices, tiering, leases, and auto-archive
- multi-host git publishing (GitHub Enterprise, GitLab, Gitea, Bitbucket)
- cross-repository poly-worktree coordination and release manifests
- bi-directional issue tracker synchronization (Jira, Linear, GitHub Issues, Generic Webhooks)
- metadata-driven recovery, disaster rollback, and inspection workflows

---

## What Claude should remember every session

### 1. Product identity
Mannostree is a **stateful CLI and agent orchestrator**, not a loose shell script collection.

Treat these as core product features:
- branch and worktree lifecycle management
- atomic metadata persistence (`.mannostree/`) with write-ahead journaling (`.mannostree/journal/`)
- universal dry-run simulation across all mutations
- disaster recoverability and rollback
- parallel variant benchmark matrix evaluations
- pluggable container sandboxing (Docker, Rootless Podman, Process fallback)
- explicit publish semantics and multi-host adapters
- bi-directional issue tracker integration

### 2. Core design rule
**Workers and agents do not own branch lifecycle. Mannostree does.**

Any internal executor, agent runner, or background container may operate inside a prepared worktree, but branch creation, base resolution, experiment grouping, cleanup policy, and publish state belong strictly to the Mannostree core application layer.

### 3. Explicitness over convenience
Prefer:
- explicit base branch resolution (never silently defaulting to current branch)
- explicit winner selection
- explicit cleanup confirmations (`--discard-uncommitted --yes`)
- explicit metadata state transitions

### 4. Preserve user trust & zero secret leakage
Never introduce behavior that can surprise the user, especially around:
- branch choice
- cleanup or uncommitted change deletion
- secret propagation (API tokens must never be written to metadata or task files)
- auto-push or auto-merge
- destructive recovery actions

---

## Technical Stack & Architecture

- **Language & Runtime**: TypeScript 5.7.3 / Node.js $\ge 20.0.0$ (ESM `"type": "module"`)
- **CLI Framework**: `commander` with ANSI styling (`chalk`)
- **Schema Validation**: `zod` for all configuration, metadata records, leases, receipts, and manifests
- **Config Parser**: `yaml` for `.mannostree.yml` and `.mannostree.poly.yml`
- **Testing Framework**: `vitest` for unit and integration test suites (100% pass rate requirement)
- **Container Sandboxes**: Native Docker CLI driver, Rootless Podman driver, direct Process fallback with POSIX UID mapping
- **Issue Trackers**: Jira REST API v3, Linear GraphQL API, GitHub Issues REST API, Generic Webhooks

---

## Metadata Architecture

```text
.mannostree/
  ├── registry.json               # Master registry of all tracked workspaces
  ├── worktrees/<id>.json         # Per-workspace JSON metadata records
  ├── experiments/<feature>.json  # Parallel multi-variant experiment records
  ├── leases/<id>.json            # Active concurrency lease lockfiles
  ├── sessions/<sessionId>.json   # Autonomous agent execution session records
  ├── issues/<KEY>.json           # Cached issue tracker ticket records
  ├── archives/<id>.json          # Metadata for unmounted archived workspaces
  ├── poly-registry.json          # Multi-repo poly cluster registry
  ├── poly-links.json             # Cross-package symlink records
  └── journal/                    # Write-ahead log for multi-file transaction rollback
```

---

## Primary Command Catalog

- **Workspace Lifecycle**: `spawn`, `drop`, `list`, `info`, `status`, `sync`, `clean`, `archive`, `restore`
- **Setup & Environment**: `setup`, `env`, `exec`
- **Parallel Variants**: `parallel spawn`, `parallel list`, `parallel compare`, `parallel eval`, `parallel pick`, `parallel publish`, `parallel drop`, `parallel handoff`
- **Autonomous Agents**: `agent dispatch`, `agent status`, `agent cancel`, `agent verify`
- **Distributed Fleet**: `fleet sync`, `fleet conflict-matrix`, `fleet lease`, `fleet tier`, `fleet auto-archive`, `fleet merge-sync`, `fleet publish`, `fleet capacity`
- **Cross-Repo Poly-Worktrees**: `poly spawn`, `poly link`, `poly unlink`, `poly sync`, `poly status`, `poly exec`, `poly pr`, `poly drop`
- **Issue Tracker Sync**: `issue ingest`, `issue transition`, `issue comment`, `issue sync`, `issue status`, `issue list`
- **Publishing & Artifacts**: `pr`, `task`, `handoff`
- **Diagnostics & Recovery**: `doctor`, `recover`

---

## Testing & Quality Assurance Rule

Before completing any task:
1. Run `npm run lint` (`tsc --noEmit`) to verify zero TypeScript errors.
2. Run `npm test` to verify all 78 test suites and 189 tests pass at 100%.
3. Ensure documentation (`docs/USER_MANUAL.md`, `README.md`, specs) accurately matches implemented behavior.
