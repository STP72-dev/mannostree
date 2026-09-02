# Feature Specification: Movement 10 — Issue Tracker Bi-directional Sync (Jira / Linear / GitHub Issues)

**Feature Branch**: `010-issue-tracker-sync`  
**Created**: 2026-09-02T11:53:00+02:00  
**Status**: DRAFT  
**Priority**: P1 (Issue Ingestion, Lifecycle Transition Automation & Evidence Attachment)

---

## 1. Purpose & Problem Statement

Modern software engineering teams and autonomous AI agents rely on project management and issue tracking systems (such as Jira, Linear, and GitHub Issues) to record requirements, coordinate sprints, prioritize bugs, and track delivery progress.

In typical worktree and agent-driven workflows:
1. **Manual Requirement Transcription**: Developers and agents must manually copy ticket descriptions, acceptance criteria, and edge cases from web interfaces into local task contracts.
2. **Untracked Tracker Drift**: As worktrees are spawned, implemented, benchmarked, and published as PRs, the remote issue tracker remains out-of-date unless manually transitioned by the engineer.
3. **Missing Verification Evidence**: Quality gate results, benchmark comparison receipts, and agent review summaries remain trapped on local workstations or CI artifacts without being posted back to the parent issue ticket.
4. **Disjointed Multi-Issue Clusters**: Multi-repo poly-worktrees and parallel experiments spanning multiple tickets lack centralized issue reconciliation.

**Movement 10** introduces **Issue Tracker Bi-directional Sync**, equipping Mannostree with pluggable adapters for **Jira**, **Linear**, and **GitHub Issues** (plus generic webhook/REST fallback) to automatically ingest ticket requirements into durable `.task/task-contract.md` specifications, automate lifecycle state transitions, publish verification evidence receipts to tickets, and detect sync drift.

---

## 2. User Personas & Target Users

- **Autonomous Agent Runners & Coordinators**: Automatically ingest ticket requirements into formal contracts and update ticket state as agents achieve milestones.
- **Software Engineers & Technical Leads**: Eliminate context-switching by spawning workspaces directly from issue IDs (`mannostree spawn --issue PROJ-101`) and having ticket states auto-transition as PRs open.
- **Product Managers & Scrum Masters**: Gain real-time, transparent visibility into worktree progress, automated review summaries, and quality gate receipts directly within Jira/Linear/GitHub Issues.
- **QA & Release Engineers**: Ensure pull requests and release manifests are traceably linked to verified issue criteria.

---

## 3. User Scenarios & Acceptance Criteria

### User Story 1: Issue Ingestion & Auto-Scaffolding on Spawn (Priority: P1 - MVP)
As a developer or agent coordinator,  
I want to spawn a worktree directly from an issue key (e.g. `JIRA-402` or `ENG-88`),  
So that the workspace is automatically named and `.task/task-contract.md` is populated with the issue title, description, acceptance criteria, priority, and assignees.

- **Acceptance Scenario 1.1 (Spawn with Issue Ingestion)**:  
  Given a configured issue tracker (e.g. Jira or Linear) and issue `ENG-104` with title "Implement OAuth2 Refresh Token Rotation",  
  When I execute `mannostree spawn --issue ENG-104`,  
  Then a new worktree is created named `feature/eng-104-oauth2-refresh-token`,  
  And `.task/task-contract.md` is scaffolded with title, issue URL, parsed acceptance criteria, and metadata,  
  And `.mannostree/worktrees/<id>.json` records the linked issue key.

- **Acceptance Scenario 1.2 (Standalone Issue Ingestion)**:  
  Given an existing worktree without an attached issue,  
  When I execute `mannostree issue ingest ENG-104`,  
  Then the issue details are fetched, populated into `.task/task-contract.md`, and recorded in metadata.

---

### User Story 2: Automated Lifecycle State Transitions (Priority: P1)
As an engineer or autonomous agent operator,  
I want remote issue tracker status to transition automatically when worktree lifecycle events occur,  
So that ticket status remains strictly aligned with actual code delivery state without manual updates.

- **Acceptance Scenario 2.1 (Spawn -> In Progress Transition)**:  
  Given an issue in `Todo` or `Backlog` status,  
  When a worktree linked to that issue is spawned with automatic transition enabled,  
  Then the remote issue is transitioned to `In Progress` (or configured custom workflow state).

- **Acceptance Scenario 2.2 (PR Published -> In Review Transition)**:  
  When running `mannostree pr` or `mannostree parallel publish` on an issue-linked worktree,  
  Then the remote issue is transitioned to `In Review`,  
  And a comment is posted on the ticket linking to the newly opened PR URL.

- **Acceptance Scenario 2.3 (Drop/Clean -> Done / Cancelled Transition)**:  
  When running `mannostree drop <id> --done` or `mannostree archive <id> --done`,  
  Then the remote issue is transitioned to `Done` / `Closed`.

---

### User Story 3: Quality Evidence & Comment Synchronization (Priority: P2)
As a technical lead or release reviewer,  
I want Mannostree to post quality gate passes, benchmark receipts, and test summaries directly to the issue ticket,  
So that stakeholder review can happen with full verification evidence attached.

- **Acceptance Scenario 3.1 (Evidence Comment Posting)**:  
  Given completed quality gates or benchmark matrix evaluations in `.task/RESULTS.md`,  
  When I execute `mannostree issue sync --comment`,  
  Then a formatted markdown comment containing test results, coverage score, benchmark deltas, and quality gate sign-offs is posted to the ticket.

---

### User Story 4: Bi-Directional Drift Detection & Reconciliation (Priority: P2)
As a project manager or engineer managing fleet workspaces,  
I want to inspect drift between local worktree states and remote tracker states,  
So that abandoned or externally closed tickets can be cleanly reconciled.

- **Acceptance Scenario 4.1 (Issue Drift Inspection)**:  
  When executing `mannostree issue status`,  
  Then a dashboard displays all active worktrees, linked issue keys, local lifecycle states, remote tracker states, and flags any drift (e.g. ticket marked `Closed` remotely while local worktree is active).

---

### User Story 5: Issue Tracker Health & Credentials Doctor Audit (Priority: P2)
As a developer setting up Mannostree on a new machine or repository,  
I want `mannostree doctor` to verify API tokens, project key access, and transition mappings,  
So that I can diagnose misconfigurations before attempting issue operations.

- **Acceptance Scenario 5.1 (Doctor Diagnostics)**:  
  When running `mannostree doctor`,  
  Then the diagnostic report tests connectivity for configured issue tracker adapters (Jira, Linear, GitHub Issues), reporting credential validity, organization/project accessibility, and transition map readiness.

---

## 4. Functional Requirements

- **`FR-001` (Issue Tracker Configuration Schema)**: The system must support `.mannostree.yml` `issues` configuration specifying provider (`jira`, `linear`, `github`, `generic`), host URL, project keys, custom state transition mappings, and auto-transition policies.
- **`FR-002` (Pluggable Issue Adapter Architecture)**: The system must implement an extensible `IssueTrackerAdapter` interface with production adapters for Jira (REST API v3), Linear (GraphQL API), GitHub Issues (REST/GraphQL), and Generic Webhook/REST.
- **`FR-003` (Automated Issue Ingestion)**: The system must provide `mannostree issue ingest <KEY>` and `mannostree spawn --issue <KEY>` to fetch ticket fields and populate `.task/task-contract.md`.
- **`FR-004` (Automated Lifecycle Transitions)**: The system must support transitioning issue states automatically upon `spawn`, `pr`, `clean`, and `archive` operations per configured transition rules.
- **`FR-005` (Quality Evidence & Comment Attachment)**: The system must support posting markdown comments and attaching verification receipts (`.task/RESULTS.md`, quality gate evidence) to issue tickets via `mannostree issue comment` and `mannostree issue sync`.
- **`FR-006` (Issue Metadata & Registry Persistence)**: The system must record linked issue metadata in `.mannostree/worktrees/<id>.json` and maintain issue cache records in `.mannostree/issues/<KEY>.json`.
- **`FR-007` (Drift Detection & Status Dashboard)**: The system must provide `mannostree issue status` and `mannostree issue list` to inspect local vs remote issue state alignment across all workspaces.
- **`FR-008` (Multi-Issue Batch Sync for Poly-Worktrees)**: The system must support linking and syncing multiple issues across poly-worktree clusters and parallel variants.
- **`FR-009` (Doctor Issue Diagnostic Audit)**: `mannostree doctor` must audit issue tracker adapter configuration, API token availability, network reachability, and project access permissions.
- **`FR-010` (Dry-Run Preview Guarantee)**: All `issue` operations (`issue ingest`, `issue transition`, `issue sync`, `issue comment`) must support `--dry-run` to preview remote mutations without altering issue tracker state.

---

## 5. Non-Functional Requirements & Safety Invariants

1. **Credential Safety**: API tokens and secrets (e.g. `JIRA_API_TOKEN`, `LINEAR_API_KEY`, `GITHUB_TOKEN`) must only be read from environment variables or secure configuration and never written to disk metadata files or git history.
2. **Offline Resilience & Graceful Degradation**: If an issue tracker is unreachable or network is offline, issue operations must warn gracefully rather than crashing local worktree operations.
3. **Idempotent Transitions**: Requesting a transition to a state the issue is already in must succeed cleanly as a no-op.
4. **Universal Dry-Run Simulation**: Dry-run invocations must simulate API calls and format output previews without mutating remote tickets.

---

## 6. Success Criteria

- **`SC-001` (Ingestion Speed)**: Fetching an issue and generating `.task/task-contract.md` completes in $\le 1.5$ seconds under standard network latency.
- **`SC-002` (State Mapping Determinism)**: 100% of configured lifecycle transition rules execute deterministically across all supported tracker adapters.
- **`SC-003` (Zero Secret Leakage)**: 0 API keys, session tokens, or personal passwords appear in metadata files, journal logs, or command error dumps.
- **`SC-004` (Automated Test Coverage)**: 100% pass rate across unit and integration test suites covering Jira, Linear, GitHub Issues, and offline fallback scenarios.

---

## 7. Assumptions & Constraints

- Users have created accounts and generated API tokens/keys for their respective issue tracking platform (Jira Cloud/Data Center, Linear workspace, or GitHub repository).
- Standard issue keys follow recognizable platform conventions (e.g. `PROJ-123` for Jira, `ENG-456` or `ABC-12` for Linear, `#123` or `123` for GitHub Issues).
- Network access is available to tracker API endpoints during live sync commands.
