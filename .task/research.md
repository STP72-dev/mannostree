# Research & Technical Decisions: Phase 4 Parallel Variant Workflows

## Context & Objectives
Phase 4 implements parallel variant exploration and comparison workflows. This enables engineers and AI agents to concurrently prototype alternative implementations from an identical base commit, evaluate diffs and validation metrics side-by-side, and explicitly promote a winning variant without risking accidental code merges or unintended deletions.

## Research Findings & Decision Impact

### 1. Experiment Record & Topology Architecture
- **Source**: `AGENTS.md` and `docs/02-project-kickoff/cli-spec.md`.
- **Findings**:
  - Parallel variants for feature `<name>` must follow canonical naming:
    - Worktree directory: `.worktrees/<feature>-v<N>`
    - Git branch: `experiment/<feature>-v<N>`
    - Worktree record ID: `experiment-<feature>-v<N>`
  - Persistent record: `.mannostree/experiments/<feature>.json`.
  - Shared base branch requirement: All N variants must branch from the exact same explicit base commit.
- **Decision Impact**: Implement `ParallelEngine` in `src/core/parallel.ts` orchestrating variant spawn, group metadata registration, comparison aggregation, and winner selection.

### 2. Side-by-Side Diff & Metrics Extraction
- **Source**: Git porcelain diff specifications (`git diff --shortstat <base>...<branch>`).
- **Findings**:
  - `git diff --shortstat <base>...<branch>` parses into files changed, insertions (+), and deletions (-).
  - Combining this with `getAheadBehindCount` and `ValidationMetadata` gives complete comparison data across variants.
- **Decision Impact**: Add `getDiffShortStat(worktreePath, baseBranch, branch)` to `GitEngine`.

### 3. Winner Selection & No-Auto-Merge Invariants
- **Source**: `AGENTS.md` Hard Project Rules.
- **Findings**:
  - Winner selection must update `.mannostree/experiments/<feature>.json` and the winning worktree record's `parallel.winner = true`.
  - Selection MUST NOT trigger `git merge` or merge into base.
  - Losing variants MUST NOT be deleted unless the user explicitly supplies `--cleanup-losers --yes`.
- **Decision Impact**: Implement `pick()` enforcing explicit winner marking and requiring separate confirmation for loser cleanup.
