# Tasks: Automated Benchmark Harness & Comparative Matrix Evaluation

**Input**: Design documents from `specs/003-benchmark-matrix-eval/`  
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/cli-contract.md`, `quickstart.md`

## Format: `- [ ] [TaskID] [P?] [Story?] Description with file path`

- **[P]**: Parallelizable (independent file targets without uncommitted task dependencies)
- **[Story]**: User story identifier (`[US1]`, `[US2]`, `[US3]`, `[US4]`, `[US5]`)
- Explicit target file paths specified for all tasks

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Configuration schema extension for matrix evaluation probes and default scoring weights

- [X] T001 Extend `ParallelConfigSchema` in `src/config/schema.ts` to support `eval_matrix` probe defaults and scoring weights

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core type definitions, Zod validation schemas, and experiment metadata persistence required across all user stories

- [X] T002 [P] Define core types for `MatrixProbeSpec`, `VariantProbeResult`, `VariantEvaluationSummary`, `ExperimentMatrixReport`, `MatrixScoringWeights`, and `ParallelEvalOptions` in `src/types/index.ts`
- [X] T003 [P] Implement Zod validation schemas for matrix probes, variant summaries, scoring weights, and experiment matrix reports in `src/metadata/schema.ts`
- [X] T004 Extend `ExperimentRecord` and `MetadataStore` in `src/metadata/store.ts` to persist `eval_matrix` in `.mannostree/experiments/<feature>.json`

**Checkpoint**: Core types, schemas, and persistence models ready — user story implementation can proceed.

---

## Phase 3: User Story 1 - Multi-Variant Matrix Evaluation Dispatch (Priority: P1) 🎯 MVP

**Goal**: Concurrently or serially execute configured evaluation probe sequences across all variants of a parallel experiment.

**Independent Test**: Create a 2-variant experiment, run `mannostree parallel eval <feature>`, verify that probes execute across both variant sandboxes, and confirm that probe results are recorded in experiment metadata.

### Tests for User Story 1
- [X] T005 [P] [US1] Unit test for probe discovery, command interpolation, and sandbox execution in `tests/unit/matrix-eval.test.ts`
- [X] T006 [P] [US1] Integration test for single-command `mannostree parallel eval <feature>` CLI execution in `tests/integration/parallel-eval.test.ts`

### Implementation for User Story 1
- [X] T007 [US1] Implement `MatrixEvaluator` probe execution runner and concurrency queue in `src/core/matrix-eval.ts`
- [X] T008 [US1] Implement `parallelEval` method in `src/core/orchestrator.ts`
- [X] T009 [US1] Register `parallel eval <feature>` command in `src/cli/commands/parallel.ts`

**Checkpoint**: User Story 1 functional and independently testable.

---

## Phase 4: User Story 2 - Standardized Matrix Metric Collection & Custom Probes (Priority: P1)

**Goal**: Collect and normalize diverse metrics (test pass rate, lint errors, benchmark latency/throughput, bundle size, and git diff statistics).

**Independent Test**: Execute matrix evaluation with custom probe sequences (`--matrix "npm test, npm run bench"`), verify that numeric metrics and diff stats are accurately parsed, and confirm that probe failures in one variant do not crash remaining variants.

### Tests for User Story 2
- [X] T010 [P] [US2] Unit test for numeric metric extraction and probe failure containment in `tests/unit/matrix-eval.test.ts`
- [X] T011 [P] [US2] Integration test for custom probe sequences and failure isolation in `tests/integration/parallel-eval.test.ts`

### Implementation for User Story 2
- [X] T012 [US2] Implement metric extraction regex parsers and git diff metric aggregator in `src/core/matrix-eval.ts`
- [X] T013 [US2] Implement per-probe failure isolation, timeout watchdog, and diagnostic capture in `src/core/matrix-eval.ts`

**Checkpoint**: User Stories 1 and 2 functional with multi-dimensional metric collection.

---

## Phase 5: User Story 3 - Comparative Matrix Table & Automated Scoring (Priority: P2)

**Goal**: Compile side-by-side comparative matrix tables, compute 0–100 composite scores using Normalized Weighted Sum Model (WSM), and write `.task/matrix-report.md`.

**Independent Test**: Run evaluation across multiple variants, verify that `.task/matrix-report.md` contains side-by-side comparison tables with normalized composite scores, and confirm color-coded terminal table rendering.

### Tests for User Story 3
- [X] T014 [P] [US3] Unit test for WSM composite score normalization and ranking algorithm in `tests/unit/matrix-eval.test.ts`
- [X] T015 [P] [US3] Integration test for `.task/matrix-report.md` generation and experiment metadata persistence in `tests/integration/parallel-eval.test.ts`

### Implementation for User Story 3
- [X] T016 [US3] Implement WSM scoring calculator and deterministic tie-breaker resolver in `src/core/matrix-eval.ts`
- [X] T017 [US3] Implement markdown matrix report compiler (`.task/matrix-report.md`) in `src/core/matrix-eval.ts`
- [X] T018 [US3] Implement terminal comparative matrix table formatter in `src/cli/output.ts` and `src/cli/commands/parallel.ts`

**Checkpoint**: User Stories 1, 2, and 3 functional with comparative matrix reporting.

---

## Phase 6: User Story 4 - Automated Winner Recommendation & Justification Engine (Priority: P2)

**Goal**: Formulate evidence-backed winner justification and support immediate winner promotion via `--auto-pick`.

**Independent Test**: Evaluate an experiment where Variant 1 clearly outperforms Variant 2, verify that the generated report names Variant 1 as winner with concrete metric justification, and test automatic winner selection via `--auto-pick`.

### Tests for User Story 4
- [X] T019 [P] [US4] Unit test for winning justification synthesis in `tests/unit/matrix-eval.test.ts`
- [X] T020 [P] [US4] Integration test for `--auto-pick` winner selection and loser variant preservation in `tests/integration/parallel-eval.test.ts`

### Implementation for User Story 4
- [X] T021 [US4] Implement automated justification synthesis comparing winner metrics against competitors in `src/core/matrix-eval.ts`
- [X] T022 [US4] Implement `--auto-pick` integration connecting `MatrixEvaluator` to `ParallelEngine.pickWinner` in `src/core/orchestrator.ts` and `src/cli/commands/parallel.ts`

**Checkpoint**: User Stories 1, 2, 3, and 4 functional with automated decision support.

---

## Phase 7: User Story 5 - Baseline Comparison & Regression Guard (Priority: P3)

**Goal**: Run probes against base branch (`main`) reference to detect performance regressions with `--baseline`.

**Independent Test**: Run `mannostree parallel eval --baseline` on an experiment, verify that base branch metrics are sampled non-destructively, and confirm relative delta percentages appear in the matrix report.

### Tests for User Story 5
- [X] T023 [P] [US5] Unit test for base branch baseline sampling and delta percentage calculation in `tests/unit/matrix-eval.test.ts`
- [X] T024 [P] [US5] Integration test for `mannostree parallel eval --baseline` in `tests/integration/parallel-eval.test.ts`

### Implementation for User Story 5
- [X] T025 [US5] Implement non-destructive ephemeral base branch worktree sampler in `src/core/matrix-eval.ts`
- [X] T026 [US5] Implement regression delta reporting and score penalty calculator in `src/core/matrix-eval.ts`

**Checkpoint**: All user stories (1 through 5) functional and regression guarded.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Type safety, strict lint verification, full test suite coverage, and documentation alignment

- [X] T027 [P] Export all matrix evaluation types, runners, and schemas in `src/index.ts`
- [X] T028 Run TypeScript compilation and strict lint checks via `npm run lint`
- [X] T029 Run full test suite with coverage reporting via `npm run coverage`
- [X] T030 [P] Update CLI documentation and examples in `docs/` and `README.md`
- [X] T031 Validate operator workflows per `specs/003-benchmark-matrix-eval/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies
- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user story phases.
- **User Story 1 (Phase 3 - P1)**: Depends on Foundational — MVP baseline.
- **User Story 2 (Phase 4 - P1)**: Depends on Foundational + US1.
- **User Story 3 (Phase 5 - P2)**: Depends on Foundational + US2.
- **User Story 4 (Phase 6 - P2)**: Depends on Foundational + US3.
- **User Story 5 (Phase 7 - P3)**: Depends on Foundational + US3.
- **Polish (Phase 8)**: Depends on completion of target user stories.

### Parallel Opportunities
- Foundational types and schemas (`T002`, `T003`) can be implemented concurrently.
- Test tasks within each story phase (`T005`/`T006`, `T010`/`T011`, `T014`/`T015`, `T019`/`T020`, `T023`/`T024`) can be authored concurrently before implementation.
- User Story 4 (Winner Justification) and User Story 5 (Baseline Comparison) can proceed concurrently once US3 completes.

---

## Implementation Strategy

### MVP First (User Story 1 Baseline)
1. Complete **Phase 1: Setup** (`T001`).
2. Complete **Phase 2: Foundational** (`T002`-`T004`).
3. Complete **Phase 3: User Story 1** (`T005`-`T009`).
4. **VALIDATE**: Run `npm test` on `matrix-eval` test suites.

### Incremental Feature Expansion
1. Add **User Story 2 (Metric Collection & Probes)** (`T010`-`T013`).
2. Add **User Story 3 (Comparative Scoring & Matrix Report)** (`T014`-`T018`).
3. Add **User Story 4 (Winner Justification & Auto-Pick)** (`T019`-`T022`).
4. Add **User Story 5 (Baseline Sampling & Regression Guard)** (`T023`-`T026`).
5. Complete **Phase 8: Polish** (`T027`-`T031`).
