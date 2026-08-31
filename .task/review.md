# Independent Review: Non-Zero Process Exit Code on Failed Output Envelopes

## Verdict
**PASSED**

## Critical Findings
None.

## Major Findings
None.

## Minor Findings
None.

## Invariants & Safety Verification Evidence
- [x] **Truthful CLI Exit Codes**: When a command output envelope reports `ok: false` (e.g. `parallel drop` partial failure), `formatOutput` sets `process.exitCode = ExitCode.GENERIC_FAILURE` (1) so shell scripts and automation pipelines do not proceed on failure.
- [x] **Truthful Dry-Run Envelope**: `parallel drop` without `--yes` or with `--dry-run` returns `dry_run: true` and makes zero disk or metadata changes.
- [x] **No Experiment Record Deletion on Partial Failure**: When any variant fails to drop, `dropExperiment` retains the experiment metadata file `.mannostree/experiments/<feature>.json`, synchronizing `variants` with the surviving variant IDs.
- [x] **Winner Protection Policy**: When `config.cleanup.protect_winner !== false`, the winning variant is preserved during `parallel drop` unless explicitly overridden with `--force`.
- [x] **Automated Verification**: 62/62 tests passing across 21 test suites in 1.18s.
