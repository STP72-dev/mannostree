# CLI Contract: Movement 9 — Cross-Repository Poly-Worktree Orchestration

**Feature Branch**: `009-cross-repo-poly-worktree`  
**Date**: 2026-09-02T11:21:00+02:00  

---

## 1. CLI Commands Specification

### 1.1 `mannostree poly spawn <feature>`
Spawns synchronized worktrees across all member repositories defined in `.mannostree.poly.yml`.

```bash
# Options:
#   --base <branch>         Override default base branch across all member repositories
#   --manifest <path>       Custom path to .mannostree.poly.yml (default: auto-detected)
#   --no-link               Skip automatic cross-package linking step
#   --no-setup              Skip profile install/setup commands in spawned worktrees
#   --dry-run               Simulate multi-repo spawn and output planned operations
```

### 1.2 `mannostree poly drop <feature>`
Safely tears down worktrees across all member repositories with link restoration.

```bash
# Options:
#   --keep-branch           Retain git branches in member repositories
#   --force                 Bypass operational blockers (non-dirty)
#   --discard-uncommitted   Allow discarding dirty uncommitted changes (requires --yes)
#   --yes                   Confirm destructive drop
#   --dry-run               Preview worktrees to be removed
```

### 1.3 `mannostree poly link <feature>` / `mannostree poly unlink <feature>`
Establishes or restores local dependency package linkage across member worktrees.

```bash
# Options:
#   --strategy <type>       Override link strategy (npm, python, go, cargo, symlink)
#   --dry-run               Preview package linking actions
```

### 1.4 `mannostree poly sync <feature>`
Synchronizes base branches across all member worktrees with conflict isolation.

```bash
# Options:
#   --strategy <strategy>   Rebase, merge, or ff-only strategy (default: rebase)
#   --fetch                 Fetch remotes before synchronizing
#   --dry-run               Simulate synchronization without applying commits
```

### 1.5 `mannostree poly status [feature]`
Displays cross-repository integration dashboard, branch status, and link state.

```bash
# Options:
#   --fetch                 Fetch remote tracking status
#   --json                  Output JSON formatted status matrix
```

### 1.6 `mannostree poly exec <feature> <command...>`
Executes a command across all member worktrees sequentially or concurrently.

```bash
# Options:
#   --parallel              Execute concurrently across member worktrees
#   --repo <name>           Filter execution to specific member repository
#   --sandbox <type>        Run in container sandbox (docker, podman, process)
```

### 1.7 `mannostree poly pr <feature>`
Assembles and publishes pull requests across all member repositories with joint cross-linking.

```bash
# Options:
#   --title <title>         Joint PR title template
#   --draft                 Create PRs as draft (default: true)
#   --push                  Push branches to remotes and invoke host adapters
#   --dry-run               Preview PR body and cross-links
```
