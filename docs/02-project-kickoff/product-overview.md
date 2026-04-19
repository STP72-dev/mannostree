# Product Overview

## Problem statement

Modern repositories are increasingly used by developers and AI agents in parallel. The dominant pain points:

1. **Branch sprawl with no lifecycle**. Developers create branches that linger, get lost, or accidentally inherit wrong base commits.
2. **No isolation between concurrent tasks**. Switching branches in a single working tree disturbs running processes, dev servers, IDE indexers, and AI agents.
3. **No structured way to try multiple implementation approaches** for the same problem and choose between them.
4. **AI-assisted workflows lack durable handoff state**. Plans, results, and review notes live in chat history, not in the repo.
5. **Setup/env handling is repo-specific and ad hoc**. Each contributor reinvents `.env` copying, install steps, and validation.
6. **Cleanup is dangerous**. Removing worktrees and branches risks losing work; auto-cleanup risks losing user trust.

Plain `git worktree` solves none of these. Bash scripts solve some, badly, and become competing lifecycle layers.

## Product definition

> **Mannostree is a developer workspace lifecycle manager that uses git worktrees to support parallel task execution, implementation experiments, and agent-driven software workflows.**

Mannostree owns the **state machine**, **metadata**, and **artifact contract** for every workspace it creates. It treats:

- a **worktree** as a stateful workspace with a lifecycle,
- a **branch** as a managed identifier coupled to that workspace,
- an **experiment** as a first-class collection of variant workspaces,
- a `.task/` directory as the **durable system of record** for AI/human handoff.

## Target users

| Persona | Scenario |
|---------|----------|
| Senior developer | Wants 3 parallel feature attempts without WIP-stash juggling. |
| Tech lead / staff engineer | Wants comparable variants and a clear winner selection step before merge. |
| Platform / DX engineer | Needs scriptable, machine-readable workspace state across a team. |
| AI workflow operator | Needs supervisor + subagent execution with durable artifact handoff. |
| Open-source maintainer | Wants safe, traceable issue-to-PR flows with no surprise cleanup. |

Mannostree is **not** designed for: end-users of compiled software, non-developers, or teams that explicitly do not use git.

## Goals

- Fast, safe creation of isolated development workspaces from explicit base branches.
- Unified worktree + branch lifecycle with explicit, normalized states.
- Project-aware setup and environment handling with auditable policies.
- First-class **parallel variant** workflows with comparison and explicit winner selection.
- Artifact-first execution so planner / worker / verifier / reviewer roles can be filled by humans **or** agents.
- Issue / PR workflow support with summaries derived from artifacts.
- Strong diagnostics, dry-run support, and recoverable broken state.
- Host-neutral core with a clearly-bounded GitHub adapter.

## Non-goals

- **Replacing git.** Mannostree wraps git operations; it does not reimplement them.
- **Acting as a CI/CD platform.** Validation runs locally or via existing CI; Mannostree only records and summarizes results.
- **Auto-merging branches.** Publishing is always explicit; merging is left to the host.
- **Hiding repo-specific complexity entirely.** Setup policies are configurable, not magical.
- **Becoming a chat agent framework.** It provides artifacts and roles, not a runtime for arbitrary agents.
- **Coupling to a single AI vendor or model.** The artifact contract is vendor-neutral.
- **Forcing GitHub.** Local-only and host-neutral workflows are first-class.

## Product principles

1. **Single source of truth.** Mannostree owns lifecycle. Legacy worktree scripts must not coexist as competing layers.
2. **Artifact-first.** Plans, results, validation outcomes, and reviews live in files, not in chat.
3. **Explicit over implicit.** Base branch, winner selection, and cleanup are user decisions.
4. **Safe by default.** No auto-merge, no destructive cleanup without approval, no implicit `.env` copy unless policy allows.
5. **State-machine driven.** Each lifecycle transition has named states, required artifacts, and validation rules.
6. **Host-neutral core.** GitHub (and future hosts) are integration adapters, not a coupling.
7. **Recoverable.** Metadata is sufficient to reconstruct, diagnose, and clean up.
8. **Machine + human friendly.** Both `--json` output and pleasant CLI text are first-class.

## Confirmed design intent vs recommended choices

| Confirmed | Recommended (revisable) |
|-----------|-------------------------|
| Worktree-based isolation | YAML config (`.mannostree.yml`) |
| Branch lifecycle owned by orchestrator | JSON metadata files in `.mannostree/` |
| `.task/` artifact directory per worktree | TypeScript/Node or Go for implementation (TBD) |
| Parallel variants are core | GitHub integration via `gh` CLI in MVP |
| Explicit winner selection | Mermaid for documentation diagrams |
