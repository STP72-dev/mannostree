import { exec, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'node:fs';
import { ProfileConfig } from '../config/schema.js';
import { ExitCode, MannostreeError } from '../types/index.js';

const execAsync = promisify(exec);

export interface SetupApplyResult {
  install_ran: boolean;
  install_succeeded: boolean;
  validation_passed: boolean;
  commands_executed: string[];
  errors: string[];
}

export interface EnvApplyResult {
  mode: 'copy' | 'link' | 'skip' | 'generate';
  files_handled: string[];
  generated: boolean;
}

export class SetupEngine {
  constructor(public repoRoot: string) {}

  public async runShellCommand(
    cmd: string,
    cwd: string,
    envVars: Record<string, string> = {}
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const combinedEnv = { ...process.env, ...envVars };
    try {
      const { stdout, stderr } = await execAsync(cmd, { cwd, env: combinedEnv });
      return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode: 0 };
    } catch (err: any) {
      return {
        stdout: err.stdout ? String(err.stdout).trim() : '',
        stderr: err.stderr ? String(err.stderr).trim() : err.message,
        exitCode: err.code || 1,
      };
    }
  }

  public async applyProfile(
    worktreeFullPath: string,
    profile: ProfileConfig,
    options: { reinstall?: boolean; dryRun?: boolean } = {}
  ): Promise<SetupApplyResult> {
    const { reinstall = false, dryRun = false } = options;
    const executed: string[] = [];
    const errors: string[] = [];

    if (!fs.existsSync(worktreeFullPath)) {
      throw new MannostreeError(
        `Worktree directory does not exist: ${worktreeFullPath}`,
        ExitCode.USAGE_ERROR
      );
    }

    if (dryRun) {
      return {
        install_ran: profile.install_commands.length > 0,
        install_succeeded: true,
        validation_passed: true,
        commands_executed: [...profile.install_commands, ...profile.validation_commands],
        errors: [],
      };
    }

    let installSucceeded = true;
    let installRan = false;

    // Run install commands
    if (profile.install_commands.length > 0) {
      installRan = true;
      for (const cmd of profile.install_commands) {
        executed.push(cmd);
        const res = await this.runShellCommand(cmd, worktreeFullPath, profile.env_vars);
        if (res.exitCode !== 0) {
          installSucceeded = false;
          errors.push(`Install command failed: '${cmd}' (exit code ${res.exitCode}): ${res.stderr}`);
          break;
        }
      }
    }

    // Run validation commands
    let validationPassed = true;
    if (installSucceeded && profile.validation_commands.length > 0) {
      for (const vCmd of profile.validation_commands) {
        executed.push(vCmd);
        const res = await this.runShellCommand(vCmd, worktreeFullPath, profile.env_vars);
        if (res.exitCode !== 0) {
          validationPassed = false;
          errors.push(`Validation command failed: '${vCmd}' (exit code ${res.exitCode}): ${res.stderr}`);
          break;
        }
      }
    }

    return {
      install_ran: installRan,
      install_succeeded: installSucceeded,
      validation_passed: validationPassed,
      commands_executed: executed,
      errors,
    };
  }

  public async applyEnvPolicy(
    worktreeFullPath: string,
    profile: ProfileConfig,
    modeOverride?: 'copy' | 'link' | 'skip' | 'generate',
    fromPath?: string,
    options: { dryRun?: boolean } = {}
  ): Promise<EnvApplyResult> {
    const { dryRun = false } = options;
    const mode = modeOverride || profile.env_mode || 'skip';
    const sourceDir = fromPath ? path.resolve(this.repoRoot, fromPath) : this.repoRoot;
    const handledFiles: string[] = [];

    if (!fs.existsSync(worktreeFullPath)) {
      throw new MannostreeError(
        `Worktree directory does not exist: ${worktreeFullPath}`,
        ExitCode.USAGE_ERROR
      );
    }

    if (mode === 'skip') {
      return { mode: 'skip', files_handled: [], generated: false };
    }

    if (mode === 'copy' || mode === 'link') {
      const filesToHandle = profile.env_files.length > 0 ? profile.env_files : ['.env'];

      for (const relFile of filesToHandle) {
        const srcFile = path.resolve(sourceDir, relFile);
        const destFile = path.resolve(worktreeFullPath, relFile);

        if (!fs.existsSync(srcFile)) {
          throw new MannostreeError(
            `Source environment file not found at '${srcFile}'. Cannot perform '${mode}'.`,
            ExitCode.SETUP_ENV_ERROR
          );
        }

        handledFiles.push(relFile);

        if (!dryRun) {
          const destDir = path.dirname(destFile);
          if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
          }

          if (mode === 'copy') {
            fs.copyFileSync(srcFile, destFile);
          } else if (mode === 'link') {
            if (fs.existsSync(destFile)) {
              fs.unlinkSync(destFile);
            }
            fs.symlinkSync(srcFile, destFile);
          }
        }
      }

      return { mode, files_handled: handledFiles, generated: false };
    }

    if (mode === 'generate') {
      if (!profile.generate_command) {
        throw new MannostreeError(
          `Profile is configured for env mode 'generate' but no 'generate_command' is defined.`,
          ExitCode.SETUP_ENV_ERROR
        );
      }

      if (!dryRun) {
        const res = await this.runShellCommand(
          profile.generate_command,
          worktreeFullPath,
          profile.env_vars
        );
        if (res.exitCode !== 0) {
          throw new MannostreeError(
            `Failed to generate environment via '${profile.generate_command}': ${res.stderr}`,
            ExitCode.SETUP_ENV_ERROR
          );
        }
      }

      return { mode: 'generate', files_handled: [], generated: true };
    }

    return { mode: 'skip', files_handled: [], generated: false };
  }

  public async execInWorktree(
    worktreeFullPath: string,
    commandArgs: string[],
    profile?: ProfileConfig,
    options: { inheritStdio?: boolean } = {}
  ): Promise<{ exitCode: number; stdout?: string; stderr?: string }> {
    if (!fs.existsSync(worktreeFullPath)) {
      throw new MannostreeError(
        `Worktree directory does not exist: ${worktreeFullPath}`,
        ExitCode.USAGE_ERROR
      );
    }

    const commandStr = commandArgs.join(' ');
    const combinedEnv = { ...process.env, ...(profile?.env_vars || {}) };

    if (options.inheritStdio) {
      return new Promise((resolve) => {
        const child = spawn(commandStr, {
          cwd: worktreeFullPath,
          env: combinedEnv,
          shell: true,
          stdio: 'inherit',
        });

        child.on('close', (code) => {
          resolve({ exitCode: code ?? 0 });
        });

        child.on('error', (err) => {
          resolve({ exitCode: 1, stderr: err.message });
        });
      });
    }

    const res = await this.runShellCommand(commandStr, worktreeFullPath, profile?.env_vars);
    return {
      exitCode: res.exitCode,
      stdout: res.stdout,
      stderr: res.stderr,
    };
  }
}
