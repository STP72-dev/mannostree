# Solution Options: Phase 5 Artifacts, Publishing, & Ecosystem Integration

## Option 1: Integrated Publishing & Task Engine with Local Artifact Assembler (Recommended)

### Architecture & Module Boundaries
- `src/core/publish.ts`: `PublishEngine` handling PR assembly, GitHub CLI (`gh`) interop, prepare-only mode, and remote pushing.
- `src/core/task.ts`: `TaskEngine` handling artifact completeness validation, issue linking, and handoff generation.
- `src/core/orchestrator.ts`: Integrate `pr`, `issue`, `task`, and `handoff` methods into `MannostreeOrchestrator`.
- `src/cli/commands/`: Add `pr.ts`, `issue.ts`, `task.ts`, `handoff.ts`.

### State Transitions & Metadata Impact
- Updates `publish` block: `pushed`, `pr_number`, `pr_url`, `published_at`.
- Updates `task` block: `issue_number`, `issue_title`, `source_type`.
- Transitions `lifecycle_state` to `PR_OPEN` (when PR is created) or `REVIEWED` / `TASK_RESOLVED`.

### Dry-Run & Safety Invariants
- `prepare-only` default prevents accidental remote git push operations.
- Full dry-run preview across all mutating commands.

### Scope & Reversibility
- Completely modular, clean abstractions, 100% backward compatible.

---

## Option 2: Standalone Shell Script Wrappers around `gh`

### Architecture & Module Boundaries
- Delegates all PR generation and issue linking directly to external shell scripts without local artifact aggregation.

### State Transitions & Metadata Impact
- Fails to reliably update local `.mannostree/worktrees/<id>.json` metadata.

### Dry-Run & Safety Invariants
- Cannot reliably simulate PR body generation in offline or CI environments.

### Scope & Reversibility
- Fragile and violates metadata expectations in AGENTS.md.

---

## Option 3: Remote Cloud Webhook Service

### Architecture & Module Boundaries
- Offloads publishing to an external web service or GitHub App.

### State Transitions & Metadata Impact
- Requires network infrastructure, external tokens, and server maintenance.

### Dry-Run & Safety Invariants
- Unnecessary complexity for a developer CLI tool.

### Scope & Reversibility
- Disqualified by complexity and infrastructure requirements.
