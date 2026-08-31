# Solution Evaluation & Scorecard: Parallel Lifecycle Safety

## Hard Gates

| Gate | Requirement | Option 1 (Reconciliation) | Option 2 (Preflight Abort) | Option 3 (Suppression) |
|------|-------------|----------------------------|----------------------------|------------------------|
| **1. Data Preservation** | No abandoned unindexed worktrees | **PASS** | **PASS** | FAIL |
| **2. Envelope Purity** | `dry_run: true` on preview | **PASS** | **PASS** | FAIL |
| **3. Winner Protection** | Protects winner by default | **PASS** | **PASS** | FAIL |
| **4. Recoverability** | Surviving state stays in metadata | **PASS** | **PASS** | FAIL |
| **Result** | | **QUALIFIED** | **QUALIFIED** | **DISQUALIFIED** |

---

## Weighted Scoring

| Evaluation Dimension | Weight | Option 1 (Reconciliation) | Option 2 (Preflight Abort) |
|----------------------|--------|----------------------------|----------------------------|
| **Safety & Data Preservation** | 30 | 30 | 28 |
| **Specification & Acceptance Fit** | 25 | 25 | 22 |
| **Recoverability & Observability** | 20 | 20 | 16 |
| **Compatibility & Maintainability** | 15 | 15 | 11 |
| **Scope & Reversibility** | 10 | 9 | 7 |
| **Total Score** | **100** | **99** | **84** |

---

## Decision Record
- **Selected Option**: **Option 1 (Partial-State Reconciliation with Surviving Variant Synchronization)**.
- **Score**: **99/100** (leads next viable option by 15 points).
