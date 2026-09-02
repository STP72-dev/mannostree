# AGENTS.md

## Purpose
This repository builds **Mannostree**, a developer CLI and autonomous agent orchestration platform for safe, explicit, git-worktree-based parallel development.

The tool manages:
- isolated worktree lifecycle and base-branch resolution
- per-worktree metadata and transaction write-ahead journaling
- parallel variant experiments, automated benchmark matrix evaluation, and Pareto winner selection
- autonomous agent dispatch, clean-room container sandboxes (Docker/Podman), and contract scorecards
- distributed fleet synchronization, 3-way semantic conflict matrices, tiering, leases, and auto-archive
- multi-host remote git publishing (GitHub Enterprise, GitLab, Gitea, Bitbucket)
- cross-repository poly-worktree coordination and synchronized release manifests
- bi-directional issue tracker synchronization (Jira REST v3, Linear GraphQL, GitHub Issues, Generic Webhooks)

---

## What agents should optimize for
1. **Safety first** — no hidden branch selection, no silent deletion, no auto-merge, and strict flag separation (`--discard-uncommitted --yes`).
2. **Explicit state** — every important lifecycle change must be reflected in metadata.
3. **Reproducibility** — commands, artifacts, receipts, and scorecards must be deterministic and reviewable.
4. **Small blast radius** — prefer narrow, reversible changes over broad refactors.
5. **Artifact-first workflow** — durable files (`.task/task-contract.md`, `.task/RESULTS.md`, `.task/sandbox-receipt.json`) beat chat memory.
6. **Zero-secret leakage** — never persist API tokens (Jira, Linear, GitHub, GitLab, Gitea, Bitbucket) in metadata or task files.

---

## Hard project rules
- **Mannostree owns branch/worktree lifecycle.** Worker agents must not invent or manage branch topology on their own.
- **Base branch must be explicit or deterministically resolved.** Never silently default to the current branch.
- **Parallel variants are first-class.** Variants for the same feature use distinct experiment branches and worktrees.
- **No automatic merge of any variant.** Selection and publish are separate steps.
- **Do not auto-delete losing variants.** Preserve them until the user explicitly cleans them up.
- **Strict Flag Separation Rule**: Destructive cleanup requires `--discard-uncommitted --yes`; `--force` only bypasses non-content operational blockers.
- **Keep docs and metadata aligned with behavior.** If code changes lifecycle semantics, update the relevant docs and schema definitions in the same change.

---

## Working model

### Core domain objects
Agents should think in terms of these first-class objects:
- **worktree record** (`.mannostree/worktrees/<id>.json`)
- **experiment record** (`.mannostree/experiments/<feature>.json`)
- **registry** (`.mannostree/registry.json`)
- **lease lock** (`.mannostree/leases/<id>.json`)
- **agent session** (`.mannostree/sessions/<sessionId>.json`)
- **sandbox receipt** (`.task/sandbox-receipt.json`)
- **poly manifest & links** (`.mannostree.poly.yml`, `.mannostree/poly-links.json`)
- **issue record** (`.mannostree/issues/<KEY>.json`)
- **artifact pack** (`.task/`)
- **publish state**

### Canonical concepts
- single workspace flow
- parallel variant flow & Pareto matrix evaluation
- autonomous agent execution & verification scorecard
- distributed fleet sync & conflict collision matrix
- lifecycle tiering, leases & auto-archive retention
- multi-host git publishing & release candidate merge-sync
- clean-room container sandboxing (Docker/Podman/Process)
- cross-repo poly-worktrees & package inter-wiring
- bi-directional issue tracker sync & drift inspection
- recoverable state & transaction journal rollback
- universal dry-run support & safe cleanup

---

## Repository layout

```text
.
├── AGENTS.md                       # Agent constraints & operational guidelines
├── CLAUDE.md                       # Architectural context & design rules
├── GEMINI.md                       # Technology inventory & development guidelines
├── README.md                       # Product overview, feature matrix & quickstart
├── docs/
│   ├── USER_MANUAL.md              # Complete Operator & Developer User Manual
│   ├── 01-arch-design/             # Module boundaries, schemas & architecture
│   └── 02-project-kickoff/         # Product specs & roadmap history
├── specs/                          # 10-Movement feature specifications & verification reports
│   ├── 001-safety-lifecycle-recovery/
│   ├── 002-agent-contract-runner/
│   ├── 003-benchmark-matrix-eval/
│   ├── 004-fleet-sync-conflict-matrix/
│   ├── 005-fleet-tier-auto-archive/
│   ├── 006-parallel-publish-merge-sync/
│   ├── 007-multi-host-adapters/
│   ├── 008-sandboxed-container-execution/
│   ├── 009-cross-repo-poly-worktree/
│   └── 010-issue-tracker-sync/
├── src/                            # TypeScript source codebase
│   ├── cli/                        # Commander CLI commands & output formatters
│   ├── config/                     # Configuration loader & Zod schemas
│   ├── core/                       # Orchestrator, doctor, setup & task engines
│   ├── git/                        # Git engine, branch resolver & worktree driver
│   ├── metadata/                   # Metadata store, journal & validation schemas
│   ├── parallel/                   # Parallel engine, matrix eval & handoff
│   ├── agent/                      # Agent runner, scorecard & execution engine
│   ├── fleet/                      # Fleet sync, conflict matrix, tiering, leases & auto-archive
│   ├── publish/                    # Multi-host publishing adapters & release merger
│   ├── sandbox/                    # Container runtime drivers (Docker, Podman, Process)
│   ├── poly/                       # Cross-repo poly-worktree engine & linkers
│   └── issues/                     # Pluggable issue tracker adapters & sync engine
├── tests/                          # Vitest unit & integration test suites
├── .mannostree/                    # Runtime metadata (registry, worktrees, sessions, leases)
├── .worktrees/                     # Mounted git worktrees (runtime)
└── .task/                          # Per-worktree artifacts when applicable
```

---

## Branch and naming policy

### Single-path branches
- `feature/<name>`
- `fix/<name>`
- `docs/<name>`
- `refactor/<name>`

### Parallel experiment branches
- `experiment/<feature>-v1`
- `experiment/<feature>-v2`
- `experiment/<feature>-vN`

### Worktree paths
- `.worktrees/<name>` for single-path work
- `.worktrees/<feature>-vN` for parallel variants

---

## Command families

- **Workspace**: `spawn`, `drop`, `list`, `info`, `status`, `sync`, `clean`, `archive`, `restore`
- **Setup & Environment**: `setup`, `env`, `exec`
- **Parallel Experiments**: `parallel spawn`, `parallel list`, `parallel compare`, `parallel eval`, `parallel pick`, `parallel publish`, `parallel drop`, `parallel handoff`
- **Autonomous Agents**: `agent dispatch`, `agent status`, `agent cancel`, `agent verify`
- **Fleet Operations**: `fleet sync`, `fleet conflict-matrix`, `fleet lease`, `fleet tier`, `fleet auto-archive`, `fleet merge-sync`, `fleet publish`, `fleet capacity`
- **Poly-Worktrees**: `poly spawn`, `poly link`, `poly unlink`, `poly sync`, `poly status`, `poly exec`, `poly pr`, `poly drop`
- **Issue Tracker**: `issue ingest`, `issue transition`, `issue comment`, `issue sync`, `issue status`, `issue list`
- **Publishing & Artifacts**: `pr`, `task`, `handoff`
- **Diagnostics & Recovery**: `doctor`, `recover`

---

## Validation expectations
Every change must validate the smallest relevant surface area:
1. `npm run lint` (strict TypeScript typechecking with zero errors)
2. Targeted Vitest unit test suites
3. Integration test suites for CLI and end-to-end worktree behavior
4. Full test suite run (`npm test` — 100% pass rate across all 78 test suites)
5. Documentation and schema updates aligned with behavior changes

---

## Done means
A task is done only when all of the following are true:
- the requested behavior is implemented and strictly typed
- automated test suites pass at 100%
- metadata impacts and journal write-ahead logging are handled
- documentation (User Manual, README, and specs) stays accurate
- no hidden destructive behavior or secret leakage was introduced
- output is reviewable and deterministic
