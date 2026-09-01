# CLI Contract: Automated Benchmark Harness & Matrix Evaluation

## Command: `mannostree parallel eval <feature>`

Execute automated evaluation matrices (tests, lints, benchmarks, bundle size probes) across all variants of a parallel experiment and compute composite rankings.

---

### Command Syntax

```bash
mannostree parallel eval <feature> [options]
```

### Options

| Flag | Type | Default | Description |
|---|---|---|---|
| `<feature>` | `string` (positional) | *(required)* | Name of the parallel experiment group to evaluate |
| `--matrix <probes...>` | `string[]` | *from config* | Custom probe command sequence (e.g. `npm test`, `npm run bench`) |
| `--concurrency <N>` | `number` | `4` | Maximum number of concurrent variant/probe executions |
| `--serial` | `boolean` | `false` | Force sequential probe execution across variants to prevent CPU contention |
| `--auto-pick` | `boolean` | `false` | Automatically invoke winner selection (`parallel pick`) for the #1 ranked compliant variant |
| `--baseline` | `boolean` | `false` | Sample reference metrics against the base branch (`main`) |
| `--timeout <sec>` | `number` | `120` | Timeout per probe subprocess in seconds |
| `--json` | `boolean` | `false` | Output structured machine-readable JSON envelope |
| `--yaml` | `boolean` | `false` | Output structured machine-readable YAML envelope |
| `--plain` | `boolean` | `false` | Minimal plain text output without ANSI colors or formatting |
| `--dry-run` | `boolean` | `false` | Preview probe commands and target variants without executing subprocesses |

---

### JSON Output Envelope (`--json`)

```json
{
  "command": "parallel eval",
  "ok": true,
  "dry_run": false,
  "result": {
    "report": {
      "feature_name": "auth-spike",
      "evaluated_at": "2026-09-01T10:30:00.000Z",
      "recommended_winner_id": "auth-spike-v1",
      "winning_justification": "Variant 1 achieved 100% test pass rate with 35% lower latency (120ms vs 185ms) and 42 fewer lines changed.",
      "probes": [
        {
          "name": "test",
          "category": "test",
          "command": "npm test",
          "mandatory": true
        },
        {
          "name": "bench",
          "category": "benchmark",
          "command": "npm run bench",
          "mandatory": false
        }
      ],
      "variants": [
        {
          "worktree_id": "auth-spike-v1",
          "variant_name": "v1",
          "composite_score": 92.5,
          "rank": 1,
          "compliant": true,
          "tests_passed": 12,
          "tests_total": 12,
          "lint_clean": true,
          "benchmark_latency_ms": 120.5,
          "git_diff": {
            "files_changed": 3,
            "insertions": 115,
            "deletions": 20
          },
          "probe_results": [
            {
              "probe_name": "test",
              "category": "test",
              "passed": true,
              "exit_code": 0,
              "duration_ms": 1450
            }
          ]
        },
        {
          "worktree_id": "auth-spike-v2",
          "variant_name": "v2",
          "composite_score": 78.0,
          "rank": 2,
          "compliant": true,
          "tests_passed": 12,
          "tests_total": 12,
          "lint_clean": true,
          "benchmark_latency_ms": 185.2,
          "git_diff": {
            "files_changed": 4,
            "insertions": 157,
            "deletions": 35
          },
          "probe_results": [
            {
              "probe_name": "test",
              "category": "test",
              "passed": true,
              "exit_code": 0,
              "duration_ms": 2100
            }
          ]
        }
      ]
    },
    "matrix_report_path": ".worktrees/auth-spike-v1/.task/matrix-report.md",
    "picked_winner": null
  },
  "warnings": [],
  "errors": []
}
```

---

### Exit Codes

- `0`: All probes completed, matrix computed, and report generated.
- `1`: One or more non-fatal probe warnings (e.g. non-mandatory benchmark failure) or tie encountered.
- `2`: Usage error (e.g. unknown experiment feature name or zero variants available).
- `3`: Fatal execution error (e.g. worktree directory missing or corrupt registry).
