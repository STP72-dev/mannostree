# Solution Evaluation & Scorecard: Phase 3 Project-Aware Setup & Profiles

## Hard Gates

| Gate | Requirement | Option 1 (Setup Engine) | Option 2 (External Scripts) | Option 3 (Monolithic) |
|------|-------------|-------------------------|-----------------------------|-----------------------|
| **1. Explicit Base Compatibility** | Preserves base branch safety | **PASS** | **PASS** | **PASS** |
| **2. Lifecycle Ownership** | Single lifecycle layer (ADR-001) | **PASS** | **FAIL** (ADR-001) | **PASS** |
| **3. Secret Safety** | Explicit opt-in for env files | **PASS** | **FAIL** | **PASS** |
| **4. Dry-Run Purity** | No mutations during dry-run | **PASS** | FAIL | **PASS** |
| **5. Exit Code Forwarding** | Exact code forwarding in exec | **PASS** | FAIL | **PASS** |
| **6. Failure Transition** | Safe transition to BROKEN | **PASS** | FAIL | **PASS** |
| **Result** | | **QUALIFIED** | **DISQUALIFIED** | **QUALIFIED** |

---

## Weighted Scoring (Qualified Options)

| Evaluation Dimension | Weight | Option 1 (Setup Engine) | Option 3 (Monolithic) |
|----------------------|--------|-------------------------|-----------------------|
| **Safety & Secret Preservation** | 30 | 30 | 25 |
| **Specification & Acceptance Fit** | 25 | 25 | 22 |
| **Diagnostics & Failure Handling** | 20 | 20 | 15 |
| **Compatibility & Maintainability** | 15 | 14 | 10 |
| **Implementation Scope & Reversibility** | 10 | 9 | 6 |
| **Total Score** | **100** | **98** | **78** |

---

## Decision Record
- **Selected Option**: **Option 1 (Integrated Setup Engine with Profile Schema & Direct Execution)**.
- **Rationale**: Option 1 achieves **98/100**, exceeding the qualification threshold and surpassing Option 3 by 20 points.
- **Parallel Permission**: `never`.
