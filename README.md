# Mannostree

Developer workspace lifecycle manager — git worktrees for parallel task execution, AI experiments, and agent-driven workflows.

---

## Features

- **Safe Worktree Lifecycle**: Explicit base branch resolution and isolated branch/worktree creation.
- **Operational Safety & Diagnostics**: Real-time status reporting, safe base synchronization with automatic conflict abort, comprehensive system diagnostics (`doctor`), safe bulk cleanup, and targeted recovery.
- **Project-Aware Setup & Profiles**: Automated dependency bootstrapping (`setup`), explicit environment file policy management (`env`), and in-worktree command execution (`exec`).
- **Parallel Variant Workflows**: First-class multi-hypothesis branching (`parallel spawn`), parallel experiment inventory (`parallel list`), side-by-side metric comparisons (`parallel compare`), explicit winner selection (`parallel pick`), and safe group decommissioning (`parallel drop`).
- **Artifacts, Publishing, & Handoffs**: Auto-compiled pull request documentation from durable `.task/` markdown files (`pr`), GitHub issue linking (`issue`), artifact completeness auditing (`task`), and successor agent handoffs (`handoff`).
- **Atomic Metadata Registry**: Versioned, split metadata architecture (`.mannostree/registry.json` + `.mannostree/worktrees/<id>.json` + `.mannostree/experiments/<feature>.json`) with atomic write-temp-and-rename guarantees.
- **Config-Driven Policies**: Centralized repository policies defined in `.mannostree.yml`.
- **Artifact-First Workflow**: Automatic scaffolding of `.task/` contract and verification files (`task-contract.md`, `solution-options.md`, `implementation-plan.md`, `quality-gates.md`, `review.md`, and `RESULTS.md`).
- **Automation & CI Friendly**: Native `--json`, `--yaml`, `--plain`, and `--dry-run` support with structured output envelopes.

---

## Installation & Build

```bash
# Install dependencies
npm install

# Build TypeScript CLI
npm run build

# Link CLI globally (optional)
npm link
```

---

## Configuration (`.mannostree.yml`)

Mannostree is configured via `.mannostree.yml` at the root of your repository:

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
    env_mode: skip
    env_files:
      - .env
    env_vars:
      NODE_ENV: development
    validation_commands:
      - npm test

parallel:
  max_variants: 5
  require_shared_base: true
  require_same_profile: true
  default_plan_mode: shared

publish:
  default_remote: origin
  default_draft: true
  push_on_pr_create: false
  pr_body_source: artifacts

cleanup:
  default_dry_run: true
  stale_days: 30
  protect_winner: true
  archive_on_drop: true
```

---

## CLI Commands

### Workspace Lifecycle (Phase 1)

#### 1. Spawn a Worktree
Create an isolated development workspace from an explicit base branch:
```bash
# Create feature workspace
mannostree spawn my-feature -b main

# Plan creation without touching disk or git
mannostree spawn my-feature -b main --dry-run
```

#### 2. List Worktrees
Enumerate active tracked worktrees:
```bash
mannostree list

# Structured JSON output
mannostree list --json
```

#### 3. Inspect Worktree Info
View detailed worktree record, git state, and live health status:
```bash
mannostree info feature-my-feature
```

#### 4. Drop a Worktree
Safely remove a worktree and its branch:
```bash
# Remove clean worktree
mannostree drop feature-my-feature

# Force remove dirty worktree
mannostree drop feature-my-feature --force

# Retain git branch
mannostree drop feature-my-feature --keep-branch
```

---

### Operational Safety & Diagnostics (Phase 2)

#### 5. Worktree Status
Inspect live git ahead/behind counts against base, dirty/untracked/conflict state, and lifecycle metadata:
```bash
mannostree status feature-my-feature

# Fetch remote refs before inspecting
mannostree status feature-my-feature --fetch
```

#### 6. Synchronize Base Branch (`sync`)
Safely rebase or merge a worktree with its base branch (automatically aborts and restores on conflict):
```bash
# Rebase against base branch
mannostree sync feature-my-feature --strategy rebase

# Preview sync action
mannostree sync feature-my-feature --dry-run
```

#### 7. Health Diagnostics (`doctor`)
Audit tracked metadata against on-disk folders, git branches, and orphan refs:
```bash
# Read-only diagnosis
mannostree doctor

# Apply repair plan
mannostree doctor --fix --yes
```

#### 8. Bulk Cleanup (`clean`)
Report and safely remove merged or stale worktrees:
```bash
# Candidate report (dry-run preview)
mannostree clean --merged

# Execute cleanup for merged worktrees
mannostree clean --merged --yes

# Cleanup stale worktrees older than 14 days
mannostree clean --stale-days 14 --yes
```

#### 9. Workspace Recovery & Transaction Rollback (`recover`)
Repair damaged metadata or rollback interrupted multi-file operations:
```bash
# Reconstruct metadata from on-disk directory
mannostree recover feature-my-feature --rebuild-metadata --yes

# Reattach missing worktree directory
mannostree recover feature-my-feature --reattach-worktree --yes

# Rollback any in-flight interrupted transaction from journal
mannostree recover --rollback --yes
```

#### 10. Archive & Restore (`archive`, `restore`)
Reclaim disk space by unmounting physical worktrees while preserving git branch history and metadata:
```bash
# Archive clean workspace (unmounts directory)
mannostree archive feature-my-feature --yes

# Archive dirty workspace with uncommitted changes
mannostree archive feature-my-feature --force --yes

# Restore archived workspace (re-attaches worktree)
mannostree restore feature-my-feature --yes

# List only archived workspaces
mannostree list --archived
```

---

### Project-Aware Setup & Profiles (Phase 3)

#### 11. Workspace Setup (`setup`)
Apply or re-apply profile installation and validation commands to a worktree:
```bash
# Run profile setup commands
mannostree setup feature-my-feature

# Apply a specific named profile
mannostree setup feature-my-feature --profile node

# Re-run install commands even if previously executed
mannostree setup feature-my-feature --reinstall
```

#### 12. Environment Configuration (`env`)
Manage environment files (`.env`) safely with explicit policies:
```bash
# Copy env files from repo root
mannostree env feature-my-feature --mode copy

# Symlink env files
mannostree env feature-my-feature --mode link

# Run profile generate command
mannostree env feature-my-feature --mode generate
```

#### 13. Execute Commands in Worktree (`exec`)
Run commands directly inside a worktree's isolated directory with injected profile environment variables:
```bash
# Run tests inside worktree
mannostree exec feature-my-feature -- npm test

# Run arbitrary command
mannostree exec feature-my-feature -- git log -n 5
```

---

### Parallel Variant Workflows (Phase 4)

#### 14. Spawn Parallel Variants (`parallel spawn`)
Concurrently generate N variant worktrees and branches from a shared explicit base branch:
```bash
# Spawn 3 variant experiments
mannostree parallel spawn auth-spike -n 3 -b main

# Preview parallel spawn
mannostree parallel spawn auth-spike -n 3 -b main --dry-run
```

#### 15. List Parallel Experiments (`parallel list`)
Enumerate all parallel experiment groups and their current states:
```bash
mannostree parallel list

# Filter by status
mannostree parallel list --status active
```

#### 16. Compare Variants Side-by-Side (`parallel compare`)
Inspect comparative ahead/behind counts, diff statistics (+/- lines, changed files), and validation outcomes:
```bash
# Tabular terminal comparison
mannostree parallel compare auth-spike

# Structured JSON comparison
mannostree parallel compare auth-spike --json
```

#### 17. Automated Evaluation Matrix (`parallel eval`)
Concurrently run test, lint, and benchmark probe matrices across all variants, computing composite scores and automated winner recommendations:
```bash
# Evaluate variants with default or custom probe suites
mannostree parallel eval auth-spike --matrix "npm test, npm run bench"

# Evaluate and automatically promote #1 ranked variant
mannostree parallel eval auth-spike --auto-pick
```

#### 18. Pick Winner (`parallel pick`)

Explicitly promote the winning variant in experiment metadata (never auto-merges or auto-deletes losers):
```bash
# Select variant 1 as winner
mannostree parallel pick auth-spike --winner v1 --reason "Superior query performance"

# Select winner and clean losers with explicit confirmation
mannostree parallel pick auth-spike --winner v1 --cleanup-losers --yes
```

#### 18. Drop Experiment Group & Status (`parallel drop`, `parallel drop-status`)
Safely remove all variant worktrees associated with an experiment group:
```bash
# Preview dropping experiment variants
mannostree parallel drop auth-spike

# Execute dropping all variants and branches
mannostree parallel drop auth-spike --yes --force

# Inspect current survival/drop status for an experiment
mannostree parallel drop-status auth-spike
```

#### 19. Parallel Winner Handoff (`parallel handoff`)
Generate packaged handoff report and bundle linking winning justifications with preserved loser registries:
```bash
mannostree parallel handoff auth-spike --to "Reviewer Agent" --notes "Benchmark comparison ready"
```

---

### Artifacts, Publishing, & Ecosystem Integration (Phase 5)

#### 18. Prepare or Publish Pull Requests (`pr`)
Compile PR descriptions from `.task/` markdown files and optionally publish to GitHub:
```bash
# Compile and save PR description locally (prepare-only)
mannostree pr feature-my-feature

# Push branch and create PR via GitHub CLI
mannostree pr feature-my-feature --push
```

#### 19. Link GitHub Issue (`issue`)
Associate an existing GitHub issue with a worktree workspace:
```bash
mannostree issue feature-my-feature --from-issue 42 --title "Refactor authentication flow"
```

#### 20. Audit Task Artifacts (`task`)
Verify completeness and validity of required durable `.task/` artifacts:
```bash
mannostree task feature-my-feature --validate
```

#### 21. Generate Workspace Handoff (`handoff`)
Export comprehensive handoff packages for successor agents or human reviewers:
```bash
mannostree handoff feature-my-feature --to "Senior Reviewer" --notes "All unit and integration tests passing."
```

---

### Autonomous Agent Contract Runner & Fleet Dispatch

#### 22. Dispatch Worker Agent (`agent dispatch`)
Dispatch an autonomous agent into an isolated workspace or across all variants of an experiment:
```bash
# Single worktree dispatch
mannostree agent dispatch feature-my-feature \
  --role worker \
  --title "Implement Auth Token Refresh" \
  --criteria "Refresh tokens on expiry" "Unit test timeout behavior"

# Concurrent parallel fleet dispatch
mannostree agent dispatch auth-experiment --parallel
```

#### 23. Inspect Agent Status (`agent status`)
Monitor live agent execution stages, elapsed time, and task criteria progress:
```bash
mannostree agent status [target]
```

#### 24. Verify Contract Fulfillment (`agent verify`)
Independently verify 100% acceptance criteria checklist completion and automated quality gates:
```bash
mannostree agent verify feature-my-feature --retries 1
```

#### 25. Cancel Active Session (`agent cancel`)
Safely terminate an agent execution session without losing uncommitted worktree code:
```bash
mannostree agent cancel feature-my-feature
```

---

### Automated Benchmark Harness & Matrix Evaluation (Movement 2)

#### 26. Comparative Matrix Evaluation (`parallel eval`)
Benchmark competing parallel variant implementations against quality gates, execution duration, and change blast radius:
```bash
# Evaluate variants with baseline delta sampling and Weighted Sum Model scoring
mannostree parallel eval auth-feature

# Automatically promote winning variant and generate matrix evaluation report
mannostree parallel eval auth-feature --auto-pick
```

---

### Fleet Synchronization & Conflict Collision Matrix (Movement 3)

#### 27. Fleet Synchronization (`fleet sync`)
Synchronize active worktrees against their base branches with safety guards against dirty worktrees and active agent sessions:
```bash
# Preview divergence across all active worktrees without modifying branches
mannostree fleet sync --preview

# Synchronize using fast-forward or rebase strategy
mannostree fleet sync --strategy rebase

# Target a specific worktree for synchronization
mannostree fleet sync --target feature-my-feature --strategy merge
```

#### 28. Cross-Worktree Conflict Collision Matrix (`fleet conflict-matrix`)
Compute $N \times N$ pairwise cross-worktree collision matrix and in-memory 3-way merge simulations:
```bash
# Generate cross-worktree file overlap and collision matrix
mannostree fleet conflict-matrix

# Run in CI/pre-publish pipeline failing if merge hazards exist
mannostree fleet conflict-matrix --fail-on-conflict

# Output structured machine-readable JSON conflict report
mannostree fleet conflict-matrix --json
```

---

### Fleet Tiering, Workspace Leases & Auto-Archive Policy (Movement 4)

#### 29. Workspace Leases & Concurrency Locks (`fleet lease`)
Acquire, inspect, renew, and release concurrency leases on worktrees to protect against accidental concurrent edits or automated cleanup:
```bash
# Acquire an exclusive lease with declared purpose and TTL
mannostree fleet lease acquire feature-auth --holder agent-alpha --ttl 1h --purpose "Auth module migration"

# List active leases across the fleet
mannostree fleet lease list --active

# Extend expiration on an active lease
mannostree fleet lease renew feature-auth --ttl 30m

# Release lease when work is complete
mannostree fleet lease release feature-auth
```

#### 30. Lifecycle Tiering & Pinning (`fleet tier`)
Classify worktrees into tiers (`hot`, `warm`, `cold`, `pinned`) and protect important workspaces against automated pruning:
```bash
# Explicitly pin a critical worktree
mannostree fleet tier pin feature-main-refactor

# Set explicit lifecycle tier
mannostree fleet tier set feature-cache-v1 warm

# Unpin a worktree
mannostree fleet tier unpin feature-main-refactor

# List all fleet worktrees by lifecycle tier
mannostree fleet tier list
```

#### 31. Auto-Archive Retention Engine (`fleet auto-archive`)
Evaluate capacity quotas and retention policies to automatically unmount and archive idle worktrees without losing branch data:
```bash
# Preview candidates eligible for auto-archival without modifying disk
mannostree fleet auto-archive --preview

# Execute auto-archival of excess or idle worktrees
mannostree fleet auto-archive --yes
```

---

### Parallel Winner Publishing & Release Merge-Sync (Movement 5)

#### 33. Parallel Winner Publishing (`parallel publish`)
Publish the explicitly promoted winner of a parallel experiment directly to a GitHub Pull Request with rich auto-compiled benchmark scorecards, solution comparisons, quality gate logs, and reference variant links:
```bash
# Preview compiled PR description with embedded benchmark scorecard table
mannostree parallel publish auth-spike --preview

# Export compiled PR markdown artifact
mannostree parallel publish auth-spike --preview --export-pr ./dist/auth-pr.md

# Push winning branch to remote origin and open draft Pull Request
mannostree parallel publish auth-spike --draft --push
```

#### 34. Multi-Branch Release Merge-Sync (`fleet merge-sync`)
Simulate in-memory 3-way merges across candidate feature branches into a shared integration/release trunk and automatically generate versioned release manifests:
```bash
# Simulate candidate mergeability against target branch without modifying git state
mannostree fleet merge-sync --target staging --preview

# Execute sequential release assembly and record release manifest
mannostree fleet merge-sync --target staging --yes

# Integrate only clean candidates, skipping conflicting branches
mannostree fleet merge-sync --target staging --yes --ignore-conflicts
```

#### 35. Fleet Batch Pull Request Publisher (`fleet publish`)
Batch-publish pull requests across multiple completed fleet workspaces with automated concurrency lease cleanup:
```bash
# Preview batch publishing across all eligible ready worktrees
mannostree fleet publish --all --preview

# Batch publish selected worktrees and push branches
mannostree fleet publish --selected feature-auth feature-cache --push --draft
```

---

### Multi-Host Remote Adapters (Movement 7)

Mannostree provides first-class, pluggable support across **GitHub**, **GitLab** (Cloud & Self-Hosted), **Gitea / Forgejo**, **Atlassian Bitbucket**, and **Generic Git Remotes**.

#### Multi-Host Configuration in `.mannostree.yml`
```yaml
publish:
  default_remote: origin
  default_host: auto # auto | github | gitlab | gitea | bitbucket | generic
  default_draft: true
  hosts:
    gitlab:
      base_url: https://gitlab.internal.corp/api/v4
      token_env: GITLAB_TOKEN
    gitea:
      base_url: https://gitea.local/api/v1
      token_env: GITEA_TOKEN
    bitbucket:
      workspace: myteam
      token_env: BITBUCKET_TOKEN
```

#### Publishing to GitLab, Gitea, or Bitbucket
```bash
# Auto-detects host type from remote URL and creates GitLab Merge Request
mannostree pr feature-auth --push --draft

# Explicitly override host adapter
mannostree pr feature-auth --push --host gitlab
mannostree pr feature-cache --push --host gitea
mannostree pr feature-core --push --host bitbucket

# Publish parallel experiment winner to GitLab
mannostree parallel publish auth-eval --push --host gitlab --draft

# Audit host adapter tokens and CLI readiness
mannostree doctor
```

---

### Sandboxed Container Execution (Movement 8)

Mannostree provides zero-leak clean-room container sandboxing across **Docker**, **Podman** (rootless), and direct host **Process** fallback for isolated command execution, worker agent execution, and benchmark matrix evaluations.

#### Sandbox Configuration in `.mannostree.yml`
```yaml
sandbox:
  default_runtime: process # docker | podman | process
  default_image: node:20-alpine
  default_network: bridge # none | bridge | host | egress-only
  limits:
    cpus: 2.0
    memory: 2GB
    timeout_seconds: 300
```

#### Sandboxed CLI Workflows
```bash
# Execute in-worktree commands inside isolated Docker container with resource limits
mannostree exec feature-auth npm test --sandbox docker --image node:20-alpine --cpus 2 --memory 1GB --network none

# Preview sandboxed execution in dry-run mode
mannostree exec feature-auth cargo test --sandbox docker --image rust:latest --dry-run

# Dispatch autonomous agent into a clean-room Docker sandbox
mannostree agent dispatch feature-auth --role worker --sandbox docker --image node:20-alpine --network bridge

# Run parallel benchmark evaluations inside isolated container runtimes
mannostree parallel eval auth-eval --sandbox docker --image node:20-alpine --cpus 2 --memory 2GB

# Audit container engine health, versions, daemon connectivity, and rootless mode
mannostree doctor
```

---

### Cross-Repository Poly-Worktree Orchestration (Movement 9)

Mannostree provides multi-repository poly-worktree cluster management for coordinating feature development, package inter-wiring, unified base branch syncing, status matrix reporting, and joint pull request publishing across microservices and packages.

#### Cluster Manifest Configuration (`.mannostree.poly.yml`)
```yaml
version: 1
name: ecommerce-core
repos:
  api:
    path: ./services/api
    default_base_branch: main
    role: backend
  web:
    path: ./apps/web
    default_base_branch: main
    role: frontend
  types:
    path: ./packages/types
    default_base_branch: main
    role: lib
links:
  - source_repo: types
    target_repo: web
    strategy: npm # npm | python | go | cargo | symlink
    package_name: "@corp/types"
```

#### Poly CLI Workflows
```bash
# Atomically spawn synchronized worktrees across all member repositories
mannostree poly spawn checkout-v2 --base main

# Preview multi-repo worktree creation without modifying disk or git state
mannostree poly spawn checkout-v2 --dry-run

# Establish local cross-package dependencies between member worktrees
mannostree poly link checkout-v2

# Remove local dependency links
mannostree poly unlink checkout-v2

# View composite status matrix across all member repositories
mannostree poly status checkout-v2

# Synchronize base branches across all member repositories (rebase/merge/ff)
mannostree poly sync checkout-v2 --strategy rebase

# Concurrently execute commands across all member worktrees
mannostree poly exec checkout-v2 "npm test" --parallel

# Publish coordinated multi-host PRs with embedded sibling PR release tables
mannostree poly pr checkout-v2 --push --draft

# Safely drop poly-worktrees across all repositories
mannostree poly drop checkout-v2 --yes
```

---

## Testing & Verification

Run the automated test suite with Vitest:

```bash
# Run tests
npm test

# Run tests with code coverage report
npm run coverage
```

---

## License

MIT

