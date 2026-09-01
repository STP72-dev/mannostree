import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'node:fs';
import { ExitCode, GitStateMetadata, MannostreeError } from '../types/index.js';

const execFileAsync = promisify(execFile);

export interface PorcelainWorktreeEntry {
  path: string;
  head: string;
  branch?: string;
  bare?: boolean;
  detached?: boolean;
  locked?: boolean;
  prunable?: boolean;
}

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

  public async getHeadCommit(ref: string = 'HEAD'): Promise<string | null> {
    try {
      const { stdout } = await this.exec(['rev-parse', ref]);
      return stdout || null;
    } catch {
      return null;
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

  public async fetchAll(cwd: string = this.workingDir): Promise<void> {
    try {
      await this.exec(['fetch', '--all', '--prune'], cwd);
    } catch (err: any) {
      // If no remotes or offline, report warning/error gracefully
      throw new MannostreeError(
        `Git fetch failed: ${err.message}`,
        ExitCode.GIT_ERROR
      );
    }
  }

  public async isWorktreeDirty(worktreePath: string): Promise<boolean> {
    const fullPath = path.resolve(this.workingDir, worktreePath);
    if (!fs.existsSync(fullPath)) return false;

    const { stdout } = await this.exec(['status', '--porcelain'], fullPath);
    return stdout.length > 0;
  }




  public async getAheadBehindCount(
    worktreePath: string,
    baseBranch: string,
    branch?: string
  ): Promise<{ ahead: number; behind: number }> {
    const fullPath = path.resolve(this.workingDir, worktreePath);
    if (!fs.existsSync(fullPath)) {
      return { ahead: 0, behind: 0 };
    }

    try {
      const targetBranch = branch || (await this.getCurrentBranchIn(fullPath)) || 'HEAD';
      const { stdout } = await this.exec(
        ['rev-list', '--left-right', '--count', `${baseBranch}...${targetBranch}`],
        fullPath
      );
      const [behindStr, aheadStr] = stdout.split(/\s+/);
      const behind = parseInt(behindStr, 10) || 0;
      const ahead = parseInt(aheadStr, 10) || 0;
      return { ahead, behind };
    } catch {
      return { ahead: 0, behind: 0 };
    }
  }

  public async getCurrentBranchIn(dir: string): Promise<string | null> {
    try {
      const { stdout } = await this.exec(['branch', '--show-current'], dir);
      return stdout || null;
    } catch {
      return null;
    }
  }

  public async isBranchMerged(branch: string, baseBranch: string): Promise<boolean> {
    try {
      await this.exec(['merge-base', '--is-ancestor', branch, baseBranch]);
      return true;
    } catch {
      return false;
    }
  }

  public async getDiffShortStat(
    worktreePath: string,
    baseBranch: string,
    branch?: string
  ): Promise<{ files_changed: number; insertions: number; deletions: number }> {
    const fullPath = path.resolve(this.workingDir, worktreePath);
    if (!fs.existsSync(fullPath)) {
      return { files_changed: 0, insertions: 0, deletions: 0 };
    }

    try {
      const targetRef = branch ? `${baseBranch}...${branch}` : `${baseBranch}...HEAD`;
      const { stdout } = await this.exec(['diff', '--shortstat', targetRef], fullPath);
      if (!stdout || stdout.trim().length === 0) {
        return { files_changed: 0, insertions: 0, deletions: 0 };
      }

      const filesMatch = stdout.match(/(\d+)\s+files?\s+changed/);
      const insertionsMatch = stdout.match(/(\d+)\s+insertions?\(\+\)/);
      const deletionsMatch = stdout.match(/(\d+)\s+deletions?\(-\)/);

      return {
        files_changed: filesMatch ? parseInt(filesMatch[1], 10) : 0,
        insertions: insertionsMatch ? parseInt(insertionsMatch[1], 10) : 0,
        deletions: deletionsMatch ? parseInt(deletionsMatch[1], 10) : 0,
      };
    } catch {
      return { files_changed: 0, insertions: 0, deletions: 0 };
    }
  }

  public async getGitState(
    worktreePath: string,
    baseBranch?: string,
    branch?: string
  ): Promise<GitStateMetadata> {
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

    let ahead = 0;
    let behind = 0;
    if (baseBranch) {
      const ab = await this.getAheadBehindCount(worktreePath, baseBranch, branch);
      ahead = ab.ahead;
      behind = ab.behind;
    }

    return {
      head_commit: headCommit,
      head_commit_message: headCommitMessage,
      dirty,
      ahead_count: ahead,
      behind_count: behind,
      has_untracked_files: hasUntracked,
      has_conflicts: hasConflicts,
    };
  }

  public async syncWorktree(
    worktreePath: string,
    baseBranch: string,
    strategy: 'rebase' | 'merge' | 'ff-only' = 'rebase',
    dryRun: boolean = false
  ): Promise<{ strategy: string; conflicts?: string[] }> {
    const fullPath = path.resolve(this.workingDir, worktreePath);

    if (!fs.existsSync(fullPath)) {
      throw new MannostreeError(
        `Worktree directory does not exist: ${worktreePath}`,
        ExitCode.USAGE_ERROR
      );
    }

    const isDirty = await this.isWorktreeDirty(fullPath);
    if (isDirty) {
      throw new MannostreeError(
        `Cannot sync: worktree '${worktreePath}' has uncommitted or untracked changes. Stash or commit them before syncing.`,
        ExitCode.USAGE_ERROR
      );
    }

    if (dryRun) {
      return { strategy };
    }

    if (strategy === 'rebase') {
      try {
        await this.exec(['rebase', baseBranch], fullPath);
        return { strategy };
      } catch (err: any) {
        // Capture conflict status before aborting
        let conflictFiles: string[] = [];
        try {
          const statusRes = await this.exec(['status', '--porcelain'], fullPath);
          conflictFiles = statusRes.stdout
            .split('\n')
            .filter((l) => l.startsWith('UU') || l.startsWith('AA') || l.startsWith('UD') || l.startsWith('DU'))
            .map((l) => l.substring(3).trim());
        } catch {
          // ignore
        }

        // Abort rebase cleanly
        try {
          await this.exec(['rebase', '--abort'], fullPath);
        } catch {
          // ignore
        }

        throw new MannostreeError(
          `Sync rebase failed due to merge conflicts on base '${baseBranch}'. Rebase was automatically aborted to preserve clean state.`,
          ExitCode.GIT_ERROR,
          { strategy: 'rebase', conflicts: conflictFiles }
        );
      }
    } else if (strategy === 'merge') {
      try {
        await this.exec(['merge', baseBranch, '--no-edit'], fullPath);
        return { strategy };
      } catch (err: any) {
        let conflictFiles: string[] = [];
        try {
          const statusRes = await this.exec(['status', '--porcelain'], fullPath);
          conflictFiles = statusRes.stdout
            .split('\n')
            .filter((l) => l.startsWith('UU') || l.startsWith('AA') || l.startsWith('UD') || l.startsWith('DU'))
            .map((l) => l.substring(3).trim());
        } catch {
          // ignore
        }

        try {
          await this.exec(['merge', '--abort'], fullPath);
        } catch {
          // ignore
        }

        throw new MannostreeError(
          `Sync merge failed due to conflicts on base '${baseBranch}'. Merge was automatically aborted to preserve clean state.`,
          ExitCode.GIT_ERROR,
          { strategy: 'merge', conflicts: conflictFiles }
        );
      }
    } else if (strategy === 'ff-only') {
      try {
        await this.exec(['merge', '--ff-only', baseBranch], fullPath);
        return { strategy };
      } catch (err: any) {
        throw new MannostreeError(
          `Sync ff-only failed: branch cannot be fast-forwarded to base '${baseBranch}'.`,
          ExitCode.GIT_ERROR
        );
      }
    }

    throw new MannostreeError(
      `Unknown sync strategy '${strategy}'. Supported: rebase, merge, ff-only.`,
      ExitCode.USAGE_ERROR
    );
  }

  public async listPorcelainWorktrees(): Promise<PorcelainWorktreeEntry[]> {

    try {
      const { stdout } = await this.exec(['worktree', 'list', '--porcelain']);
      const entries: PorcelainWorktreeEntry[] = [];
      const blocks = stdout.split('\n\n').filter(Boolean);

      for (const block of blocks) {
        const lines = block.split('\n');
        let wtPath = '';
        let head = '';
        let branch: string | undefined;
        let bare = false;
        let detached = false;
        let locked = false;
        let prunable = false;

        for (const line of lines) {
          if (line.startsWith('worktree ')) {
            wtPath = line.substring(9).trim();
          } else if (line.startsWith('HEAD ')) {
            head = line.substring(5).trim();
          } else if (line.startsWith('branch ')) {
            const fullRef = line.substring(7).trim();
            branch = fullRef.replace(/^refs\/heads\//, '');
          } else if (line === 'bare') {
            bare = true;
          } else if (line === 'detached') {
            detached = true;
          } else if (line.startsWith('locked')) {
            locked = true;
          } else if (line.startsWith('prunable')) {
            prunable = true;
          }
        }

        if (wtPath) {
          entries.push({
            path: wtPath,
            head,
            branch,
            bare,
            detached,
            locked,
            prunable,
          });
        }
      }

      return entries;
    } catch {
      return [];
    }
  }

  public async listLocalBranches(): Promise<string[]> {
    try {
      const { stdout } = await this.exec(['branch', '--format=%(refname:short)']);
      return stdout.split('\n').map((s) => s.trim()).filter(Boolean);
    } catch {
      return [];
    }
  }

  public async repairWorktree(worktreePath?: string): Promise<void> {
    try {
      const args = ['worktree', 'repair'];
      if (worktreePath) {
        args.push(path.resolve(this.workingDir, worktreePath));
      }
      await this.exec(args);
    } catch (err: any) {
      throw new MannostreeError(
        `Failed to repair worktree: ${err.message}`,
        ExitCode.GIT_ERROR
      );
    }
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
    return this.deleteWorktree(worktreePath, branch, force, keepBranch, dryRun);
  }

  public async deleteWorktree(
    worktreePath: string,
    branch: string,
    force: boolean = false,
    keepBranch: boolean = false,
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

  public async getChangedFilesAgainstBase(
    branchOrPath: string,
    baseBranch: string
  ): Promise<string[]> {
    try {
      const fullPath = path.resolve(this.workingDir, branchOrPath);
      const isDir = fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory();
      const cwd = isDir ? fullPath : this.workingDir;
      const ref = isDir ? 'HEAD' : branchOrPath;

      const { stdout } = await this.exec(
        ['diff', '--name-only', `${baseBranch}...${ref}`],
        cwd
      );
      const committed = stdout
        .split('\n')
        .map((s) => s.trim())
        .filter((s) => s && !s.startsWith('.task/') && !s.startsWith('.mannostree/'));

      if (isDir) {
        const { stdout: statusOut } = await this.exec(['status', '--porcelain'], cwd);
        const uncommitted = statusOut
          .split('\n')
          .map((line) => line.slice(3).trim())
          .filter((s) => s && !s.startsWith('.task/') && !s.startsWith('.mannostree/'));
        return Array.from(new Set([...committed, ...uncommitted]));
      }

      return committed;
    } catch {
      return [];
    }
  }

  public async simulateMergeTree(
    branchA: string,
    branchB: string
  ): Promise<{
    clean: boolean;
    conflicts: Array<{ file: string; detail: string }>;
    rawOutput: string;
  }> {
    try {
      const { stdout: baseOut } = await this.exec(['merge-base', branchA, branchB], this.workingDir);
      const mergeBase = baseOut.trim();
      if (!mergeBase) {
        return {
          clean: false,
          conflicts: [{ file: 'all', detail: 'No common ancestor found' }],
          rawOutput: '',
        };
      }

      const { stdout } = await this.exec(
        ['merge-tree', mergeBase, branchA, branchB],
        this.workingDir
      );

      const conflicts: Array<{ file: string; detail: string }> = [];
      const lines = stdout.split('\n');

      for (const line of lines) {
        const match =
          line.match(/\s+(?:base|our|their)\s+\d+\s+[0-9a-f]+\s+(.+)$/i) ||
          line.match(/(?:file|path)\s+([^\s]+)/i) ||
          line.match(/\+\+\+\s+b\/([^\s]+)/);
        if (match) {
          const fName = match[1].trim();
          if (fName && !conflicts.some((c) => c.file === fName)) {
            conflicts.push({ file: fName, detail: line.trim() });
          }
        }
      }

      const hasConflict =
        stdout.includes('<<<<<<<') ||
        stdout.includes('changed in both') ||
        stdout.includes('conflict') ||
        conflicts.length > 0;

      return {
        clean: !hasConflict,
        conflicts,
        rawOutput: stdout,
      };
    } catch (err: any) {
      return {
        clean: false,
        conflicts: [{ file: 'error', detail: err.message || 'Simulation error' }],
        rawOutput: '',
      };
    }
  }
}

