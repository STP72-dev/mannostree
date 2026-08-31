# Mannostree

Developer workspace lifecycle manager — git worktrees for parallel task execution, AI experiments, and agent-driven workflows.

---

## Features

- **Safe Worktree Lifecycle**: Explicit base branch resolution and isolated branch/worktree creation.
- **Atomic Metadata Registry**: Versioned, split metadata architecture (`.mannostree/registry.json` + `.mannostree/worktrees/<id>.json`) with atomic write-temp-and-rename guarantees.
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
    validation_commands:
      - npm test

cleanup:
  default_dry_run: true
  stale_days: 30
  protect_winner: true
  archive_on_drop: true
```

---

## Core Commands

### 1. Spawn a Worktree
Create an isolated development workspace from an explicit base branch:

```bash
# Create feature workspace
mannostree spawn my-feature -b main

# Plan creation without touching disk or git
mannostree spawn my-feature -b main --dry-run
```

### 2. List Worktrees
Enumerate active tracked worktrees:

```bash
mannostree list

# JSON output
mannostree list --json
```

### 3. Inspect Worktree Info
View detailed worktree metadata, git state, and live health status:

```bash
mannostree info feature-my-feature
```

### 4. Drop a Worktree
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

## Testing & Verification

Run the automated test suite with Vitest:

```bash
npm test
```

---

## License

MIT
