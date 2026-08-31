# Solution Evaluation & Scorecard: Phase 2 Operational Safety & Diagnostics

## Hard Gates

| Gate | Requirement | Option 1 (Integrated Extensions) | Option 2 (Sub-Engines) | Option 3 (Shell Scripts) |
|------|-------------|----------------------------------|------------------------|--------------------------|
| **1. Explicit Base Selection** | Enforces deterministic base branch | **PASS** | **PASS** | FAIL |
| **2. No Raw-Worker Lifecycle** | Mannostree strictly owns lifecycle | **PASS** | **PASS** | **FAIL** (ADR-001) |
| **3. Read-Only Diagnostics** | `status` and `doctor` are read-only by default | **PASS** | **PASS** | FAIL |
| **4. Preview & Confirmation** | `clean` and `recover` require preview/`--yes` | **PASS** | **PASS** | FAIL |
| **5. No Fallback File Deletion** | Safe git removal without ad-hoc rm | **PASS** | **PASS** | FAIL |
| **6. No Untracked Mutation** | Untracked worktrees are never touched | **PASS** | **PASS** | FAIL |
| **7. No Auto-Merge / Cleanup** | Explicit user action required | **PASS** | **PASS** | **PASS** |
| **8. Documented Schema Integrity** | Full schema versioning and consistency | **PASS** | **PASS** | FAIL |
| **Result** | | **QUALIFIED** | **QUALIFIED** | **DISQUALIFIED** |

---

## Weighted Scoring (Qualified Options)

| Evaluation Dimension | Weight | Option 1 (Integrated Extensions) | Option 2 (Sub-Engines) |
|----------------------|--------|----------------------------------|------------------------|
| **Safety & Data Preservation** | 30 | 30 | 24 |
| **Specification & Acceptance Fit** | 25 | 25 | 21 |
| **Diagnostics & Recoverability** | 20 | 20 | 16 |
| **Compatibility & Maintainability** | 15 | 14 | 10 |
| **Implementation Scope & Reversibility** | 10 | 9 | 6 |
| **Total Score** | **100** | **98** | **77** |

---

## Decision Record
- **Selected Option**: **Option 1 (Integrated Orchestrator with Dedicated Engine Extensions)**.
- **Rationale**: Option 1 scores **98/100**, exceeding the 80-point qualification threshold and leading Option 2 by 21 points. It preserves Phase 1 contracts while cleanly adding `status`, `sync`, `doctor`, `clean`, and `recover`.
- **Parallel Variants**: Forbidden (`never`).
