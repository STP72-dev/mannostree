# Research & Technical Decisions: Post-MVP Release-Readiness & GitHub CLI Verification

## Research Sources & Decisions

### 1. GitHub CLI (`gh pr create`) Protocol
- **Source**: Official GitHub CLI Documentation (`gh pr create --help`).
- **Date**: 2026-08-31.
- **Specification Details**:
  - `gh pr create` requires `--head <branch>` and `--base <base_branch>`.
  - Content options: `--title <string>` and `--body-file <filepath>`.
  - Flags: `--draft` creates a draft PR.
  - Standard output on success: A single URL line formatted as `https://github.com/<owner>/<repo>/pull/<number>`.
- **Decision Impact**: Implement deterministic regex parsing `/\/pull\/(\d+)/` to extract both `pr_url` and `pr_number`.

### 2. Isolated & Injected Binary Execution Architecture
- **Source**: Node.js `child_process.execFile` and Hexagonal Architecture principles.
- **Date**: 2026-08-31.
- **Findings**:
  - `GitEngine.exec` unconditionally prefixes calls with the `git` binary executable.
  - `gh` is an external binary executable separate from `git`.
  - Hardcoding shell `exec` makes testing non-deterministic in environments without `gh` authentication.
- **Decision Impact**: Introduce `GhAdapter` interface / function signature in `src/core/publish.ts`:
  ```ts
  export type GhExecutor = (
    args: string[],
    cwd: string
  ) => Promise<{ stdout: string; stderr: string }>;
  ```
  Default implementation executes `child_process.execFile('gh', args, { cwd })`. `PublishEngine` accepts optional `ghExecutor` for seamless dependency injection in tests.

### 3. Coverage Tooling & Measurement
- **Source**: Vitest V8 Coverage Guide (`@vitest/coverage-v8`).
- **Date**: 2026-08-31.
- **Findings**:
  - `@vitest/coverage-v8` provides fast AST-accurate branch and statement coverage without transpilation instrumentation overhead.
- **Decision Impact**: Integrated `@vitest/coverage-v8@^3.0.7` and configured reporting in `vitest.config.ts`.
