import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { MannostreeOrchestrator } from '../../src/core/orchestrator.js';
import { loadConfig } from '../../src/config/loader.js';
import { MannostreeError } from '../../src/types/index.js';

describe('Sync Engine', () => {
  let tempRepo: string;
  let orchestrator: MannostreeOrchestrator;

  beforeEach(() => {
    tempRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'mannostree-sync-test-'));
    execSync('git init -b main', { cwd: tempRepo });
    execSync('git config user.name "Sync Tester"', { cwd: tempRepo });
    execSync('git config user.email "sync@example.com"', { cwd: tempRepo });
    fs.writeFileSync(path.join(tempRepo, 'file1.txt'), 'base content\n', 'utf-8');
    execSync('git add file1.txt && git commit -m "Base commit"', { cwd: tempRepo });

    const config = loadConfig(undefined, tempRepo);
    orchestrator = new MannostreeOrchestrator(tempRepo, config);
  });

  afterEach(() => {
    try {
      execSync('git worktree prune', { cwd: tempRepo });
    } catch {
      // ignore
    }
    fs.rmSync(tempRepo, { recursive: true, force: true });
  });

  it('syncs cleanly when base branch has new commits and worktree is clean', async () => {
    await orchestrator.spawn({ name: 'sync-feature', baseBranch: 'main' });
    const wtPath = path.join(tempRepo, '.worktrees', 'sync-feature');

    // Commit scaffold files in worktree
    execSync('git add . && git commit -m "Scaffold files"', { cwd: wtPath });

    // Add new commit to main
    fs.writeFileSync(path.join(tempRepo, 'file2.txt'), 'new base feature\n', 'utf-8');
    execSync('git add file2.txt && git commit -m "New commit on main"', { cwd: tempRepo });

    const syncRes = await orchestrator.sync('feature-sync-feature', {
      strategy: 'rebase',
      fetch: false,
    });

    expect(syncRes.ok).toBe(true);
    expect(fs.existsSync(path.join(wtPath, 'file2.txt'))).toBe(true);
  });

  it('refuses to sync when worktree is dirty', async () => {
    await orchestrator.spawn({ name: 'dirty-sync', baseBranch: 'main' });
    const wtPath = path.join(tempRepo, '.worktrees', 'dirty-sync');

    // Introduce untracked dirty file
    fs.writeFileSync(path.join(wtPath, 'dirty.txt'), 'uncommitted', 'utf-8');

    await expect(
      orchestrator.sync('feature-dirty-sync', { fetch: false })
    ).rejects.toThrowError(MannostreeError);
  });

  it('automatically aborts sync on rebase conflict without leaving workspace in broken state', async () => {
    await orchestrator.spawn({ name: 'conflict-feature', baseBranch: 'main' });
    const wtPath = path.join(tempRepo, '.worktrees', 'conflict-feature');

    // Worktree changes file1.txt
    fs.writeFileSync(path.join(wtPath, 'file1.txt'), 'worktree conflicting content\n', 'utf-8');
    execSync('git add . && git commit -m "Conflicting worktree change"', { cwd: wtPath });

    // Main changes file1.txt
    fs.writeFileSync(path.join(tempRepo, 'file1.txt'), 'main conflicting content\n', 'utf-8');
    execSync('git add file1.txt && git commit -m "Conflicting main change"', { cwd: tempRepo });

    await expect(
      orchestrator.sync('feature-conflict-feature', { strategy: 'rebase', fetch: false })
    ).rejects.toThrowError(MannostreeError);

    // Verify git rebase was aborted and worktree is not stuck in rebase-merge
    const isDirty = await orchestrator.git.isWorktreeDirty(wtPath);
    expect(isDirty).toBe(false);
  });
});
