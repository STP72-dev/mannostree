# Implementation Plan: Phase 3 Project-Aware Setup & Profiles

## Overview
Implement Phase 3 Project-Aware Setup & Profiles for **Mannostree**:
- **Profile Configuration**: Support named profiles in `.mannostree.yml` with `install_commands`, `env_mode`, `env_files`, `validation_commands`, `env_vars`, and `generate_command`.
- **Setup Engine (`src/core/setup.ts`)**:
  - `applyProfile`: Runs install and validation commands in worktree directory.
  - `applyEnvPolicy`: Handles `copy`, `link`, `skip`, and `generate` modes with strict file presence checks and dry-run preview.
  - `execCommand`: Executes commands inside the worktree directory with environment variable injection and exit code forwarding.
- **Orchestrator Integration**:
  - `setup(id, options)`: Re-applies profile to worktree and updates metadata.
  - `env(id, options)`: Applies or updates env policy for worktree.
  - `exec(id, commandArgs, options)`: Executes command in worktree directory and returns exact exit code.
  - `spawn()`: Invokes setup engine automatically unless `--no-setup` is passed.
- **CLI Commands**:
  - `mannostree setup <id> [--profile <name>] [--reinstall] [--dry-run]`
  - `mannostree env <id> [--mode copy|link|skip|generate] [--from <path>] [--dry-run]`
  - `mannostree exec <id> -- <command...>`
- **Automated Tests & Documentation**:
  - Unit and integration tests for setup, env, and exec workflows.

---

## Detailed Specifications

### 1. `setup <id> [--profile <name>] [--reinstall] [--dry-run]`
- Finds worktree record by `<id>`.
- Resolves profile from `--profile` flag or record's existing profile (defaulting to config default).
- Previews commands in `--dry-run`.
- Executes profile `install_commands` (unless already installed and `--reinstall` not specified) and `validation_commands`.
- Updates worktree record: `setup.setup_mode`, `setup.install_ran`, `setup.install_succeeded`, `setup.setup_commands`, `last_activity_at`.
- If a validation command fails, records status as failed and sets `lifecycle_state: 'BROKEN'`.

### 2. `env <id> [--mode copy|link|skip|generate] [--from <path>] [--dry-run]`
- Resolves env mode (CLI flag `--mode` or profile default).
- `copy`: For each file in `profile.env_files`, copies from `--from` (default `repo_root`) to worktree directory.
- `link`: For each file in `profile.env_files`, creates symlink in worktree pointing to source.
- `skip`: Does nothing.
- `generate`: Executes `profile.generate_command` in worktree directory.
- Refuses if source env file does not exist when in `copy` or `link` mode.
- Updates metadata: `setup.env_mode`.

### 3. `exec <id> -- <command...>`
- Resolves worktree directory from `<id>`.
- Injects profile `env_vars` merged with `process.env`.
- Spawns subprocess with `cwd: worktreeFullPath` and forwards stdout/stderr and exit code.

---

## Risk Register & Test Plan

| Risk | Mitigation |
|------|------------|
| Silent leakage or copying of production secrets | `env` requires explicit mode; never defaults to copying `.env` without configuration. |
| Hanging child process during setup or exec | Capture subprocess errors cleanly; forward exit codes and signals. |
| Incomplete setup leaves worktree in invalid state | Record failure in metadata and transition `lifecycle_state` to `BROKEN`. |

---

## Acceptance Traceability Matrix

| Requirement | Implementation Component | Test Suite |
|-------------|--------------------------|------------|
| Profile install & validation commands | `SetupEngine.applyProfile`, `orchestrator.setup` | `tests/unit/setup.test.ts` |
| Env policy copy/link/skip/generate | `SetupEngine.applyEnvPolicy`, `orchestrator.env` | `tests/unit/env.test.ts` |
| Exec with env injection & exit code forwarding | `SetupEngine.execCommand`, `orchestrator.exec` | `tests/unit/exec.test.ts` |
| CLI commands & dry-run | `src/cli/commands/setup.ts`, `env.ts`, `exec.ts` | `tests/integration/phase3.test.ts` |
| Full Phase 1 & 2 regression safety | All prior modules | `tests/integration/cli.test.ts`, `tests/integration/phase2.test.ts` |
