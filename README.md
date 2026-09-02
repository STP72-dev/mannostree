# Mannostree

> **Developer workspace lifecycle manager — git worktrees for parallel task execution, AI experiments, and agent-driven workflows.**

[![Tests](https://img.shields.io/badge/tests-189%20passed%20(100%25)-brightgreen.svg)](https://github.com/STP72-dev/mannostree)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7.3-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20.0.0-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Mannostree turns git worktrees into first-class, stateful development workspaces with explicit base-branch resolution, atomic metadata persistence, clean-room container sandboxes, autonomous agent orchestration, multi-host remote publishing, cross-repo poly-worktrees, and bi-directional issue tracker synchronization.

📖 **[Read the Complete User Manual](docs/USER_MANUAL.md)** for exhaustive architectural deep-dives, workflow walkthroughs, and disaster recovery runbooks.

---

## 10-Movement Architectural Feature Matrix

| Movement | Area | Key Capabilities | Commands |
|---|---|---|---|
| **M1** | **Safety Lifecycle & Recovery** | Explicit base resolution, atomic metadata, status inspection, safe sync with auto-conflict abort, health diagnostics, transaction rollback. | `spawn`, `drop`, `list`, `info`, `status`, `sync`, `doctor`, `recover`, `clean`, `archive`, `restore` |
| **M2** | **Agent Contract Runner** | AI agent prompt dispatch, acceptance criteria verification, live stage tracking, durability scorecards. | `agent dispatch`, `agent status`, `agent verify`, `agent cancel` |
| **M3** | **Benchmark Matrix Evaluation** | Multi-variant test/lint/benchmark evaluation probe matrices, Pareto optimal scoring, automated promotion. | `parallel eval`, `parallel pick` |
| **M4** | **Distributed Fleet Sync** | Divergence preview, $N \times N$ 3-way semantic merge collision matrix, clean upstream rebasing. | `fleet sync`, `fleet conflict-matrix` |
| **M5** | **Fleet Tiering & Auto-Archive** | Concurrency lease locks with TTL, hot/warm/cold tiering, pinning, capacity quotas, automated retention auto-archival. | `fleet lease`, `fleet tier`, `fleet auto-archive`, `fleet capacity` |
| **M6** | **Parallel Publish & Release Merge** | Batch PR publishing, winner promotion with embedded scorecards, release trunk candidate merge-sync. | `parallel publish`, `fleet merge-sync`, `fleet publish` |
| **M7** | **Multi-Host Git Adapters** | Pluggable support for GitHub Enterprise, GitLab (Cloud/Self-Hosted), Gitea/Forgejo, and Atlassian Bitbucket. | `pr --host`, `parallel publish --host`, `doctor` |
| **M8** | **Sandboxed Container Engine** | Clean-room execution via Docker, Rootless Podman, or Process fallback with CPU/memory limits, network policies, POSIX UID mapping, and durable receipts. | `exec --sandbox`, `agent dispatch --sandbox`, `parallel eval --sandbox` |
| **M9** | **Cross-Repo Poly-Worktrees** | Multi-repository cluster orchestration, local package dependency linking (npm/pip/cargo/symlink), composite status matrix, synchronized multi-repo PRs. | `poly spawn`, `poly link`, `poly unlink`, `poly sync`, `poly status`, `poly exec`, `poly pr`, `poly drop` |
| **M10** | **Issue Tracker Bi-Directional Sync** | Issue requirement ingestion (Jira REST v3, Linear GraphQL, GitHub Issues), `.task/task-contract.md` auto-scaffolding, automated status transitions, evidence comments, drift inspection. | `issue ingest`, `issue transition`, `issue comment`, `issue sync`, `issue status`, `issue list`, `spawn --issue` |

---

## Architecture Overview

```
                                  ┌────────────────────────┐
                                  │      Mannostree        │
                                  │   Orchestrator Core    │
                                  └───────────┬────────────┘
                                              │
         ┌──────────────────┬─────────────────┼─────────────────┬──────────────────┐
         │                  │                 │                 │                  │
         ▼                  ▼                 ▼                 ▼                  ▼
  ┌──────────────┐   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   ┌──────────────┐
  │ Worktree &   │   │ Parallel &   │  │ Agent Runner │  │ Fleet Engine │   │ Poly Engine  │
  │ Git Engine   │   │ Matrix Eval  │  │ & Sandboxes  │  │ & Leases     │   │ & Multi-Repo │
  └──────┬───────┘   └──────┬───────┘  └──────┬───────┘  └──────┬───────┘   └──────┬───────┘
         │                  │                 │                 │                  │
         ▼                  ▼                 ▼                 ▼                  ▼
  .worktrees/<id>    .task/RESULTS.md  .task/receipt.json .mannostree/     .mannostree/
  (Isolated Tree)    (Pareto Metrics)  (UID & Quotas)     leases/*.json    poly-links.json
```

---

## Quickstart Guide

### 1. Installation

```bash
# Clone and install dependencies
git clone https://github.com/STP72-dev/mannostree.git
cd mannostree
npm ci
npm run build

# Link CLI globally
npm link

# Verify installation
mannostree --version
```

### 2. Configuration (`.mannostree.yml`)

```yaml
version: 1

default_base_branch: main
worktree_root: .worktrees
metadata_root: .mannostree
artifact_dir_name: .task

base_branch_resolution:
  order:
    - cli
    - profile
    - config
    - repo
    - remote
  forbid_current_branch_as_base: true

profiles:
  default:
    install_commands: []
    env_mode: skip
    validation_commands: []
  node:
    install_commands:
      - npm ci
    env_mode: copy
    env_files:
      - .env.example
    env_vars:
      NODE_ENV: development
    validation_commands:
      - npm test

sandbox:
  default_runtime: process # docker | podman | process
  default_image: node:20-alpine
  limits:
    cpus: 2.0
    memory: 2GB

issues:
  default_provider: jira # jira | linear | github | generic
  auto_transition: true
  transitions:
    on_spawn: "In Progress"
    on_pr: "In Review"
    on_drop: "Closed"
```

---

## Core Command Catalog

### Single-Workspace Lifecycle
```bash
# Spawn workspace with explicit base branch
mannostree spawn auth-v2 -b main --profile node

# Inspect live status and divergence
mannostree status feature-auth-v2 --fetch

# Run safe base rebase (auto-aborts on conflict)
mannostree sync feature-auth-v2 --strategy rebase

# Execute tests inside isolated workspace
mannostree exec feature-auth-v2 -- npm test

# Publish Pull Request to GitHub, GitLab, Gitea, or Bitbucket
mannostree pr feature-auth-v2 --push --draft

# Archive workspace directory to reclaim disk space
mannostree archive feature-auth-v2 --yes
```

### Parallel Multi-Variant Experiments
```bash
# Spawn 3 variants from shared base
mannostree parallel spawn cache-strategy -n 3 -b main

# Run benchmark evaluation matrix inside clean-room containers
mannostree parallel eval cache-strategy --matrix "npm test, npm run bench" --sandbox docker

# Compare side-by-side metrics
mannostree parallel compare cache-strategy

# Explicitly promote winning variant
mannostree parallel pick cache-strategy --winner v2 --reason "Lowest P99 latency"

# Publish winning PR with embedded scorecard
mannostree parallel publish cache-strategy --push --draft

# Safely drop experiment variants (preserves winner)
mannostree parallel drop cache-strategy --yes
```

### Autonomous Agent Orchestration
```bash
# Dispatch worker agent with strict acceptance criteria
mannostree agent dispatch feature-auth-v2 \
  --role worker \
  --title "Implement OAuth2 Refresh Token Rotation" \
  --criteria "Refresh tokens on expiry" "Unit test timeout behavior" \
  --sandbox docker \
  --timeout 600

# Monitor live execution status
mannostree agent status feature-auth-v2

# Verify acceptance criteria fulfillment
mannostree agent verify feature-auth-v2

# Export handoff package for review
mannostree handoff feature-auth-v2 --to "Reviewer" --notes "Passing all contract criteria"
```

### Distributed Fleet Operations
```bash
# Acquire exclusive concurrency lease
mannostree fleet lease acquire feature-auth-v2 --holder "agent-01" --ttl 1h --purpose "Auth refactor"

# Inspect cross-fleet 3-way merge collision matrix
mannostree fleet conflict-matrix --fail-on-conflict

# Synchronize all active fleet workspaces
mannostree fleet sync --strategy rebase --preview

# Run auto-archive retention engine
mannostree fleet auto-archive --stale-days 14 --yes

# Assemble release candidate trunk from clean branches
mannostree fleet merge-sync --target release/v1.2.0 --yes
```

### Cross-Repository Poly-Worktrees
```bash
# Spawn synchronized worktrees across all member repositories
mannostree poly spawn checkout-v2 --base main

# Establish local cross-package dependency links
mannostree poly link checkout-v2

# Inspect composite status matrix
mannostree poly status checkout-v2

# Execute tests across all member repositories
mannostree poly exec checkout-v2 "npm test" --parallel

# Publish coordinated multi-repository pull requests
mannostree poly pr checkout-v2 --push --draft
```

### Issue Tracker Bi-Directional Sync
```bash
# Ingest issue requirements and spawn worktree (auto-transitions to In Progress)
mannostree spawn payment-retry --issue PROJ-101 --issue-provider jira

# Inspect live status and drift matrix against remote trackers
mannostree issue status

# Synchronize verification receipts and quality gate logs to the ticket
mannostree issue sync feature-payment-retry --comment

# Transition issue status
mannostree issue transition PROJ-101 "In Review"
```

### System Health & Diagnostics
```bash
# Comprehensive diagnostic audit (metadata, git, containers, tokens, issues)
mannostree doctor

# Automated diagnostic repair plan execution
mannostree doctor --fix --yes

# Disaster recovery: reconstruct metadata from disk
mannostree recover feature-auth-v2 --rebuild-metadata --yes

# Disaster recovery: rollback interrupted transaction from journal
mannostree recover --rollback --yes
```

---

## Testing & Quality Assurance

Mannostree is maintained under a strict 100% test pass requirement with Vitest:

```bash
# Run complete test suite (78 test suites, 189 tests)
npm test

# Run strict TypeScript compilation check
npm run lint

# Run tests with code coverage report
npm run coverage
```

---

## Documentation Index

- 📘 **[User Manual](docs/USER_MANUAL.md)**: Exhaustive operator guide, command reference, and troubleshooting runbooks.
- 📐 **[Architecture Specifications](docs/01-arch-design/)**: Core architectural specifications, module boundaries, and metadata proposals.
- 🗺️ **[Project Roadmap](docs/02-project-kickoff/roadmap.md)**: 10-Movement delivery log and milestone history.
- 🤖 **[Agent Guidelines](AGENTS.md)**: Operational rules and lifecycle constraints for AI pair programmers and worker agents.

---

## License

[MIT](LICENSE) © 2026 Mannostree Authors
