# Task Contract: Phase 1 Core Foundation

## Problem
Mannostree is currently in a design-only state with extensive specifications in `docs/` but no functional CLI, config loader, metadata engine, git worktree engine, or automated test harness. To enable safe, deterministic, worktree-based parallel development and agent orchestration, Mannostree needs its Phase 1 core foundation implemented in TypeScript/Node.

## Scope
1. **TypeScript/Node CLI Scaffold**:
   - `package.json`, `tsconfig.json`, build and test scripts.
   - CLI entrypoint (`bin/mannostree.js` or `src/cli/index.ts`) using Commander/yargs or native CLI parsing.
   - Global flags: `--json`, `--yaml`, `--plain`, `--verbose`, `--quiet`, `--dry-run`, `--config`, `--profile`, `--cwd`.
   - Exit-code taxonomy (0: success, 1: generic, 2: usage/input, 3: validation, 4: git operation, 5: setup/env, 6: metadata inconsistency, etc.).
   - Standard output envelope in `--json` mode (`command`, `ok`, `dry_run`, `result`, `warnings`, `errors`).
2. **Configuration Engine (`.mannostree.yml`)**:
   - Load, parse (YAML), and validate schema for `.mannostree.yml`.
   - Default fallback configuration when config file is absent.
   - Config-driven properties: `default_base_branch`, `worktree_root`, `metadata_root`, `artifact_dir_name`, `profiles`, `cleanup`, `base_branch_resolution`.
3. **Metadata Engine**:
   - Versioned (`version: 1`), atomic (write-to-temp + rename) registry and per-worktree record persistence.
   - Registry index (`.mannostree/registry.json`).
   - Per-worktree record (`.mannostree/worktrees/<id>.json`) adhering to the canonical schema.
   - Lifecycle state enum (`WORKTREE_READY`, `CONTEXT_PACKED`, etc.) and two-field status model (`status` + `lifecycle_state`).
4. **Git / Worktree Engine**:
   - Explicit base-branch resolution: CLI flag (`-b`) -> profile -> config default (`default_base_branch`) -> remote default branch. Forbids current branch fallback unless explicit.
   - Single-path worktree creation (`git worktree add -b <branch> <path> <base>`).
   - Worktree removal (`git worktree remove` and branch deletion unless `--keep-branch`).
   - Safety checks: detect untracked/dirty files before dropping, detect collisions before spawning.
5. **CLI Commands**:
   - `spawn <name>`: Create isolated worktree from explicit base, scaffold `.task/` skeleton + `RESULTS.md`, persist metadata.
   - `list`: List tracked worktrees (with filtering by state/kind/tag, table and `--json` outputs).
   - `info <id>`: Show detailed worktree metadata + derived live existence.
   - `drop <id>`: Safely remove worktree & branch with safety checks, `--keep-branch`, `--force`, `--dry-run`.
6. **Verification & Testing**:
   - Unit tests for config, metadata, base resolution, CLI parsing, and git operations using Node test runner / vitest / jest.
   - Integration tests executing real git worktree spawn/list/info/drop cycles in temporary directories.
7. **Documentation**:
   - Update README and relevant user-facing docs to match actual implemented behavior and verification instructions.

## Out-of-Scope
- Parallel variant execution (`parallel spawn`, `parallel compare`, `parallel pick`, etc.).
- GitHub API integration and PR publishing (`pr create`, `pr view`).
- Automatic merges or silent/implicit cleanup.
- Secret copying/linking without explicit policy.

## Acceptance Criteria
- [ ] `mannostree --help` displays command hierarchy and options.
- [ ] Config loader correctly parses `.mannostree.yml` and validates required fields with schema errors (exit code 3).
- [ ] Explicit base branch is strictly enforced and deterministically resolved. If unresolved, errors with exit code 2 or 3 without falling back to `HEAD`.
- [ ] `mannostree spawn <name> -b main` creates worktree directory, git branch, `.task/` artifacts + `RESULTS.md`, and persists `.mannostree/worktrees/<id>.json` + `registry.json`.
- [ ] `mannostree spawn <name> --dry-run` reports exact planned actions without touching git or filesystem.
- [ ] `mannostree list` and `mannostree list --json` list active worktrees accurately.
- [ ] `mannostree info <id>` displays comprehensive metadata and live status checks.
- [ ] `mannostree drop <id>` safely removes worktree directory and branch, updating registry; refuses if dirty unless `--force`.
- [ ] All metadata writes use atomic write-temp-and-rename semantics.
- [ ] Comprehensive automated test suite passes with 100% green exit code.

## References
- `AGENTS.md`
- `CLAUDE.md`
- `docs/01-arch-design/config-design.md`
- `docs/01-arch-design/metadata-schema-proposal.md`
- `docs/01-arch-design/command-layer.md`
- `docs/02-project-kickoff/cli-spec.md`
- `docs/02-project-kickoff/metadata-schema.md`
- `docs/02-project-kickoff/architecture.md`
- `docs/02-project-kickoff/worktree-lifecycle.md`
- `docs/02-project-kickoff/branching-and-naming.md`

## Explicit Assumptions
- Implementation stack: Node.js (v20+) + TypeScript (ESM) using a clean, lightweight CLI framework (e.g. Commander or native/argparse) and YAML parser (`yaml`).
- Test runner: Vitest or Node's native test runner (`node:test`) with TypeScript runner (`tsx` or `ts-node`).
- Base branch: `main` is the explicit base for this repo.
- Publishing mode: `prepare-only`.
- Parallel-variant permission: `never`.
