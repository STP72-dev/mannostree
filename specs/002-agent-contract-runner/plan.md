# Implementation Plan: Autonomous Agent Contract Runner & Task Dispatch

**Branch**: `002-agent-contract-runner` | **Date**: 2026-09-01 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/002-agent-contract-runner/spec.md`

## Summary

This feature implements the **Autonomous Agent Contract Runner and Task Dispatch Engine** (Movement 1):
1. **Task Contract Scaffolding & Injection**: Generates structured `.task/task-contract.md` files defining problem scope, acceptance criteria checklists (`- [ ]`), and quality gate rules.
2. **Pluggable Agent Dispatch & Sandbox Containment**: Launches agent processes into isolated worktree directories using configurable command templates in `.mannostree.yml` (e.g. `gemini --task {contract_path}`), preventing out-of-bounds filesystem mutations.
3. **Multi-Role Lifecycle State Machine**: Tracks granular agent states (`dispatched`, `planning`, `working`, `verifying`, `fulfilled`, `execution_failed`, `fulfillment_rejected`).
4. **Objective Contract Fulfillment Gatekeeper**: Independently verifies that 100% of acceptance criteria checkboxes are marked complete and all configured quality gates (`.task/quality-gates.md`) pass before certifying completion.
5. **Execution Scorecard Aggregation**: Compiles quantitative performance, test, and diff metrics into `.task/scorecard.md` and metadata records.
6. **Concurrent Fleet Dispatch**: Supports simultaneous dispatch and monitoring across all variants of a parallel experiment group.

---

## Technical Context

**Language/Version**: TypeScript 5.7.3 / Node.js >= 20.0.0 (ESM `package.json` `"type": "module"`)  
**Primary Dependencies**: `commander` (CLI parsing), `chalk` (colored output), `zod` (runtime schema validation), `yaml` (config parsing)  
**Storage**: File-based persistent JSON records in `.mannostree/sessions/` and markdown artifacts in `.task/`  
**Testing**: `vitest` (unit + integration suites with v8 coverage)  
**Target Platform**: Cross-platform POSIX & Windows (Linux, macOS, Windows with Git CLI)  
**Project Type**: Developer CLI tool  
**Performance Goals**: < 1.5s CLI execution for dispatch, status, and verification (excluding agent execution duration); zero race conditions during parallel multi-variant dispatch  
**Constraints**: Tool-agnostic runner interface; child process confinement to worktree `cwd`; non-destructive abort on failure  
**Scale/Scope**: Manages repositories with 1-50 active worktrees and multi-agent dispatch across up to 10 concurrent variants  

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / Rule | Compliance Status | Analysis & Justification |
|---|:---:|---|
| **Principle 1: Safety First & Data Loss Prevention** | **PASS** | Aborted or failed agent sessions preserve all uncommitted code without silent deletion; sandbox containment prevents mutation outside the worktree. |
| **Principle 2: Explicit Lifecycle & State Integrity** | **PASS** | Every agent stage (`dispatched`, `planning`, `working`, `verifying`, `fulfilled`) is recorded in session metadata and worktree records. |
| **Principle 3: Reproducibility & Observability** | **PASS** | Automated fulfillment verification provides objective gatekeeping; execution scorecards record exact test counts, duration, and diff metrics. |
| **Principle 4: Small Blast Radius & Backward Compatibility** | **PASS** | Non-destructively extends `src/core/` and CLI commands with the `agent` command suite, preserving all existing worktree and parallel operations. |

---

## Project Structure

### Documentation (this feature)

```text
specs/002-agent-contract-runner/
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
│   └── index.ts                 # Extended agent session, quality gate, and scorecard types
├── metadata/
│   └── schema.ts                # Zod schemas for agent sessions and fulfillment reports
├── core/
│   ├── agent-runner.ts          # Process spawning, command template interpolation, and session tracking
│   ├── contract.ts              # Task contract parser, checkbox validator, and scorecard builder
│   ├── quality-gates.ts         # Automated gate runner (lint, test, build execution)
│   └── orchestrator.ts          # Orchestration hooks for agent dispatch and verification
├── cli/
│   ├── commands/
│   │   └── agent.ts             # `agent dispatch`, `agent status`, `agent verify`, `agent cancel`
│   └── output.ts                # Structured JSON envelopes and text formatters for agent sessions
tests/
├── unit/
│   ├── contract-parser.test.ts  # Task contract parsing and acceptance checklist verification tests
│   ├── quality-gates.test.ts    # Automated quality gate execution and failure reporting tests
│   └── agent-runner.test.ts     # Command template interpolation, process containment, and timeout tests
└── integration/
    ├── agent-dispatch.test.ts   # End-to-end single and parallel agent dispatch CLI flow
    └── agent-fulfillment.test.ts # End-to-end contract verification and scorecard compilation
```

**Structure Decision**: The modular CLI architecture introduces `src/core/agent-runner.ts`, `src/core/contract.ts`, and `src/core/quality-gates.ts`, managed through the unified `mannostree agent` command suite in `src/cli/commands/agent.ts`.

---

## Complexity Tracking

*No constitution violations or unjustified architectural complexity detected.*
