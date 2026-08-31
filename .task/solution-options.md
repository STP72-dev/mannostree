# Solution Options: Parallel Experiment Lifecycle Commands

## Option 1: First-Class `ParallelEngine` Lifecycle Extensions (Recommended)
- Extend `ParallelEngine` with `listExperiments()` and `dropExperiment()`.
- Expose `parallelList` and `parallelDrop` on `MannostreeOrchestrator`.
- Register `parallel list` and `parallel drop` in `src/cli/commands/parallel.ts`.
- Enforce strict confirmation gates (`--yes` required to perform real deletions).

## Option 2: Script-Based Looping via `mannostree drop`
- Users manually loop over variant IDs and invoke `mannostree drop <id>`.
- Fails to clean up `.mannostree/experiments/<feature>.json` metadata record.

## Option 3: Recursive Hard Unlink
- Directly delete `.worktrees/` directories and remove git branches with raw commands without health checking.
- Violates safety invariants and leaves broken porcelain worktrees.
