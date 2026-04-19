# Mannostree

**Mannostree is a developer workspace lifecycle manager that uses git worktrees to support parallel task execution, implementation experiments, and agent-driven software workflows.**

It is not a thin `git worktree` wrapper, not a shell-shortcut bag, and not a one-shot issue-to-PR bot. It is a stateful CLI product that owns the lifecycle of branches, worktrees, metadata, artifacts, and publish state — so humans and AI agents can work safely and reproducibly inside isolated workspaces.

## Why

Modern feature work increasingly involves:

- multiple in-flight branches per developer
- AI-assisted implementation that benefits from isolation
- "try N approaches, pick the best one" experimentation
- structured handoffs between planning, implementation, verification, and review

`git worktree` provides the primitive but not the lifecycle, metadata, safety, or comparison story. Mannostree fills that gap.

## Major capability areas

| Area | What Mannostree provides |
|------|--------------------------|
| Worktree lifecycle | Spawn, drop, list, info, status with explicit base branch and metadata |
| Branch management | Naming rules, base resolution, sync, ahead/behind, diff |
| Project setup / env | Optional install, env file copy/link/skip/generate policies |
| Parallel variants | N isolated worktrees per feature, side-by-side compare, explicit winner pick |
| Agent workflows | Artifact-first orchestration; planner / worker / verifier / reviewer / comparator roles |
| Issue / PR | Issue-driven start; PR body generated from artifacts; safe publish |
| Diagnostics | `doctor`, `recover`, dry-run, metadata-driven traceability |
| Host integration | Pure-git core; GitHub adapter as an explicit integration layer |

## Quick CLI examples

```bash
# Spawn a single isolated workspace
mannostree spawn retry-api-client -b main

# Inspect what is alive
mannostree list
mannostree info retry-api-client
mannostree status retry-api-client

# Run N parallel variants of the same feature
mannostree parallel spawn retry-api-client 3 -b main --plan docs/retry-plan.md
mannostree parallel list retry-api-client
mannostree parallel compare retry-api-client
mannostree parallel pick retry-api-client v2

# Publish
mannostree pr create retry-api-client
mannostree parallel pr create retry-api-client

# Cleanup (explicit)
mannostree drop retry-api-client
mannostree parallel drop retry-api-client --keep-winner
```

## Design principles (short form)

- **Mannostree is the single source of truth** for worktree lifecycle.
- **Artifact-first orchestration**: durable `.task/` files are the system of record, not chat memory.
- **Workers do not own branch lifecycle.** The Branch-Orchestrator does.
- **Explicitness over convenience**: explicit base branch, explicit winner, explicit cleanup.
- **Safe by default**: no auto-merge, no destructive cleanup without approval.
- **VCS-host agnostic core**, with GitHub as a clearly bounded integration layer.

## Documentation map

- [`product-overview.md`](product-overview.md) — product scope, goals, non-goals
- [`architecture.md`](architecture.md) — system layers, state machine, ADRs
- [`cli-spec.md`](cli-spec.md) — full command reference
- [`worktree-lifecycle.md`](worktree-lifecycle.md) — lifecycle and base-branch rules
- [`parallel-variants.md`](parallel-variants.md) — variant experiments
- [`agent-architecture.md`](agent-architecture.md) — agent roles and boundaries
- [`metadata-schema.md`](metadata-schema.md) — metadata, artifacts, `.mannostree.yml`
- [`branching-and-naming.md`](branching-and-naming.md) — naming rules
- [`roadmap.md`](roadmap.md) — MVP / V2 / V3 + Day-1 blueprint
- [`open-questions-and-risks.md`](open-questions-and-risks.md) — open design and risk register
- [`integrations/github.md`](integrations/github.md) — GitHub adapter design
