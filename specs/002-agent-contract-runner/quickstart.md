# Quickstart: Autonomous Agent Contract Runner & Task Dispatch

## Overview
This guide demonstrates how to delegate coding tasks to autonomous worker agents inside isolated worktrees, monitor execution, and verify contract fulfillment.

---

## 1. Dispatching a Worker Agent into a Single Worktree

### Spawn an Isolated Worktree
```bash
mannostree spawn payment-retry --base-branch main
```

### Dispatch Worker with a Task Contract
```bash
mannostree agent dispatch payment-retry \
  --role worker \
  --command "gemini --task {contract_path}"
```
*Outcome:*
- Creates `.worktrees/payment-retry/.task/task-contract.md`.
- Spawns the agent process inside `.worktrees/payment-retry`.
- Tracks the active session in `.mannostree/sessions/`.

---

## 2. Monitoring Live Agent Status

### Check Real-Time Agent Progress
```bash
mannostree agent status payment-retry
```
*Output:*
```text
Session ID:         session_20260901_102030_a1b2
Worktree:           .worktrees/payment-retry
Role:               worker
State:              WORKING
Elapsed Time:       45s
Criteria Completed: 2 / 4
```

---

## 3. Verifying Contract Fulfillment & Quality Gates

### Run Independent Verification
```bash
mannostree agent verify payment-retry
```
*Verification Checks:*
1. **Contract Checklists**: Verifies all `- [x]` items in `.task/task-contract.md`.
2. **Quality Gates**: Executes configured `npm run lint`, `npm test`, and `npm run build`.
3. **Scorecard**: Compiles `.task/scorecard.md`.

---

## 4. Concurrent Parallel Dispatch across Experiments

### Spawn a 3-Variant Experiment
```bash
mannostree parallel spawn cache-strategy --variants 3
```

### Dispatch Concurrent Workers to All Variants
```bash
mannostree agent dispatch cache-strategy --parallel
```

### View Fleet Dashboard
```bash
mannostree agent status cache-strategy
```
