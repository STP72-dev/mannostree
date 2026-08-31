# Research & Technical Decisions: Phase 3 Project-Aware Setup & Profiles

## Context & Objectives
Phase 3 establishes the Setup Engine and Profile Management subsystem in Mannostree. This subsystem is responsible for bootstrapping isolated workspace dependencies, applying explicit environment policies (`.env` file handling), and running commands directly inside worktrees with proper environment injection.

## Research Findings & Decision Impact

### 1. Subprocess Execution & Environment Variable Injection
- **Source**: Node.js `node:child_process` documentation (`https://nodejs.org/api/child_process.html`).
- **Date Accessed**: 2026-08-31
- **Findings**:
  - `child_process.spawn(cmd, args, { cwd, env, stdio: 'inherit' | 'pipe', shell: true })` allows cross-platform execution of compound commands (e.g. `npm ci && npm test`), respects custom working directories, and captures/forwards exact process exit codes.
  - When running `mannostree exec <id> -- <cmd...>`, `stdio: 'inherit'` ensures seamless interactive/streaming output and proper TTY signal handling.
- **Decision Impact**: Implement a dedicated `SetupEngine` with helper `runCommand(cmd, cwd, env)` and `execInWorktree(worktreePath, cmdArgs, env)`.

### 2. Explicit Environment File Handling (`env_mode`)
- **Source**: CLAUDE.md & ADR-003 / ADR-007.
- **Date Accessed**: 2026-08-31
- **Findings**:
  - Never implicitly copy or propagate `.env` files.
  - `copy`: Explicitly copies listed `env_files` from `--from` (default repo root) to target worktree root.
  - `link`: Symlinks listed `env_files` using relative symlinks or absolute paths.
  - `skip`: Default mode; does nothing.
  - `generate`: Runs custom profile generator script (e.g. `npm run generate-env`).
- **Decision Impact**: Implement `applyEnvPolicy()` in `SetupEngine` enforcing strict source validation and dry-run preview.

### 3. Setup Lifecycle State & Validation Failure Handling
- **Source**: `docs/02-project-kickoff/worktree-lifecycle.md`.
- **Date Accessed**: 2026-08-31
- **Findings**:
  - If setup install or validation fails, worktree must not silently proceed. The worktree metadata must record `setup.install_succeeded = false` and transition `lifecycle_state` to `BROKEN` with diagnostic error output.
- **Decision Impact**: Implement status updating and `BROKEN` transition on setup failure.
