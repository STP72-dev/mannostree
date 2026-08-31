# Implementation Plan: Phase 1 Core Foundation

## Overview
Implement the complete Phase 1 core foundation for Mannostree in TypeScript/Node (ESM):
- Project scaffolding (`package.json`, `tsconfig.json`, `vitest.config.ts`, build scripts).
- Configuration engine (`.mannostree.yml` parser with Zod schema validation and profile support).
- Metadata engine (atomic write-temp-rename file persistence for `registry.json` and `worktrees/<id>.json`).
- Git & Worktree engine (deterministic base-branch resolution, worktree add/remove, dirty state checks, dry-run execution).
- Artifact engine (scaffolding `.task/` skeleton + `RESULTS.md`).
- Application / Orchestrator layer (coordinating operations, enforcing lifecycle rules, dry-run routing).
- CLI layer (Commander.js entrypoint, global flags `--json`/`--yaml`/`--plain`/`--dry-run`, exit code taxonomy, formatting).
- CLI commands: `spawn`, `list`, `info`, `drop`.
- Automated test suite (unit + integration) and documentation alignment.

---

## Architecture & Module Breakdown

### 1. Project Configuration & Scaffolding
- `package.json`: Type `"module"`, dependencies (`commander`, `yaml`, `zod`, `chalk`), devDependencies (`typescript`, `@types/node`, `vitest`, `tsx`).
- `tsconfig.json`: Target ES2022, Module NodeNext, strict mode enabled.
- `vitest.config.ts`: Vitest test configuration.
- `bin/mannostree.js`: Executable wrapper pointing to compiled `dist/cli/index.js` or `tsx src/cli/index.ts`.

### 2. Domain Types & Constants (`src/types/`)
- `src/types/index.ts`:
  - `WorktreeRecord`, `RegistryRecord`, `LifecycleState`, `WorktreeStatus`.
  - Global CLI options (`json`, `yaml`, `plain`, `dryRun`, `verbose`, `quiet`, `config`, `profile`, `cwd`).
  - Command output envelope (`CommandOutput<T>`).
  - Exit code enum (`ExitCode`).

### 3. Configuration Engine (`src/config/`)
- `src/config/schema.ts`: Zod schema for `.mannostree.yml`.
  - Validates `version`, `default_base_branch`, `worktree_root`, `metadata_root`, `artifact_dir_name`, `base_branch_resolution`, `profiles`, `cleanup`.
- `src/config/loader.ts`: Loads config from `--config` path or traverses upward for `.mannostree.yml`. Falls back to safe default config if missing.

### 4. Metadata Engine (`src/metadata/`)
- `src/metadata/schema.ts`: Zod schemas for `registry.json` and `worktrees/<id>.json`.
- `src/metadata/store.ts`:
  - Atomic persistence (`writeAtomicJson` via temp file + `fs.rename`).
  - Registry management (init, add worktree, remove worktree, list worktrees).
  - Worktree record management (get, put, delete, archive).

### 5. Git & Worktree Engine (`src/git/`)
- `src/git/base-resolver.ts`: Resolves base branch using strict order: CLI flag (`-b`) -> profile -> config default -> remote default. Forbids current branch fallback.
- `src/git/engine.ts`:
  - Executing git commands safely via `child_process.execFile`.
  - Methods: `getRepoRoot`, `checkBranchExists`, `getCurrentBranch`, `getRemoteDefaultBranch`, `createBranchAndWorktree`, `removeWorktreeAndBranch`, `getGitState` (dirty, untracked, ahead/behind).
  - Supports dry-run simulation.

### 6. Artifact Engine (`src/artifact/`)
- `src/artifact/scaffold.ts`:
  - Scaffolds `.task/task-contract.md`, `.task/solution-options.md`, `.task/implementation-plan.md`, `.task/quality-gates.md`, `.task/review.md`, and `RESULTS.md` inside newly spawned worktrees.

### 7. Orchestration Layer (`src/core/`)
- `src/core/orchestrator.ts`:
  - Implements `spawnWorktree(options)`, `listWorktrees(filter)`, `getInfo(id)`, `dropWorktree(id, options)`.
  - Enforces lifecycle state transitions (`WORKTREE_READY`, `CONTEXT_PACKED`).
  - Formats results into standard envelope (`CommandOutput<T>`).

### 8. CLI Commands & Entrypoint (`src/cli/`)
- `src/cli/output.ts`: Formatter for text, JSON, YAML, plain, and error rendering.
- `src/cli/commands/spawn.ts`: `mannostree spawn <name>`
- `src/cli/commands/list.ts`: `mannostree list`
- `src/cli/commands/info.ts`: `mannostree info <id>`
- `src/cli/commands/drop.ts`: `mannostree drop <id>`
- `src/cli/index.ts`: Commander program setup with global flags, error handlers, and exit code mappings.

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Incomplete git worktree creation due to existing branch/directory collision | Worktree or branch creation fails midway | Pre-flight collision checks before executing git commands; atomic cleanup on error. |
| Race conditions or partial writes in metadata | Broken metadata records | Use write-temp-then-rename for all JSON writes. |
| Accidental removal of dirty or uncommitted work during `drop` | Data loss | Inspect worktree git status before dropping; reject unless `--force` is provided. |
| Implicit base-branch fallback | Violates project safety invariants | Strict base-branch resolution order; throw validation error if base cannot be deterministically resolved. |

---

## Test & Verification Plan

### 1. Unit Tests
- `tests/unit/config.test.ts`: Test YAML parsing, default fallbacks, schema validations, and invalid config error handling.
- `tests/unit/metadata.test.ts`: Test atomic JSON writes, schema validation, registry additions, removals, and queries.
- `tests/unit/base-resolver.test.ts`: Test deterministic resolution hierarchy and rejection of current-branch fallbacks.
- `tests/unit/artifact.test.ts`: Test scaffolding of `.task/` files and `RESULTS.md`.

### 2. Integration Tests
- `tests/integration/cli.test.ts`: End-to-end testing using temporary git repositories:
  - CLI help and global flags (`--json`, `--dry-run`).
  - `spawn` creates branch, worktree directory, metadata record, and `.task/` artifacts.
  - `spawn --dry-run` reports actions without modifying disk.
  - `list` returns formatted table and `--json` list.
  - `info <id>` returns full metadata and health checks.
  - `drop <id>` safely removes worktree and branch, updating metadata.
  - `drop` refuses dirty worktree without `--force`.

---

## Acceptance Traceability Matrix

| Requirement | Implementation Component | Verification Test |
|-------------|--------------------------|-------------------|
| CLI scaffold & global flags | `src/cli/index.ts`, `src/cli/output.ts` | `tests/integration/cli.test.ts` |
| `.mannostree.yml` loading & schema validation | `src/config/schema.ts`, `src/config/loader.ts` | `tests/unit/config.test.ts` |
| Atomic metadata registry & worktree records | `src/metadata/store.ts`, `src/metadata/schema.ts` | `tests/unit/metadata.test.ts` |
| Explicit base-branch resolution | `src/git/base-resolver.ts` | `tests/unit/base-resolver.test.ts` |
| Safe `spawn`, `list`, `info`, `drop` commands | `src/core/orchestrator.ts`, `src/cli/commands/*` | `tests/integration/cli.test.ts` |
| Dry-run support across commands | `src/git/engine.ts`, `src/core/orchestrator.ts` | `tests/integration/cli.test.ts` |
| Aligned documentation | `README.md`, `CLAUDE.md` | Verification pass |
