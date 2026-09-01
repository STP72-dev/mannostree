# CLI Contract: Fleet Sync & Cross-Worktree Conflict Matrix

**Feature**: `004-fleet-sync-conflict-matrix`  
**Command Family**: `mannostree fleet`  

---

## 1. `mannostree fleet sync`

### Synopsis
```bash
mannostree fleet sync [options]
```

### Options
- `--preview`, `--dry-run`: Preview divergence and sync actions without mutating worktree branches.
- `--strategy <rebase|merge|ff-only>`: Sync strategy to apply to clean worktrees (default: `ff-only`).
- `--target <worktree_id>`: Restrict fleet sync to a single target worktree and its base branch.
- `--json`: Output machine-readable JSON envelope.
- `--yaml`: Output YAML envelope.

### Exit Codes
- `0`: All eligible worktrees synchronized successfully or preview generated cleanly.
- `1`: Syntax/usage error.
- `2`: Merge/rebase conflict encountered during sync (skipped or aborted).
- `10`: Active agent session or dirty worktree blocked sync.

---

## 2. `mannostree fleet conflict-matrix`

### Synopsis
```bash
mannostree fleet conflict-matrix [options]
```

### Options
- `--target <worktree_id>`: Focus conflict analysis on a single worktree vs all other fleet members.
- `--simulate-merge`, `--deep`: Run in-memory `git merge-tree` to prove auto-mergeability of overlapping files.
- `--fail-on-conflict`: Exit with code 2 if any direct conflict hazard is detected.
- `--verbose`: List exact line numbers and conflict hunk diffs.
- `--json`: Output machine-readable JSON envelope.
- `--yaml`: Output YAML envelope.

### Exit Codes
- `0`: Conflict matrix computed successfully (and no hazards if `--fail-on-conflict` is set).
- `1`: Syntax/usage error.
- `2`: Conflict hazards detected (when `--fail-on-conflict` is passed).
