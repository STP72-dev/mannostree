# Operator Quickstart: Fleet Sync & Cross-Worktree Conflict Matrix

**Feature**: `004-fleet-sync-conflict-matrix`  

---

## Workflow 1: Previewing & Synchronizing Fleet

```bash
# 1. Preview divergence across all active worktrees
mannostree fleet sync --preview

# 2. Synchronize all clean worktrees using fast-forward or rebase
mannostree fleet sync --strategy rebase

# 3. Synchronize a specific worktree
mannostree fleet sync --target feature-auth
```

---

## Workflow 2: Cross-Worktree Collision Detection

```bash
# 1. Generate full fleet conflict matrix
mannostree fleet conflict-matrix

# 2. Run deep in-memory 3-way merge simulation
mannostree fleet conflict-matrix --simulate-merge --verbose

# 3. CI/CD Pre-Publish Collision Gate
mannostree fleet conflict-matrix --fail-on-conflict
```
