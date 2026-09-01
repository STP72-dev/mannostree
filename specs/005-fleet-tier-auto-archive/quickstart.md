# Quickstart Guide: Fleet Tiering, Workspace Leases & Auto-Archive Policy

**Feature**: `005-fleet-tier-auto-archive` (Movement 4)  
**Date**: 2026-09-01  
**Status**: Ready for Planning

---

## 1. Quick Workflow Walkthrough

### Step 1: Inspect Fleet Capacity and Tier Status
```bash
# View fleet dashboard overview
mannostree fleet status

# View detailed workspace tier distribution
mannostree fleet tier list
```

### Step 2: Acquire a Workspace Lease
```bash
# Agent or developer acquires a 2-hour exclusive lease on a worktree
mannostree fleet lease acquire feature-auth-refactor \
  --holder "Agent-Claude" \
  --ttl 2h \
  --purpose "Execute authentication unit test migration"

# Inspect all active leases
mannostree fleet lease list --active
```

### Step 3: Pin a Critical Worktree
```bash
# Explicitly pin a long-lived worktree to prevent auto-archival
mannostree fleet tier pin feature-main-design
```

### Step 4: Preview and Execute Automated Garbage Collection (Auto-Archive)
```bash
# Preview candidates eligible for archival based on quota and idle time
mannostree fleet auto-archive --preview

# Execute auto-archive (safely unmounts idle worktrees to cold tier)
mannostree fleet auto-archive --yes
```

### Step 5: Release Lease
```bash
# Release lease once task is fulfilled
mannostree fleet lease release feature-auth-refactor
```

### Step 6: Restore Archived Worktree on Demand
```bash
# Cold archived worktrees can be remounted instantly with 100% history preserved
mannostree restore feature-auth-refactor --yes
```
