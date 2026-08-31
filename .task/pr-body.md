# Pull Request: Mannostree Phase 4 Parallel Variant Workflows

## Summary
Implements Phase 4 Parallel Variant Workflows for **Mannostree**, delivering `parallel spawn`, `parallel compare`, and `parallel pick` while maintaining 100% backward compatibility with Phases 1, 2, and 3.

## Changes
- **Experiment Schema & Atomic Persistence**:
  - Added `ExperimentRecordSchema` and `ExperimentRecord` types.
  - Implemented `saveExperiment`, `getExperiment`, `listExperiments`, `deleteExperiment` in `MetadataStore`.
- **Git Diff Engine**:
  - Added `getDiffShortStat()` to calculate files changed, insertions, and deletions relative to base merge-base.
- **Parallel Engine Subsystem**:
  - Added `src/core/parallel.ts` (`ParallelEngine`) managing N-variant worktree generation (`experiment/<feature>-vN`), comparison report generation, and explicit winner promotion.
- **Hard Project Invariants**:
  - Enforced strict **NO AUTO-MERGE** rule on `parallel pick`.
  - Enforced strict **NO AUTO-DELETE** rule: losing variants are preserved unless explicitly instructed via `--cleanup-losers` AND `--yes`.
- **CLI Commands**:
  - Added `src/cli/commands/parallel.ts` (`spawn`, `compare`, `pick`).
  - Added formatters for variant comparison tables and pick summaries in `src/cli/output.ts`.
  - Registered `parallel` command suite in `src/cli/index.ts`.
- **Automated Tests**:
  - Added unit test suite `tests/unit/parallel.test.ts` (4 tests) and integration suite `tests/integration/phase4.test.ts`.
  - Total test suite: 48/48 tests passing across 17 suites.
- **Documentation**:
  - Updated `README.md` and durable task artifacts.

## Validation
- `npm run lint`: Passed (0 type errors).
- `npm run build`: Passed (Clean compilation to `dist/`).
- `npm test -- --run`: Passed (48/48 tests passing in 1.05s).

## Review
- Independent review verdict: **PASSED**.
- All safety invariants verified (no auto-merge, no auto-delete, shared explicit base branch, dry-run purity).

## Publishing Mode
- **Mode**: `prepare-only`.
