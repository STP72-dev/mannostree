# Implementation Plan: Phase 5 Artifacts, Publishing, & Ecosystem Integration

## Overview
Deliver Phase 5 Artifacts, Publishing, & Ecosystem Integration for **Mannostree**:
- **Publish Engine (`src/core/publish.ts`)**:
  - `assemblePrBody`: Reads `.task/task-contract.md`, `RESULTS.md`, `.task/quality-gates.md`, and `.task/review.md` to compose a comprehensive PR body markdown document.
  - `publishPr`: Saves `.task/pr-body.md`. In default `prepare-only` mode, generates and returns PR body without network calls. When `--push` is passed, runs `git push` and optionally calls `gh pr create` if GitHub CLI is installed.
  - Updates worktree metadata (`publish.pushed`, `publish.pr_number`, `publish.pr_url`, `publish.published_at`, `lifecycle_state: 'PR_OPEN'`).
- **Task Engine (`src/core/task.ts`)**:
  - `linkIssue`: Associates GitHub issue number and title to worktree record and updates `.task/task-contract.md`.
  - `validateArtifacts`: Checks required files (`task-contract.md`, `implementation-plan.md`, `quality-gates.md`, `review.md`, `RESULTS.md`) and calculates completeness score.
  - `generateHandoff`: Builds comprehensive agent/human handoff summary.
- **Orchestrator Integration**:
  - Add `pr()`, `issue()`, `task()`, and `handoff()` methods to `MannostreeOrchestrator`.
- **CLI Commands**:
  - `mannostree pr <id> [--draft] [--title <text>] [--body-file <path>] [--push] [--dry-run]`
  - `mannostree issue <id> [--from-issue <num>] [--title <text>] [--dry-run]`
  - `mannostree task <id> [--validate] [--summary]`
  - `mannostree handoff <id> [--to <name>] [--notes <text>]`
- **Testing & Documentation**:
  - Unit tests for PR body compilation, issue linking, task artifact validation, and handoff generation.
  - CLI integration tests for all 4 commands.

---

## Detailed Specifications

### 1. `pr <id> [--draft] [--title <text>] [--body-file <path>] [--push] [--dry-run]`
- Finds worktree record.
- Reads `task-contract.md`, `RESULTS.md`, `quality-gates.md`, `review.md`.
- Assembles PR markdown body and saves to `.task/pr-body.md`.
- If `push`: pushes branch to remote and invokes `gh pr create` if available.
- If `prepare-only` (default): outputs PR body and manual instructions.
- Updates metadata: `publish.pr_number`, `publish.pr_url`, `publish.published_at`, `lifecycle_state: 'PR_OPEN'`.

### 2. `issue <id> [--from-issue <num>] [--title <text>]`
- Links issue number and title to worktree record (`task.issue_number`, `task.issue_title`, `task.source_type: 'issue'`).
- Updates `.task/task-contract.md` header with issue reference.

### 3. `task <id> [--validate] [--summary]`
- Audits `.task/` artifacts.
- Checks presence and contents of:
  - `task-contract.md`
  - `implementation-plan.md`
  - `quality-gates.md`
  - `review.md`
  - `RESULTS.md`
- Returns completeness score (0-100%) and missing artifacts list.

### 4. `handoff <id> [--to <name>] [--notes <text>]`
- Serializes complete snapshot: worktree record, branch, base branch, head commit, diff stats, validation status, reviewer notes, and next recommended actions.

---

## Acceptance Traceability Matrix

| Requirement | Implementation Component | Test Suite |
|-------------|--------------------------|------------|
| Artifact PR compilation & prepare-only mode | `PublishEngine.publishPr`, `orchestrator.pr` | `tests/unit/publish.test.ts` |
| Issue linking & task contract update | `TaskEngine.linkIssue`, `orchestrator.issue` | `tests/unit/task.test.ts` |
| Task artifact validation | `TaskEngine.validateArtifacts`, `orchestrator.task` | `tests/unit/task.test.ts` |
| Agent/human handoff summary | `TaskEngine.generateHandoff`, `orchestrator.handoff` | `tests/unit/task.test.ts` |
| CLI commands & dry-run | `src/cli/commands/pr.ts`, `issue.ts`, `task.ts`, `handoff.ts` | `tests/integration/phase5.test.ts` |
| Full backward compatibility | All prior modules | All test suites |
