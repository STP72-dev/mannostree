# Solution Options: Phase 1 Core Foundation

## Option 1: Layered Modular Architecture (TypeScript + Commander + Zod + Direct Git Engine)

### Architecture
- Clean layered architecture as prescribed in `docs/02-project-kickoff/architecture.md`:
  - `src/cli/`: CLI layer (Commander.js, argument parsing, output formatting for text/json/yaml, global flags, exit code mapping).
  - `src/core/`: Application/orchestration layer (coordinating operations, lifecycle rule enforcement, dry-run routing).
  - `src/config/`: Configuration loader, schema validator, profile manager.
  - `src/git/`: Git/worktree engine wrapping git commands with dry-run capabilities.
  - `src/metadata/`: Metadata engine (atomic file operations, registry and worktree record validation/querying).
  - `src/artifact/`: Task artifact scaffolding (`.task/` directory + `RESULTS.md`).
- Modules communicate via typed interfaces and domain objects.

### Files/Modules Affected
- `package.json`, `tsconfig.json`, `vitest.config.ts`
- `bin/mannostree.js` (CLI entry executable)
- `src/index.ts`
- `src/types/index.ts` (shared domain models)
- `src/config/schema.ts`, `src/config/loader.ts`
- `src/metadata/schema.ts`, `src/metadata/store.ts`
- `src/git/engine.ts`, `src/git/base-resolver.ts`
- `src/artifact/scaffold.ts`
- `src/core/orchestrator.ts`
- `src/cli/commands/spawn.ts`, `src/cli/commands/drop.ts`, `src/cli/commands/list.ts`, `src/cli/commands/info.ts`
- `tests/unit/`, `tests/integration/`

### Metadata/Lifecycle Implications
- Full adherence to `.mannostree/registry.json` and `.mannostree/worktrees/<id>.json`.
- Strict schema versioning (`version: 1`), atomic temp-write-and-rename.
- Explicit lifecycle transitions (`WORKTREE_READY`, `CONTEXT_PACKED`).

### Failure & Recovery Behavior
- Validation failures output structured error summaries with exit code 3.
- Git command failures captured cleanly with exit code 4.
- Atomic file operations ensure no partial metadata writes on crash.

### Tests
- Unit tests for config loading, metadata schemas, base resolver, git wrapper, artifact generation.
- End-to-end integration tests using isolated temporary git repositories testing real worktree spawn, list, info, and drop workflows.

### Risks & Reversibility
- Low risk. Minimal external runtime dependencies (`commander`, `yaml`, `zod`, `chalk`). Standard ESM TypeScript.
- Highly reversible and extensible for Phase 2+ (parallel engine, doctor, github adapter).

### Estimated Change Scope
- Medium (~15-20 TypeScript source files + test suite).

---

## Option 2: Monolithic Orchestrator with Minimal Dependencies (Zero-Schema Native Types)

### Architecture
- Consolidates git, metadata, config, and artifact routines into a single monolithic `Mannostree` service class with lightweight manual type guards instead of Zod.
- Custom CLI parser instead of Commander.

### Files/Modules Affected
- `package.json`, `tsconfig.json`
- `src/cli.ts`
- `src/mannostree.ts`
- `src/git.ts`
- `src/types.ts`
- `tests/e2e.test.ts`

### Metadata/Lifecycle Implications
- Metadata JSON written directly with manual validation.
- Higher likelihood of subtle schema drift if fields are added without runtime schema enforcement.

### Failure & Recovery Behavior
- Less granular validation errors; syntax errors in config or metadata may cause generic parse exceptions.

### Tests
- Focused primarily on end-to-end black-box CLI tests.

### Risks & Reversibility
- Harder to maintain and extend for Phase 2+ commands (doctor, parallel, publish).
- Difficult to ensure atomic consistency and comprehensive error reporting across growing features.

### Estimated Change Scope
- Small (~5-8 files), but higher technical debt.

---

## Option 3: Shell/Subprocess Adapter Wrapped in TypeScript

### Architecture
- Wraps bash/shell scripts for git worktree lifecycle operations, exposing a TypeScript CLI facade for argument handling.
- Shell scripts handle directory creation and git invocation; TS handles JSON metadata output.

### Files/Modules Affected
- `scripts/worktree-spawn.sh`, `scripts/worktree-drop.sh`
- `src/cli.ts`, `src/executor.ts`
- `package.json`

### Metadata/Lifecycle Implications
- Split lifecycle ownership between shell scripts and TypeScript metadata layer.
- Contradicts ADR-001 ("Mannostree replaces legacy worktree scripts as the single lifecycle layer").

### Failure & Recovery Behavior
- Inconsistent cross-platform behavior (Windows/macOS/Linux shell quirks).
- Poor atomicity guarantees if shell script partially executes before TS metadata updates.

### Tests
- Requires testing shell scripts and TS wrappers separately.

### Risks & Reversibility
- High risk. Violates ADR-001 and project safety rules regarding explicit deterministic lifecycle ownership.

### Estimated Change Scope
- Medium (~10 files), fragile and hard to audit.
