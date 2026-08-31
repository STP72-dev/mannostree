# CLI Interface Contracts: Safety-First Lifecycle Recovery

## 1. Parallel Drop & Retry

### `mannostree parallel drop <feature>`
Safely drops all or surviving variants of a parallel experiment.

#### Flags
- `--yes`: Confirm execution (skips preview mode).
- `--discard-uncommitted`: Explicitly permit dropping variants that contain uncommitted or untracked changes.
- `--force`: Bypass non-content operational blockers ONLY (e.g. stale lockfiles, broken metadata links).
- `--dry-run`: Preview planned actions without executing git or metadata changes.
- `--json`: Output machine-readable `DropStatusReport`.

#### Output Contract
```json
{
  "schema_version": 1,
  "command": "parallel drop",
  "status": "partial_failure | success | dry_run",
  "dry_run": false,
  "experiment_id": "exp_auth_v1",
  "total_variants": 3,
  "dropped_count": 2,
  "surviving_count": 1,
  "experiment_record_retained": true,
  "variants": [
    {
      "variant_id": "auth-v1",
      "status": "dropped"
    },
    {
      "variant_id": "auth-v2",
      "status": "dropped"
    },
    {
      "variant_id": "auth-v3",
      "status": "preserved_dirty",
      "error": "Worktree contains uncommitted changes",
      "remediation": "Commit changes or run with --discard-uncommitted --yes"
    }
  ],
  "next_steps": [
    "Resolve uncommitted changes in .worktrees/auth-v3 or run 'mannostree parallel drop auth --discard-uncommitted --yes'"
  ]
}
```

---

## 2. Drop Status Query

### `mannostree parallel drop-status <feature>`
Queries the current cleanup and survival state of an experiment.

#### Output Contract
```json
{
  "schema_version": 1,
  "feature": "auth",
  "status": "partial_dropped",
  "surviving_variants": ["auth-v3"],
  "reasons": {
    "auth-v3": "Uncommitted local modifications"
  },
  "recommended_command": "mannostree parallel drop auth --retry"
}
```

---

## 3. Health & Broken Diagnostics

### `mannostree doctor [id|feature]`
Runs non-destructive health checks across all workspaces or a targeted feature.

#### Output Contract
```json
{
  "schema_version": 1,
  "timestamp": "2026-08-31T16:30:00Z",
  "overall_health": "degraded | healthy | broken",
  "entities": [
    {
      "id": "experiment/auth",
      "type": "experiment",
      "health": "broken",
      "anomalies": [
        {
          "check_id": "worktree_dir_exists",
          "target": ".worktrees/auth-v2",
          "severity": "critical",
          "message": "Physical worktree directory missing"
        }
      ],
      "recovery_actions": [
        "mannostree recover --repair experiment/auth",
        "mannostree parallel drop auth --force"
      ]
    }
  ]
}
```

---

## 4. Archive & Restore

### `mannostree archive <id|feature>`
De-allocates physical worktree directory while preserving git branch and metadata.

#### Flags
- `--discard-uncommitted`: Permit archiving if uncommitted changes exist.
- `--yes`: Confirm archive execution.
- `--json`: Output structured JSON.

#### Output Contract
```json
{
  "schema_version": 1,
  "command": "archive",
  "entity_id": "experiment/cache-opt",
  "status": "archived",
  "freed_paths": [".worktrees/cache-opt-v1", ".worktrees/cache-opt-v2"],
  "preserved_branches": ["experiment/cache-opt-v1", "experiment/cache-opt-v2"],
  "archive_record": ".mannostree/archives/experiment-cache-opt.json"
}
```

### `mannostree restore <id|feature>`
Re-allocates worktrees from preserved git branches and restores active status.

---

## 5. Parallel Handoff

### `mannostree parallel handoff <feature>`
Compiles decision rationale, comparative scorecard, and preserved non-winning variants.

#### Output Contract
```json
{
  "schema_version": 1,
  "command": "parallel handoff",
  "feature": "auth-tokens",
  "winner": "auth-tokens-v2",
  "preserved_losers": ["auth-tokens-v1", "auth-tokens-v3"],
  "handoff_markdown": ".task/parallel-handoff.md",
  "handoff_json": ".mannostree/experiments/auth-tokens-handoff.json"
}
```
