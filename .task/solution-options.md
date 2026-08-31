# Solution Options: Phase 4 Parallel Variant Workflows

## Option 1: Integrated Parallel Engine with Dedicated Experiment Group Registry (Recommended)

### Architecture & Module Boundaries
- `src/metadata/schema.ts`: Define `ExperimentRecordSchema` and update `WorktreeRecordSchema.parallel`.
- `src/metadata/store.ts`: Add atomic persistence for `.mannostree/experiments/<feature>.json` (`saveExperiment`, `getExperiment`, `listExperiments`).
- `src/git/engine.ts`: Add `getDiffShortStat()` to compute diff metrics.
- `src/core/parallel.ts`: Implement `ParallelEngine` managing `spawnVariants`, `compareVariants`, and `pickWinner`.
- `src/core/orchestrator.ts`: Expose `parallelSpawn`, `parallelCompare`, `parallelPick`.
- `src/cli/commands/parallel.ts`: CLI subcommand suite (`mannostree parallel spawn|compare|pick`).

### State Transitions & Metadata Impact
- Atomic records in `.mannostree/experiments/<feature>.json` tracking variants list, winner status, selected_at, and plan mode.
- Each variant worktree record updated with `parallel: { experiment_name, winner, selected }`.

### Dry-Run & Safety Invariants
- Full dry-run preview across `parallel spawn` and `parallel pick`.
- Strict enforcement of NO AUTO-MERGE and NO AUTO-DELETE of losing variants without `--cleanup-losers --yes`.

### Scope & Reversibility
- Modular, fully reversible, 100% backward compatible with existing test suite.

---

## Option 2: Loose Scripted Variants without Group Registry

### Architecture & Module Boundaries
- Creates variants as ad-hoc single worktrees without persisting `.mannostree/experiments/<feature>.json`.

### State Transitions & Metadata Impact
- Lacks group-level cohesion; comparison commands must guess variant relationships from string matching.

### Dry-Run & Safety Invariants
- High risk of orphaned state and uncoordinated cleanup.

### Scope & Reversibility
- Fragile and violates metadata expectations in AGENTS.md.

---

## Option 3: Auto-merging Worktree Orchestrator

### Architecture & Module Boundaries
- Automatically merges the selected winner into base branch during `pick` and deletes all other variants.

### State Transitions & Metadata Impact
- Violates non-negotiable project rules.

### Dry-Run & Safety Invariants
- Disqualified by Hard Gate: Violates NO AUTO-MERGE rule.

### Scope & Reversibility
- Destructive and unsafe.
