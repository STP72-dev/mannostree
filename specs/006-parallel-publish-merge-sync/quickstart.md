# Quickstart: Movement 5 — Parallel Publish & Multi-Branch Merge-Sync

**Feature**: `006-parallel-publish-merge-sync`  
**Date**: 2026-09-01  
**Status**: Completed

---

## Workflow 1: Parallel Winner Publishing

### Step 1: Run and Evaluate Parallel Variants
```bash
# 1. Spawn parallel variants
mannostree parallel spawn auth-system 3

# 2. Evaluate variants and auto-pick the winner
mannostree parallel eval auth-system --auto-pick
```

### Step 2: Publish Winner to Pull Request
```bash
# Preview generated Pull Request description and benchmark comparison
mannostree parallel publish auth-system --preview

# Publish winner branch and open GitHub Draft PR
mannostree parallel publish auth-system --draft --push
```

---

## Workflow 2: Multi-Branch Integration Assembly (`fleet merge-sync`)

### Step 1: Pre-Flight Integration Simulation
```bash
# Simulate 3-way in-memory merge of all active branches into staging
mannostree fleet merge-sync --target staging --preview
```

### Step 2: Assemble Release Trunk
```bash
# Merge clean candidate branches into staging
mannostree fleet merge-sync --target staging --yes
```

---

## Workflow 3: Batch Fleet Publishing (`fleet publish`)

```bash
# Publish all verified features across the fleet in batch
mannostree fleet publish --all --draft --push
```
