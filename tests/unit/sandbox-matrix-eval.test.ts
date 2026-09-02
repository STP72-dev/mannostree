import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { MatrixEvaluator } from '../../src/core/matrix-eval.js';
import { GitEngine } from '../../src/git/engine.js';
import { MetadataStore } from '../../src/metadata/store.js';
import { loadConfig } from '../../src/config/loader.js';

describe('Movement 8: Clean-Room Parallel Benchmark Evaluation', () => {
  let tmpDir: string;
  let evaluator: MatrixEvaluator;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mannostree-sandbox-eval-'));
    const config = loadConfig(undefined, tmpDir);
    const git = new GitEngine(tmpDir);
    const store = new MetadataStore(tmpDir, config);

    evaluator = new MatrixEvaluator(tmpDir, git, store, config);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('executes a probe with local process sandbox driver and measures metrics', async () => {
    const probe = {
      name: 'echo_latency',
      command: 'echo "LATENCY: 12.5ms"',
      category: 'benchmark' as const,
      metric_regex: 'LATENCY:\\s*([0-9.]+)',
      metric_unit: 'ms',
    };

    const res = await evaluator.executeProbe(
      tmpDir,
      probe,
      {},
      { sandbox: 'process' }
    );

    expect(res.passed).toBe(true);
    expect(res.numeric_value).toBe(12.5);
    expect(res.metric_unit).toBe('ms');
  });

  it('routes clean-room probe execution through dry-run docker sandbox without error', async () => {
    const probe = {
      name: 'clean_bench',
      command: 'echo "LATENCY: 5ms"',
      category: 'benchmark' as const,
      metric_regex: 'LATENCY:\\s*([0-9.]+)',
      metric_unit: 'ms',
    };

    const res = await evaluator.executeProbe(
      tmpDir,
      probe,
      {},
      {
        sandbox: 'process',
        image: 'rust:latest',
        cpus: 4,
        memory: '4GB',
      }
    );

    expect(res.passed).toBe(true);
    expect(res.numeric_value).toBe(5);
  });
});
