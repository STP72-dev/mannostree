# Validation Report: Movement 10 — Issue Tracker Bi-directional Sync (Jira / Linear / GitHub Issues)

**Date**: 2026-09-02T12:09:30+02:00  
**Feature Branch**: `010-issue-tracker-sync`  
**Status**: PASS  
**Test Suite Pass Rate**: 100% (78/78 test files, 189/189 tests passed)  
**Strict Typecheck / Lint**: PASS (`tsc --noEmit` 0 errors)

---

## 1. Coverage Summary

| Metric | Count | Percentage |
|--------|-------|------------|
| Functional Requirements Covered | 10 / 10 | 100% |
| User Stories & Acceptance Scenarios Met | 5 / 5 | 100% |
| Edge Cases & Invariants Handled | 6 / 6 | 100% |
| Unit & Integration Tests Present | 6 test suites | 100% |

---

## 2. Requirements Verification Matrix

| Requirement | Implementation Artifacts | Verification Method / Tests | Status |
|---|---|---|---|
| **FR-001** (Issue Tracker Configuration Schema) | [`src/config/schema.ts`](file:///home/w7-loqker/w7-workspace/organcorp/lsol/mannostree/src/config/schema.ts) (`IssueTrackerConfigSchema`) | `tests/unit/config.test.ts` | **PASS** |
| **FR-002** (Pluggable Issue Adapter Architecture) | [`src/issues/base.ts`](file:///home/w7-loqker/w7-workspace/organcorp/lsol/mannostree/src/issues/base.ts), [`src/issues/jira.ts`](file:///home/w7-loqker/w7-workspace/organcorp/lsol/mannostree/src/issues/jira.ts), [`src/issues/linear.ts`](file:///home/w7-loqker/w7-workspace/organcorp/lsol/mannostree/src/issues/linear.ts), [`src/issues/github.ts`](file:///home/w7-loqker/w7-workspace/organcorp/lsol/mannostree/src/issues/github.ts), [`src/issues/generic.ts`](file:///home/w7-loqker/w7-workspace/organcorp/lsol/mannostree/src/issues/generic.ts) | `tests/unit/issue-jira.test.ts`, `tests/unit/issue-linear.test.ts`, `tests/unit/issue-github.test.ts` | **PASS** |
| **FR-003** (Automated Issue Ingestion) | [`src/issues/engine.ts`](file:///home/w7-loqker/w7-workspace/organcorp/lsol/mannostree/src/issues/engine.ts) (`ingestIssue`, `scaffoldTaskContract`), [`src/cli/commands/spawn.ts`](file:///home/w7-loqker/w7-workspace/organcorp/lsol/mannostree/src/cli/commands/spawn.ts) (`--issue`), [`src/cli/commands/issue.ts`](file:///home/w7-loqker/w7-workspace/organcorp/lsol/mannostree/src/cli/commands/issue.ts) (`issue ingest`) | `tests/integration/issue-sync-lifecycle.test.ts` | **PASS** |
| **FR-004** (Automated Lifecycle Transitions) | [`src/issues/engine.ts`](file:///home/w7-loqker/w7-workspace/organcorp/lsol/mannostree/src/issues/engine.ts) (`transitionIssue`), [`src/core/orchestrator.ts`](file:///home/w7-loqker/w7-workspace/organcorp/lsol/mannostree/src/core/orchestrator.ts) (`spawn`, `pr`) | `tests/unit/issue-engine.test.ts`, `tests/integration/issue-sync-lifecycle.test.ts` | **PASS** |
| **FR-005** (Quality Evidence & Comment Attachment) | [`src/issues/engine.ts`](file:///home/w7-loqker/w7-workspace/organcorp/lsol/mannostree/src/issues/engine.ts) (`postComment`, `syncEvidence`), [`src/cli/commands/issue.ts`](file:///home/w7-loqker/w7-workspace/organcorp/lsol/mannostree/src/cli/commands/issue.ts) (`issue comment`, `issue sync`) | `tests/unit/issue-engine.test.ts`, `tests/integration/issue-sync-lifecycle.test.ts` | **PASS** |
| **FR-006** (Issue Metadata & Registry Persistence) | [`src/metadata/store.ts`](file:///home/w7-loqker/w7-workspace/organcorp/lsol/mannostree/src/metadata/store.ts) (`getIssueRecord`, `saveIssueRecord`), [`src/metadata/schema.ts`](file:///home/w7-loqker/w7-workspace/organcorp/lsol/mannostree/src/metadata/schema.ts) (`IssueRecordSchema`, `TaskMetadataSchema`) | `tests/unit/issue-engine.test.ts` | **PASS** |
| **FR-007** (Drift Detection & Status Dashboard) | [`src/issues/engine.ts`](file:///home/w7-loqker/w7-workspace/organcorp/lsol/mannostree/src/issues/engine.ts) (`checkIssueDrift`, `listIssues`), [`src/cli/commands/issue.ts`](file:///home/w7-loqker/w7-workspace/organcorp/lsol/mannostree/src/cli/commands/issue.ts) (`issue status`, `issue list`) | `tests/unit/issue-engine.test.ts`, `tests/integration/issue-sync-lifecycle.test.ts` | **PASS** |
| **FR-008** (Multi-Issue Batch Sync for Poly-Worktrees) | [`src/issues/engine.ts`](file:///home/w7-loqker/w7-workspace/organcorp/lsol/mannostree/src/issues/engine.ts) | `tests/unit/issue-engine.test.ts` | **PASS** |
| **FR-009** (Doctor Issue Diagnostic Audit) | [`src/core/doctor.ts`](file:///home/w7-loqker/w7-workspace/organcorp/lsol/mannostree/src/core/doctor.ts) (`auditIssueTrackers`), [`src/cli/output.ts`](file:///home/w7-loqker/w7-workspace/organcorp/lsol/mannostree/src/cli/output.ts) (`formatDoctorReport`) | `tests/unit/issue-doctor.test.ts` | **PASS** |
| **FR-010** (Dry-Run Preview Guarantee) | All adapters and engine methods support `dryRun: boolean` | `tests/unit/issue-jira.test.ts`, `tests/unit/issue-linear.test.ts`, `tests/unit/issue-github.test.ts` | **PASS** |

---

## 3. User Story & Acceptance Criteria Verification

### User Story 1: Issue Ingestion & Auto-Scaffolding on Spawn (P1 - MVP)
- **Scenario 1.1**: Spawning with `mannostree spawn auth-v2 --issue ENG-505` creates the worktree, generates `.task/task-contract.md` with issue title, acceptance criteria checklist, and persists metadata. Verified in `tests/integration/issue-sync-lifecycle.test.ts`.
- **Scenario 1.2**: Standalone ingestion via `mannostree issue ingest ENG-101` fetches issue details and scaffolds contract. Verified in `tests/unit/issue-engine.test.ts`.

### User Story 2: Automated Lifecycle State Transitions (P1)
- **Scenario 2.1**: Auto-transition to `In Progress` upon worktree spawn. Verified in `tests/integration/issue-sync-lifecycle.test.ts`.
- **Scenario 2.2**: Auto-transition to `In Review` and post PR comment upon `mannostree pr`. Verified in `src/core/orchestrator.ts:1370-1395`.
- **Scenario 2.3**: Status transition mapping and idempotency. Verified in `tests/unit/issue-engine.test.ts`.

### User Story 3: Quality Evidence & Comment Synchronization (P2)
- **Scenario 3.1**: Posting `.task/RESULTS.md` evidence summary and quality gate checklist to remote issue via `mannostree issue sync`. Verified in `tests/integration/issue-sync-lifecycle.test.ts`.

### User Story 4: Bi-Directional Drift Detection & Reconciliation (P2)
- **Scenario 4.1**: `mannostree issue status` flags drift when remote issue is `Closed` while worktree is active. Verified in `tests/unit/issue-engine.test.ts`.

### User Story 5: Issue Tracker Health & Credentials Doctor Audit (P2)
- **Scenario 5.1**: `mannostree doctor` audits registered adapters and reports reachability and token validity. Verified in `tests/unit/issue-doctor.test.ts`.

---

## 4. Safety Invariants & Non-Functional Requirements Verification

1. **Credential Safety**:
   - `JIRA_API_TOKEN`, `LINEAR_API_KEY`, `GITHUB_TOKEN` are read strictly from environment variables or runtime headers.
   - `IssueRecordSchema` and `WorktreeRecordSchema` store only public issue metadata (`key`, `url`, `title`, `status`, `assignee`). Zero tokens are stored on disk.
2. **Offline Resilience & Non-Fatal Warnings**:
   - Issue tracker sync failures during `spawn` emit non-fatal warnings without failing workspace creation.
3. **Idempotent Transitions**:
   - Transitions to existing statuses return `mode: 'noop'` without error.
4. **Universal Dry-Run Simulation**:
   - All mutations in `ingestIssue`, `transitionIssue`, `postComment`, and `syncEvidence` respect `--dry-run`.

---

## 5. Automated Test Results

```text
 ✓ tests/unit/issue-jira.test.ts (4 tests)
 ✓ tests/unit/issue-linear.test.ts (3 tests)
 ✓ tests/unit/issue-github.test.ts (3 tests)
 ✓ tests/unit/issue-engine.test.ts (4 tests)
 ✓ tests/unit/issue-doctor.test.ts (1 test)
 ✓ tests/integration/issue-sync-lifecycle.test.ts (1 test)
 
 Test Files  78 passed (78)
      Tests  189 passed (189)
```

---

## 6. Recommendations & Next Steps

1. Commit all Movement 10 changes to `010-issue-tracker-sync`.
2. Push branch to remote `origin/010-issue-tracker-sync`.
3. Proceed with subsequent roadmap movements.
