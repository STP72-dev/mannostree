# Implementation Plan: Movement 4 — Fleet Tiering, Workspace Leases & Auto-Archive Policy

**Branch**: `005-fleet-tier-auto-archive` | **Date**: 2026-09-01 | **Spec**: [`spec.md`](spec.md)  
**Input**: Feature specification from `specs/005-fleet-tier-auto-archive/spec.md`

---

## Summary

Implement **Fleet Tiering, Workspace Leases & Auto-Archive Policy** in Mannostree. This movement introduces:
1. **Workspace Leases & Concurrency Protection**: Exclusive time-to-live (`ttl`) locks preventing concurrent agent collisions, accidental drops, or background archival.
2. **Lifecycle Tiering**: 4 discrete workspace tiers (`hot`, `warm`, `cold`, `pinned`) providing clear lifecycle management and minimal disk overhead.
3. **Auto-Archive Policy Engine**: Automated evaluation of retention quotas (`max_active_worktrees`, `idle_ttl`) to unmount eligible warm worktrees to cold archive tier with zero branch deletion.
4. **Fleet Quota Dashboard**: Centralized dashboard for mounted worktrees, active leases, disk footprint, and tier distribution.

---

## Technical Context

**Language/Version**: TypeScript 5.7.3 / Node.js >= 20.0.0 (ESM `package.json` `"type": "module"`)  
**Primary Dependencies**: `commander` (CLI), `chalk` (colored output), `zod` (runtime schema validation), `yaml` (config parsing)  
**Storage**: File-based persistent JSON records in `.mannostree/leases/`, `.mannostree/worktrees/`, `.mannostree/fleet/`, and markdown artifacts in `.task/`  
**Testing**: Vitest 3.2.7 (Unit, Integration, and CLI binary tests)  
**Target Platform**: Linux, macOS, POSIX-compliant environments  
**Project Type**: CLI developer tooling and orchestration engine  
**Performance Goals**: Fleet capacity evaluation < 100ms; auto-archive evaluation for 25 worktrees < 2s; zero file descriptor leakage  
**Constraints**: Non-destructive by default; zero branch deletion during archival; atomic metadata transactions  
**Scale/Scope**: 50+ concurrent worktrees, multi-agent fleet coordination  

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Principle 1: Safety First & Data Loss Prevention**: Auto-archive unmounts worktree directories to cold storage tier without deleting git branch refs or discarding uncommitted files. Actively leased and pinned worktrees are strictly protected.
- [x] **Principle 2: Explicit Lifecycle & State Integrity**: Lease records and tier transitions are durably recorded in `.mannostree/leases/` and `.mannostree/worktrees/` via transaction journaling.
- [x] **Principle 3: Reproducibility & Observability**: All lease and auto-archive commands support `--preview` / `--dry-run`, structured JSON/YAML output, and deterministic exit codes.
- [x] **Principle 4: Small Blast Radius & Backward Compatibility**: Builds cleanly upon existing `archive`/`restore` and `FleetEngine` primitives with backward-compatible schema extensions.

---

## Project Structure

### Documentation (this feature)

```text
specs/005-fleet-tier-auto-archive/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Technical decisions & architecture
├── data-model.md        # Domain schemas and state machine
├── quickstart.md        # Operator workflows & examples
├── contracts/           # CLI command contracts
│   └── cli-contract.md
└── tasks.md             # Implementation tasks (/speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── cli/
│   ├── commands/
│   │   ├── fleet.ts           # Extended with lease, tier, auto-archive, and status
│   │   └── ...
│   └── index.ts
├── config/
│   └── schema.ts              # FleetPolicyConfig schema
├── core/
│   ├── fleet.ts               # Extended with LeaseEngine & AutoArchiveEngine
│   ├── orchestrator.ts        # Fleet lease, tier, and auto-archive delegations
│   └── ...
├── metadata/
│   ├── schema.ts              # WorkspaceLeaseSchema, FleetCapacityReportSchema
│   └── store.ts               # Lease persistence & atomic operations
├── types/
│   └── index.ts               # Lease, Tier, Policy, and Report interfaces
tests/
├── unit/
│   ├── fleet-lease.test.ts    # Lease acquisition, TTL expiry, renewal, and guard tests
│   ├── fleet-tier.test.ts     # Tier transitions and pinning tests
│   └── auto-archive.test.ts   # Policy evaluation and safe archival tests
└── integration/
    └── fleet-tier-cli.test.ts # End-to-end CLI lease, auto-archive, and status flows
```

---

## Complexity Tracking

| Invariant / Feature | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Lazy TTL Expiration | Eliminates need for persistent background daemons | Background daemons introduce process management complexity and zombie worker risk |
| Separate `leases/` metadata dir | Prevents lock contention and simplifies atomic file operations | Embedding leases directly inside worktree records risks race conditions during concurrent updates |
