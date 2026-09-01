# Data Model: Movement 5 — Parallel Publish & Multi-Branch Merge-Sync

**Feature**: `006-parallel-publish-merge-sync`  
**Date**: 2026-09-01  
**Status**: Completed

---

## 1. Domain Types & Schemas

### 1.1 `ParallelPublishOptions`
Options passed to `orchestrator.parallelPublish` and CLI command `parallel publish`:

```typescript
export interface ParallelPublishOptions {
  featureName: string;
  title?: string;
  draft?: boolean;
  push?: boolean;
  targetBase?: string;
  preview?: boolean;
  dryRun?: boolean;
  force?: boolean;
  exportPrBody?: string;
}
```

### 1.2 `ParallelPublishResult`
Output returned by parallel winner publishing:

```typescript
export interface ParallelPublishResult {
  feature_name: string;
  winner_variant: string;
  branch: string;
  base_branch: string;
  pushed: boolean;
  pr_number?: number | null;
  pr_url?: string | null;
  pr_body_file?: string;
  pr_title: string;
  pr_body: string;
  published_at: string;
  comparison_embedded: boolean;
  quality_gates_passed: boolean;
  evaluated_variants: string[];
}
```

### 1.3 `FleetMergeSyncCandidate`
Status of a single candidate branch evaluated during fleet merge-sync:

```typescript
export interface FleetMergeSyncCandidate {
  worktree_id: string;
  branch: string;
  head_sha: string;
  can_merge_cleanly: boolean;
  conflicting_files: string[];
  status: 'READY' | 'MERGED' | 'CONFLICT_BLOCKED' | 'SKIPPED';
  message?: string;
}
```

### 1.4 `FleetMergeSyncReport`
Consolidated report of multi-branch pre-flight merge simulation and assembly:

```typescript
export interface FleetMergeSyncReport {
  timestamp: string;
  target_branch: string;
  dry_run: boolean;
  total_candidates: number;
  clean_count: number;
  conflict_count: number;
  integrated_count: number;
  candidates: FleetMergeSyncCandidate[];
  release_manifest_path?: string;
}
```

### 1.5 `FleetMergeSyncOptions`
```typescript
export interface FleetMergeSyncOptions {
  target: string;
  candidates?: string[];
  preview?: boolean;
  dryRun?: boolean;
  yes?: boolean;
  ignoreConflicts?: boolean;
  createTargetIfMissing?: boolean;
}
```

### 1.6 `FleetBatchPublishReport`
Report of batch pull request creation across the fleet:

```typescript
export interface FleetBatchPublishItem {
  worktree_id: string;
  branch: string;
  status: 'PUBLISHED' | 'SKIPPED' | 'FAILED';
  pr_number?: number | null;
  pr_url?: string | null;
  message?: string;
}

export interface FleetBatchPublishReport {
  timestamp: string;
  total_targeted: number;
  published_count: number;
  skipped_count: number;
  failed_count: number;
  results: FleetBatchPublishItem[];
}
```

### 1.7 `FleetBatchPublishOptions`
```typescript
export interface FleetBatchPublishOptions {
  all?: boolean;
  selected?: string[];
  draft?: boolean;
  push?: boolean;
  targetBase?: string;
  preview?: boolean;
  dryRun?: boolean;
  force?: boolean;
}
```

---

## 2. Release Manifest Persistence

Persisted at `.mannostree/releases/<target_branch_slug>.json`:

```typescript
export interface ReleaseManifestRecord {
  version: number;
  target_branch: string;
  assembled_at: string;
  head_commit: string;
  integrated_worktrees: Array<{
    worktree_id: string;
    branch: string;
    commit_sha: string;
  }>;
}
```
