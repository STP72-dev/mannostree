# Data Model: Fleet Sync & Cross-Worktree Conflict Matrix

**Feature**: `004-fleet-sync-conflict-matrix`  
**Date**: 2026-09-01  

---

## 1. Domain Entities & TypeScript Types

```typescript
export type FleetSyncStatusType =
  | 'SYNCED'
  | 'BEHIND'
  | 'AHEAD'
  | 'DIVERGED'
  | 'DIRTY_SKIPPED'
  | 'SESSION_ACTIVE_SKIPPED'
  | 'FAILED_CONFLICT'
  | 'FAILED_ERROR';

export interface WorktreeSyncStatus {
  worktree_id: string;
  branch: string;
  base_branch: string;
  status: FleetSyncStatusType;
  ahead: number;
  behind: number;
  dirty: boolean;
  active_session_id?: string;
  message?: string;
  updated_at: string;
}

export interface FleetSyncReport {
  synced_at: string;
  strategy: 'rebase' | 'merge' | 'ff-only';
  dry_run: boolean;
  total_worktrees: number;
  synced_count: number;
  skipped_count: number;
  failed_count: number;
  worktrees: WorktreeSyncStatus[];
}

export type ConflictSeverity = 'CLEAN' | 'SHARED_FILES_CLEAN' | 'CONFLICT';

export interface ConflictHunkDetail {
  file_path: string;
  source_lines?: string;
  target_lines?: string;
  conflict_type: 'content' | 'modify/delete' | 'rename/rename';
}

export interface ConflictMatrixCell {
  source_id: string;
  target_id: string;
  source_branch: string;
  target_branch: string;
  severity: ConflictSeverity;
  shared_files: string[];
  conflicting_files: string[];
  conflict_details: ConflictHunkDetail[];
  auto_mergeable: boolean;
}

export interface FleetConflictMatrixReport {
  analyzed_at: string;
  total_worktrees: number;
  worktree_ids: string[];
  conflict_hazard_count: number;
  shared_file_pair_count: number;
  matrix: ConflictMatrixCell[][];
  high_risk_pairs: Array<{
    source_id: string;
    target_id: string;
    conflicting_files: string[];
  }>;
}

export interface FleetSyncOptions {
  strategy?: 'rebase' | 'merge' | 'ff-only';
  preview?: boolean;
  dryRun?: boolean;
  target?: string;
}

export interface FleetConflictMatrixOptions {
  target?: string;
  simulateMerge?: boolean;
  failOnConflict?: boolean;
  verbose?: boolean;
  dryRun?: boolean;
}
```

---

## 2. Zod Validation Schemas

```typescript
export const FleetSyncStatusSchema = z.object({
  worktree_id: z.string(),
  branch: z.string(),
  base_branch: z.string(),
  status: z.enum([
    'SYNCED',
    'BEHIND',
    'AHEAD',
    'DIVERGED',
    'DIRTY_SKIPPED',
    'SESSION_ACTIVE_SKIPPED',
    'FAILED_CONFLICT',
    'FAILED_ERROR',
  ]),
  ahead: z.number().int().nonnegative(),
  behind: z.number().int().nonnegative(),
  dirty: z.boolean(),
  active_session_id: z.string().optional(),
  message: z.string().optional(),
  updated_at: z.string(),
});

export const FleetSyncReportSchema = z.object({
  synced_at: z.string(),
  strategy: z.enum(['rebase', 'merge', 'ff-only']),
  dry_run: z.boolean(),
  total_worktrees: z.number().int().nonnegative(),
  synced_count: z.number().int().nonnegative(),
  skipped_count: z.number().int().nonnegative(),
  failed_count: z.number().int().nonnegative(),
  worktrees: z.array(FleetSyncStatusSchema),
});

export const ConflictMatrixCellSchema = z.object({
  source_id: z.string(),
  target_id: z.string(),
  source_branch: z.string(),
  target_branch: z.string(),
  severity: z.enum(['CLEAN', 'SHARED_FILES_CLEAN', 'CONFLICT']),
  shared_files: z.array(z.string()),
  conflicting_files: z.array(z.string()),
  conflict_details: z.array(
    z.object({
      file_path: z.string(),
      source_lines: z.string().optional(),
      target_lines: z.string().optional(),
      conflict_type: z.enum(['content', 'modify/delete', 'rename/rename']),
    })
  ),
  auto_mergeable: z.boolean(),
});

export const FleetConflictMatrixReportSchema = z.object({
  analyzed_at: z.string(),
  total_worktrees: z.number().int().nonnegative(),
  worktree_ids: z.array(z.string()),
  conflict_hazard_count: z.number().int().nonnegative(),
  shared_file_pair_count: z.number().int().nonnegative(),
  matrix: z.array(z.array(ConflictMatrixCellSchema)),
  high_risk_pairs: z.array(
    z.object({
      source_id: z.string(),
      target_id: z.string(),
      conflicting_files: z.array(z.string()),
    })
  ),
});
```
