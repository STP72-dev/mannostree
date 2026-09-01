# Technical Research: Movement 5 — Parallel Publish & Multi-Branch Merge-Sync

**Feature**: `006-parallel-publish-merge-sync`  
**Date**: 2026-09-01  
**Status**: Completed

---

## 1. Technical Decisions

### Decision 1: Parallel PR Composition Pipeline (`parallel publish`)
- **Choice**: Multi-layer Markdown generator extracting and assembling evidence from `.task/` and `.mannostree/`:
  1. Executive Summary & Winning Variant Declaration
  2. Weighted Sum Model (WSM) Multi-Variant Benchmark Scorecard
  3. Solution Architecture Comparison Matrix
  4. Task Verification Checklist & Quality Gate Execution Logs
  5. Preserved Reference Branches (non-winning variants)
- **Rationale**: Automates 100% of pull request authoring with durable, reviewable evidence, eliminating review latency and "why wasn't approach X taken?" discussions.
- **Alternatives Considered**: Simple single-branch PR description (rejected: loses the value of parallel variant exploration and benchmark scores).

### Decision 2: GitHub CLI Execution & Offline Fallback
- **Choice**: Dynamic `GhExecutor` integration with offline markdown export.
  - If `gh` CLI is installed and authenticated (`gh auth status`): runs `gh pr create --title <title> --body-file <path> [--draft] [--base <base>]`.
  - If `gh` is missing, unauthenticated, or remote push is offline: exports `.task/pr-body.md`, pushes the git branch (if `--push` enabled), and outputs clear manual PR creation guidance.
- **Rationale**: Ensures the CLI works reliably in CI runners, air-gapped environments, and local developer workstations without crashing on missing API tokens.
- **Alternatives Considered**: Direct Octokit / GitHub REST API client (rejected: introduces heavy dependency and requires managing separate GitHub API tokens when `gh` already handles SSH/OAuth credentials).

### Decision 3: In-Memory 3-Way Merge-Sync Engine (`fleet merge-sync`)
- **Choice**: Pre-flight simulated merging using `git merge-tree --write-tree` against the target trunk (e.g. `staging` or `release/2026-09`).
  - Step 1: Detect base commit between target trunk and each candidate branch.
  - Step 2: Simulate in-memory 3-way merge for each branch sequentially.
  - Step 3: If conflicts are found, flag collision blocks and abort without touching git state (unless `--ignore-conflicts` is passed).
  - Step 4: If all candidates pass (or `--yes` is confirmed), assemble the integrated target branch and emit `.mannostree/releases/<target_branch>.json` manifest.
- **Rationale**: Completely prevents broken integration trunks and merge lockups by catching semantic and syntactic merge collisions before any git branch pointers move.
- **Alternatives Considered**: Trial merge in temporary worktree on disk (rejected: slower and creates disk clutter; in-memory `merge-tree` executes in < 50ms per branch).

### Decision 4: Batch Fleet Publishing (`fleet publish`)
- **Choice**: Batch publisher iterating through specified worktrees (`--selected <ids>` or `--all`), verifying ready lifecycle state (`IMPLEMENTED`, `VERIFIED`, `REVIEWED`, `READY_FOR_PR`), releasing active concurrency leases, and opening pull requests.
- **Rationale**: Streamlines multi-agent fleet operations where an orchestration run completes 3–10 features across different modules simultaneously.
- **Alternatives Considered**: Requiring operators to run `mannostree pr` individually for each worktree (rejected: tedious for autonomous workflows).

---

## 2. Invariants & Guardrails

1. **Explicit Winner Selection**: `parallel publish` will strictly refuse to publish unless an experiment has an explicit winner in `.mannostree/experiments/<feature>.json`.
2. **Quality Gate Guard**: If quality gates or contract fulfillment failed, `parallel publish` halts unless `--force` is supplied.
3. **Target Branch Safety**: `fleet merge-sync` will never force-push or mutate protected branches without explicit user confirmation (`--yes`).
4. **Variant Preservation**: Non-winning experiment branches are preserved in git and listed as references in the PR body.
