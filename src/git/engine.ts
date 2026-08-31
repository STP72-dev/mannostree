import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'node:fs';
import { ExitCode, GitStateMetadata, MannostreeError } from '../types/index.js';

const execFileAsync = promisify(execFile);

export class GitEngine {
  constructor(public workingDir: string = process.cwd()) {}

  public async exec(
    args: string[],
    cwd: string = this.workingDir
  ): Promise<{ stdout: string; stderr: string }> {
    try {
      const { stdout, stderr } = await execFileAsync('git', args, { cwd });
      return { stdout: stdout.trim(), stderr: stderr.trim() };
    } catch (err: any) {
      throw new MannostreeError(
        `Git command 'git ${args.join(' ')}' failed: ${err.stderr || err.message}`,
        ExitCode.GIT_ERROR,
        { command: `git ${args.join(' ')}`, stderr: err.stderr, stdout: err.stdout }
      );
    }
  }

  public async getRepoRoot(): Promise<string> {
    try {
      const { stdout } = await this.exec(['rev-parse', '--show-toplevel']);
      return stdout;
    } catch {
      throw new MannostreeError(
        `Not inside a Git repository: ${this.workingDir}`,
        ExitCode.USAGE_ERROR
      );
    }
  }

  public async branchOrRefExists(ref: string): Promise<boolean> {
    try {
      await this.exec(['rev-parse', '--verify', `${ref}^{commit}`]);
      return true;
    } catch {
      return false;
    }
  }

  public async getCurrentBranch(): Promise<string | null> {
    try {
      const { stdout } = await this.exec(['branch', '--show-current']);
      return stdout || null;
    } catch {
      return null;
    }
  }

  public async getRemoteDefaultBranch(): Promise<string | null> {
    try {
      const { stdout } = await this.exec([
        'symbolic-ref',
        '--short',
        'refs/remotes/origin/HEAD',
      ]);
      // e.g. origin/main -> main
      if (stdout.startsWith('origin/')) {
        return stdout.substring(7);
      }
      return stdout || null;
    } catch {
      return null;
    }
  }

  public async isWorktreeDirty(worktreePath: string): Promise<boolean> {
    const fullPath = path.resolve(this.workingDir, worktreePath);
    if (!fs.existsSync(fullPath)) return false;

    const { stdout } = await this.exec(['status', '--porcelain'], fullPath);
    return stdout.length > 0;
  }

  public async getGitState(worktreePath: string): Promise<GitStateMetadata> {
    const fullPath = path.resolve(this.workingDir, worktreePath);
    if (!fs.existsSync(fullPath)) {
      return {
        dirty: false,
        ahead_count: 0,
        behind_count: 0,
        has_untracked_files: false,
        has_conflicts: false,
      };
    }

    let headCommit: string | undefined;
    let headCommitMessage: string | undefined;
    try {
      const logRes = await this.exec(['log', '-1', '--format=%h%x00%s'], fullPath);
      const [hash, msg] = logRes.stdout.split('\0');
      headCommit = hash;
      headCommitMessage = msg;
    } catch {
      // empty repo or detached
    }

    const statusRes = await this.exec(['status', '--porcelain'], fullPath);
    const statusLines = statusRes.stdout.split('\n').filter(Boolean);
    const hasUntracked = statusLines.some((l) => l.startsWith('??'));
    const hasConflicts = statusLines.some(
      (l) => l.startsWith('UU') || l.startsWith('AA') || l.startsWith('UD')
    );
    const dirty = statusLines.length > 0;

    return {
      head_commit: headCommit,
      head_commit_message: headCommitMessage,
      dirty,
      ahead_count: 0,
      behind_count: 0,
      has_untracked_files: hasUntracked,
      has_conflicts: hasConflicts,
    };
  }

  public async createBranchAndWorktree(
    branch: string,
    worktreePath: string,
    baseBranch: string,
    dryRun: boolean = false
  ): Promise<void> {
    const fullWorktreePath = path.resolve(this.workingDir, worktreePath);

    if (fs.existsSync(fullWorktreePath)) {
      throw new MannostreeError(
        `Target worktree directory already exists: ${worktreePath}`,
        ExitCode.USAGE_ERROR
      );
    }

    const branchExists = await this.branchOrRefExists(branch);
    if (branchExists) {
      throw new MannostreeError(
        `Branch '${branch}' already exists in repository`,
        ExitCode.USAGE_ERROR
      );
    }

    if (dryRun) {
      return;
    }

    // Create branch from baseBranch and add worktree
    await this.exec([
      'worktree',
      'add',
      '-b',
      branch,
      fullWorktreePath,
      baseBranch,
    ]);
  }

  public async removeWorktreeAndBranch(
    worktreePath: string,
    branch: string,
    keepBranch: boolean = false,
    force: boolean = false,
    dryRun: boolean = false
  ): Promise<void> {
    const fullWorktreePath = path.resolve(this.workingDir, worktreePath);

    if (fs.existsSync(fullWorktreePath)) {
      const isDirty = await this.isWorktreeDirty(fullWorktreePath);
      if (isDirty && !force) {
        throw new MannostreeError(
          `Worktree at ${worktreePath} has uncommitted or untracked changes. Use --force to drop anyway.`,
          ExitCode.USAGE_ERROR
        );
      }
    }

    if (dryRun) {
      return;
    }

    if (fs.existsSync(fullWorktreePath)) {
      try {
        const removeArgs = ['worktree', 'remove'];
        if (force) removeArgs.push('--force');
        removeArgs.push(fullWorktreePath);
        await this.exec(removeArgs);
      } catch (err: any) {
        // If git worktree remove fails, check if we need to remove directory manually and prune
        if (fs.existsSync(fullWorktreePath)) {
          fs.rmSync(fullWorktreePath, { recursive: true, force: true });
        }
        await this.exec(['worktree', 'prune']);
      }
    }

    if (!keepBranch) {
      const branchExists = await this.branchOrRefExists(branch);
      if (branchExists) {
        const deleteFlag = force ? '-D' : '-d';
        try {
          await this.exec(['branch', deleteFlag, branch]);
        } catch {
          // If -d fails because unmerged and not force, warn or delete with -D if force
          if (force) {
            await this.exec(['branch', '-D', branch]);
          }
        }
      }
    }
  }
}
