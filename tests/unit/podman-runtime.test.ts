import { describe, it, expect } from 'vitest';
import { PodmanRuntime } from '../../src/sandbox/podman.js';

describe('Movement 8: PodmanRuntime Driver', () => {
  const runtime = new PodmanRuntime();

  it('has type "podman"', () => {
    expect(runtime.type).toBe('podman');
  });

  it('builds podman execution arguments with rootless and SELinux volume mounting', () => {
    const { executable, args } = runtime.buildExecutionArgs('/tmp/podman-wt', {
      command: 'pytest',
      image: 'python:3.11-slim',
      limits: {
        cpus: 1.5,
        memory: '1GB',
      },
    });

    expect(executable).toBe('podman');
    expect(args).toContain('run');
    expect(args).toContain('--rm');
    expect(args).toContain('python:3.11-slim');
    expect(args).toContain('--cpus');
    expect(args).toContain('1.5');
    expect(args).toContain('-m');
    expect(args).toContain('1g');
    expect(args.some((a) => a.includes('/tmp/podman-wt:/workspace'))).toBe(true);
  });

  it('handles dry-run mode without spawning container', async () => {
    const res = await runtime.execute('/tmp/podman-wt', {
      command: 'go test ./...',
      image: 'golang:1.22',
      dryRun: true,
    });

    expect(res.exit_code).toBe(0);
    expect(res.runtime).toBe('podman');
    expect(res.stdout).toContain('DRY-RUN: podman run');
  });
});
