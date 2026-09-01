# CLI Contracts: Movement 5 — Parallel Publish & Multi-Branch Merge-Sync

**Feature**: `006-parallel-publish-merge-sync`  
**Date**: 2026-09-01  
**Status**: Completed

---

## 1. `mannostree parallel publish <feature>`

Publish winning experiment variant with auto-compiled multi-variant scorecard and task artifacts.

### Options
- `--draft`: Create a draft Pull Request (default: false unless configured).
- `--title <title>`: Custom PR title (defaults to `feat(<feature>): implement <feature> (<variant> winner)`).
- `--push`: Push winning branch to remote origin before opening PR.
- `--target-base <branch>`: Base branch to target for the PR (defaults to experiment's shared base).
- `--preview` / `--dry-run`: Output compiled PR markdown, scorecard, and actions without remote push or PR creation.
- `--export-pr <path>`: Write compiled PR markdown to specified path.
- `--force`: Bypass quality gate failure warnings.

### JSON Output
```json
{
  "command": "parallel publish",
  "ok": true,
  "dry_run": false,
  "result": {
    "feature_name": "auth-jwt",
    "winner_variant": "auth-jwt-v2",
    "branch": "experiment/auth-jwt-v2",
    "base_branch": "main",
    "pushed": true,
    "pr_number": 42,
    "pr_url": "https://github.com/org/repo/pull/42",
    "pr_title": "feat(auth-jwt): implement JWT authentication (v2 winner)",
    "pr_body_file": ".task/pr-body.md",
    "published_at": "2026-09-01T15:30:00.000Z",
    "comparison_embedded": true,
    "quality_gates_passed": true,
    "evaluated_variants": ["auth-jwt-v1", "auth-jwt-v2", "auth-jwt-v3"]
  },
  "warnings": [],
  "errors": []
}
```

---

## 2. `mannostree fleet merge-sync`

Simulate and execute multi-branch 3-way in-memory merge assembly into an integration trunk.

### Options
- `--target <branch>`: **[Required]** Target integration/release branch (e.g. `staging`, `release/2026-09`).
- `--candidates <ids>`: Comma-separated list of candidate worktree IDs (defaults to all active/ready worktrees).
- `--preview`: Preview in-memory 3-way merge simulations without creating or updating target branch.
- `--yes`: Confirm release branch creation and merge assembly.
- `--ignore-conflicts`: Skip conflicting branches and assemble only clean candidates.

### JSON Output
```json
{
  "command": "fleet merge-sync",
  "ok": true,
  "dry_run": false,
  "result": {
    "timestamp": "2026-09-01T15:30:00.000Z",
    "target_branch": "staging",
    "dry_run": false,
    "total_candidates": 3,
    "clean_count": 3,
    "conflict_count": 0,
    "integrated_count": 3,
    "candidates": [
      {
        "worktree_id": "feature-auth-v2",
        "branch": "experiment/auth-v2",
        "head_sha": "a1b2c3d",
        "can_merge_cleanly": true,
        "conflicting_files": [],
        "status": "MERGED"
      }
    ],
    "release_manifest_path": ".mannostree/releases/staging.json"
  },
  "warnings": [],
  "errors": []
}
```

---

## 3. `mannostree fleet publish`

Batch-publish pull requests across multiple completed worktrees.

### Options
- `--all`: Publish all worktrees with completed quality gates.
- `--selected <ids>`: Comma-separated list of worktrees to publish.
- `--draft`: Open as draft pull requests.
- `--push`: Push branches to remote origin.
- `--preview`: Preview batch publishing actions.
- `--force`: Bypass non-critical quality gate warnings.

### JSON Output
```json
{
  "command": "fleet publish",
  "ok": true,
  "dry_run": false,
  "result": {
    "timestamp": "2026-09-01T15:30:00.000Z",
    "total_targeted": 2,
    "published_count": 2,
    "skipped_count": 0,
    "failed_count": 0,
    "results": [
      {
        "worktree_id": "feature-auth",
        "branch": "feature/auth",
        "status": "PUBLISHED",
        "pr_number": 43,
        "pr_url": "https://github.com/org/repo/pull/43"
      }
    ]
  },
  "warnings": [],
  "errors": []
}
```
