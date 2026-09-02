# mannostree Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-08-31

## Active Technologies
- File-based persistent JSON records in `.mannostree/sessions/`, `.task/sandbox-receipt.json`, `.mannostree/leases/`, `.mannostree/worktrees/`, and `.task/` (008-sandboxed-container-execution)
- TypeScript 5.7.3 / Node.js >= 20.0.0 (ESM `package.json` `"type": "module"`) + `commander` (CLI), `chalk` (colored output), `zod` (runtime schema validation), `yaml` (config parsing) (008-sandboxed-container-execution)
- Pluggable container execution runtime drivers (Docker, Podman rootless, local Process fallback) with POSIX UID mapping, resource caps, and durable execution receipts (008-sandboxed-container-execution)
- TypeScript 5.7.3 / Node.js >= 20.0.0 (ESM `"type": "module"`) + `commander` (CLI), `chalk` (styling), `zod` (runtime schema validation), `yaml` (YAML manifest parser) (009-cross-repo-poly-worktree)
- Persistent JSON files in `.mannostree/poly-registry.json`, `.mannostree/poly-links.json`, `.mannostree/poly-releases/` (009-cross-repo-poly-worktree)
- TypeScript 5.7.3 / Node.js >= 20.0.0 (ESM `"type": "module"`) + `commander` (CLI), `chalk` (styling), `zod` (runtime schema validation), `yaml` (YAML parsing), native Node.js `fetch` (HTTP client) (010-issue-tracker-sync)
- Persistent JSON files in `.mannostree/issues/<KEY>.json`, updated `.mannostree/worktrees/<id>.json`, and `.task/task-contract.md` (010-issue-tracker-sync)

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
- 010-issue-tracker-sync: Added TypeScript 5.7.3 / Node.js >= 20.0.0 (ESM `"type": "module"`) + `commander` (CLI), `chalk` (styling), `zod` (runtime schema validation), `yaml` (YAML parsing), native Node.js `fetch` (HTTP client)
- 009-cross-repo-poly-worktree: Added TypeScript 5.7.3 / Node.js >= 20.0.0 (ESM `"type": "module"`) + `commander` (CLI), `chalk` (styling), `zod` (runtime schema validation), `yaml` (YAML manifest parser)
- 008-sandboxed-container-execution: Added container sandbox execution engine (Docker, Podman, Process fallback), resource quotas, network isolation policies, POSIX UID mapping, durable `.task/sandbox-receipt.json` records, sandboxed agent dispatch, clean-room matrix eval, and container health doctor audit.


<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->

