# Implementation Plan: Movement 5 — Parallel Publish & Multi-Branch Merge-Sync

**Feature**: `006-parallel-publish-merge-sync`  
**Date**: 2026-09-01  
**Status**: Ready for Tasks

---

## 1. Technical Context & Stack

- **Runtime**: Node.js >= 20.0.0 (ESM, `package.json` `"type": "module"`)
- **Language**: TypeScript 5.7.3 (`strict: true`, `noUncheckedIndexedAccess: true`)
- **CLI Framework**: Commander.js + Chalk
- **Schema Validation**: Zod (`src/metadata/schema.ts`)
- **Git Engine**: Git CLI wrapper (`GitEngine` in `src/git/engine.ts`) with `git merge-tree --write-tree`
- **Metadata Store**: Atomic file-backed JSON store in `.mannostree/`
- **Testing**: Vitest (`tests/unit/`, `tests/integration/`)

---

## 2. Architecture & Component Blueprint

```
src/
├── types/index.ts                  # Add ParallelPublishResult, FleetMergeSyncReport, FleetBatchPublishReport
├── metadata/
│   ├── schema.ts                   # Add Zod validation schemas for Movement 5 reports
│   └── store.ts                    # Add release manifest persistence (releasesDir)
├── core/
│   ├── publish.ts                  # Extend PublishEngine with parallel winner compilation & batch fleet publishing
│   ├── fleet.ts                    # Extend FleetEngine with multi-branch in-memory merge simulation (mergeSync)
│   ├── parallel.ts                 # Wire parallelPublish into ParallelEngine
│   └── orchestrator.ts             # Orchestrate parallelPublish, fleetMergeSync, and fleetBatchPublish
└── cli/
    └── commands/
        ├── parallel.ts             # Register `parallel publish <feature>`
        └── fleet.ts                # Register `fleet merge-sync` and `fleet publish`
```

---

## 3. Work Breakdown Structure (Phased)

### Phase 1: Setup & Configuration
- Extend `MannostreeConfigSchema` to support release manifest paths and default batch publish options.

### Phase 2: Foundational Types, Schemas & Release Manifest Store
- Define domain interfaces in `src/types/index.ts`.
- Define Zod validation schemas in `src/metadata/schema.ts`.
- Add `releasesDir`, `saveReleaseManifest`, `getReleaseManifest`, `listReleaseManifests` in `src/metadata/store.ts`.

### Phase 3: User Story 1 & 2 — Parallel Winner Publishing (`parallel publish`)
- Implement rich PR body compiler extracting task artifacts, solution options, task checklist, and multi-variant benchmark scorecard.
- Implement `ParallelEngine.publishWinner(featureName, options)` with explicit winner validation, quality gate checks, and `GhExecutor` invocation.
- Register `parallel publish` in `src/cli/commands/parallel.ts`.
- Author unit tests in `tests/unit/parallel-publish.test.ts` and integration tests in `tests/integration/parallel-publish-cli.test.ts`.

### Phase 4: User Story 3 — Fleet Multi-Branch Release Assembly (`fleet merge-sync`)
- Implement in-memory sequential 3-way merge simulations in `FleetEngine.mergeSync(options)`.
- Support `--preview`, `--yes`, `--ignore-conflicts`, and release manifest generation.
- Register `fleet merge-sync` in `src/cli/commands/fleet.ts`.
- Author unit tests in `tests/unit/fleet-merge-sync.test.ts` and integration tests in `tests/integration/fleet-merge-sync-cli.test.ts`.

### Phase 5: User Story 4 — Batch Fleet Publishing (`fleet publish`)
- Implement batch publishing in `PublishEngine.batchPublish(options)` with lease releases and concurrency safety.
- Register `fleet publish` in `src/cli/commands/fleet.ts`.
- Author unit tests in `tests/unit/fleet-batch-publish.test.ts`.

### Phase 6: Polish & Verification
- Verify 100% test suite pass rate and zero TypeScript lint errors.
- Update `README.md` with Movement 5 CLI command guides.
- Generate `/speckit.validate` audit report.
