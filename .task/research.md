# Research & Technical Decisions: Phase 1 Core Foundation

## Context & Objectives
Mannostree requires a reliable, lightweight, script-friendly CLI tool built in TypeScript with zero tolerance for unverified assumptions, implicit branch selections, or race conditions during metadata persistence.

## Research Findings & Decision Impact

### 1. CLI Parsing Framework
- **Source**: Commander.js documentation (`https://github.com/tj/commander.js`) & Yargs documentation.
- **Date Accessed**: 2026-08-31
- **Findings**: Commander provides concise command tree declaration (`spawn`, `drop`, `list`, `info`), clean hierarchical help output, typed option parsing, subcommands, and easy override of exit codes to match Mannostree's exit code taxonomy (codes 0, 1, 2, 3, 4, 5, 6, 7, 8, etc.).
- **Decision Impact**: Use `commander` for the CLI interface layer.

### 2. Configuration & Schema Validation
- **Source**: Zod documentation (`https://zod.dev`) & YAML parser (`https://eemeli.org/yaml/`).
- **Date Accessed**: 2026-08-31
- **Findings**: `yaml` provides pure JS YAML 1.2 parsing. `zod` allows declarative schema definitions for `.mannostree.yml`, `registry.json`, and worktree records (`<id>.json`), while deriving exact TypeScript types from schemas. Zod validation errors format cleanly into user-friendly validation reports (Exit Code 3).
- **Decision Impact**: Use `yaml` + `zod` for config parsing and metadata serialization/validation.

### 3. Git Operations & Process Execution
- **Source**: Git documentation on worktrees (`https://git-scm.com/docs/git-worktree`) and Node.js `node:child_process`.
- **Date Accessed**: 2026-08-31
- **Findings**: Direct invocation of git CLI via `node:child_process.execFile` / `execSync` preserves full git behavior, respects user git configuration, allows dry-run command logging, captures exact stdout/stderr and exit codes, and eliminates hidden wrapper quirks.
- **Decision Impact**: Implement a dedicated `GitEngine` module wrapping `child_process.execFile` with explicit dry-run support, working directory injection, and typed return values.

### 4. Atomic File Persistence
- **Source**: POSIX filesystem rename atomicity semantics (`fs.promises.rename`).
- **Date Accessed**: 2026-08-31
- **Findings**: Atomic updates across filesystems require creating a temporary file in the same directory (or parent) and using atomic `fs.rename` (or `fs.copyFile` + unlink on cross-device boundary).
- **Decision Impact**: Implement `writeAtomicJson(filePath, data)` that writes to `<filePath>.tmp.<timestamp>` and atomically renames to `<filePath>`, preventing partial/corrupted records during process interruptions.

### 5. Test Harness
- **Source**: Vitest (`https://vitest.dev/`).
- **Date Accessed**: 2026-08-31
- **Findings**: `vitest` runs TypeScript directly with zero build step, supports isolated test runs, fast execution, and integrated coverage.
- **Decision Impact**: Use `vitest` for unit and integration test suites.
