# mannostree Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-08-31

## Active Technologies
- File-based persistent JSON records in `.mannostree/sessions/` and markdown artifacts in `.task/` (002-agent-contract-runner)

- TypeScript 5.7.3 / Node.js >= 20.0.0 (ESM `package.json` `"type": "module"`) + `commander` (CLI parsing), `chalk` (colored output), `zod` (runtime schema validation), `yaml` (config parsing) (001-safety-lifecycle-recovery)

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
- 004-fleet-sync-conflict-matrix: Added FleetEngine (fleet sync, 3-way in-memory merge simulation, pairwise cross-worktree conflict matrix)
- 003-benchmark-matrix-eval: Added MatrixEvaluator (automated benchmark harness, WSM multi-variant composite scoring, parallel eval CLI)
- 002-agent-contract-runner: Added TypeScript 5.7.3 / Node.js >= 20.0.0 (ESM `package.json` `"type": "module"`) + `commander` (CLI parsing), `chalk` (colored output), `zod` (runtime schema validation), `yaml` (config parsing)
- 001-safety-lifecycle-recovery: Added TypeScript 5.7.3 / Node.js >= 20.0.0 (ESM `package.json` `"type": "module"`) + `commander` (CLI parsing), `chalk` (colored output), `zod` (runtime schema validation), `yaml` (config parsing)


<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
