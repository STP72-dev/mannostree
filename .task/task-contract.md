# Task Contract: Phase 5 Artifacts, Publishing, & Ecosystem Integration

## Problem
After implementing and validating changes in an isolated worktree, developers and autonomous AI agents need dependable tools to summarize task results, assemble clean pull request documentation from durable `.task/` artifacts, link GitHub issues, and generate handoff packages for successor agents or human reviewers.

## Scope
Deliver Phase 5 Artifacts, Publishing, & Ecosystem Integration while preserving 100% backward compatibility across Phases 1, 2, 3, and 4:
1. **`pr <id> [--draft] [--title <text>] [--body-file <path>] [--push] [--dry-run]`**:
   - Generates PR body by aggregating `.task/task-contract.md`, `RESULTS.md`, `.task/quality-gates.md`, and `.task/review.md`.
   - Default mode is `prepare-only`: generates PR body locally (saved to `.task/pr-body.md` and returned in output envelope).
   - If `--push` is passed, executes git push and optionally invokes `gh pr create` when available.
   - Updates metadata (`publish.pr_number`, `publish.pr_url`, `publish.published_at`, `lifecycle_state: 'PR_OPEN'`).
   - Supports `--dry-run` preview.
2. **`issue <id> [--from-issue <num>] [--title <text>] [--dry-run]`**:
   - Links worktree to an issue; updates `.task/task-contract.md` and metadata (`task.issue_number`, `task.issue_title`, `task.source_type`).
3. **`task <id> [--validate] [--summary]`**:
   - Inspects durable `.task/` artifacts, validates completeness of required files, and computes task status summary.
4. **`handoff <id> [--to <name>] [--notes <text>]`**:
   - Prepares an agent/human handoff summary containing current worktree record, git status, ahead/behind counts, diff summary, and pending review recommendations.
5. **Testing & Documentation**:
   - Unit tests for PR body generation, issue linking, task artifact validation, and handoff package generation.
   - Integration tests for all Phase 5 CLI commands.
   - Update README and durable task artifacts.

## Out-of-Scope
- Auto-merging pull requests.
- Unsolicited background remote git pushes.

## Acceptance Criteria
- [ ] **Compatibility**: All 48 existing unit and integration tests continue to pass.
- [ ] **`pr`**: Generates structured PR body from artifacts; operates in `prepare-only` by default; updates publish metadata; supports `--push` and `--dry-run`.
- [ ] **`issue`**: Links issue metadata and updates task contract file.
- [ ] **`task`**: Validates artifact files and quality gates.
- [ ] **`handoff`**: Outputs complete handoff bundle for successor agents.
- [ ] **Test Coverage**: 100% passing tests across all test suites.

## Explicit Assumptions
- Base branch: `main`.
- Publishing mode: `prepare-only` by default.
