# mannostree Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-08-31

## Active Technologies
- File-based persistent JSON records in `.mannostree/sessions/`, `.task/sandbox-receipt.json`, `.mannostree/leases/`, `.mannostree/worktrees/`, and `.task/` (008-sandboxed-container-execution)
- TypeScript 5.7.3 / Node.js >= 20.0.0 (ESM `package.json` `"type": "module"`) + `commander` (CLI), `chalk` (colored output), `zod` (runtime schema validation), `yaml` (config parsing) (008-sandboxed-container-execution)
- Pluggable container execution runtime drivers (Docker, Podman rootless, local Process fallback) with POSIX UID mapping, resource caps, and durable execution receipts (008-sandboxed-container-execution)

## Project Structure

```text
src/
tests/
```

## Commands

npm test && npm run lint

## Code Style

TypeScript 5.7.3 / Node.js >= 20.0.0 (ESM `package.json` `"type": "module"`): Follow standard conventions

## Recent Changes
- 008-sandboxed-container-execution: Added container sandbox execution engine (Docker, Podman, Process fallback), resource quotas, network isolation policies, POSIX UID mapping, durable `.task/sandbox-receipt.json` records, sandboxed agent dispatch, clean-room matrix eval, and container health doctor audit.
- 007-multi-host-adapters: Added pluggable multi-host remote adapters (GitHub, GitLab MRs, Gitea PRs, Bitbucket PRs, Generic Remote), zero-dependency remote URL detector, and host diagnostics doctor audit.
- 006-parallel-publish-merge-sync: Added Parallel publish pipeline (rich evidence PR compilation, benchmark embedding), Fleet merge-sync (multi-branch sequential 3-way in-memory merge assembly, release manifest), and Fleet batch PR publisher
- 005-fleet-tier-auto-archive: Added TypeScript 5.7.3 / Node.js >= 20.0.0 (ESM `package.json` `"type": "module"`) + `commander` (CLI), `chalk` (colored output), `zod` (runtime schema validation), `yaml` (config parsing)
- 004-fleet-sync-conflict-matrix: Added FleetEngine (fleet sync, 3-way in-memory merge simulation, pairwise cross-worktree conflict matrix)
- 003-benchmark-matrix-eval: Added MatrixEvaluator (automated benchmark harness, WSM multi-variant composite scoring, parallel eval CLI)


<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->

