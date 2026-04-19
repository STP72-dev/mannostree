# Metadata, Artifacts, and Configuration Schema

> Builds on the existing draft in `docs/01-arch-design/metadata-schema-proposal.md`. This file is the canonical reference.

## Layout

```text
.mannostree/
  registry.json
  worktrees/
    <id>.json
  experiments/
    <feature>.json
    <feature>/
      comparison.md
  archive/
    <id>.json

<repo>/.worktrees/
  <id-tail>/
    .task/
      task-contract.md
      solution-options.md
      implementation-plan.md
      quality-gates.md
      review.md
      comparison.md
      pr-body.md
    RESULTS.md

<repo>/.mannostree.yml
```

## Versioning

- Every JSON record has `"version": <int>`. Mannostree refuses to write records with an unknown version; it offers `recover --migrate` to upgrade.
- Schema migrations are documented in this file under a future `## Migrations` section.

## `registry.json` (global discovery index)

```json
{
  "version": 1,
  "repo_root": "/path/to/repo",
  "default_base_branch": "main",
  "worktree_root": ".worktrees",
  "metadata_root": ".mannostree",
  "artifact_dir_name": ".task",
  "created_at": "2026-04-19T10:00:00Z",
  "updated_at": "2026-04-19T10:42:13Z",
  "worktrees": ["feature-retry-api-client", "experiment-retry-api-client-v1"],
  "experiments": ["retry-api-client"]
}
```

**Purpose.** Discovery only. Truth lives in per-record files.

## Worktree record (per-worktree truth)

Path: `.mannostree/worktrees/<id>.json`.

### Required minimal fields

```json
{
  "version": 1,
  "id": "feature-retry-api-client",
  "repo_root": "/path/to/repo",
  "worktree_path": ".worktrees/retry-api-client",
  "branch": "feature/retry-api-client",
  "base_branch": "main",
  "created_at": "2026-04-19T10:00:00Z",
  "updated_at": "2026-04-19T10:00:00Z",
  "status": "created",
  "lifecycle_state": "WORKTREE_READY"
}
```

### Full record example

```json
{
  "version": 1,
  "id": "experiment-retry-api-client-v1",
  "kind": "parallel_variant",
  "feature_name": "retry-api-client",
  "variant": "v1",

  "repo_root": "/path/to/repo",
  "worktree_path": ".worktrees/retry-api-client-v1",
  "metadata_path": ".mannostree/worktrees/experiment-retry-api-client-v1.json",

  "branch": "experiment/retry-api-client-v1",
  "base_branch": "main",
  "branch_type": "experiment",

  "created_at": "2026-04-19T10:11:00Z",
  "updated_at": "2026-04-19T10:36:40Z",
  "last_activity_at": "2026-04-19T10:36:40Z",

  "created_by": "mannostree parallel spawn",
  "profile": "node",
  "status": "reviewed",
  "lifecycle_state": "REVIEWED",

  "task": {
    "source_type": "issue",
    "issue_number": 42,
    "issue_title": "Retry API client on transient failures",
    "task_contract_file": ".task/task-contract.md",
    "implementation_plan_file": ".task/implementation-plan.md"
  },

  "artifacts": {
    "artifact_root": ".task",
    "results_file": "RESULTS.md",
    "quality_gates_file": ".task/quality-gates.md",
    "review_file": ".task/review.md",
    "comparison_file": null,
    "pr_body_file": null
  },

  "setup": {
    "setup_mode": "profile",
    "env_mode": "skip",
    "install_ran": true,
    "install_succeeded": true,
    "setup_commands": ["npm ci"]
  },

  "git_state": {
    "head_commit": "abc123",
    "head_commit_message": "Add retry middleware",
    "dirty": false,
    "ahead_count": 2,
    "behind_count": 0,
    "has_untracked_files": false,
    "has_conflicts": false
  },

  "validation": {
    "status": "passed",
    "last_run_at": "2026-04-19T10:31:02Z",
    "commands": [
      { "command": "npm run lint", "status": "passed" },
      { "command": "npm test -- retry", "status": "passed" }
    ]
  },

  "review": {
    "status": "passed_with_suggestions",
    "critical_count": 0,
    "suggestion_count": 2,
    "last_reviewed_at": "2026-04-19T10:36:40Z"
  },

  "publish": {
    "pushed": false,
    "pr_number": null,
    "pr_url": null,
    "published_at": null
  },

  "parallel": {
    "experiment_name": "retry-api-client",
    "winner": false,
    "selected": false
  },

  "summary": {
    "files_changed": 8,
    "lines_added": 210,
    "lines_removed": 34,
    "validation_status": "passed",
    "review_status": "passed_with_suggestions"
  },

  "health": {
    "exists_on_disk": true,
    "branch_exists": true,
    "metadata_consistent": true,
    "last_health_check_at": "2026-04-19T10:35:00Z",
    "health_status": "ok"
  },

  "tags": ["retry", "experiment", "issue-42"]
}
```

### Field categories

| Category | Required | Optional | Recommended |
|----------|----------|----------|-------------|
| Identity | `version`, `id` | `kind`, `feature_name`, `variant` | `tags` |
| Location | `repo_root`, `worktree_path` | `metadata_path` | — |
| Branch/base | `branch`, `base_branch` | `branch_type` | — |
| Task | — | full `task` block | `task.source_type` |
| Artifacts | — | `artifacts` block | scaffold-time defaults |
| Setup | — | `setup` block | when profile applied |
| Git | — | `git_state` block | refreshed by `status` |
| Validation/Review/Publish | — | respective blocks | as state advances |
| Parallel | required for variants | — | — |
| Summary/Health | — | — | recommended for fast `list`/`compare` |

## Experiment record

Path: `.mannostree/experiments/<feature>.json`.

```json
{
  "version": 1,
  "name": "retry-api-client",
  "kind": "parallel_experiment",
  "created_at": "2026-04-19T10:10:00Z",
  "updated_at": "2026-04-19T10:40:10Z",
  "base_branch": "main",
  "plan_file": "docs/retry-client-plan.md",
  "plan_mode": "shared",
  "source_type": "issue",
  "issue_number": 42,
  "max_variants": 5,
  "variants": [
    {
      "id": "experiment-retry-api-client-v1",
      "branch": "experiment/retry-api-client-v1",
      "worktree_path": ".worktrees/retry-api-client-v1",
      "status": "reviewed",
      "validation_status": "passed",
      "review_status": "passed_with_suggestions"
    },
    {
      "id": "experiment-retry-api-client-v2",
      "branch": "experiment/retry-api-client-v2",
      "worktree_path": ".worktrees/retry-api-client-v2",
      "status": "reviewed",
      "validation_status": "passed",
      "review_status": "passed"
    }
  ],
  "comparison": {
    "comparison_file": ".mannostree/experiments/retry-api-client/comparison.md",
    "completed": true,
    "completed_at": "2026-04-19T10:39:30Z"
  },
  "winner": {
    "selected": true,
    "variant_id": "experiment-retry-api-client-v2",
    "selected_at": "2026-04-19T10:40:10Z",
    "reason": "best balance of scope and risk"
  },
  "publish": {
    "pr_created": false,
    "pr_number": null,
    "pr_url": null
  }
}
```

## Lifecycle states (canonical enum)

Single-path: `NEW`, `TASK_RESOLVED`, `WORKTREE_READY`, `CONTEXT_PACKED`, `PLAN_READY`, `IMPLEMENTED`, `VERIFIED`, `REVIEWED`, `PR_OPEN`, `WAITING_USER_APPROVAL`, `CLEANED`, `BROKEN`.

Experiment: `created`, `running`, `awaiting_comparison`, `winner_selected`, `published`, `archived`, `broken`.

## Status vs lifecycle_state

- `status`: human-friendly summary (`created`, `dirty`, `validated`, `reviewed`, `pr_open`).
- `lifecycle_state`: machine-friendly normalized token from the enum above.

Two fields, never overloaded into one.

## Artifact schema recommendations

Each artifact is markdown for human readability; Mannostree validates section presence (not prose quality).

| Artifact | Required sections |
|----------|------------------|
| `task-contract.md` | Problem, Scope, Out-of-scope, Acceptance criteria, References |
| `solution-options.md` | Options, Trade-offs, Recommended path |
| `implementation-plan.md` | Steps, Risks, Test plan |
| `RESULTS.md` | Summary, Files changed, Test evidence, Trade-offs, Risks |
| `quality-gates.md` | Commands, Outcomes (per-command), Overall status |
| `review.md` | Verdict, Critical, Major, Minor, Suggestions |
| `comparison.md` | Variant table, Recommendation |
| `pr-body.md` | Summary, Changes, Validation, Review, Notes |

## `.mannostree.yml` schema

### Required top-level fields
- `version`
- `default_base_branch`
- `worktree_root`

### Recommended top-level fields
- `metadata_root` (default `.mannostree`)
- `artifact_dir_name` (default `.task`)
- `profiles`
- `parallel`
- `cleanup`

### Optional top-level fields
- `publish`
- `integrations`
- `tags`

### Example

```yaml
version: 1

default_base_branch: main
worktree_root: .worktrees
metadata_root: .mannostree
artifact_dir_name: .task

base_branch_resolution:
  order: [cli, profile, config, repo, remote]
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
    env_files: [.env, .env.local]
    validation_commands:
      - node --version
      - npm run lint
  python:
    install_commands:
      - python -m venv .venv
      - .venv/bin/pip install -r requirements.txt
    env_mode: copy
    env_files: [.env]
    validation_commands:
      - .venv/bin/python -c "import sys; print(sys.version)"

cleanup:
  default_dry_run: true
  stale_days: 30
  protect_winner: true
  archive_on_drop: true

parallel:
  max_variants: 5
  require_shared_base: true
  require_same_profile: true
  default_plan_mode: shared

publish:
  default_remote: origin
  default_draft: true
  push_on_pr_create: true
  pr_body_source: artifacts   # artifacts | manual

integrations:
  github:
    enabled: true
    cli: gh
    project_board: null
    label_on_open: ["mannostree"]

tags:
  defaults: []
```

## Atomicity and consistency rules

- All metadata writes use **write-temp + rename** for atomicity.
- `registry.json` is updated only after the per-record file is durably written.
- `doctor` is the recovery tool for any divergence between disk, git, and metadata.
