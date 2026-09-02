# Implementation Plan: Movement 10 — Issue Tracker Bi-directional Sync (Jira / Linear / GitHub Issues)

**Branch**: `010-issue-tracker-sync` | **Date**: 2026-09-02T11:55:30+02:00 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `specs/010-issue-tracker-sync/spec.md`  

---

## Summary

Movement 10 introduces a pluggable, bi-directional issue tracker synchronization engine for **Jira**, **Linear**, and **GitHub Issues** (plus generic webhook/REST fallback). It allows engineers and autonomous agents to spawn workspaces directly from issue keys, automatically scaffold `.task/task-contract.md` with ticket requirements, execute automated lifecycle state transitions (`In Progress`, `In Review`, `Done`, `Cancelled`), post verification receipts (`.task/RESULTS.md`), detect issue drift, and audit issue tracker credentials via `mannostree doctor`.

---

## Technical Context

**Language/Version**: TypeScript 5.7.3 / Node.js >= 20.0.0 (ESM `"type": "module"`)  
**Primary Dependencies**: `commander` (CLI), `chalk` (styling), `zod` (runtime schema validation), `yaml` (YAML parsing), native Node.js `fetch` (HTTP client)  
**Storage**: Persistent JSON files in `.mannostree/issues/<KEY>.json`, updated `.mannostree/worktrees/<id>.json`, and `.task/task-contract.md`  
**Testing**: Vitest (`npm test`)  
**Target Platform**: Linux / macOS / POSIX workstations and CI runners  
**Project Type**: Developer CLI tool  
**Performance Goals**: Issue ingestion & contract scaffolding $\le 1.5$ seconds; zero network blocking on offline/disconnected operations  
**Constraints**: Zero secret leaks to disk/journals; idempotent transitions; universal `--dry-run` simulation  
**Scale/Scope**: Arbitrary number of issue trackers, projects, and worktrees  

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **No hidden branch selection**: Worktrees spawned from issues strictly resolve base branches via existing deterministic `BaseResolver`.
- [x] **Safety first & explicit state**: Issue operations never silently delete work or push unauthorized changes; token secrets are isolated in memory.
- [x] **Reproducibility & durability**: Task contracts extracted from tickets are stored in durable `.task/task-contract.md`.
- [x] **Small blast radius**: Issue operations degrade gracefully to warnings if remote tracker is unreachable.
- [x] **Dry-run capable**: All issue commands support `--dry-run`.

---

## Project Structure

### Documentation (this feature)

```text
specs/010-issue-tracker-sync/
├── spec.md              # Feature specification
├── plan.md              # Implementation plan (this file)
├── research.md          # Technical research & protocol decisions
├── data-model.md        # Domain schema & data models
├── quickstart.md        # Operator quickstart guide
├── contracts/
│   └── cli-contract.md  # CLI command signatures & outputs
└── checklists/
    └── requirements.md  # Spec quality checklist (15/15 Pass)
```

### Source Code Structure

```text
src/
├── issues/                     # Movement 10 Issue Tracker Engine
│   ├── base.ts                 # IssueTrackerAdapter interface & registry
│   ├── jira.ts                 # Jira REST API v3 adapter
│   ├── linear.ts               # Linear GraphQL API adapter
│   ├── github.ts               # GitHub Issues REST API adapter
│   ├── generic.ts              # Generic Webhook adapter
│   ├── engine.ts               # IssueSyncEngine (orchestration, transitions, contracts)
│   └── index.ts                # Barrel export
├── config/
│   └── schema.ts               # Extended with IssueTrackerConfigSchema
├── types/
│   └── index.ts                # Extended with Movement 10 issue domain types
├── metadata/
│   ├── schema.ts               # Extended with IssueRecordSchema
│   └── store.ts                # Extended with getIssueRecord / saveIssueRecord
├── core/
│   ├── doctor.ts               # Extended with auditIssueTrackers()
│   └── orchestrator.ts         # Integrated with issueSyncEngine
├── cli/
│   ├── commands/
│   │   ├── issue.ts            # Registered mannostree issue subcommands
│   │   └── spawn.ts            # Extended with --issue <key> support
│   └── output.ts               # Formatted issue status & doctor output
└── index.ts                    # Public API exports
tests/
├── unit/
│   ├── issue-jira.test.ts
│   ├── issue-linear.test.ts
│   ├── issue-github.test.ts
│   ├── issue-engine.test.ts
│   └── issue-doctor.test.ts
└── integration/
    └── issue-sync-lifecycle.test.ts
```

---

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Native `fetch` HTTP abstraction | Eliminates heavy third-party Jira/Linear SDK dependencies | SDKs introduce large dependency trees, potential breaking version mismatches, and excess bundle weight. |
