# Task Contract: Phase 4 Parallel Variant Workflows

## Problem
Complex features, architectural spikes, and AI agent experiments often benefit from exploring multiple implementation hypotheses in parallel (e.g. comparing different algorithms, libraries, or prompting strategies). Mannostree must support first-class parallel variant generation, side-by-side comparison, and explicit winner selection without risking accidental auto-merges or silent deletion of losing worktrees.

## Scope
Deliver Phase 4 Parallel Variant Workflows while preserving 100% backward compatibility with Phases 1, 2, and 3:
1. **`parallel spawn <feature> -n <count> [--base-branch <base>] [--profile <name>] [--plan-mode shared|isolated] [--dry-run]`**:
   - Spawns N isolated variant worktrees: `.worktrees/<feature>-v1`, `.worktrees/<feature>-v2`, ... `.worktrees/<feature>-vN`.
   - Branch naming policy: `experiment/<feature>-v1`, `experiment/<feature>-v2`, ... `experiment/<feature>-vN`.
   - All variants share the exact same explicit base branch.
   - Creates and updates `.mannostree/experiments/<feature>.json`.
   - Sets `parallel` metadata on each worktree record (`experiment_name`, `winner: false`, `selected: false`).
   - Supports `--dry-run` preview.
2. **`parallel compare <feature> [--metrics] [--json] [--yaml]`**:
   - Generates tabular and structured comparisons across all variants in the experiment group.
   - Compares: branch ahead/behind count, lines added/removed, files changed, test validation status, and lifecycle state.
   - Read-only; never mutates git or disk.
3. **`parallel pick <feature> --winner <variant_id_or_index> [--cleanup-losers] [--archive-losers] [--reason <text>] [--dry-run]`**:
   - Explicit winner selection:
     - Sets `winner: true` and `selected: true` on the winning worktree record.
     - Updates `.mannostree/experiments/<feature>.json` with `winner`, `selected_at`, `selection_reason`.
   - **Hard Rule**: NO AUTO-MERGE. Selection does not merge the branch into base.
   - **Hard Rule**: NO AUTO-DELETE of losers unless `--cleanup-losers` AND `--yes` are explicitly passed.
   - Supports `--dry-run` preview.
4. **Metadata Store & Schema**:
   - Add `ExperimentRecordSchema` and `saveExperiment`, `getExperiment`, `listExperiments` in `MetadataStore`.
   - Atomic persistence in `.mannostree/experiments/<feature>.json`.
5. **Testing & Documentation**:
   - Unit tests for parallel spawn, compare metrics, and winner selection.
   - Integration tests for CLI `parallel` subcommands.
   - Update README and durable task artifacts.

## Out-of-Scope
- Phase 5 GitHub publish flow and PR creation.
- Auto-merge into main/base branch.
- Silent deletion of non-selected variants.

## Acceptance Criteria
- [ ] **Phase 1, 2 & 3 Compatibility**: All 43 existing unit and integration tests continue to pass.
- [ ] **`parallel spawn`**: Spawns N variants from shared explicit base branch; follows strict naming `experiment/<feature>-vN` and `.worktrees/<feature>-vN`; saves experiment record; supports dry-run.
- [ ] **`parallel compare`**: Compares all variants with git diff metrics and lifecycle states; supports table, JSON, and YAML formats.
- [ ] **`parallel pick`**: Explicitly selects winner; records in experiment and worktree metadata; enforces no-auto-merge invariant; preserves losers unless explicitly commanded with `--cleanup-losers --yes`.
- [ ] **Test Coverage**: 100% passing tests across unit and integration suites.

## Explicit Assumptions
- Base branch: `main`.
- Publishing mode: `prepare-only`.
- Parallel variants permission: Allowed under `parallel` command suite.
