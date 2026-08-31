# Data Model: Safety-First Lifecycle Recovery & Health Hardening

## Overview
This document defines the schema, state machines, entity relationships, and validation rules for transaction journaling, health diagnostics, broken state handling, archive/restore workflows, and parallel handoff packaging in Mannostree.

---

## Entities & Schemas

### 1. TransactionJournalEntry
Tracks an atomic multi-file metadata transition.

```typescript
export interface TransactionIntent {
  file_path: string;            // Absolute or repo-relative path to target metadata
  action: 'create' | 'update' | 'delete';
  previous_snapshot?: string;   // JSON string of previous content (for rollback)
  next_snapshot?: string;       // JSON string of target content (for replay)
}

export interface TransactionJournalEntry {
  transaction_id: string;       // e.g. "tx_20260831_160905_a1b2"
  operation: 'spawn' | 'drop' | 'pick' | 'archive' | 'restore' | 'recover' | 'parallel_spawn' | 'parallel_drop';
  entity_type: 'worktree' | 'experiment' | 'registry';
  entity_id: string;
  created_at: string;           // ISO 8601
  updated_at: string;           // ISO 8601
  state: 'in_flight' | 'committed' | 'rolled_back' | 'failed';
  intents: TransactionIntent[];
  error?: {
    code: string;
    message: string;
    stack?: string;
  };
}
```

### 2. ExperimentHealthRecord / WorktreeHealth
Stores point-in-time and continuous health diagnostics.

```typescript
export type HealthStatus = 'healthy' | 'degraded' | 'broken';

export interface HealthCheckResult {
  check_id: 'worktree_dir_exists' | 'git_worktree_registered' | 'git_branch_exists' | 'metadata_record_valid' | 'clean_git_status';
  passed: boolean;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  remediation?: string;
}

export interface HealthDiagnostic {
  status: HealthStatus;
  last_verified_at: string;    // ISO 8601
  checks: HealthCheckResult[];
  recommended_actions: string[];
}
```

### 3. DropStatusReport
Itemized outcome of a single or batch variant cleanup operation.

```typescript
export interface VariantDropOutcome {
  variant_id: string;
  worktree_path: string;
  branch: string;
  status: 'dropped' | 'failed' | 'preserved_winner' | 'preserved_dirty';
  error?: string;
  remediation?: string;
}

export interface DropStatusReport {
  feature: string;
  experiment_id: string;
  timestamp: string;
  dry_run: boolean;
  total_variants: number;
  dropped_count: number;
  surviving_count: number;
  experiment_record_retained: boolean;
  variants: VariantDropOutcome[];
  next_steps: string[];
}
```

### 4. ArchiveRecord
Preserves complete workspace context when physical worktrees are de-allocated.

```typescript
export interface ArchiveRecord {
  entity_id: string;
  entity_type: 'worktree' | 'experiment';
  archived_at: string;          // ISO 8601
  base_branch: string;
  head_sha: string;
  original_worktree_path: string;
  branch_name: string;
  metadata_snapshot_path: string;
  artifacts: string[];
  restorable: boolean;
}
```

### 5. ParallelHandoffPackage
Bundles decision evidence, comparative scorecards, and loser variant preservation.

```typescript
export interface VariantComparisonSummary {
  variant_id: string;
  branch: string;
  head_sha: string;
  status: string;
  quality_score?: number;
  test_pass_rate?: number;
  test_coverage?: number;
  loc_delta?: number;
  notes?: string;
}

export interface ParallelHandoffPackage {
  handoff_id: string;
  feature: string;
  base_branch: string;
  created_at: string;
  winner: {
    variant_id: string;
    branch: string;
    head_sha: string;
    selection_rationale: string;
  };
  comparison_scorecard: VariantComparisonSummary[];
  preserved_losers: Array<{
    variant_id: string;
    branch: string;
    head_sha: string;
    archived_or_active: 'active' | 'archived';
  }>;
  pr_summary_markdown: string;
  artifact_path: string;
}
```

---

## Extended State Machines

### Worktree Lifecycle States
```
created -> setup_pending -> setup_complete -> planned -> implemented -> validated -> ready_for_pr -> pr_open -> merged
   |             |               |              |            |             |              |            |
   +-------------+---------------+--------------+------------+-------------+--------------+------------+
                                                 |
                                         +-------+-------+
                                         |               |
                                         v               v
                                     archived         broken
                                         |               |
                                         v               v
                                    (restored)       (repaired)
```

- **`archived`**: Physical directory removed via `git worktree remove`; git branch and metadata preserved.
- **`broken`**: Missing directory, missing git branch, or unreadable metadata detected.

### Experiment Lifecycle States
```
created -> running -> awaiting_comparison -> winner_selected -> published
   |           |               |                    |               |
   +-----------+---------------+--------------------+---------------+
                                 |
                         +-------+-------+
                         |               |
                         v               v
                     archived         broken
                         |               |
                         v               v
                    (restored)       (repaired)
```

---

## Storage Locations

- `.mannostree/journal/transactions.jsonl` — Historical append-only audit trail
- `.mannostree/journal/active.json` — Currently in-flight transactions (ephemeral)
- `.mannostree/archives/<id>.json` — Archive snapshot metadata
- `.task/parallel-handoff.md` — Human-readable handoff report
- `.mannostree/experiments/<feature>-handoff.json` — Machine-readable handoff bundle
