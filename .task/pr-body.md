# Parallel Lifecycle Safety: Truthful Previews, Partial Failure Resilience, Winner Protection, & Non-Zero Exit Codes

## Summary
Hardens the `parallel drop` lifecycle command and CLI error signaling:
1. **Non-Zero Exit Code on Failed Output**: When an envelope reports `ok: false` (such as `parallel drop` partial failure), `formatOutput` sets `process.exitCode = ExitCode.GENERIC_FAILURE` (1) ensuring automation and CI scripts catch errors.
2. **Truthful Preview Envelope**: `parallel drop` without `--yes` explicitly emits `dry_run: true` in the output envelope.
3. **Partial-Failure Resilience**: If any variant drop fails (such as dirty uncommitted changes without `--force`), the experiment record is **NOT deleted**. Instead, `experiment.variants` is synchronized to retain only the surviving variant IDs, leaving a valid audit trail for `doctor` and `recover`.
4. **Winner Protection Policy**: Adheres to `config.cleanup.protect_winner` by preserving winning variants from mass deletion during `parallel drop` unless `--force` is supplied.
5. **Enhanced CLI Output**: Reports dropped variants, surviving variants, protected winners, and failure errors with clear terminal indicators.

## Quality & Validation Totals
- `npm run lint`: **PASSED** (0 errors)
- `npm run build`: **PASSED** (clean compilation)
- `npm run coverage`: **PASSED** (62/62 tests passing across 21 test suites in 1.18s)
- **Whole-Project Coverage Totals**:
  - Statements: **56.51%** (1483 / 2624 lines)
  - Branches: **65.37%** (268 / 410 branches)
  - Functions: **89.71%** (61 / 68 functions)
  - Lines: **56.51%** (1483 / 2624 lines)
- **Review Verdict**: **PASSED**
