# Pull Request: Mannostree Phase 1 Core Foundation

## Summary
Implements the Phase 1 core foundation for Mannostree, establishing the TypeScript/Node CLI, declarative configuration parsing, atomic metadata store, git worktree lifecycle manager, artifact scaffolding, and `spawn`, `list`, `info`, and `drop` commands.

## Changes
- **Scaffold & Build Setup**:
  - `package.json`, `tsconfig.json`, `vitest.config.ts`, `bin/mannostree.js`.
- **Configuration Engine**:
  - `.mannostree.yml` loader and Zod schema validation in `src/config/`.
- **Metadata Engine**:
  - Versioned, atomic write-temp-and-rename metadata persistence for `.mannostree/registry.json` and `.mannostree/worktrees/<id>.json` in `src/metadata/`.
- **Git & Base Resolution Engine**:
  - Explicit base-branch resolution hierarchy forbidding implicit fallback to current branch in `src/git/base-resolver.ts`.
  - Direct git execution wrapper for worktree creation, removal, and status inspection in `src/git/engine.ts`.
- **Artifact Engine**:
  - Automatic `.task/` and `RESULTS.md` scaffolding in `src/artifact/scaffold.ts`.
- **CLI Commands & Orchestrator**:
  - `spawn`, `list`, `info`, `drop` commands in `src/cli/` and `src/core/orchestrator.ts`.
  - Full support for `--json`, `--yaml`, `--plain`, `--verbose`, `--quiet`, and `--dry-run`.
- **Automated Tests**:
  - 19 unit and integration tests across 6 test suites with 100% pass rate.

## Validation
- `npm run lint`: Passed (zero TypeScript errors).
- `npm run build`: Passed (clean compilation to `dist/`).
- `npm test`: Passed (19/19 tests across `tests/unit/` and `tests/integration/`).

## Review
- Independent review verdict: **PASSED**.
- All Mannostree safety invariants (explicit base, atomic persistence, safety gates on drop) are verified.

## Safety & No-Auto-Merge Policy
- **No Automatic Merge**: This change follows the repository policy requiring manual review and explicit winner selection. Auto-merge is disabled.
- **Publishing Mode**: `prepare-only`.
