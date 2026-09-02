# mannostree Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-09-02

## Active Technologies
- TypeScript 5.7.3 / Node.js >= 20.0.0 (ESM `package.json` `"type": "module"`)
- Core Libraries: `commander` (CLI parser), `chalk` (ANSI terminal formatting), `zod` (runtime metadata & schema validation), `yaml` (YAML configuration parser), native Node.js `fetch` (HTTP/REST/GraphQL client), `vitest` (automated test framework)
- File-based atomic JSON records in `.mannostree/`:
  - Worktrees: `.mannostree/worktrees/<id>.json`
  - Experiments: `.mannostree/experiments/<feature>.json`
  - Leases: `.mannostree/leases/<id>.json`
  - Sessions: `.mannostree/sessions/<sessionId>.json`
  - Issues: `.mannostree/issues/<KEY>.json`
  - Poly-registry: `.mannostree/poly-registry.json`, `.mannostree/poly-links.json`, `.mannostree/poly-releases/`
  - Write-ahead Transaction Journal: `.mannostree/journal/`
- Durable Task Artifacts in `.task/`:
  - `.task/task-contract.md` (Contract & acceptance criteria checklist)
  - `.task/RESULTS.md` (Verification evidence & benchmark results)
  - `.task/sandbox-receipt.json` (Container execution receipt & resource proof)
- Pluggable Container Execution Sandbox Drivers (Docker, Rootless Podman, local Process fallback) with POSIX UID mapping, resource caps (CPU, memory, timeout), and network isolation
- Pluggable Multi-Host Git Remote Adapters (GitHub, GitLab, Gitea, Bitbucket)
- Pluggable Issue Tracker Adapters (Jira REST API v3, Linear GraphQL, GitHub Issues, Generic Webhooks)

## Project Structure

```text
src/
  cli/          # Commander CLI commands & output formatting
  config/       # Configuration loader & Zod schemas (.mannostree.yml)
  core/         # Orchestrator core, doctor diagnostics, setup & task engine
  git/          # Git engine, base resolver & worktree driver
  metadata/     # Metadata store, transaction journal & schemas
  parallel/     # Parallel variant engine & Pareto matrix evaluator
  agent/        # Autonomous agent runner, scorecard & execution engine
  fleet/        # Fleet sync, conflict collision matrix, tiering, leases & auto-archive
  publish/      # Multi-host remote publishing & release merge-sync
  sandbox/      # Container execution drivers (Docker, Podman, Process)
  poly/         # Cross-repository poly-worktree engine & package linkers
  issues/       # Bi-directional issue tracker sync engine & adapters
tests/
  unit/         # Vitest unit test suites
  integration/  # Vitest end-to-end lifecycle & CLI integration test suites
docs/
  USER_MANUAL.md# Comprehensive Operator & Developer User Manual
```

## Verification Commands

```bash
# Run strict TypeScript compilation check
npm run lint

# Run all test suites
npm test

# Build distribution bundle
npm run build
```

## Code Style & Safety Invariants

- TypeScript 5.7.3 / Node.js >= 20.0.0 (ESM `package.json` `"type": "module"`): Follow standard conventions
- Strict flag separation: require `--discard-uncommitted --yes` for destructive cleanup; `--force` only bypasses non-content operational blockers
- Explicit base branch resolution: never implicitly default to checked-out branch
- Zero-secret leakage: never persist tokens in metadata JSON or `.task/` markdown files
- Universal dry-run preview across all mutating operations

## Completed Feature Movements

- **Movement 1 (`001-safety-lifecycle-recovery`)**: Core Safety Invariants, Lifecycle Machine & Journaled Recovery Engine.
- **Movement 2 (`002-agent-contract-runner`)**: Autonomous Agent Contract Runner, Execution Receipt Ledger & Verification Scorecard.
- **Movement 3 (`003-benchmark-matrix-eval`)**: Multi-Variant Matrix Evaluation, Benchmark Regression Gates & Pareto Selection.
- **Movement 4 (`004-fleet-sync-conflict-matrix`)**: Distributed Fleet Sync, 3-Way Semantic Conflict Matrix & Upstream Rebase Engine.
- **Movement 5 (`005-fleet-tier-auto-archive`)**: Workspace Tiering, Dynamic Leases & Automated Retention / Auto-Archive Policies.
- **Movement 6 (`006-parallel-publish-merge-sync`)**: Parallel Batch Publishing, Multi-Target Push & Merge Reconciliation.
- **Movement 7 (`007-multi-host-adapters`)**: Multi-Host Git Adapters (GitLab, Gitea, Bitbucket, GitHub Enterprise).
- **Movement 8 (`008-sandboxed-container-execution`)**: Pluggable Container Sandboxes (Docker, Rootless Podman, Process Fallback) with Resource Quotas & Isolation.
- **Movement 9 (`009-cross-repo-poly-worktree`)**: Cross-Repository Poly-Worktrees, Shared Symlinks & Monorepo/Multi-Repo Release Manifests.
- **Movement 10 (`010-issue-tracker-sync`)**: Bi-directional Issue Tracker Sync (Jira REST v3, Linear GraphQL, GitHub Issues, Generic Webhooks, Drift Detection, Evidence Sync).

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
