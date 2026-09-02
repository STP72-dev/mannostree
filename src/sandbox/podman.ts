import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { SandboxRuntime } from './base.js';
import { normalizeMemory } from './docker.js';
import {
  SandboxExecutionOptions,
  SandboxExecutionResult,
  SandboxHealthStatus,
  SandboxRuntimeType,
} from '../types/index.js';

const execFileAsync = promisify(execFile);

export class PodmanRuntime implements SandboxRuntime {
  public readonly type: SandboxRuntimeType = 'podman';

  constructor(
    private customExecutor?: (args: string[]) => Promise<{ stdout: string; stderr: string }>
  ) {}

  public buildExecutionArgs(
    worktreePath: string,
    options: SandboxExecutionOptions
  ): { executable: string; args: string[] } {
    const args: string[] = ['run', '--rm'];

    // Volume mount with SELinux :Z flag for rootless Podman
    args.push('-v', `${worktreePath}:/workspace:Z`);
    args.push('-w', '/workspace');

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
      executable: 'podman',
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
        runtime: 'podman',
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

        resolve({
          runtime: 'podman',
          image: options.image || 'node:20-alpine',
          command: options.command,
          exit_code: exitCode,
          duration_ms: duration,
          stdout: stdoutData.trim(),
          stderr: stderrData.trim(),
          timed_out: timedOut,
        });
      });

      proc.on('error', (err) => {
        if (timer) {
          clearTimeout(timer);
        }
        const duration = Date.now() - startTime;
        resolve({
          runtime: 'podman',
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
        const res = await execFileAsync('podman', args);
        return { stdout: res.stdout.trim(), stderr: res.stderr.trim() };
      });

      const verRes = await execFn(['--version']);
      const verMatch = verRes.stdout.match(/version\s+([0-9.]+)/i);
      const version = verMatch ? verMatch[1] : verRes.stdout;

      let rootless = true;
      try {
        const infoRes = await execFn(['info']);
        if (infoRes.stdout.includes('rootless: false')) {
          rootless = false;
        }
      } catch {
        // ignore
      }

      return {
        runtime: 'podman',
        available: true,
        version,
        daemon_running: true,
        rootless,
        details: `Podman ${version} active (${rootless ? 'rootless mode' : 'rootful mode'})`,
      };
    } catch (err: any) {
      return {
        runtime: 'podman',
        available: false,
        error: err.message,
        details: 'Podman CLI binary not found on PATH',
      };
    }
  }
}
