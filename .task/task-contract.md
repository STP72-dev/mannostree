# Task Contract: Parallel Experiment Lifecycle Commands (`parallel list`, `parallel drop`)

## Problem
While `parallel spawn`, `parallel compare`, and `parallel pick` exist, users and agents lack direct commands to enumerate all active/completed parallel experiments across the repository (`parallel list`) and safely decommission an entire experiment group and its worktrees (`parallel drop`).

## Scope
1. **`parallel list [--status <active|completed|cleaned>] [--json] [--yaml]`**:
   - Enumerate all tracked parallel experiment records from `.mannostree/experiments/`.
   - Report feature name, base branch, variant count, status, winner, and creation timestamp.
2. **`parallel drop <feature> [--keep-branch] [--force] [--archive] [--yes] [--dry-run]`**:
   - Safely remove all variant worktrees associated with an experiment feature.
   - Enforce confirmation gate (`--yes`) or preview mode (`--dry-run`).
   - Clean up experiment record in metadata or mark status as `cleaned`.
3. **Safety Invariants**:
   - No auto-merge.
   - No silent deletion: `parallel drop` requires `--yes` or runs in dry-run preview mode.
   - 100% backward compatibility with all existing 57 tests.

## Out-of-Scope
- Automatically dropping experiments without user instruction.

## Acceptance Criteria
- [ ] `npm run lint`: 0 errors.
- [ ] `npm run build`: Clean build.
- [ ] `npm run coverage`: 100% passing tests including new unit and integration tests.
- [ ] `parallel list` and `parallel drop` CLI commands operational.
