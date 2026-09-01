# CLI Interface Contracts: Agent Contract Runner & Task Dispatch

## 1. Agent Dispatch

### `mannostree agent dispatch <target>`
Dispatches a worker agent into an isolated worktree or all variants of an experiment.

#### Arguments & Options
- `<target>`: Worktree ID (e.g. `feature-auth`) or feature name (e.g. `auth-experiment`).
- `--role <role>`: Agent role (`planner`, `worker`, `verifier`, default: `worker`).
- `--command <cmd>`: Custom command template override.
- `--contract <file>`: Use pre-existing contract file instead of scaffolding.
- `--timeout <seconds>`: Maximum execution timeout in seconds.
- `--parallel`: Dispatch concurrently to all variants if target is an experiment.
- `--dry-run`: Preview planned contract generation and process invocation.
- `--json`: Output machine-readable dispatch session record.

#### Output Contract
```json
{
  "schema_version": 1,
  "command": "agent dispatch",
  "status": "dispatched",
  "session_id": "session_20260901_102030_a1b2",
  "worktree_id": "feature-auth",
  "worktree_path": ".worktrees/feature-auth",
  "role": "worker",
  "contract_path": ".worktrees/feature-auth/.task/task-contract.md",
  "command_executed": "gemini --task .worktrees/feature-auth/.task/task-contract.md",
  "pid": 12345
}
```

---

## 2. Agent Status

### `mannostree agent status [target]`
Queries the live status of active or completed agent sessions across workspaces.

#### Output Contract
```json
{
  "schema_version": 1,
  "sessions": [
    {
      "session_id": "session_20260901_102030_a1b2",
      "worktree_id": "feature-auth",
      "role": "worker",
      "state": "working",
      "elapsed_seconds": 142,
      "contract_progress": {
        "total_criteria": 4,
        "completed_criteria": 2
      }
    }
  ]
}
```

---

## 3. Contract Fulfillment Verification

### `mannostree agent verify <target>`
Independently verifies acceptance criteria completion and executes automated quality gates.

#### Options
- `--retries <count>`: Number of retries for flaky quality gates.
- `--json`: Output structured `FulfillmentVerificationReport`.

#### Output Contract
```json
{
  "schema_version": 1,
  "command": "agent verify",
  "worktree_id": "feature-auth",
  "status": "fulfilled",
  "acceptance_criteria": {
    "total": 4,
    "completed": 4
  },
  "quality_gates": {
    "passed": true,
    "results": [
      {
        "gate_name": "lint",
        "passed": true,
        "duration_ms": 320
      },
      {
        "gate_name": "test",
        "passed": true,
        "duration_ms": 1450
      }
    ]
  },
  "scorecard_path": ".worktrees/feature-auth/.task/scorecard.md"
}
```

---

## 4. Agent Cancellation

### `mannostree agent cancel <target>`
Safely terminates an active agent process while preserving all uncommitted code.

#### Output Contract
```json
{
  "schema_version": 1,
  "command": "agent cancel",
  "session_id": "session_20260901_102030_a1b2",
  "status": "cancelled",
  "worktree_path": ".worktrees/feature-auth",
  "uncommitted_files_preserved": true
}
```
