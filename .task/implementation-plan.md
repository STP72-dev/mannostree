# Implementation Plan: Parallel Experiment Lifecycle Commands (`parallel list`, `parallel drop`)

## Overview
Implement `listExperiments` and `dropExperiment` in `src/core/parallel.ts`, wire them into `MannostreeOrchestrator`, add CLI commands `parallel list` and `parallel drop`, and verify with unit/integration tests.

## Changes

### 1. `src/core/parallel.ts`
- Add `listExperiments(status?: string): Promise<ExperimentRecord[]>`.
- Add `dropExperiment(options: ParallelDropOptions): Promise<ParallelDropResult>`.

### 2. `src/core/orchestrator.ts`
- Add `parallelList` and `parallelDrop`.

### 3. `src/cli/output.ts`
- Add `formatParallelListResult` and `formatParallelDropResult`.

### 4. `src/cli/commands/parallel.ts`
- Register `parallel list` and `parallel drop` subcommands.

### 5. Automated Tests
- Unit tests in `tests/unit/parallel.test.ts`.
- Integration tests in `tests/integration/phase4.test.ts`.
