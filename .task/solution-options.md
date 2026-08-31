# Solution Options: Phase 3 Project-Aware Setup & Profiles

## Option 1: Integrated Setup Engine with Profile Schema & Direct Execution (Recommended)

### Architecture & Module Boundaries
- `src/config/schema.ts`: Expand `ProfileConfigSchema` to include `env_vars: z.record(z.string()).default({})` and `generate_command: z.string().optional()`.
- `src/core/setup.ts`: Implement `SetupEngine` with:
  - `applyProfile(worktreePath, profile, options)`: Runs install and validation commands.
  - `applyEnvPolicy(worktreePath, profile, mode, fromPath, options)`: Handles copy, link, skip, generate.
  - `execCommand(worktreePath, commandArgs, profile, options)`: Runs arbitrary commands in worktree with env injection and exit code forwarding.
- `src/core/orchestrator.ts`: Integrate `SetupEngine` into `spawn`, `setup`, `env`, and `exec`.
- `src/cli/commands/`: Add `setup.ts`, `env.ts`, `exec.ts`.

### State Transitions & Metadata Impact
- Updates `setup` block in `worktree.json`: `setup_mode`, `env_mode`, `install_ran`, `install_succeeded`, `setup_commands`.
- Transitions `lifecycle_state` to `CONTEXT_PACKED` on success, or `BROKEN` on install/validation failure.

### Dry-Run & Error Handling
- Full dry-run preview across `setup` and `env`.
- Uses `ExitCode.SETUP_ENV_ERROR` (5) on install or env copy failure.
- `exec` forwards the executed process's exact exit code directly.

### Tests
- Unit tests for env copy, link, skip, generate; install commands execution; validation failures.
- Integration tests for CLI `setup`, `env`, `exec`.

### Scope & Reversibility
- Minimal changes, clean modular design, 100% backward compatible.

---

## Option 2: External Task Runners & Shell Templates

### Architecture & Module Boundaries
- Delegates setup to external tool managers (Makefiles, npm scripts, shell wrappers) without unified Mannostree profile definitions.

### State Transitions & Metadata Impact
- Weak lifecycle tracking; metadata cannot reliably capture command outcomes.

### Dry-Run & Error Handling
- Difficult to provide dry-run previews of multi-step external shell scripts.

### Tests
- Brittle environment-dependent test harness.

### Scope & Reversibility
- High risk of platform incompatibility and violates ADR-001.

---

## Option 3: Monolithic Orchestrator with Inline Subprocesses

### Architecture & Module Boundaries
- Implements all setup, env copying, and exec execution directly inside `MannostreeOrchestrator` methods without a dedicated `SetupEngine`.

### State Transitions & Metadata Impact
- Bloats orchestrator class and mixes low-level file I/O with lifecycle orchestration.

### Dry-Run & Error Handling
- Tightly couples dry-run logic with CLI output formatting.

### Tests
- Harder to unit test env and setup logic in isolation.

### Scope & Reversibility
- Less maintainable for Phase 4+ extensions.
