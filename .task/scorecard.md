# Solution Evaluation & Scorecard

## Hard Gates

| Gate | Requirement | Option 1 (Layered Modular) | Option 2 (Monolithic) | Option 3 (Shell Wrapper) |
|------|-------------|----------------------------|-----------------------|--------------------------|
| **1. Explicit Base Compatibility** | Strictly requires explicit base resolution | **PASS** | **PASS** | FAIL (Shell defaults risk) |
| **2. No Hidden Lifecycle Action** | Mannostree strictly owns worktree creation/removal | **PASS** | **PASS** | **FAIL** (Violates ADR-001) |
| **3. No Auto-Merge / Implicit Cleanup** | Winner pick and drop are explicit | **PASS** | **PASS** | **PASS** |
| **4. Secret Safety** | No copying of secrets without explicit policy | **PASS** | **PASS** | **PASS** |
| **5. Metadata / Recovery Correctness** | Atomic writes and versioned schema | **PASS** | **PASS** | FAIL (Partial write risk) |
| **6. Testability** | Direct unit and integration verification | **PASS** | **PASS** | FAIL (Brittle shell mocks) |
| **Result** | | **QUALIFIED** | **QUALIFIED** | **DISQUALIFIED** |

---

## Weighted Scoring (Qualified Options)

| Evaluation Dimension | Weight | Option 1 (Layered Modular) | Option 2 (Monolithic) |
|----------------------|--------|----------------------------|-----------------------|
| **Product & Acceptance Fit** | 25 | 25 | 18 |
| **Safety & Lifecycle Alignment** | 25 | 25 | 19 |
| **Verification & Recoverability** | 20 | 19 | 14 |
| **Maintainability & Scope Discipline** | 15 | 14 | 10 |
| **Delivery & Reversibility** | 15 | 14 | 11 |
| **Total Score** | **100** | **97** | **72** |

---

## Decision Record
- **Selected Option**: **Option 1 (Layered Modular Architecture)**.
- **Rationale**: Option 1 achieves a score of **97/100** (exceeding the threshold of 80 and surpassing Option 2 by 25 points). It implements the exact layered architecture, ADRs, and schema invariants defined in the repository design documents.
- **Parallel Variant Decision**: Single-path execution (Parallel-variant permission set to `never`).
