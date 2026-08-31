# Research & Technical Decisions: Phase 5 Artifacts, Publishing, & Ecosystem Integration

## Context & Objectives
Phase 5 delivers the publishing, task artifact validation, issue linking, and agent handoff subsystem for Mannostree. It bridges local worktree lifecycle state with external collaboration systems (GitHub, CI/CD, autonomous agent swarms) while enforcing prepare-only safety defaults.

## Research Findings & Decision Impact

### 1. Artifact-First PR Compilation
- **Source**: ADR-005 & `CLAUDE.md`.
- **Findings**:
  - The PR body should be deterministically composed from durable `.task/` markdown files:
    - Summary & problem from `task-contract.md`
    - Changes and files from `RESULTS.md`
    - Verification & test breakdown from `quality-gates.md`
    - Quality assurance and approval notes from `review.md`
  - Output is saved to `.task/pr-body.md` in the worktree directory.
- **Decision Impact**: Implement `PublishEngine` in `src/core/publish.ts` with `assemblePrBody(worktreeFullPath, record)`.

### 2. Prepare-Only Default & Safe Publishing
- **Source**: `AGENTS.md` Hard Project Rules.
- **Findings**:
  - Never push to remote or open PRs silently.
  - Default behavior: assemble PR body and save locally in `prepare-only` mode.
  - `--push`: Explicit opt-in flag to push branch and invoke `gh pr create` if GitHub CLI is installed.
- **Decision Impact**: Implement `createPullRequest()` with explicit prepare-only gating.

### 3. Task Artifact Validation & Handoff Summaries
- **Source**: `docs/02-project-kickoff/cli-spec.md`.
- **Findings**:
  - `task <id> --validate`: Audits required files (`task-contract.md`, `implementation-plan.md`, `quality-gates.md`, `review.md`, `RESULTS.md`) and reports completeness score.
  - `handoff <id>`: Structures a serialized snapshot of the workspace (git diffs, ahead/behind, task state, next recommended action) for successor agents or human reviewers.
- **Decision Impact**: Implement `TaskEngine` in `src/core/task.ts` handling validation and handoff assembly.
