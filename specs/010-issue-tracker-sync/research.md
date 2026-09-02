# Technical Research & Architecture Decisions: Movement 10 — Issue Tracker Bi-directional Sync

**Feature Branch**: `010-issue-tracker-sync`  
**Date**: 2026-09-02T11:55:00+02:00  
**Status**: COMPLETE  

---

## 1. Research Topic: Issue Tracker Protocols & API Architecture

### Context
Mannostree needs to ingest issue requirements and synchronize lifecycle state with major enterprise issue tracking systems: **Atlassian Jira** (Cloud & Data Center), **Linear**, and **GitHub Issues**, while providing a generic fallback.

### Findings & Architecture Decisions

#### 1. Jira Adapter (Cloud & Data Center)
- **Protocol**: REST API v3 (`/rest/api/3/issue/{issueIdOrKey}`)
- **Authentication**:
  - Jira Cloud: Basic Auth with Base64 `email:api_token` via `JIRA_EMAIL` and `JIRA_API_TOKEN` environment variables.
  - Jira Data Center / Server: Bearer token authentication via `JIRA_PAT`.
- **Field Extraction**: Ingest `summary` (title), `description` (Atlassian Document Format or plain markdown), `priority.name`, `assignee.displayName`, `status.name`, `labels`, and `customfield_*` (Acceptance Criteria).
- **Transitions**: Discovers transitions via `GET /rest/api/3/issue/{key}/transitions` and invokes `POST /rest/api/3/issue/{key}/transitions` with matching `transition.id`.

#### 2. Linear Adapter
- **Protocol**: GraphQL API (`https://api.linear.app/graphql`)
- **Authentication**: `Authorization: <LINEAR_API_KEY>` header.
- **Queries & Mutations**:
  - Fetch issue: `query Issue($id: String!) { issue(id: $id) { id identifier title description priority state { id name type } assignee { name email } labels { nodes { name } } } }`
  - Transition state: `mutation IssueUpdate($id: String!, $stateId: String!) { issueUpdate(id: $id, input: { stateId: $stateId }) { success issue { id state { name } } } }`
  - Post comment: `mutation CommentCreate($issueId: String!, $body: String!) { commentCreate(input: { issueId: $issueId, body: $body }) { success comment { id url } } }`

#### 3. GitHub Issues Adapter
- **Protocol**: REST API v3 (`https://api.github.com/repos/{owner}/{repo}/issues/{issue_number}`) with zero new dependencies (native `fetch` or `gh` CLI fallback).
- **Authentication**: `Authorization: Bearer <GITHUB_TOKEN>` or `GH_TOKEN`.
- **Transitions**: Patch state (`open` / `closed`) or add/remove workflow labels (e.g., `status:in-progress`, `status:in-review`, `status:done`).
- **Comments**: `POST /repos/{owner}/{repo}/issues/{issue_number}/comments`.

#### 4. Generic Webhook / REST Fallback Adapter
- **Protocol**: Configurable HTTP POST webhook triggers on lifecycle transitions with JSON payloads containing worktree metadata and verification receipts.

---

## 2. Research Topic: Bi-Directional State Machine & Transition Mapping

### Context
Worktree states in Mannostree (`NEW`, `WORKTREE_READY`, `PLAN_READY`, `IMPLEMENTED`, `VERIFIED`, `REVIEWED`, `PR_OPEN`, `CLEANED`, `BROKEN`) must map deterministically to issue tracking statuses (`Todo`, `In Progress`, `In Review`, `Done`, `Closed`).

### Decision
Define a declarative mapping schema in `.mannostree.yml`:

```yaml
issues:
  default_provider: jira # jira | linear | github | generic
  auto_transition: true
  transitions:
    on_spawn: "In Progress"
    on_pr: "In Review"
    on_archive: "Done"
    on_drop: "Cancelled"
  jira:
    host: "https://myorg.atlassian.net"
    project_key: "PROJ"
  linear:
    team_key: "ENG"
  github:
    owner: "myorg"
    repo: "lsol"
```

### Safety Invariants
1. **Idempotency**: If the remote issue is already in the target status or no matching transition ID is found, the engine logs an info notice and continues without failing.
2. **Graceful Degradation**: If the network is offline or the token is invalid, operations warn without aborting git worktree creation.

---

## 3. Research Topic: Task Contract Scaffolding & Evidence Attachment

### Context
When spawning a worktree from an issue key (`mannostree spawn --issue PROJ-101`), the system should automatically populate `.task/task-contract.md`.

### Decision
Extract structured sections from the issue payload:
- **Title**: `# Task Contract: [KEY] - [Summary]`
- **Source**: `Issue Tracker: [Provider] ([URL])`
- **Objective**: Raw issue description converted to clean markdown.
- **Acceptance Criteria**: Checkbox list parsed from description (`- [ ] ...`) or dedicated custom field.
- **Metadata**: Priority, Assignee, Labels, Created Date.

When quality gates pass or benchmark matrix runs complete, `mannostree issue sync --comment` formats `.task/RESULTS.md` into a structured issue comment with receipt links.

---

## 4. Research Topic: Secret Safety & Storage

### Context
API tokens must never be persisted to repository files, git worktrees, or shared JSON journals.

### Decision
- Tokens are resolved exclusively from runtime environment variables:
  - Jira: `JIRA_API_TOKEN`, `JIRA_EMAIL`, `JIRA_PAT`
  - Linear: `LINEAR_API_KEY`
  - GitHub: `GITHUB_TOKEN`, `GH_TOKEN`
- Persistent records in `.mannostree/issues/<KEY>.json` and `.mannostree/worktrees/<id>.json` store ONLY sanitized metadata: issue key, title, remote URL, current status, and timestamp.
- Doctor diagnostics redact secrets (showing only `Configured: yes/no` or `Key: ****abcd`).

---

## 5. Summary of Architecture Choices

| Component | Choice | Rationale |
|---|---|---|
| **HTTP Client** | Node native `fetch` (Node >= 18) | Zero external runtime dependencies; lightweight, high performance. |
| **Adapter Pattern** | Extensible `IssueTrackerAdapter` interface | Unifies Jira, Linear, GitHub Issues, and Generic webhooks under identical API. |
| **Persistence** | Split `.mannostree/issues/<KEY>.json` | Cache issue snapshot locally for offline fast reads and drift detection. |
| **Contract Scaffolder** | Markdown template generator | Seamlessly integrates with existing `.task/task-contract.md` artifact workflow. |
| **Diagnostics** | `DoctorEngine.auditIssueTrackers()` | Validates tokens, project keys, and connectivity in `mannostree doctor`. |
