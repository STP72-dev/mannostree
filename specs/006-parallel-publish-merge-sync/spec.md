# Feature Specification: Parallel Publish & Multi-Branch Merge-Sync

**Feature Branch**: `006-parallel-publish-merge-sync`  
**Created**: 2026-09-01  
**Status**: Ready for Planning  
**Input**: User description: "Movement 5: Parallel Publish & Multi-Branch Merge-Sync"

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Single-Command Parallel Winner Publishing (Priority: P1) 🎯 MVP

After running parallel variant experiments (e.g. `experiment/auth-v1`, `v2`, `v3`) and selecting a winning implementation (via `parallel pick` or `parallel eval --auto-pick`), developers and autonomous agents need a standardized, reproducible publishing pipeline (`mannostree parallel publish <feature>`). This command validates quality gates, compiles multi-variant benchmark comparisons and task documentation from `.task/` and metadata into a rich Pull Request body, pushes the selected branch to the remote git origin, and opens a GitHub Pull Request (or outputs reviewable PR markdown).

**Why this priority**: Bridges the gap between variant comparison/selection and team code review, eliminating manual PR drafting and ensuring evidence-backed pull requests with benchmark comparison matrices.

**Independent Test**: Can be tested by creating an experiment with 2 variants, picking a winner, running `mannostree parallel publish <feature> --preview` to inspect compiled PR markdown containing scorecard and variant comparison, and running `mannostree parallel publish <feature> --draft` with mocked GitHub CLI to verify branch push and PR creation.

**Acceptance Scenarios**:
1. **Given** an experiment with a selected winning variant and completed quality gates, **When** the user runs `mannostree parallel publish <feature> --preview`, **Then** the system generates a complete PR package (title, branch, base branch, markdown body with benchmark matrix, task checklist, and winning rationale) without mutating remote git state.
2. **Given** an experiment where no winner has been selected yet, **When** `mannostree parallel publish <feature>` is executed, **Then** the command refuses to publish and outputs an error instructing the user to run `parallel pick` or `parallel eval --auto-pick` first.
3. **Given** a winning variant whose verification or quality gates failed, **When** `mannostree parallel publish <feature>` is executed without `--force`, **Then** publishing is blocked with a report of failing quality gates.
4. **Given** valid publication options (`--draft`, `--title`, `--target-base`, `--push`), **When** publishing executes, **Then** the winner branch is pushed to remote, the PR is opened, and publication status is saved in `.mannostree/experiments/<feature>.json` and the worktree record.

---

### User Story 2 - Multi-Variant Comparison Artifact Embedding in PRs (Priority: P1)

Reviewers evaluating a pull request generated from a parallel experiment need full context on which alternative architectures or solutions were evaluated, their relative benchmark scores (duration, memory, test results, blast radius), and why the winner was selected over competing variants.

**Why this priority**: Eliminates "why didn't you try approach X?" review cycles by embedding durable comparative evidence directly into the PR description.

**Independent Test**: Can be tested by running `parallel eval` on a multi-variant feature, publishing the winner, and verifying that the generated PR body includes: (a) executive summary, (b) solution options table, (c) Weighted Sum Model benchmark scorecard, and (d) full task acceptance checklist.

**Acceptance Scenarios**:
1. **Given** completed parallel evaluation data in `.mannostree/experiments/<feature>.json` and `.task/results.md`, **When** the PR body is generated, **Then** it embeds a Markdown table contrasting all evaluated variants with their composite scores, quality gate results, and code diff statistics.
2. **Given** non-winning variants, **When** published, **Then** the PR body lists losing variants as preserved reference branches (e.g. `experiment/auth-v2`) without deleting them.

---

### User Story 3 - Fleet Multi-Branch Release Assembly & Pre-Flight Merge Simulation (Priority: P2)

When preparing to integrate multiple concurrent feature worktrees or experiment winners into a shared integration or release branch (e.g. `staging` or `release/2026-09`), release managers and orchestrators need an automated merge-sync engine (`mannostree fleet merge-sync --target staging`) that performs pre-flight in-memory 3-way merge simulations across all candidate branches, detects mutual collision hazards, computes dependency-ordered integration sequences, and produces a consolidated staging release branch.

**Why this priority**: Prevents broken staging environments and integration merge gridlocks by catching cross-branch conflicts before branches are merged to shared trunks.

**Independent Test**: Can be tested by creating 3 feature branches (2 orthogonal, 1 conflicting), running `mannostree fleet merge-sync --target staging --preview` to identify the conflicting branch, filtering candidates, and executing `mannostree fleet merge-sync --target staging --yes` to assemble the clean release branch.

**Acceptance Scenarios**:
1. **Given** multiple active or completed feature worktrees, **When** the operator runs `mannostree fleet merge-sync --target <target-branch> --preview`, **Then** the system simulates pairwise 3-way merges into the target branch and outputs a pre-flight integration scorecard (clean branches vs conflict blockers).
2. **Given** direct merge conflicts detected in one or more candidate branches, **When** `fleet merge-sync` runs without `--ignore-conflicts`, **Then** the integration process halts safely without modifying the target branch, reporting the conflicting hunks and offending worktrees.
3. **Given** all selected candidate branches pass pre-flight simulation, **When** the user runs `fleet merge-sync --target <target-branch> --yes`, **Then** the system creates or updates the target release branch, sequentially merges candidate branches, and records the release manifest in `.mannostree/releases/`.

---

### User Story 4 - Batch Fleet Multi-PR Publishing (Priority: P2)

In large-scale multi-agent operations where several features or variants have been verified, operators need to publish pull requests in batch (`mannostree fleet publish --all` / `--selected <ids>`) with unified concurrency lease validation, conflict checks against the base branch, and machine-readable output.

**Why this priority**: Automates end-of-iteration release pipelines across dozens of concurrent developer workspaces.

**Independent Test**: Can be tested by selecting 3 completed worktrees, running `mannostree fleet publish --all --draft --json`, verifying that active concurrency leases are released, each PR is created, and a summary report is returned.

**Acceptance Scenarios**:
1. **Given** multiple ready-for-PR worktrees, **When** `mannostree fleet publish --selected wt-1,wt-2 --draft` is run, **Then** each worktree is published, and a batch summary table with PR URLs is displayed.
2. **Given** a worktree that is dirty or has failing quality gates, **When** batch publish runs, **Then** the failing worktree is safely skipped with reason logged, while valid worktrees proceed.

---

### Edge Cases

- **Missing Remote Access / Offline Mode**: If `gh` CLI or git remote is unreachable, `parallel publish` supports `--export-pr <path>` or writes the complete PR markdown to `.task/pr-body.md` without failing.
- **Merge Conflict During Release Assembly**: If a semantic collision occurs during sequential merge simulation in `fleet merge-sync`, the operation performs an atomic abort and leaves the target branch untouched.
- **Publishing an Already Published Branch**: If a PR already exists for the branch, `parallel publish` detects the existing PR number, updates the PR body/title if requested, and avoids duplicate PR creation.
- **Winner Branch Dirty or Missing**: If the winner worktree was unmounted or has uncommitted modifications, publishing requires clean state or explicit `--force`.

---

## Requirements *(mandatory)*

### Functional Requirements

- **`FR-001`**: The system MUST support `mannostree parallel publish <feature_name>` to compile artifacts, push the winner branch, and open a Pull Request for a selected experiment winner.
- **`FR-002`**: `parallel publish` MUST verify that a winning variant has been explicitly selected in `.mannostree/experiments/<feature>.json` before proceeding.
- **`FR-003`**: `parallel publish` MUST automatically compile PR content from `.task/` artifacts (`task-contract.md`, `solution-options.md`, `quality-gates.md`, `RESULTS.md`) and benchmark scorecards.
- **`FR-004`**: `parallel publish` MUST support `--draft` to open draft pull requests and `--preview` / `--dry-run` to output formatted PR body without remote push.
- **`FR-005`**: `parallel publish` MUST embed a multi-variant benchmark comparison matrix into the PR description when parallel evaluation data exists.
- **`FR-006`**: The system MUST support `mannostree fleet merge-sync --target <branch>` to simulate and execute multi-branch integration assembly.
- **`FR-007`**: `fleet merge-sync` MUST perform pre-flight in-memory 3-way merge simulations for all candidate branches against the target branch before performing any git mutations.
- **`FR-008`**: `fleet merge-sync` MUST abort immediately without modifying target branches if unresolved conflicts exist, unless `--ignore-conflicts` is passed.
- **`FR-009`**: `fleet merge-sync` MUST record integration manifests in `.mannostree/releases/<target_branch>.json` containing commit SHAs, integrated branches, and timestamp.
- **`FR-010`**: The system MUST support batch fleet publishing via `mannostree fleet publish [--all] [--selected <ids>] [--draft]`.
- **`FR-011`**: The system MUST update `WorktreeRecord.publish` and `ExperimentRecord.publish` metadata with PR URL, PR number, target branch, and published timestamp.
- **`FR-012`**: All publish and merge-sync commands MUST support `--json` and `--yaml` machine-readable output envelopes.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **`SC-001`**: Zero manual copy-pasting needed to publish evidence-backed PRs from parallel experiment winners.
- **`SC-002`**: 100% of generated PR bodies for parallel experiments contain structured variant comparison tables and quality gate verification records.
- **`SC-003`**: 0 broken release branches created due to pre-flight 3-way merge conflict detection in `fleet merge-sync`.
- **`SC-004`**: Multi-branch release simulation executes in under 3 seconds for 10 concurrent feature branches.

---

## Key Entities & Data Model

### 1. `ParallelPublishResult`
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
  published_at: string;
  comparison_embedded: boolean;
}
```

### 2. `FleetMergeSyncReport`
```typescript
export interface FleetMergeSyncCandidate {
  worktree_id: string;
  branch: string;
  head_sha: string;
  can_merge_cleanly: boolean;
  conflicting_files: string[];
  status: 'READY' | 'MERGED' | 'CONFLICT_BLOCKED' | 'SKIPPED';
}

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

### 3. `FleetBatchPublishReport`
```typescript
export interface FleetBatchPublishReport {
  timestamp: string;
  total_targeted: number;
  published_count: number;
  skipped_count: number;
  results: Array<{
    worktree_id: string;
    branch: string;
    status: 'PUBLISHED' | 'SKIPPED' | 'FAILED';
    pr_url?: string;
    message?: string;
  }>;
}
```

---

## Assumptions & Dependencies

- **GitHub CLI (`gh`)**: Used when available for direct PR creation; gracefully falls back to local PR markdown export and git push when `gh` is unauthenticated or not installed.
- **Preservation Policy**: Losing experiment variants remain in local git branches / metadata and are never deleted during publish.
- **Non-Destructive Invariants**: Neither `parallel publish` nor `fleet merge-sync` will force-push over remote protected branches without explicit parameters.
