import { describe, it, expect } from 'vitest';
import { DockerRuntime } from '../../src/sandbox/docker.js';

describe('Movement 8: DockerRuntime Driver', () => {
  const runtime = new DockerRuntime();

  it('has type "docker"', () => {
    expect(runtime.type).toBe('docker');
  });

  it('builds standard docker run arguments with UID mapping, volume mounts, and resource caps', () => {
    const { executable, args } = runtime.buildExecutionArgs('/tmp/my-worktree', {
      command: 'npm test',
      image: 'node:20-alpine',
      network: 'none',
      limits: {
        cpus: 2,
        memory: '2GB',
      },
    });

    expect(executable).toBe('docker');
    expect(args).toContain('run');
    expect(args).toContain('--rm');
    expect(args).toContain('-w');
    expect(args).toContain('/workspace');
    expect(args).toContain('/tmp/my-worktree:/workspace');
    expect(args).toContain('node:20-alpine');
    expect(args).toContain('--network');
    expect(args).toContain('none');
    expect(args).toContain('--cpus');
    expect(args).toContain('2');
    expect(args).toContain('-m');
    expect(args).toContain('2g');

    // POSIX UID injection check
    if (process.getuid) {
      expect(args.some((a) => a.includes('--user'))).toBe(true);
    }
  });

  it('handles dry-run mode without spawning container', async () => {
    const res = await runtime.execute('/tmp/my-worktree', {
      command: 'cargo test',
      image: 'rust:latest',
      dryRun: true,
    });

    expect(res.exit_code).toBe(0);
    expect(res.runtime).toBe('docker');
    expect(res.stdout).toContain('DRY-RUN: docker run');
    expect(res.stdout).toContain('rust:latest');
  });

  it('checks health by inspecting docker version and daemon accessibility', async () => {
    // Custom mock executor to test health checks deterministically
    const mockRuntime = new DockerRuntime(async (args) => {
      if (args[0] === '--version') {
        return { stdout: 'Docker version 27.1.1, build 6312585', stderr: '' };
      }
      if (args[0] === 'info') {
        return { stdout: 'Server Version: 27.1.1\nCgroup Version: 2', stderr: '' };
      }
      return { stdout: '', stderr: '' };
    });

    const health = await mockRuntime.checkHealth();
    expect(health.available).toBe(true);
    expect(health.version).toContain('27.1.1');
    expect(health.daemon_running).toBe(true);
  });
});
