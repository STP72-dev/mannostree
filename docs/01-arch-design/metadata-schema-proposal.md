## Metadata schema proposal

The metadata layer should make Mannostree **stateful, recoverable, comparable, and automation-friendly**.

It should answer four questions reliably:

1. What worktrees exist?
2. How were they created?
3. What is their current lifecycle state?
4. How do they relate to issues, PRs, variants, and artifact files?

---

# Directory layout

```text
.mannostree/
  registry.json
  worktrees/
    feature-retry-api-client.json
    experiment-retry-api-client-v1.json
    experiment-retry-api-client-v2.json
  experiments/
    retry-api-client.json
  archive/
    old-feature-x.json
```

---

# 1. `registry.json`

This is the global index.

It should be lightweight and fast to read.
Its job is discovery, not full detail.

## Example

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
  "worktrees": [
    "feature-retry-api-client",
    "experiment-retry-api-client-v1",
    "experiment-retry-api-client-v2"
  ],
  "experiments": [
    "retry-api-client"
  ]
}
```

## Purpose

* global lookup
* quick listing
* versioning anchor
* recovery entrypoint

---

# 2. Worktree record schema

Each worktree gets its own metadata file.

## File name

```text
.mannostree/worktrees/<worktree-id>.json
```

## Example

```json
{
  "version": 1,
  "id": "experiment-retry-api-client-v1",
  "kind": "parallel_variant",
  "feature_name": "retry-api-client",
  "variant": "v1",

  "repo_root": "/path/to/repo",
  "worktree_path": "/path/to/repo/.worktrees/retry-api-client-v1",
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
  "lifecycle_state": "ready_for_comparison",

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
    "setup_mode": "agents_md",
    "env_mode": "skip",
    "install_ran": true,
    "install_succeeded": true,
    "setup_commands": [
      "npm ci"
    ]
  },

  "git_state": {
    "head_commit": "abc123def456",
    "head_commit_message": "Add retry middleware and scoped tests",
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
      {
        "command": "npm run lint",
        "status": "passed"
      },
      {
        "command": "npm test -- retry-client",
        "status": "passed"
      }
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

  "tags": [
    "retry",
    "experiment",
    "issue-42"
  ]
}
```

---

# 3. Experiment record schema

This tracks the whole parallel group.

## File name

```text
.mannostree/experiments/<feature>.json
```

## Example

```json
{
  "version": 1,
  "name": "retry-api-client",
  "kind": "parallel_experiment",

  "created_at": "2026-04-19T10:10:00Z",
  "updated_at": "2026-04-19T10:40:10Z",

  "base_branch": "main",
  "plan_file": "docs/retry-client-plan.md",
  "source_type": "issue",
  "issue_number": 42,

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
    "comparison_file": ".task/comparison.md",
    "completed": true,
    "completed_at": "2026-04-19T10:39:30Z"
  },

  "winner": {
    "selected": true,
    "variant_id": "experiment-retry-api-client-v2",
    "selected_at": "2026-04-19T10:40:10Z"
  },

  "publish": {
    "pr_created": false,
    "pr_number": null,
    "pr_url": null
  }
}
```

---

# 4. Lifecycle states

These should be normalized, not free-text.

## Recommended states

```text
created
setup_pending
setup_complete
planned
implemented
validated
reviewed
ready_for_comparison
winner_selected
ready_for_pr
pr_open
merged
archived
broken
```

For experiments:

```text
created
running
awaiting_comparison
winner_selected
published
archived
broken
```

This makes filtering and recovery much easier.

---

# 5. Minimal required fields

Every worktree record should always contain at least:

```json
{
  "version": 1,
  "id": "feature-retry-api-client",
  "repo_root": "/path/to/repo",
  "worktree_path": "/path/to/repo/.worktrees/feature-retry-api-client",
  "branch": "feature/retry-api-client",
  "base_branch": "main",
  "created_at": "2026-04-19T10:00:00Z",
  "updated_at": "2026-04-19T10:00:00Z",
  "status": "created",
  "lifecycle_state": "created"
}
```

Everything else can be enriched later.

---

# 6. Status model

I would keep two fields, not one:

## `status`

Human-friendly summary:

* `created`
* `dirty`
* `validated`
* `reviewed`
* `pr_open`

## `lifecycle_state`

Machine-friendly precise state:

* `setup_complete`
* `ready_for_comparison`
* `winner_selected`

This avoids overloading one field.

---

# 7. Recovery-oriented fields

These are important because Mannostree should be recoverable.

Good recovery signals:

```json
{
  "exists_on_disk": true,
  "branch_exists": true,
  "metadata_consistent": true,
  "last_health_check_at": "2026-04-19T10:35:00Z",
  "health_status": "ok"
}
```

These can live under:

```json
"health": {
  "exists_on_disk": true,
  "branch_exists": true,
  "metadata_consistent": true,
  "health_status": "ok"
}
```

Very useful for `doctor` and `recover`.

---

# 8. Comparison-friendly fields

For parallel mode, comparison should not require re-parsing everything each time.

Useful cached fields:

```json
"summary": {
  "files_changed": 8,
  "lines_added": 210,
  "lines_removed": 34,
  "validation_status": "passed",
  "review_status": "passed_with_suggestions"
}
```

This makes `parallel compare` fast.

---

# 9. Publish-friendly fields

PR tracking should be first-class.

```json
"publish": {
  "pushed": true,
  "remote_branch": "experiment/retry-api-client-v2",
  "pr_number": 187,
  "pr_url": "https://github.com/org/repo/pull/187",
  "draft": false,
  "published_at": "2026-04-19T11:02:01Z"
}
```

---

# 10. Archive schema

When something is dropped or cleaned, you may still want to preserve historical metadata.

Example archived record:

```json
{
  "version": 1,
  "id": "feature-old-cleanup",
  "archived_at": "2026-04-19T12:00:00Z",
  "archive_reason": "merged_and_cleaned",
  "original_record": {
    "...": "full previous metadata"
  }
}
```

This is optional, but useful.

---

# Best design rule

**Registry is for discovery. Worktree records are for truth. Experiment records are for comparison state.**

That split keeps the model clean.

---

# Recommended JSON structure layers

The worktree record should consistently follow this shape:

```text
root
├── identity
├── location
├── branch/base
├── task
├── artifacts
├── setup
├── git_state
├── validation
├── review
├── publish
├── parallel
├── health
└── timestamps
```

Even if flattened in JSON, that logical grouping should stay.

---

# Minimal file set for MVP

For an MVP, these three are enough:

```text
.mannostree/registry.json
.mannostree/worktrees/<id>.json
.mannostree/experiments/<feature>.json
```

That already supports:

* spawn
* list
* info
* parallel compare
* pick winner
* PR tracking
* recovery

---

# One-line summary

**The Mannostree metadata model should treat each worktree as a first-class state object, each parallel experiment as a grouped comparison object, and the registry as a lightweight discovery index.**

The next logical step is the **actual JSON schemas or TypeScript interfaces** for these records.
