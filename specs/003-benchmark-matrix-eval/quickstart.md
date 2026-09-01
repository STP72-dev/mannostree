# Quickstart: Automated Benchmark Harness & Matrix Evaluation

This quickstart guides you through evaluating competing parallel experiment variants, reviewing side-by-side performance matrices, and automatically selecting a winner.

---

## 1. Create a Multi-Variant Experiment

Spawn 3 competing technical implementations for an authentication cache:

```bash
# Spawn 3 variants on feature 'cache-spike'
mannostree parallel spawn cache-spike --variants 3 --base-branch main
```

---

## 2. Execute Tasks Across Variants

Implement or dispatch worker agents to each variant:

```bash
# Dispatch parallel agents to implement competing cache algorithms
mannostree agent dispatch cache-spike --parallel \
  --title "Implement Cache Spike" \
  --criteria "Support LRU eviction" "Pass benchmark with <100ms latency"
```

---

## 3. Run Automated Matrix Evaluation

Evaluate all 3 variants under identical test and benchmark conditions:

```bash
# Run tests, lints, and benchmark probes across all variants
mannostree parallel eval cache-spike --matrix "npm test, npm run bench"
```

### Example Terminal Output:

```text
Evaluating Matrix for Experiment 'cache-spike' (3 variants)...

✓ [cache-spike-v1] npm test (1.2s) | npm run bench (0.8s) | Score: 94.2 [RANK #1]
✓ [cache-spike-v2] npm test (1.4s) | npm run bench (1.5s) | Score: 81.0 [RANK #2]
✖ [cache-spike-v3] npm test (FAIL) | npm run bench (0.9s) | Score: 45.0 [RANK #3]

================================================================================
Feature: cache-spike | Recommended Winner: cache-spike-v1 (Score: 94.2)
================================================================================
Rank | Variant         | Tests Passed | Benchmark Latency | Diff (+/-) | Score
#1   | cache-spike-v1  | 10/10 (100%) | 42.1 ms (BEST)    | +85 / -12  | 94.2 ★
#2   | cache-spike-v2  | 10/10 (100%) | 78.5 ms           | +120 / -30 | 81.0
#3   | cache-spike-v3  |  8/10 ( 80%) | 49.0 ms           | +95 / -18  | 45.0
================================================================================

Winning Justification:
Variant 1 achieved 100% test pass rate with 46% lower latency (42.1ms vs 78.5ms) and the cleanest code diff (+85/-12 lines).

Durable matrix report saved to: .worktrees/cache-spike-v1/.task/matrix-report.md
```

---

## 4. Automatic Winner Promotion (`--auto-pick`)

To automatically select and promote the #1 ranked compliant variant in a single command:

```bash
mannostree parallel eval cache-spike --auto-pick
```

This immediately designates `cache-spike-v1` as the chosen winner in `.mannostree/experiments/cache-spike.json` while safely preserving `cache-spike-v2` and `cache-spike-v3` for future reference or explicit cleanup.
