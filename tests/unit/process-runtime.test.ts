import { describe, it, expect } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { ProcessRuntime } from '../../src/sandbox/process.js';

describe('Movement 8: ProcessRuntime (Local Fallback Driver)', () => {
  const runtime = new ProcessRuntime();

  it('has type "process"', () => {
    expect(runtime.type).toBe('process');
  });

  it('executes a shell command directly in worktree directory', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mannostree-proc-test-'));
    try {
      const res = await runtime.execute(tmpDir, {
        command: 'echo "hello from process runtime"',
      });

      expect(res.exit_code).toBe(0);
      expect(res.stdout.trim()).toBe('hello from process runtime');
      expect(res.timed_out).toBe(false);
      expect(res.runtime).toBe('process');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('captures non-zero exit codes cleanly', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mannostree-proc-fail-'));
    try {
      const res = await runtime.execute(tmpDir, {
        command: 'exit 42',
      });

      expect(res.exit_code).toBe(42);
      expect(res.timed_out).toBe(false);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('respects dry-run mode and returns preview result without executing', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mannostree-proc-dry-'));
    try {
      const res = await runtime.execute(tmpDir, {
        command: 'rm -rf /something/dangerous',
        dryRun: true,
      });

      expect(res.exit_code).toBe(0);
      expect(res.stdout).toContain('DRY-RUN: process');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('reports healthy status during diagnostic check', async () => {
    const health = await runtime.checkHealth();
    expect(health.available).toBe(true);
    expect(health.runtime).toBe('process');
  });
});
