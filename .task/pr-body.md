# Pull Request: Mannostree Phase 3 Project-Aware Setup & Profiles

## Summary
Implements Phase 3 Project-Aware Setup & Profiles for **Mannostree**, delivering `setup`, `env`, and `exec` commands while maintaining 100% backward compatibility with Phase 1 and Phase 2.

## Changes
- **Configuration & Profiles**:
  - Added `env_vars` (environment variable injection) and `generate_command` to `ProfileConfigSchema`.
- **Setup Engine Subsystem**:
  - Added `src/core/setup.ts` (`SetupEngine`) managing profile install and validation commands, explicit env file policies (`copy`, `link`, `skip`, `generate`), and in-worktree process execution.
- **Core Orchestrator**:
  - Implemented `setup`, `env`, and `exec` methods in `MannostreeOrchestrator`.
  - Integrated automated setup and env bootstrap into `spawn` (bypassed with `--no-setup`).
- **CLI Commands**:
  - Added `setup.ts`, `env.ts`, and `exec.ts` to `src/cli/commands/`.
  - Added output formatters for setup and env in `src/cli/output.ts`.
  - Registered all Phase 3 commands in `src/cli/index.ts`.
- **Automated Tests**:
  - Added unit test suites (`tests/unit/setup.test.ts`, `tests/unit/env.test.ts`, `tests/unit/exec.test.ts`) and integration suite (`tests/integration/phase3.test.ts`).
  - Total test suite: 43/43 tests passing across 15 suites.
- **Documentation**:
  - Updated `README.md` and durable task artifacts.

## Validation
- `npm run lint`: Passed (0 type errors).
- `npm run build`: Passed (Clean compilation to `dist/`).
- `npm test -- --run`: Passed (43/43 tests passing in 1.01s).

## Review
- Independent review verdict: **PASSED**.
- All safety invariants verified (explicit env copying, validation failure transition to `BROKEN`, exit code forwarding, dry-run purity).

## Publishing Mode
- **Mode**: `prepare-only`.
