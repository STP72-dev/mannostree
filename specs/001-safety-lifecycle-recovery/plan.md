# Implementation Plan: Safety-First Lifecycle Recovery & Health Hardening

**Branch**: `001-safety-lifecycle-recovery` | **Date**: 2026-08-31 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/001-safety-lifecycle-recovery/spec.md`

## Summary

This feature hardens Mannostree's workspace and experiment lifecycle with a safety-first architecture:
1. **Partial-Failure Drop & Retry**: Tracks itemized variant drop results, preserves surviving dirty worktrees and parent experiment records, and supports safe retries without risking intact workspaces.
2. **Persistent Health Diagnostics & Broken States**: Proactively detects filesystem/git desynchronizations, explicitly marks affected entities as `broken`, and emits non-destructive recovery guidance.
3. **Transaction Journaling**: Employs write-ahead snapshot logging for multi-file metadata operations to guarantee atomic recovery and rollback across unexpected process crashes.
4. **Archive & Restore Lifecycle**: Provides disk-reclaiming worktree de-allocation while preserving Git branch references and experiment metadata for subsequent re-activation.
5. **Packaged Parallel Handoff**: Formulates a complete decision and scorecard bundle linking winning justifications with preserved non-winning variant registries.
6. **Strict Flag Separation**: Enforces `--discard-uncommitted --yes` for content-destructive actions while strictly confining `--force` to non-content operational bypasses.

---

## Technical Context

**Language/Version**: TypeScript 5.7.3 / Node.js >= 20.0.0 (ESM `package.json` `"type": "module"`)  
**Primary Dependencies**: `commander` (CLI parsing), `chalk` (colored output), `zod` (runtime schema validation), `yaml` (config parsing)  
**Storage**: File-based persistent JSON/JSONL records in `.mannostree/` and markdown artifacts in `.task/`  
**Testing**: `vitest` (unit + integration suites with v8 coverage)  
**Target Platform**: Cross-platform POSIX & Windows (Linux, macOS, Windows with Git CLI)  
**Project Type**: Developer CLI tool  
**Performance Goals**: < 100ms CLI latency for single operations; < 2.0s execution for batch/parallel diagnostics up to 10 variants  
**Constraints**: Zero external database dependencies; pure Git CLI + filesystem metadata; atomic file writes; strict data-loss prevention  
**Scale/Scope**: Manages repositories with 1-50 active worktrees and dozens of parallel experiment branches  

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / Rule | Compliance Status | Analysis & Justification |
|---|:---:|---|
| **Principle 1: Safety First & Data Loss Prevention** | **PASS** | Strict separation enforced: `--force` never deletes uncommitted changes; `--discard-uncommitted --yes` is mandatory for content destruction; losing variants are never auto-deleted. |
| **Principle 2: Explicit Lifecycle & State Integrity** | **PASS** | Every transition (`archived`, `broken`, `dropped`) is explicitly recorded; multi-file operations log atomic intents in `.mannostree/journal/transactions.jsonl`. |
| **Principle 3: Reproducibility & Observability** | **PASS** | All commands provide preview mode (`--dry-run`) and structured machine-readable outputs (`--json`). Non-destructive repair guidance emitted by default. |
| **Principle 4: Small Blast Radius & Backward Compatibility** | **PASS** | Extends existing schema interfaces non-destructively; retains existing CLI command options while adding safety layers. |

---

## Project Structure

### Documentation (this feature)

```text
specs/001-safety-lifecycle-recovery/
├── spec.md               # Feature specification
├── plan.md               # This implementation plan
├── research.md           # Technical decisions and trade-offs
├── data-model.md         # Schema definitions, state machines, and entities
├── quickstart.md         # User and operator workflows
├── contracts/            # Interface and CLI schemas
│   └── cli-contract.md
└── checklists/
    └── requirements.md   # Quality validation checklist
```

### Source Code (repository root)

```text
src/
├── types/
│   └── index.ts                 # Extended state types, health records, transaction models
├── metadata/
│   ├── schema.ts                # Zod schemas for journal, health, archive, and handoff
│   ├── store.ts                 # Atomic file operations with journal integration
│   └── journal.ts               # Transaction logger, intent recorder, and rollback engine
├── core/
│   ├── doctor.ts                # Multi-point health checks and anomaly detector
│   ├── parallel.ts              # Partial failure drop resilience, drop-status, and retry
│   ├── orchestrator.ts          # Archive and restore lifecycle handlers
│   ├── recover.ts               # Journal replay, rollback, and repair execution
│   └── handoff.ts               # Parallel handoff bundle generation
├── cli/
│   ├── commands/
│   │   ├── parallel.ts          # Added `drop-status` and retry/discard flags
│   │   ├── doctor.ts            # Health reporting and diagnostic flags
│   │   ├── recover.ts           # Interrupted transaction recovery and repair
│   │   ├── archive.ts           # Archive and restore commands
│   │   └── handoff.ts           # Parallel handoff CLI endpoint
│   └── output.ts                # Structured JSON envelopes and text formatters
tests/
├── unit/
│   ├── metadata-journal.test.ts # Atomic journal logging and rollback tests
│   ├── health-doctor.test.ts    # Broken state detection and diagnostic tests
│   ├── flag-safety.test.ts      # Strict flag separation (--force vs --discard-uncommitted)
│   └── archive-restore.test.ts  # Workspace unmounting and restoration tests
└── integration/
    ├── parallel-drop-safety.test.ts # Partial failure, dirty variant, and retry integration
    └── parallel-handoff.test.ts     # Package generation and loser preservation integration
```

**Structure Decision**: The modular CLI architecture adheres directly to the 8-layer design in `CLAUDE.md`, expanding `metadata/journal.ts`, `core/doctor.ts`, `core/parallel.ts`, and adding dedicated unit and integration suites in `tests/`.

---

## Complexity Tracking

*No constitution violations or unjustified architectural complexity detected.*
