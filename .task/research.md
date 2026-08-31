# Research & Technical Decisions: Parallel Experiment Lifecycle Commands

## Research Findings

### 1. Parallel Experiment Lifecycle
- **Source**: `docs/02-project-kickoff/parallel-variants.md` & `roadmap.md`.
- **Date**: 2026-08-31.
- **Findings**:
  - `parallel list` should display a concise table of experiments with feature name, variant IDs, current status (`active`, `completed`, `cleaned`), and selected winner.
  - `parallel drop <feature>` must iterate through all variants in the experiment record, invoke `dropWorktreeFn` on each variant worktree, and then remove or mark the experiment record as `cleaned`.
  - Multi-gate confirmation: When dropping an experiment, require `--yes` to proceed with real deletion, else preview the worktrees and branches that would be removed.
- **Decision Impact**: Implement `listExperiments()` and `dropExperiment()` in `ParallelEngine`.
