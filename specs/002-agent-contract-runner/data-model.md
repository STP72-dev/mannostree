# Data Model: Autonomous Agent Contract Runner & Task Dispatch Engine

## Overview
This document defines the schemas, state machines, entity relationships, and validation rules for task contracts, agent dispatch sessions, quality gates, fulfillment verification, and scorecards in Mannostree.

---

## Entities & Interfaces

### 1. TaskContract
Represents an active task contract document (`.task/task-contract.md`).

```typescript
export interface AcceptanceCriterion {
  id: string;             // e.g. "AC-001"
  description: string;
  completed: boolean;
}

export interface TaskContract {
  title: string;
  problem_statement: string;
  scope: string[];
  out_of_scope: string[];
  acceptance_criteria: AcceptanceCriterion[];
  safety_invariants: string[];
  quality_gates_ref: string; // e.g. ".task/quality-gates.md"
  created_at: string;        // ISO 8601
  updated_at: string;        // ISO 8601
}
```

### 2. AgentSessionRecord
Tracks the lifecycle and execution metadata of a dispatched agent session.

```typescript
export type AgentRole = 'planner' | 'worker' | 'verifier' | 'custom';
export type AgentSessionState =
  | 'dispatched'
  | 'planning'
  | 'working'
  | 'verifying'
  | 'fulfilled'
  | 'fulfillment_rejected'
  | 'execution_failed'
  | 'timed_out'
  | 'cancelled';

export interface AgentSessionRecord {
  session_id: string;        // e.g. "session_20260901_102030_x1y2"
  worktree_id: string;
  feature?: string;
  role: AgentRole;
  command: string;           // Interpolated command executed
  state: AgentSessionState;
  started_at: string;        // ISO 8601
  ended_at?: string;         // ISO 8601
  duration_seconds?: number;
  pid?: number;
  exit_code?: number;
  error?: string;
  contract_path: string;
  scorecard_path?: string;
}
```

### 3. QualityGateSpec & ExecutionResult
Defines validation commands and execution outcome.

```typescript
export interface QualityGateCommand {
  name: string;              // e.g. "lint", "test", "build"
  command: string;           // e.g. "npm test"
  mandatory: boolean;
  timeout_seconds?: number;
}

export interface QualityGateExecutionResult {
  gate_name: string;
  command: string;
  passed: boolean;
  exit_code: number;
  duration_ms: number;
  stdout: string;
  stderr: string;
}

export interface QualityGateReport {
  passed: boolean;
  total_gates: number;
  passed_gates: number;
  failed_gates: number;
  results: QualityGateExecutionResult[];
}
```

### 4. FulfillmentVerificationReport
Result of independent contract and quality gate verification.

```typescript
export interface FulfillmentVerificationReport {
  worktree_id: string;
  verified_at: string;       // ISO 8601
  status: 'fulfilled' | 'rejected';
  total_criteria: number;
  completed_criteria: number;
  unmet_criteria: AcceptanceCriterion[];
  quality_gates: QualityGateReport;
  remediation_steps: string[];
}
```

### 5. ExecutionScorecard
Comprehensive performance and diff summary (`.task/scorecard.md`).

```typescript
export interface ExecutionScorecard {
  worktree_id: string;
  feature?: string;
  session_id: string;
  agent_role: AgentRole;
  generated_at: string;      // ISO 8601
  duration_seconds: number;
  git_diff: {
    files_changed: number;
    insertions: number;
    deletions: number;
    changed_files: string[];
  };
  quality_gates: {
    passed: boolean;
    tests_passed?: number;
    tests_failed?: number;
    lint_clean: boolean;
    build_clean: boolean;
  };
  fulfillment: {
    status: 'fulfilled' | 'rejected';
    criteria_met: number;
    total_criteria: number;
  };
}
```

---

## Agent State Machine

```
               [mannostree agent dispatch]
                            |
                            v
                      +------------+
                      | DISPATCHED |
                      +------------+
                            |
           +----------------+----------------+
           | (Agent begins execution)         |
           v                                 v
     +----------+                     +-------------+
     | PLANNING |                     | CANCELLED   |
     +----------+                     +-------------+
           |
           v
     +----------+
     | WORKING  |
     +----------+
           |
           v
     +-----------+
     | VERIFYING |
     +-----------+
           |
   [Verification Gate]
     /           \
    v             v
+-----------+   +----------------------+
| FULFILLED |   | FULFILLMENT_REJECTED |
+-----------+   +----------------------+
                       |
                  (remediation)
                       |
                       v
                 [Re-verify]
```

---

## Storage & File Artifacts

- `.task/task-contract.md` — Active task requirements and acceptance criteria.
- `.task/quality-gates.md` — Executable verification rules.
- `.task/review.md` — Diagnostic feedback on rejection or failure.
- `.task/scorecard.md` — Human-readable scorecard metrics.
- `.mannostree/sessions/<session_id>.json` — Durable machine-readable session history.
