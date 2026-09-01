# Technical Research: Automated Benchmark Harness & Comparative Matrix Evaluation

## Overview
This document consolidates architectural decisions, algorithms, and integration patterns for the **Automated Benchmark Harness & Comparative Matrix Evaluation Engine** (`003-benchmark-matrix-eval`).

---

## Key Technical Decisions

### Decision 1: Concurrency Control & Benchmark Isolation
- **Context**: Running heavy CPU/IO benchmark commands simultaneously across 3+ variant worktrees can skew latency and throughput measurements due to host core saturation.
- **Decision**: Provide adaptive execution modes:
  - **Default**: Concurrent execution for lightweight test and lint probes (`--concurrency 4`), but sequential execution (`--serial`) or dedicated isolation mode for compute/time-sensitive benchmark probes.
  - **CLI Control**: Provide explicit `--concurrency <N>` and `--serial` flags.
- **Rationale**: Balances execution speed during fast CI checks with benchmark precision when comparing algorithmic latency.
- **Alternatives Considered**:
  - *Always serial*: Safe but slow when checking 5+ variants with standard unit test suites.
  - *Always parallel*: Can cause up to 40% jitter in benchmark latency timings on constrained machines.

---

### Decision 2: Multi-Dimensional Metric Normalization & Scoring Algorithm
- **Context**: The evaluation matrix must compare diverse dimensions:
  - Correctness: Test pass percentage ($0–100\%$, higher is better).
  - Lint Quality: Error/warning count ($0–\infty$, lower is better).
  - Performance: Benchmark latency in milliseconds ($0–\infty$, lower is better) or throughput in ops/sec ($0–\infty$, higher is better).
  - Code Footprint / Churn: Total lines added/removed ($0–\infty$, lower/leaner is better).
  - Bundle Size: Output bytes ($0–\infty$, lower is better).
- **Decision**: Implement a **Normalized Weighted Sum Model (WSM)**:
  - Higher-is-better metrics: $N(x) = \frac{x - x_{min}}{x_{max} - x_{min}}$ (with $1.0$ if all values equal and non-zero).
  - Lower-is-better metrics: $N(x) = \frac{x_{max} - x}{x_{max} - x_{min}}$ (with $1.0$ if all values equal and non-zero).
  - Penalty Factor: Any failing test or compile error forces a $0.0$ multiplier on correctness and caps composite score.
  - Configurable Weights:
    - `correctness`: Default 0.40 (40%)
    - `performance`: Default 0.30 (30%)
    - `maintainability_churn`: Default 0.20 (20%)
    - `size`: Default 0.10 (10%)
- **Rationale**: Produces intuitive, deterministic 0–100 composite scores that clearly reflect engineering priorities while remaining customizable via `.mannostree.yml`.
- **Alternatives Considered**:
  - *Z-score standardization*: Less intuitive to interpret (negative numbers possible) and requires large sample sizes ($N \ge 10$) that typical 2-5 variant experiments don't have.
  - *Hard-coded ordinal ranks (1st, 2nd, 3rd)*: Loses magnitude context (e.g. 50% faster vs 0.1% faster).

---

### Decision 3: Non-Destructive Base Branch Baseline Sampling
- **Context**: To detect regressions, the harness needs reference benchmark measurements from the base branch (`main`) without polluting the developer's current worktree or main branch workspace.
- **Decision**: When `--baseline` is specified:
  - Sample baseline either from:
    1. An existing worktree currently tracking `main`, OR
    2. A temporary detached ephemeral worktree at `.worktrees/.tmp-baseline-<hash>` created and cleaned up automatically via git worktree lifecycle.
- **Rationale**: Guarantees zero uncommitted changes on the active branch or main workspace are overwritten or dirtied during baseline probe runs.
- **Alternatives Considered**:
  - *Running `git checkout` in main repo*: Violates safety principles and dirties developer root.
  - *Skipping baseline*: Makes it impossible to know if all variants are slower than the original trunk code.

---

### Decision 4: Deterministic Tie-Breaker Hierarchy
- **Context**: Multiple variants may achieve identical composite scores.
- **Decision**: Apply a deterministic cascading priority:
  1. Functional Correctness (100% test pass > 90%)
  2. Performance Benchmark Latency (faster wins)
  3. Minimal Code Churn (fewer lines changed wins)
  4. Variant Creation Order (earliest variant wins)
- **Rationale**: Produces strictly reproducible automated winner selection across different machines and environments.
