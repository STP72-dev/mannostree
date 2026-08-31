# Mannostree

Developer workspace lifecycle manager — git worktrees for parallel task execution, AI experiments, and agent-driven workflows.

---

## Features

- **Safe Worktree Lifecycle**: Explicit base branch resolution and isolated branch/worktree creation.
- **Operational Safety & Diagnostics**: Real-time status reporting, safe base synchronization with automatic conflict abort, comprehensive system diagnostics (`doctor`), safe bulk cleanup, and targeted recovery.
- **Project-Aware Setup & Profiles**: Automated dependency bootstrapping (`setup`), explicit environment file policy management (`env`), and in-worktree command execution (`exec`).
- **Parallel Variant Workflows**: First-class multi-hypothesis branching (`parallel spawn`), side-by-side metric comparisons (`parallel compare`), and explicit winner selection (`parallel pick`) with strict no-auto-merge and no-auto-delete invariants.
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

#### 9. Workspace Recovery (`recover`)
Repair damaged metadata or reattach worktrees and branches:
```bash
# Reconstruct metadata from on-disk directory
mannostree recover feature-my-feature --rebuild-metadata --yes

# Reattach missing worktree directory
mannostree recover feature-my-feature --reattach-worktree --yes
```

---

### Project-Aware Setup & Profiles (Phase 3)

#### 10. Workspace Setup (`setup`)
Apply or re-apply profile installation and validation commands to a worktree:
```bash
# Run profile setup commands
mannostree setup feature-my-feature

# Apply a specific named profile
mannostree setup feature-my-feature --profile node

# Re-run install commands even if previously executed
mannostree setup feature-my-feature --reinstall
```

#### 11. Environment Configuration (`env`)
Manage environment files (`.env`) safely with explicit policies:
```bash
# Copy env files from repo root
mannostree env feature-my-feature --mode copy

# Symlink env files
mannostree env feature-my-feature --mode link

# Run profile generate command
mannostree env feature-my-feature --mode generate
```

#### 12. Execute Commands in Worktree (`exec`)
Run commands directly inside a worktree's isolated directory with injected profile environment variables:
```bash
# Run tests inside worktree
mannostree exec feature-my-feature -- npm test

# Run arbitrary command
mannostree exec feature-my-feature -- git log -n 5
```

---

### Parallel Variant Workflows (Phase 4)

#### 13. Spawn Parallel Variants (`parallel spawn`)
Concurrently generate N variant worktrees and branches from a shared explicit base branch:
```bash
# Spawn 3 variant experiments
mannostree parallel spawn auth-spike -n 3 -b main

# Preview parallel spawn
mannostree parallel spawn auth-spike -n 3 -b main --dry-run
```

#### 14. Compare Variants Side-by-Side (`parallel compare`)
Inspect comparative ahead/behind counts, diff statistics (+/- lines, changed files), and validation outcomes:
```bash
# Tabular terminal comparison
mannostree parallel compare auth-spike

# Structured JSON comparison
mannostree parallel compare auth-spike --json
```

#### 15. Pick Winner (`parallel pick`)
Explicitly promote the winning variant in experiment metadata (never auto-merges or auto-deletes losers):
```bash
# Select variant 1 as winner
mannostree parallel pick auth-spike --winner v1 --reason "Superior query performance"

# Select winner and clean losers with explicit confirmation
mannostree parallel pick auth-spike --winner v1 --cleanup-losers --yes
```

---

### Artifacts, Publishing, & Ecosystem Integration (Phase 5)

#### 16. Prepare or Publish Pull Requests (`pr`)
Compile PR descriptions from `.task/` markdown files and optionally publish to GitHub:
```bash
# Compile and save PR description locally (prepare-only)
mannostree pr feature-my-feature

# Push branch and create PR via GitHub CLI
mannostree pr feature-my-feature --push
```

#### 17. Link GitHub Issue (`issue`)
Associate an existing GitHub issue with a worktree workspace:
```bash
mannostree issue feature-my-feature --from-issue 42 --title "Refactor authentication flow"
```

#### 18. Audit Task Artifacts (`task`)
Verify completeness and validity of required durable `.task/` artifacts:
```bash
mannostree task feature-my-feature --validate
```

#### 19. Generate Workspace Handoff (`handoff`)
Export comprehensive handoff packages for successor agents or human reviewers:
```bash
mannostree handoff feature-my-feature --to "Senior Reviewer" --notes "All unit and integration tests passing."
```

---

## Testing & Verification

Run the automated test suite with Vitest:

```bash
npm test
```

---

## License

MIT
