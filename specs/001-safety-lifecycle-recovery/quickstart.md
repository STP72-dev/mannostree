# Quickstart: Safety-First Lifecycle Recovery & Health Hardening

## Overview
This guide demonstrates key workflows for the safety, health, archive, and recovery features in Mannostree.

---

## 1. Handling Partial Drop Failure & Safe Retry

### Create Parallel Experiment with 2 Variants
```bash
mannostree parallel spawn auth-flow --variants 2
```

### Make 1 Variant Dirty (Simulating Work in Progress)
```bash
echo "temp work" > .worktrees/auth-flow-v2/temp.txt
```

### Attempt Parallel Drop (Safe Partial Failure)
```bash
mannostree parallel drop auth-flow --yes
```
*Outcome:*
- `.worktrees/auth-flow-v1` (clean) is dropped safely.
- `.worktrees/auth-flow-v2` (dirty) is **preserved** to prevent data loss.
- Experiment record is **retained** in metadata.

### Inspect Drop Status
```bash
mannostree parallel drop-status auth-flow
```

### Resolve & Retry Drop
```bash
# Option A: Commit or stash changes inside .worktrees/auth-flow-v2, then retry:
mannostree parallel drop auth-flow --yes

# Option B: Discard uncommitted changes explicitly:
mannostree parallel drop auth-flow --discard-uncommitted --yes
```

---

## 2. Diagnosing and Recovering Broken Workspaces

### Run Health Diagnostics
```bash
mannostree doctor
```

### If a Workspace is Flagged `BROKEN`
```bash
# View non-destructive repair steps
mannostree info experiment/broken-feature

# Execute repair
mannostree recover --repair experiment/broken-feature
```

---

## 3. Archiving and Restoring Workspaces

### Archive a Completed or Inactive Experiment
```bash
# Unmounts physical worktree directories while retaining git branches and metadata
mannostree archive experiment/cache-opt --yes
```

### Check Status (Archived Workspaces Hidden by Default)
```bash
mannostree list --archived
```

### Restore Workspace When Needed
```bash
mannostree restore experiment/cache-opt
```

---

## 4. Generating Parallel Handoff Packages

### Select Winner and Generate Handoff
```bash
mannostree parallel pick auth-flow auth-flow-v1 --reason "Passed all security benchmarks"
mannostree parallel handoff auth-flow
```
*Outputs generated:*
- `.task/parallel-handoff.md` (Markdown report with scorecard and winner rationale)
- `.mannostree/experiments/auth-flow-handoff.json` (Structured metadata preserving losers)
