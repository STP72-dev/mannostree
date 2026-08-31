# Task Contract: Phase 3 Project-Aware Setup & Profiles

## Problem
Developers and autonomous worker agents working inside isolated worktrees need dependable, profile-driven environment initialization (e.g. running `npm ci`, setting up Python venvs, managing `.env` files safely without silent secret leakage, and executing commands directly within a worktree's isolated directory).

## Scope
Deliver Phase 3 Setup Engine and Profile Management while preserving 100% backward compatibility with Phase 1 and Phase 2:
1. **Profile Engine & Configuration**:
   - Support named profiles in `.mannostree.yml` (`install_commands`, `env_mode`, `env_files`, `validation_commands`, `env_vars`, `generate_command`).
   - Integrate setup execution into `spawn` when `--no-setup` is not passed.
2. **`setup <id> [--profile <name>] [--reinstall] [--dry-run]`**:
   - Re-applies setup profile to an existing worktree.
   - Runs `install_commands` and `validation_commands` in worktree directory.
   - Updates worktree metadata (`setup.install_ran`, `setup.install_succeeded`, `setup.setup_mode`, `setup.setup_commands`).
   - If setup validation fails, updates status and transitions lifecycle state to `BROKEN` with diagnostic notes.
   - Supports `--dry-run` preview.
3. **`env <id> [--mode copy|link|skip|generate] [--from <path>] [--dry-run]`**:
   - Manages environment configuration files with strict explicit opt-in policy:
     - `copy`: Copies listed `env_files` from `--from` (default repo root) to worktree root.
     - `link`: Symlinks listed `env_files` from `--from` (default repo root) to worktree root.
     - `skip`: Does nothing.
     - `generate`: Runs profile's `generate_command` in worktree directory.
   - Refuses `copy` or `link` if source env file does not exist.
   - Updates metadata (`setup.env_mode`).
   - Supports `--dry-run` preview.
4. **`exec <id> -- <command...>`**:
   - Executes arbitrary command string or arguments directly inside `<worktree_path>`.
   - Injects profile-defined environment variables (`env_vars`).
   - Streams stdout/stderr and preserves the exact exit code of the executed child process.
5. **Documentation & Testing**:
   - Unit tests for setup profile execution, env file copy/link/generate, and exec command forwarding.
   - Integration tests for end-to-end CLI commands.
   - Update README and CLI documentation.

## Out-of-Scope
- Phase 4 multi-variant parallel execution (`parallel spawn`, `parallel compare`, `parallel pick`).
- Phase 5 GitHub publish flow and PR creation.
- Automatic secret guessing or silent `.env` file copying.

## Acceptance Criteria
- [ ] **Phase 1 & Phase 2 Compatibility**: All existing commands and tests continue to pass without regression.
- [ ] **`setup`**: Executes profile install and validation commands; updates `setup` metadata; `--dry-run` previews actions without running commands.
- [ ] **`env`**: Safely copies or symlinks listed env files; validates source file existence; supports `--dry-run`.
- [ ] **`exec`**: Runs commands inside the worktree directory; injects environment variables; forwards exact process exit codes (e.g. exit code 0, 1, 42).
- [ ] **Test Coverage**: 100% passing tests across unit and integration suites.

## References
- `AGENTS.md`
- `CLAUDE.md`
- `docs/01-arch-design/config-design.md`
- `docs/02-project-kickoff/cli-spec.md`
- `docs/02-project-kickoff/worktree-lifecycle.md`

## Explicit Assumptions
- Base branch: `main`.
- Publishing mode: `prepare-only`.
- Parallel variants: `never`.
