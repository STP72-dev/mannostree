# CLAUDE.md

## Project context
This repository is for **Mannostree**: a developer CLI that manages isolated git worktrees as first-class development workspaces.

The product goal is not just “make git worktree easier.”
The goal is to provide a **workspace lifecycle manager** for:
- single-task isolated development
- explicit base-branch selection
- multi-variant experiments for the same feature
- side-by-side comparison of variants
- winner selection without implicit merge
- metadata-driven recovery, inspection, and publish workflows
- future agent-oriented execution patterns

---

## What Claude should remember every session

### 1. Product identity
Mannostree is a **stateful CLI product**, not a loose shell script collection.

Treat these as product features, not incidental implementation details:
- branch/worktree lifecycle
- metadata persistence
- dry-run behavior
- recoverability
- comparison of variants
- explicit publish semantics

### 2. Core design rule
**Workers do not own branch lifecycle. Mannostree does.**

Any internal executor, helper, or future agent may operate inside a prepared worktree, but branch creation, base selection, experiment grouping, cleanup policy, and publish state belong to the core application layer.

### 3. Explicitness over convenience
Prefer:
- explicit base branch
- explicit winner selection
- explicit cleanup
- explicit metadata transitions

over silent defaults or magic behavior.

### 4. Preserve user trust
Never introduce behavior that can surprise the user, especially around:
- branch choice
- cleanup
- env propagation
- auto-push
- auto-merge
- destructive recovery

---

## Primary product capabilities

### Single-path workspace flow
Expected lifecycle:
1. resolve task
2. select base branch
3. generate branch/worktree identifiers
4. create worktree
5. initialize metadata
6. optionally run setup/env logic
7. work inside isolated workspace
8. inspect, validate, publish, and eventually clean up

### Parallel variant flow
Expected lifecycle:
1. resolve feature/task
2. choose explicit base branch
3. create `N` isolated branches/worktrees for the same feature
4. implement variants independently
5. store per-variant results
6. compare variants side by side
7. select winner explicitly
8. publish only the selected variant
9. preserve non-winning variants until explicit cleanup

---

## Architecture direction

### Main layers

#### 1. CLI layer
Responsible for:
- command parsing
- flags/options
- human-readable and machine-readable output

#### 2. Application/orchestration layer
Responsible for:
- resolving inputs into actions
- enforcing lifecycle rules
- coordinating metadata, git operations, setup, comparison, and publish behavior

#### 3. Git/worktree engine
Responsible for:
- base-branch resolution
- branch naming
- worktree create/remove
- sync/diff/status logic

#### 4. Metadata engine
Responsible for:
- registry
- worktree records
- experiment records
- lifecycle transitions
- recovery signals

#### 5. Setup/env engine
Responsible for:
- setup policy
- env copy/link/skip logic
- diagnostics

#### 6. Parallel engine
Responsible for:
- N-way variant creation
- experiment grouping
- comparison summaries
- winner state

#### 7. Publish/PR adapter
Responsible for:
- push state
- PR body generation
- PR tracking metadata

#### 8. Task/artifact engine
Responsible for:
- durable per-worktree artifacts such as contracts, plans, validation results, and comparison output

---

## Planned command model
Use this as the default product map unless the repo evolves a clearly better structure.

### Core commands
- `spawn`
- `drop`
- `list`
- `info`
- `status`
- `diff`
- `sync`
- `setup`
- `env`
- `doctor`
- `exec`
- `clean`
- `recover`

### Publish/work management
- `pr create`
- `pr view`
- `pr checks`
- `issue start`

### Parallel flow
- `parallel spawn`
- `parallel run`
- `parallel list`
- `parallel compare`
- `parallel pick`
- `parallel pr create`
- `parallel drop`

### Artifact-oriented flow
- `task init`
- `task show`
- `task review`
- `handoff`

---

## Configuration direction
Assume the repository will use `.mannostree.yml` as the main policy file.

That config should define:
- default base branch
- worktree root
- metadata root
- artifact directory name
- branch templates
- setup/env defaults
- parallel constraints
- quality gate sources
- publish defaults
- cleanup policy

Do not hide durable project policy in scattered code constants if it belongs in config.

---

## Metadata direction
Treat metadata as a first-class contract.

### Expected persistent files
```text
.mannostree/
  registry.json
  worktrees/<id>.json
  experiments/<feature>.json
```

### Metadata principles
- version every schema
- use explicit timestamps
- use normalized lifecycle states
- cache enough summary data for fast compare/list/info
- keep records readable by humans and scripts
- make recovery possible even after interrupted runs

### Important states
Single worktree examples:
- `created`
- `setup_pending`
- `setup_complete`
- `planned`
- `implemented`
- `validated`
- `reviewed`
- `ready_for_pr`
- `pr_open`
- `merged`
- `archived`
- `broken`

Parallel experiment examples:
- `created`
- `running`
- `awaiting_comparison`
- `winner_selected`
- `published`
- `archived`
- `broken`

---

## Branching conventions

### Preferred single-path naming
- `feature/<name>`
- `fix/<name>`
- `docs/<name>`
- `refactor/<name>`

### Preferred experiment naming
- `experiment/<feature>-v1`
- `experiment/<feature>-v2`
- `experiment/<feature>-vN`

### Base branch policy
Resolution order should be:
1. explicit CLI flag
2. profile/config override
3. repo default base branch
4. remote default branch

Do **not** silently use the current branch as the base unless the user explicitly requested that behavior.

---

## Output and UX principles
Command UX should favor:
- explicitness
- predictable naming
- dry-run support
- helpful summaries
- optional structured output

Where appropriate, support:
- `--json`
- `--yaml`
- `--plain`
- `--verbose`
- `--dry-run`

The CLI should be pleasant for humans but dependable for automation.

---

## Testing and validation strategy
Until the stack is finalized, do not hardcode a package manager or test runner in this file.
Instead, follow this rule:

1. inspect the real repo first
2. use the narrowest relevant validation
3. prefer targeted tests over broad expensive runs when the task is scoped
4. run broader validation when lifecycle or metadata semantics change
5. update docs/examples together with behavior changes

When the stack becomes concrete, add exact commands here.

---

## Documentation strategy

### Keep this file factual
CLAUDE.md should store the project facts and durable rules that need to be present in every session.

Examples that belong here:
- product purpose
- architecture boundaries
- lifecycle rules
- naming conventions
- safety constraints
- persistent assumptions about metadata and commands

### Move procedures elsewhere when they become large
If a repeated workflow turns into a long step-by-step procedure, it should eventually move to:
- a skill
- a path-specific rule
- a dedicated docs file

Do not let this file become a dumping ground for long operational playbooks.

---

## Suggested agent roles for this project
When the project reaches agent-oriented execution, these are the natural roles:
- **task-resolver**
- **branch-orchestrator**
- **planner**
- **worker**
- **verifier**
- **reviewer**
- **comparator**
- **publish agent**

### Special rule
The **branch-orchestrator** owns branch/worktree planning.
The **worker** owns implementation inside an already-prepared workspace.
Do not blur those responsibilities.

---

## MVP implementation priority
If no stronger priority is specified, build in this order:

### Phase 1 — Core foundation
- config loading
- metadata registry
- base branch resolution
- naming rules
- `spawn`, `drop`, `list`, `info`, `status`

### Phase 2 — Operational safety
- `sync`, `diff`, `doctor`, `recover`
- dry-run support
- cleanup safety checks

### Phase 3 — Project-aware setup
- `setup`
- `env`
- profiles
- config-driven defaults

### Phase 4 — Parallel experiments
- `parallel spawn`
- `parallel list`
- `parallel compare`
- `parallel pick`
- `parallel drop`

### Phase 5 — Publish flows
- `pr create`
- `parallel pr create`
- publish metadata
- handoff/report generation

### Phase 6 — Agent-oriented artifacts
- `task init`
- durable `.task/` contract files
- standardized results/review/comparison outputs

---

## Change discipline
When making changes:
- prefer minimal deltas
- keep naming and state transitions consistent
- avoid speculative abstraction unless duplication is proven
- keep code and docs synchronized
- call out any schema change clearly

If a change affects user trust, prioritize clarity over cleverness.

---

## Open decisions to resolve from the actual repo
These should be discovered from the real codebase, not guessed:
- implementation language and CLI framework
- config parser/library
- test framework
- logging strategy
- JSON schema validation approach
- PR provider integration details
- whether agent execution is native or adapter-based

Until those are concrete, do not fake certainty.

