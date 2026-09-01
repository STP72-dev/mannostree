# Implementation Plan: Fleet Sync & Cross-Worktree Conflict Matrix

**Branch**: `004-fleet-sync-conflict-matrix` | **Status**: Planned  
**Specification**: [`specs/004-fleet-sync-conflict-matrix/spec.md`](spec.md)  

---

## Technical Context & Constraints

- **Language / Runtime**: TypeScript 5.7.3 / Node.js >= 20.0.0 (ESM `"type": "module"`)
- **CLI Framework**: Commander.js + Chalk
- **Validation**: Zod runtime schema validation
- **Git Execution**: `GitEngine` with in-memory `git merge-tree` and safe rebase/abort primitives
- **Metadata Persistence**: `.mannostree/fleet/conflict-matrix.json` and markdown `.task/conflict-matrix.md`

---

## Architecture & Module Design

```text
src/
├── core/
│   ├── fleet.ts              # FleetEngine (fleet sync & conflict matrix)
│   └── orchestrator.ts       # MannostreeOrchestrator integration (fleetSync, fleetConflictMatrix)
├── git/
│   └── engine.ts             # git merge-tree in-memory simulation helpers
├── metadata/
│   └── schema.ts             # FleetSync and ConflictMatrix Zod schemas
├── cli/
│   └── commands/
│       └── fleet.ts          # CLI command registration (mannostree fleet sync, conflict-matrix)
```

---

## Implementation Phases

### Phase 1: Core Types & Schemas
- Add `FleetSyncStatusType`, `WorktreeSyncStatus`, `FleetSyncReport`, `ConflictSeverity`, `ConflictMatrixCell`, `FleetConflictMatrixReport`, `FleetSyncOptions`, `FleetConflictMatrixOptions` to `src/types/index.ts`.
- Add Zod schemas in `src/metadata/schema.ts`.

### Phase 2: Git Engine Merge-Tree Primitives
- Add `simulateMergeTree(branchA: string, branchB: string)` and `getChangedFilesAgainstBase(worktreePath: string, baseBranch: string)` in `src/git/engine.ts`.

### Phase 3: Fleet Engine Implementation (`src/core/fleet.ts`)
- Implement `FleetEngine`:
  - `syncFleet(options: FleetSyncOptions): Promise<FleetSyncReport>`
  - `computeConflictMatrix(options: FleetConflictMatrixOptions): Promise<FleetConflictMatrixReport>`
  - `generateConflictMatrixMarkdown(report: FleetConflictMatrixReport): string`

### Phase 4: Orchestrator & CLI Integration
- Connect `FleetEngine` into `MannostreeOrchestrator` (`fleetSync`, `fleetConflictMatrix`).
- Create `src/cli/commands/fleet.ts` registering `fleet sync` and `fleet conflict-matrix`.
- Register `registerFleetCommand` in `src/cli/index.ts`.

### Phase 5: Verification & Testing
- Unit tests: `tests/unit/fleet-sync.test.ts`, `tests/unit/conflict-matrix.test.ts`.
- Integration tests: `tests/integration/fleet-cli.test.ts`.
- Documentation: Update `README.md`.
