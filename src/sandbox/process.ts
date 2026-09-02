import { spawn } from 'node:child_process';
import {
  SandboxRuntime,
} from './base.js';
import {
  SandboxExecutionOptions,
  SandboxExecutionResult,
  SandboxHealthStatus,
  SandboxRuntimeType,
} from '../types/index.js';

export class ProcessRuntime implements SandboxRuntime {
  public readonly type: SandboxRuntimeType = 'process';

  public buildExecutionArgs(
    worktreePath: string,
    options: SandboxExecutionOptions
  ): { executable: string; args: string[] } {
    return {
      executable: '/bin/sh',
      args: ['-c', options.command],
    };
  }

  public async execute(
    worktreePath: string,
    options: SandboxExecutionOptions
  ): Promise<SandboxExecutionResult> {
    const startTime = Date.now();

    if (options.dryRun) {
      return {
        runtime: 'process',
        command: options.command,
        exit_code: 0,
        duration_ms: 0,
        stdout: `[DRY-RUN: process in ${worktreePath}] -> ${options.command}`,
        stderr: '',
        timed_out: false,
      };
    }

    return new Promise((resolve) => {
      let stdoutData = '';
      let stderrData = '';
      let timedOut = false;
      let timer: NodeJS.Timeout | undefined;

      const env = {
        ...process.env,
        ...(options.env || {}),
      };

      const proc = spawn(options.command, {
        cwd: worktreePath,
        shell: true,
        env,
      });

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
        resolve({
          runtime: 'process',
          command: options.command,
          exit_code: code ?? (timedOut ? 124 : 1),
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
          runtime: 'process',
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
    return {
      runtime: 'process',
      available: true,
      details: 'Direct local host process execution fallback',
    };
  }
}
