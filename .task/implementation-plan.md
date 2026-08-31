# Implementation Plan: GitHub CLI Adapter Verification & Coverage Measurement

## Overview
Implement the injected `GhAdapter` in `src/core/publish.ts`, connect it to `MannostreeOrchestrator`, write comprehensive unit and integration tests proving the `--push` publishing flow, and verify code coverage metrics.

## Detailed Tasks

### 1. `GhExecutor` in `src/core/publish.ts`
- Define `GhExecutor` type.
- Implement default `defaultGhExecutor` using `execFileAsync('gh', args, { cwd })`.
- Update `PublishEngine` to invoke `this.ghExecutor(ghArgs, worktreeFullPath)`.
- Extract PR URL and number via regex.

### 2. Comprehensive Test Suite
- `tests/unit/publish.test.ts`:
  - Test `--push` with mock `ghExecutor` returning PR URL.
  - Test `--push` with `--draft` flag.
  - Test `--push` when `gh` returns error (fails gracefully, records pushed branch).
- `tests/integration/publish-push.test.ts`:
  - End-to-end integration test with local git remote and mock `gh` executable on PATH.

### 3. Verification & Code Coverage
- Run `npm run lint`.
- Run `npm run build`.
- Run `npm run coverage` and document exact coverage statistics in `.task/quality-gates.md`.

---

## Acceptance-to-Test Traceability Matrix

| Acceptance Item | Implementation | Test Suite |
|-----------------|----------------|------------|
| `gh pr create` argument formatting | `PublishEngine.publishPr` | `tests/unit/publish.test.ts` |
| PR number & URL parsing | `PublishEngine.publishPr` | `tests/unit/publish.test.ts` |
| Fallback on `gh` error | `PublishEngine.publishPr` | `tests/unit/publish.test.ts` |
| End-to-end `--push` workflow | `PublishEngine` + `GitEngine` | `tests/integration/publish-push.test.ts` |
| Code Coverage Reporting | `@vitest/coverage-v8` | `npm run coverage` |
