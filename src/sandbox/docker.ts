import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { SandboxRuntime } from './base.js';
import {
  SandboxExecutionOptions,
  SandboxExecutionResult,
  SandboxHealthStatus,
  SandboxRuntimeType,
} from '../types/index.js';

const execFileAsync = promisify(execFile);

export function normalizeMemory(mem: string): string {
  const trimmed = mem.trim().toLowerCase();
  if (trimmed.endsWith('gb') || trimmed.endsWith('g')) {
    const num = parseInt(trimmed, 10);
    return `${num}g`;
  }
  if (trimmed.endsWith('mb') || trimmed.endsWith('m')) {
    const num = parseInt(trimmed, 10);
    return `${num}m`;
  }
  return trimmed;
}

export class DockerRuntime implements SandboxRuntime {
  public readonly type: SandboxRuntimeType = 'docker';

  constructor(
    private customExecutor?: (args: string[]) => Promise<{ stdout: string; stderr: string }>
  ) {}

  public buildExecutionArgs(
    worktreePath: string,
    options: SandboxExecutionOptions
  ): { executable: string; args: string[] } {
    const args: string[] = ['run', '--rm'];

    // Workspace volume mount and working directory
    args.push('-v', `${worktreePath}:/workspace`);
    args.push('-w', '/workspace');

    // Host user mapping on POSIX platforms to avoid root-owned generated files
    if (typeof process.getuid === 'function' && typeof process.getgid === 'function') {
      const uid = process.getuid();
      const gid = process.getgid();
      if (uid !== 0) {
        args.push('--user', `${uid}:${gid}`);
      }
    }

    // Network policy
    if (options.network) {
      args.push('--network', options.network);
    }

    // Resource limits
    if (options.limits?.cpus) {
      args.push('--cpus', String(options.limits.cpus));
    }

    if (options.limits?.memory) {
      const normalizedMem = normalizeMemory(options.limits.memory);
      args.push('-m', normalizedMem);
    }

    // Environment variables
    if (options.env) {
      for (const [key, val] of Object.entries(options.env)) {
        args.push('-e', `${key}=${val}`);
      }
    }

    // Image
    const image = options.image || 'node:20-alpine';
    args.push(image);

    // Command
    args.push('/bin/sh', '-c', options.command);

    return {
      executable: 'docker',
      args,
    };
  }

  public async execute(
    worktreePath: string,
    options: SandboxExecutionOptions
  ): Promise<SandboxExecutionResult> {
    const startTime = Date.now();
    const { executable, args } = this.buildExecutionArgs(worktreePath, options);

    if (options.dryRun) {
      return {
        runtime: 'docker',
        image: options.image || 'node:20-alpine',
        command: options.command,
        exit_code: 0,
        duration_ms: 0,
        stdout: `[DRY-RUN: ${executable} ${args.join(' ')}]`,
        stderr: '',
        timed_out: false,
      };
    }

    return new Promise((resolve) => {
      let stdoutData = '';
      let stderrData = '';
      let timedOut = false;
      let timer: NodeJS.Timeout | undefined;

      const proc = spawn(executable, args);

      if (options.limits?.timeout_seconds) {
        timer = setTimeout(() => {
          timedOut = true;
          proc.kill('SIGTERM');
        }, options.limits.timeout_seconds * 1000);
      }

      proc.stdout?.on('data', (chunk) => {
        stdoutData += chunk.toString();
      });

      proc.stderr?.on('data', (chunk) => {
        stderrData += chunk.toString();
      });

      proc.on('close', (code) => {
        if (timer) {
          clearTimeout(timer);
        }
        const duration = Date.now() - startTime;
        const exitCode = code ?? (timedOut ? 124 : 1);
        const oomKilled = exitCode === 137 && stderrData.toLowerCase().includes('oom');

        resolve({
          runtime: 'docker',
          image: options.image || 'node:20-alpine',
          command: options.command,
          exit_code: exitCode,
          duration_ms: duration,
          stdout: stdoutData.trim(),
          stderr: stderrData.trim(),
          timed_out: timedOut,
          oom_killed: oomKilled,
        });
      });

      proc.on('error', (err) => {
        if (timer) {
          clearTimeout(timer);
        }
        const duration = Date.now() - startTime;
        resolve({
          runtime: 'docker',
          image: options.image || 'node:20-alpine',
          command: options.command,
          exit_code: 1,
          duration_ms: duration,
          stdout: stdoutData.trim(),
          stderr: (stderrData + `\n${err.message}`).trim(),
          timed_out: timedOut,
        });
      });
    });
  }

  public async checkHealth(): Promise<SandboxHealthStatus> {
    try {
      const execFn = this.customExecutor || (async (args: string[]) => {
        const res = await execFileAsync('docker', args);
        return { stdout: res.stdout.trim(), stderr: res.stderr.trim() };
      });

      const verRes = await execFn(['--version']);
      const verMatch = verRes.stdout.match(/version\s+([0-9.]+)/i);
      const version = verMatch ? verMatch[1] : verRes.stdout;

      let daemonRunning = false;
      let cgroupsVer: string | undefined;

      try {
        const infoRes = await execFn(['info']);
        daemonRunning = true;
        if (infoRes.stdout.includes('Cgroup Version: 2')) {
          cgroupsVer = 'v2';
        } else if (infoRes.stdout.includes('Cgroup Version: 1')) {
          cgroupsVer = 'v1';
        }
      } catch {
        daemonRunning = false;
      }

      return {
        runtime: 'docker',
        available: true,
        version,
        daemon_running: daemonRunning,
        cgroups_version: cgroupsVer,
        details: daemonRunning
          ? `Docker ${version} active (cgroups ${cgroupsVer || 'detected'})`
          : `Docker ${version} installed, but daemon is not responding`,
      };
    } catch (err: any) {
      return {
        runtime: 'docker',
        available: false,
        error: err.message,
        details: 'Docker CLI binary not found on PATH',
      };
    }
  }
}
