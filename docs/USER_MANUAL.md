# Mannostree Operator & Developer User Manual

**Version**: 1.0.0  
**Target Environment**: Linux, macOS, POSIX Workstations, CI/CD Agents  
**Runtime**: Node.js $\ge 20.0.0$, Git $\ge 2.38.0$

---

## Table of Contents

1. [Product Overview & Architectural Philosophy](#1-product-overview--architectural-philosophy)
   - [Core Design Invariants](#core-design-invariants)
   - [Mental Model & Domain Objects](#mental-model--domain-objects)
   - [On-Disk Directory & Metadata Architecture](#on-disk-directory--metadata-architecture)
2. [Installation & Configuration](#2-installation--configuration)
   - [Prerequisites & System Setup](#prerequisites--system-setup)
   - [Global Installation](#global-installation)
   - [Configuring `.mannostree.yml`](#configuring-mannostreeyml)
   - [Multi-Host Git Remote Credentials](#multi-host-git-remote-credentials)
   - [Container Sandbox Runtimes (Docker / Podman)](#container-sandbox-runtimes-docker--podman)
   - [Issue Tracker API Authentication (Jira / Linear / GitHub)](#issue-tracker-api-authentication-jira--linear--github)
3. [Step-by-Step Operator Workflows](#3-step-by-step-operator-workflows)
   - [Workflow 1: Single-Workspace Feature Development](#workflow-1-single-workspace-feature-development)
   - [Workflow 2: Parallel Multi-Variant Experiments & Pareto Selection](#workflow-2-parallel-multi-variant-experiments--pareto-selection)
   - [Workflow 3: Autonomous Agent Dispatch & Scorecard Verification](#workflow-3-autonomous-agent-dispatch--scorecard-verification)
   - [Workflow 4: Distributed Fleet Management, Leases & Auto-Archive](#workflow-4-distributed-fleet-management-leases--auto-archive)
   - [Workflow 5: Cross-Repository Poly-Worktree Orchestration](#workflow-5-cross-repository-poly-worktree-orchestration)
   - [Workflow 6: Bi-Directional Issue Tracker Sync & Evidence Publishing](#workflow-6-bi-directional-issue-tracker-sync--evidence-publishing)
4. [Exhaustive CLI Command Reference](#4-exhaustive-cli-command-reference)
   - [Global CLI Options & Formatting](#global-cli-options--formatting)
   - [Workspace Lifecycle Commands](#workspace-lifecycle-commands)
   - [Setup, Environment & Execution Commands](#setup-environment--execution-commands)
   - [Parallel Experiment Commands](#parallel-experiment-commands)
   - [Autonomous Agent & Contract Commands](#autonomous-agent--contract-commands)
   - [Distributed Fleet Operations Commands](#distributed-fleet-operations-commands)
   - [Multi-Repository Poly-Worktree Commands](#multi-repository-poly-worktree-commands)
   - [Issue Tracker Synchronization Commands](#issue-tracker-synchronization-commands)
   - [Publishing, Artifacts & Handoff Commands](#publishing-artifacts--handoff-commands)
   - [Diagnostics, Health & Recovery Commands](#diagnostics-health--recovery-commands)
5. [Diagnostics, Troubleshooting & Disaster Recovery Runbook](#5-diagnostics-troubleshooting--disaster-recovery-runbook)
   - [System Diagnostic Audits (`doctor`)](#system-diagnostic-audits-doctor)
   - [Automated Diagnostic Repair (`doctor --fix`)](#automated-diagnostic-repair-doctor---fix)
   - [Metadata Reconstruction (`recover`)](#metadata-reconstruction-recover)
   - [Atomic Journal Rollback (`recover --rollback`)](#atomic-journal-rollback-recover---rollback)
   - [Stale Concurrency Lease Eviction](#stale-concurrency-lease-eviction)
   - [Resolving Merge & Rebase Collisions](#resolving-merge--rebase-collisions)

---

## 1. Product Overview & Architectural Philosophy

**Mannostree** is a developer CLI and workspace lifecycle manager designed for safe, explicit, git-worktree-based parallel engineering, AI experimentation, and autonomous agent coordination.

Rather than treating git worktrees as transient folders created by raw shell scripts, Mannostree treats every worktree as a **first-class lifecycle entity** backed by atomic metadata persistence, explicit base-branch resolution, sandboxed execution runtimes, concurrency leases, and multi-host publishing engines.

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

### Core Design Invariants

1. **Safety First**: No implicit base branch fallbacks, no silent file deletions, no hidden background merges. All destructive operations require explicit user confirmation flags (`--yes` and `--discard-uncommitted`).
2. **Explicit Lifecycle State Machine**: Every workspace strictly transitions through verified states (`NEW` $\to$ `TASK_RESOLVED` $\to$ `WORKTREE_READY` $\to$ `CONTEXT_PACKED` $\to$ `PLAN_READY` $\to$ `IMPLEMENTED` $\to$ `VERIFIED` $\to$ `REVIEWED` $\to$ `PR_OPEN` $\to$ `CLEANED`).
3. **Reproducibility & Determinism**: Commands, configuration profiles, execution receipts, and evaluation scorecards are stored in durable, reviewable files rather than ephemeral terminal buffers.
4. **Zero-Secret Leakage Guarantee**: API keys and tokens (Jira, Linear, GitHub, GitLab, Gitea, Bitbucket) are read exclusively from environment variables or secure credential stores and never serialized into metadata JSON files or task markdown artifacts.
5. **Universal Dry-Run Simulation**: Every state-changing command supports `--dry-run` to preview filesystem paths, git branch operations, remote API requests, and metadata mutations without side effects.

### Mental Model & Domain Objects

| Domain Object | Description | Storage Location |
|---|---|---|
| **Worktree Record** | Metadata tracking an active or archived isolated workspace, its git state, branch topology, lifecycle state, health diagnostics, and attached issue tickets. | `.mannostree/worktrees/<id>.json` |
| **Registry Record** | Centralized catalog tracking active worktree IDs, base branch defaults, and registered experiment groups. | `.mannostree/registry.json` |
| **Experiment Record** | Multi-variant parallel experiment tracking candidate variants ($v_1, v_2, \dots, v_n$), comparative benchmark results, and winning variant promotion. | `.mannostree/experiments/<feature>.json` |
| **Workspace Lease** | Time-to-Live (TTL) concurrency lock acquired by developers or autonomous agents to prevent conflicting writes or automated cleanup. | `.mannostree/leases/<id>.json` |
| **Agent Session** | Execution audit tracking worker agent prompt contracts, PID/container runtime, elapsed execution duration, and acceptance criteria fulfillment. | `.mannostree/sessions/<sessionId>.json` |
| **Execution Receipt** | Clean-room execution proof recording exit codes, POSIX UID mappings, CPU/memory resource ceilings, and stdout/stderr digests. | `.task/sandbox-receipt.json` |
| **Poly Cluster Manifest** | Multi-repository orchestration specification defining member paths, package link strategies (npm, pip, cargo, symlink), and cross-repo release matrices. | `.mannostree.poly.yml` & `.mannostree/poly-registry.json` |
| **Issue Record** | Cached remote ticket metadata (Jira, Linear, GitHub Issues), priority, assignees, and extracted acceptance criteria checklists. | `.mannostree/issues/<KEY>.json` |

### On-Disk Directory & Metadata Architecture

```text
my-repository/
├── .mannostree.yml                 # Repository-wide workspace & profile configuration
├── .mannostree.poly.yml            # (Optional) Poly-worktree multi-repo manifest
├── .mannostree/                    # Persistent atomic metadata directory
│   ├── registry.json               # Master registry of all tracked workspaces
│   ├── worktrees/                  # Per-workspace JSON metadata records
│   │   ├── feature-auth.json
│   │   └── fix-payment.json
│   ├── experiments/                # Multi-variant experiment metadata records
│   │   └── cache-strategy.json
│   ├── leases/                     # Active concurrency lease lockfiles
│   │   └── feature-auth.json
│   ├── sessions/                   # Agent execution session logs & receipts
│   ├── issues/                     # Cached issue tracker ticket records
│   │   ├── PROJ-101.json
│   │   └── ENG-88.json
│   ├── archives/                   # Metadata for unmounted archived workspaces
│   └── journal/                    # Transaction write-ahead log for crash rollback
├── .worktrees/                     # Mounted git worktrees (default directory)
│   ├── feature-auth/
│   │   ├── src/...
│   │   └── .task/                  # Durable per-workspace task & evidence artifacts
│   │       ├── task-contract.md    # Problem, scope & acceptance criteria checklist
│   │       ├── RESULTS.md          # Verification evidence & quality gate pass logs
│   │       └── sandbox-receipt.json# Container execution proof & resource metrics
│   └── cache-strategy-v1/
└── src/                            # Main repository source files
```

---

## 2. Installation & Configuration

### Prerequisites & System Setup

- **Node.js**: Version `20.0.0` or higher (`node --version`)
- **Git**: Version `2.38.0` or higher (`git --version`)
- **Optional Container Engines**:
  - Docker Desktop / Docker Engine (`docker --version`)
  - Rootless Podman (`podman --version`)
- **Optional Remote CLI Clients**:
  - GitHub CLI (`gh --version`)
  - GitLab CLI (`glab --version`)

### Global Installation

To install and build Mannostree locally:

```bash
# Clone the repository
git clone https://github.com/STP72-dev/mannostree.git
cd mannostree

# Install dependencies and compile TypeScript
npm ci
npm run build

# Link binary globally
npm link

# Verify installation
mannostree --version
```

### Configuring `.mannostree.yml`

Create `.mannostree.yml` at the root of your repository to establish baseline workspace policies:

```yaml
version: 1

# Default branch topology
default_base_branch: main
worktree_root: .worktrees
metadata_root: .mannostree
artifact_dir_name: .task

# Base branch resolution hierarchy
base_branch_resolution:
  order:
    - cli        # 1. Flag passed to CLI (-b / --base)
    - profile    # 2. Profile default
    - config     # 3. default_base_branch in config
    - repo       # 4. Git local default (main/master)
    - remote     # 5. Remote HEAD branch
  forbid_current_branch_as_base: true # Refuse implicit checkout fallback

# Setup & environment profiles
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
      - npm run lint

# Parallel experiment constraints
parallel:
  max_variants: 5
  require_shared_base: true
  require_same_profile: true
  default_plan_mode: shared

# Multi-host remote publishing defaults
publish:
  default_remote: origin
  default_host: auto # auto | github | gitlab | gitea | bitbucket | generic
  default_draft: true
  push_on_pr_create: false
  pr_body_source: artifacts
  hosts:
    gitlab:
      base_url: https://gitlab.com/api/v4
      token_env: GITLAB_TOKEN
    gitea:
      base_url: https://gitea.internal.corp/api/v1
      token_env: GITEA_TOKEN
    bitbucket:
      workspace: my-team
      token_env: BITBUCKET_TOKEN

# Pluggable Container Sandbox limits
sandbox:
  default_runtime: process # docker | podman | process
  default_image: node:20-alpine
  default_network: bridge  # none | bridge | host | egress-only
  limits:
    cpus: 2.0
    memory: 2GB
    timeout_seconds: 300

# Issue tracker bi-directional sync
issues:
  default_provider: jira # jira | linear | github | generic
  auto_transition: true
  jira:
    host: https://mycompany.atlassian.net
    project_key: PROJ
  linear:
    team_key: ENG
  transitions:
    on_spawn: "In Progress"
    on_pr: "In Review"
    on_drop: "Closed"

# Fleet retention and auto-archive policies
cleanup:
  default_dry_run: true
  stale_days: 14
  protect_winner: true
  archive_on_drop: true
```

### Multi-Host Git Remote Credentials

Mannostree auto-detects remote host types from `git remote get-url origin` or allows explicit overrides. Configure authentication tokens via environment variables:

```bash
# GitHub Personal Access Token (or authenticated gh CLI)
export GITHUB_TOKEN="ghp_xxxxxxxxxxxxxxxxxxxx"

# GitLab Personal Access Token / CI Job Token
export GITLAB_TOKEN="glpat-xxxxxxxxxxxxxxxxxxxx"

# Gitea / Forgejo Access Token
export GITEA_TOKEN="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

# Atlassian Bitbucket App Password (username:token)
export BITBUCKET_TOKEN="myuser:xxxxxxxxxxxxxxxxxxxx"
```

### Container Sandbox Runtimes (Docker / Podman)

Ensure your container daemon is running. Mannostree automatically applies POSIX user/group ID mapping (`--user $(id -u):$(id -g)`) to guarantee files created inside containers remain editable on the host without permission errors:

```bash
# Check Docker daemon availability
docker info

# For rootless Podman users:
podman info
```

### Issue Tracker API Authentication (Jira / Linear / GitHub)

Set the appropriate API credentials in your environment:

```bash
# Jira Cloud: Basic Auth (Email:APIToken) or Data Center PAT
export JIRA_API_TOKEN="dev@mycompany.com:ATATT3xFfGF0..."

# Linear: Personal API Key
export LINEAR_API_KEY="lin_api_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

# GitHub Issues: Standard GitHub Token
export GITHUB_TOKEN="ghp_xxxxxxxxxxxxxxxxxxxx"
```

---

## 3. Step-by-Step Operator Workflows

### Workflow 1: Single-Workspace Feature Development

```mermaid
flowchart LR
    A["mannostree spawn"] --> B["mannostree exec"]
    B --> C["mannostree status"]
    C --> D["mannostree sync"]
    D --> E["mannostree pr"]
    E --> F["mannostree archive"]
```

1. **Spawn Workspace**:
   ```bash
   mannostree spawn auth-jwt --base main --profile node
   ```
2. **Implement & Execute within Isolated Tree**:
   ```bash
   # Run tests inside the isolated tree
   mannostree exec feature-auth-jwt -- npm test
   ```
3. **Check Live Divergence & Status**:
   ```bash
   mannostree status feature-auth-jwt --fetch
   ```
4. **Synchronize Base Updates (Safe Rebase)**:
   ```bash
   # Automatically checks for uncommitted changes and aborts on conflict
   mannostree sync feature-auth-jwt --strategy rebase
   ```
5. **Prepare and Publish Pull Request**:
   ```bash
   mannostree pr feature-auth-jwt --push --draft
   ```
6. **Archive Workspace to Free Disk Space**:
   ```bash
   mannostree archive feature-auth-jwt --yes
   ```

---

### Workflow 2: Parallel Multi-Variant Experiments & Pareto Selection

When evaluating competing architectural hypotheses (e.g. SQLite vs. Redis caching vs. In-Memory Map):

```bash
# 1. Concurrently spawn 3 variants from a shared base branch
mannostree parallel spawn cache-strategy -n 3 -b main

# 2. Implement variants independently inside:
#    .worktrees/cache-strategy-v1
#    .worktrees/cache-strategy-v2
#    .worktrees/cache-strategy-v3

# 3. Run automated evaluation matrix with resource caps inside Docker
mannostree parallel eval cache-strategy \
  --matrix "npm test, npm run bench" \
  --sandbox docker \
  --image node:20-alpine

# 4. Compare side-by-side diff metrics and benchmark results
mannostree parallel compare cache-strategy

# 5. Explicitly promote the winning variant
mannostree parallel pick cache-strategy --winner v2 --reason "Lowest P99 latency and zero memory leaks"

# 6. Publish winning Pull Request with embedded benchmark comparison table
mannostree parallel publish cache-strategy --push --draft

# 7. Clean up non-winning variants safely (preserves winner)
mannostree parallel drop cache-strategy --yes
```

---

### Workflow 3: Autonomous Agent Dispatch & Scorecard Verification

Dispatch AI agents into clean-room sandboxed workspaces with rigid task contracts:

```bash
# 1. Spawn workspace with linked issue ticket
mannostree spawn payment-retry --base main --issue PROJ-204

# 2. Dispatch worker agent with strict acceptance criteria
mannostree agent dispatch feature-payment-retry \
  --role worker \
  --title "Implement Exponential Backoff Retry" \
  --criteria "Retry on 5xx status codes" "Do not retry on 4xx client errors" "Add unit tests" \
  --sandbox docker \
  --timeout 600

# 3. Monitor live execution status
mannostree agent status feature-payment-retry

# 4. Verify contract fulfillment and generate scorecard
mannostree agent verify feature-payment-retry

# 5. Export handoff package for human code review
mannostree handoff feature-payment-retry --to "Senior Reviewer" --notes "Passing all contract criteria"
```

---

### Workflow 4: Distributed Fleet Management, Leases & Auto-Archive

Manage dozens of concurrent active workspaces without memory exhaustion or merge collisions:

```bash
# 1. Acquire an exclusive concurrency lease
mannostree fleet lease acquire feature-auth-jwt --holder "agent-worker-01" --ttl 2h --purpose "Auth refactor"

# 2. Inspect cross-fleet pairwise 3-way merge collision matrix
mannostree fleet conflict-matrix --fail-on-conflict

# 3. Synchronize all fleet workspaces against upstream main
mannostree fleet sync --strategy rebase --preview

# 4. Set lifecycle tiering on long-running worktrees
mannostree fleet tier set feature-auth-jwt warm
mannostree fleet tier pin feature-core-refactor

# 5. Run auto-archive retention engine to unmount idle cold workspaces
mannostree fleet auto-archive --stale-days 7 --yes

# 6. Assemble release candidate trunk from all clean feature branches
mannostree fleet merge-sync --target release/v1.2.0 --yes
```

---

### Workflow 5: Cross-Repository Poly-Worktree Orchestration

Coordinate features across multiple microservice repositories (e.g. backend API + frontend web + shared types):

```bash
# 1. Atomically spawn synchronized worktrees across all manifest repositories
mannostree poly spawn checkout-v2 --base main

# 2. Establish local cross-package dependencies (e.g. npm link / symlink)
mannostree poly link checkout-v2

# 3. View composite status across all repositories
mannostree poly status checkout-v2

# 4. Run tests concurrently across all repositories
mannostree poly exec checkout-v2 "npm test" --parallel

# 5. Publish coordinated pull requests linking sibling PR URLs across hosts
mannostree poly pr checkout-v2 --push --draft

# 6. Teardown poly-worktree cluster safely
mannostree poly drop checkout-v2 --yes
```

---

### Workflow 6: Bi-Directional Issue Tracker Sync & Evidence Publishing

```bash
# 1. Ingest issue requirements and spawn worktree (auto-transitions issue to In Progress)
mannostree spawn oauth2-flow --issue ENG-104 --issue-provider linear

# 2. Inspect generated contract in .task/task-contract.md
cat .worktrees/feature-oauth2-flow/.task/task-contract.md

# 3. Check for issue status drift across active fleet
mannostree issue status

# 4. Synchronize verification test evidence and benchmark results to the ticket
mannostree issue sync feature-oauth2-flow --comment

# 5. Open Pull Request (auto-transitions issue to In Review and links PR URL)
mannostree pr feature-oauth2-flow --push
```

---

## 4. Exhaustive CLI Command Reference

### Global CLI Options & Formatting

Every Mannostree command accepts these global options:

| Flag | Description |
|---|---|
| `--json` | Emit structured, machine-readable JSON output envelope. |
| `--yaml` | Emit structured YAML output envelope. |
| `--plain` | Emit minimal plain text output for scripting. |
| `--dry-run` | Simulate actions without modifying disk, git, or remote APIs. |
| `-v, --verbose` | Enable verbose logging and full error stack traces. |
| `-q, --quiet` | Suppress non-essential informational messages. |
| `--config <path>` | Specify custom path to `.mannostree.yml`. |
| `--profile <name>`| Apply a named setup profile from configuration. |
| `--cwd <path>` | Execute command as if invoked from the specified directory. |
| `--no-color` | Disable ANSI color styling. |

---

### Workspace Lifecycle Commands

#### `mannostree spawn <name>`
Create an isolated git worktree from an explicit base branch.

```bash
mannostree spawn <name> [options]
```
- `-b, --base <branch>`: Explicit base branch (e.g. `main`, `develop`).
- `--kind <kind>`: Branch kind (`feature`, `fix`, `docs`, `refactor`). Default: `feature`.
- `--no-setup`: Skip running profile setup install commands.
- `--env <mode>`: Environment file policy (`copy`, `link`, `skip`, `generate`). Default: `skip`.
- `-i, --issue <key>`: Ingest remote issue ticket (e.g. `PROJ-101`, `ENG-88`, `#42`).
- `--issue-provider <p>`: Explicit tracker provider (`jira`, `linear`, `github`, `generic`).
- `--no-transition`: Do not auto-transition issue status on spawn.

#### `mannostree list`
List all tracked workspaces in the metadata registry.

```bash
mannostree list [options]
```
- `--status <status>`: Filter by lifecycle status (`created`, `ready`, `pr_open`, `archived`).
- `--archived`: List only archived/unmounted workspaces.
- `--active`: List only mounted, active workspaces.
- `--tag <tag>`: Filter by metadata tag.

#### `mannostree info <id>`
Display detailed inspection data for a worktree record.

```bash
mannostree info <id>
```

#### `mannostree drop <id>`
Safely unmount and delete a worktree and its git branch.

```bash
mannostree drop <id> [options]
```
- `--keep-branch`: Retain the git branch while removing the on-disk worktree.
- `--force`: Bypass uncommitted dirty change check.
- `--discard-uncommitted`: Explicitly authorize discarding dirty modifications.
- `--yes`: Confirm non-interactive deletion.

#### `mannostree status <id>`
Inspect live git ahead/behind counts, dirty/conflict state, and metadata health.

```bash
mannostree status <id> [options]
```
- `--fetch`: Fetch latest remote refs before checking divergence.

#### `mannostree sync <id>`
Synchronize a worktree with its upstream base branch.

```bash
mannostree sync <id> [options]
```
- `--strategy <mode>`: Sync strategy (`rebase`, `merge`, `ff-only`). Default: `rebase`.
- `--fetch`: Fetch remote before syncing.

#### `mannostree archive <id>` / `mannostree restore <id>`
Unmount physical workspace directory to reclaim disk space while preserving branch and metadata.

```bash
mannostree archive <id> [--force] [--yes]
mannostree restore <id> [--yes]
```

#### `mannostree clean`
Bulk cleanup of merged, closed, or stale worktrees.

```bash
mannostree clean [options]
```
- `--merged`: Select worktrees whose branches are fully merged into base.
- `--stale-days <n>`: Select worktrees with no commit activity for $N$ days.
- `--yes`: Confirm execution of cleanup.

---

### Setup, Environment & Execution Commands

#### `mannostree setup <id>`
Apply or re-apply profile installation commands inside a worktree.

```bash
mannostree setup <id> [--profile <name>] [--reinstall]
```

#### `mannostree env <id>`
Manage environment files (`.env`) for a worktree.

```bash
mannostree env <id> --mode <copy|link|skip|generate>
```

#### `mannostree exec <id> <command...>`
Execute an arbitrary command inside a worktree directory with profile environment variables.

```bash
mannostree exec <id> [options] -- <command...>
```
- `--sandbox <runtime>`: Execute inside container sandbox (`docker`, `podman`, `process`).
- `--image <image>`: Container image to run.
- `--cpus <n>`: CPU core quota ceiling limit.
- `--memory <limit>`: Memory quota limit (e.g. `2GB`).
- `--network <mode>`: Network isolation policy (`none`, `bridge`, `host`).

---

### Parallel Experiment Commands

#### `mannostree parallel spawn <feature>`
Concurrently spawn $N$ variant worktrees from a shared base branch.

```bash
mannostree parallel spawn <feature> -n <count> -b <base> [options]
```

#### `mannostree parallel list`
Enumerate all active parallel experiment groups.

```bash
mannostree parallel list [--status <status>]
```

#### `mannostree parallel compare <feature>`
Render a side-by-side metric comparison table across all variants.

```bash
mannostree parallel compare <feature>
```

#### `mannostree parallel eval <feature>`
Run automated test, lint, and benchmark matrices across all variants.

```bash
mannostree parallel eval <feature> [options]
```
- `--matrix <commands>`: Comma-separated list of probe commands to evaluate.
- `--auto-pick`: Automatically promote the top-ranked variant.
- `--sandbox <runtime>`: Run evaluation probes inside clean-room containers.

#### `mannostree parallel pick <feature>`
Explicitly promote the winning variant in experiment metadata.

```bash
mannostree parallel pick <feature> --winner <variant> --reason <text> [--cleanup-losers --yes]
```

#### `mannostree parallel publish <feature>`
Publish the promoted winning variant to a pull request with embedded comparison tables.

```bash
mannostree parallel publish <feature> [--push] [--draft] [--host <host>]
```

#### `mannostree parallel drop <feature>`
Safely decommission all variant worktrees in an experiment group.

```bash
mannostree parallel drop <feature> [--yes] [--force]
```

---

### Autonomous Agent & Contract Commands

#### `mannostree agent dispatch <target>`
Dispatch an autonomous agent session into an isolated worktree or experiment.

```bash
mannostree agent dispatch <target> [options]
```
- `--role <role>`: Agent role (`worker`, `planner`, `verifier`). Default: `worker`.
- `--title <title>`: Task title.
- `--criteria <items...>`: Acceptance criteria checklist verification points.
- `--timeout <seconds>`: Maximum session execution timeout.
- `--parallel`: Dispatch across all variants in an experiment group.
- `--sandbox <type>`: Sandbox runtime (`docker`, `podman`, `process`).

#### `mannostree agent status [target]`
Monitor live agent execution status and criteria completion.

```bash
mannostree agent status [target]
```

#### `mannostree agent verify <target>`
Verify that all acceptance criteria in `.task/task-contract.md` are checked and quality gates pass.

```bash
mannostree agent verify <target> [--retries <n>]
```

#### `mannostree agent cancel <target>`
Safely cancel an active agent session.

```bash
mannostree agent cancel <target>
```

---

### Distributed Fleet Operations Commands

#### `mannostree fleet sync`
Synchronize active workspaces across the fleet against their respective base branches.

```bash
mannostree fleet sync [--strategy <rebase|merge|ff-only>] [--preview] [--target <id>]
```

#### `mannostree fleet conflict-matrix`
Compute cross-worktree file overlap and simulate pairwise 3-way merges.

```bash
mannostree fleet conflict-matrix [--fail-on-conflict]
```

#### `mannostree fleet lease <action>`
Manage concurrency lease locks on workspaces.

```bash
# Acquire lease
mannostree fleet lease acquire <id> --holder <name> --ttl <duration> --purpose <text>

# List leases
mannostree fleet lease list [--active]

# Renew lease
mannostree fleet lease renew <id> --ttl <duration>

# Release lease
mannostree fleet lease release <id> [--force]
```

#### `mannostree fleet tier <action>`
Manage lifecycle tiering (`hot`, `warm`, `cold`) and pinning.

```bash
mannostree fleet tier set <id> <tier>
mannostree fleet tier pin <id>
mannostree fleet tier unpin <id>
mannostree fleet tier list
```

#### `mannostree fleet auto-archive`
Evaluate retention policies and auto-archive idle workspaces.

```bash
mannostree fleet auto-archive [--preview] [--stale-days <n>] [--yes]
```

#### `mannostree fleet merge-sync`
Simulate and execute release candidate trunk assembly across feature branches.

```bash
mannostree fleet merge-sync --target <branch> [--preview] [--yes] [--ignore-conflicts]
```

#### `mannostree fleet publish`
Batch publish pull requests across multiple completed fleet workspaces.

```bash
mannostree fleet publish [--all | --selected <ids...>] [--preview] [--push] [--draft]
```

---

### Multi-Repository Poly-Worktree Commands

#### `mannostree poly spawn <name>`
Atomically spawn synchronized worktrees across all member repositories in `.mannostree.poly.yml`.

```bash
mannostree poly spawn <name> -b <base>
```

#### `mannostree poly link <name>` / `mannostree poly unlink <name>`
Establish or tear down local cross-package dependencies between member repositories.

```bash
mannostree poly link <name>
mannostree poly unlink <name>
```

#### `mannostree poly status <name>`
Display composite git divergence and link status matrix across all repositories.

```bash
mannostree poly status <name>
```

#### `mannostree poly sync <name>`
Synchronize all member repository worktrees against upstream base branches.

```bash
mannostree poly sync <name> [--strategy <rebase|merge|ff-only>]
```

#### `mannostree poly exec <name> <command...>`
Concurrently execute commands across all member worktrees.

```bash
mannostree poly exec <name> "npm test" [--parallel]
```

#### `mannostree poly pr <name>`
Publish coordinated pull requests linking sibling PR URLs across all member repositories.

```bash
mannostree poly pr <name> [--push] [--draft]
```

#### `mannostree poly drop <name>`
Safely unmount and remove worktrees across all member repositories.

```bash
mannostree poly drop <name> [--yes]
```

---

### Issue Tracker Synchronization Commands

#### `mannostree issue ingest <key>`
Ingest remote issue ticket and scaffold `.task/task-contract.md`.

```bash
mannostree issue ingest <key> [-w <worktreeId>] [-p <provider>]
```

#### `mannostree issue transition <key> <status>`
Trigger remote status transition in tracker.

```bash
mannostree issue transition <key> <status> [-p <provider>]
```

#### `mannostree issue comment <key> [message]`
Post a comment to the remote issue ticket.

```bash
mannostree issue comment <key> "Comment message" [-f <file>] [-p <provider>]
```

#### `mannostree issue sync [key]`
Synchronize verification receipts (`.task/RESULTS.md`) and quality gate logs to the issue.

```bash
mannostree issue sync [key] [-w <worktreeId>]
```

#### `mannostree issue status`
Display status and drift matrix across all active worktrees and linked issue tickets.

```bash
mannostree issue status [-w <worktreeId>]
```

#### `mannostree issue list`
List open or assigned tickets from configured issue tracker.

```bash
mannostree issue list [-p <provider>] [-a <assignee>] [-s <status>]
```

---

### Publishing, Artifacts & Handoff Commands

#### `mannostree pr <id>`
Compile pull request description from `.task/` markdown files and optionally publish to remote host.

```bash
mannostree pr <id> [--push] [--draft] [--host <github|gitlab|gitea|bitbucket>]
```

#### `mannostree task <id>`
Audit completeness and validity of required durable `.task/` artifacts.

```bash
mannostree task <id> --validate
```

#### `mannostree handoff <id>`
Generate packaged handoff report and bundle for successor agents or human reviewers.

```bash
mannostree handoff <id> --to <recipient> --notes <text>
```

---

### Diagnostics, Health & Recovery Commands

#### `mannostree doctor`
Perform deep system diagnostic audit across metadata, git worktrees, container engines, host tokens, and issue trackers.

```bash
mannostree doctor [--fix] [--yes]
```

#### `mannostree recover <id>`
Repair damaged metadata records or rollback interrupted transactions.

```bash
# Reconstruct metadata record from disk
mannostree recover <id> --rebuild-metadata --yes

# Reattach missing worktree directory
mannostree recover <id> --reattach-worktree --yes

# Rollback interrupted transaction from write-ahead journal
mannostree recover --rollback --yes
```

---

## 5. Diagnostics, Troubleshooting & Disaster Recovery Runbook

### System Diagnostic Audits (`doctor`)

Run `mannostree doctor` whenever encountering unexpected behavior. Doctor audits six core subsystems:
1. **Metadata Consistency**: Verifies `.mannostree/registry.json` matches all JSON files in `.mannostree/worktrees/`.
2. **Git Worktree Alignment**: Detects orphaned directories on disk without metadata and tracked worktrees missing from git.
3. **Container Sandboxes**: Tests Docker daemon / Podman rootless socket connectivity and image availability.
4. **Multi-Host Adapters**: Validates API tokens and repository permissions for GitHub, GitLab, Gitea, and Bitbucket.
5. **Issue Trackers**: Tests API connectivity and authentication for Jira, Linear, and GitHub Issues.
6. **Active Leases**: Identifies expired concurrency leases.

```bash
mannostree doctor
```

### Automated Diagnostic Repair (`doctor --fix`)

To automatically repair detected inconsistencies (pruning orphan git refs, cleaning expired leases, repairing missing directory pointers):

```bash
# Preview repair actions in dry-run mode
mannostree doctor --fix --dry-run

# Execute repair plan
mannostree doctor --fix --yes
```

### Metadata Reconstruction (`recover`)

If a workspace's metadata file (`.mannostree/worktrees/<id>.json`) was deleted or corrupted:

```bash
# Reconstruct metadata from git branch and .task artifacts on disk
mannostree recover feature-my-feature --rebuild-metadata --yes
```

If a physical worktree directory was accidentally unmounted or moved:

```bash
# Re-attach git worktree directory to match metadata record
mannostree recover feature-my-feature --reattach-worktree --yes
```

### Atomic Journal Rollback (`recover --rollback`)

Mannostree uses a Write-Ahead Journal (`.mannostree/journal/`) for multi-file metadata mutations. If a crash or power failure occurs mid-operation:

```bash
mannostree recover --rollback --yes
```

### Stale Concurrency Lease Eviction

If an autonomous agent or terminal session terminates abnormally while holding a lease lock:

```bash
# View active and expired leases
mannostree fleet lease list

# Force-release a stale lease
mannostree fleet lease release feature-my-feature --force
```

### Resolving Merge & Rebase Collisions

If `mannostree sync` or `mannostree fleet sync` encounters a conflict, Mannostree **automatically aborts the git operation and restores the branch to its pre-sync state**, leaving zero conflict markers on disk.

To resolve manually:
1. Inspect conflicting files:
   ```bash
   mannostree fleet conflict-matrix
   ```
2. Navigate into the worktree:
   ```bash
   cd .worktrees/feature-my-feature
   git rebase main
   # Resolve conflict markers manually
   git add <resolved-files>
   git rebase --continue
   ```
3. Update Mannostree status:
   ```bash
   mannostree status feature-my-feature
   ```
