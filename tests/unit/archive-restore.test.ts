import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { MannostreeOrchestrator } from '../../src/core/orchestrator.js';
import { loadConfig } from '../../src/config/loader.js';

describe('Archive and Restore Engine', () => {
  let tempRepo: string;
  let orchestrator: MannostreeOrchestrator;

  beforeEach(() => {
    tempRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'mannostree-archive-test-'));
    execSync('git init -b main', { cwd: tempRepo });
    execSync('git config user.name "Archive Tester"', { cwd: tempRepo });
    execSync('git config user.email "archive@example.com"', { cwd: tempRepo });
    fs.writeFileSync(path.join(tempRepo, 'README.md'), '# Archive Repo\n', 'utf-8');
    execSync('git add README.md && git commit -m "Initial commit"', { cwd: tempRepo });

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

  it('refuses to archive dirty worktree without force and archives when committed', async () => {
    await orchestrator.spawn({ name: 'feat-archive', baseBranch: 'main' });
    const wtPath = path.join(tempRepo, '.worktrees', 'feat-archive');
    expect(fs.existsSync(wtPath)).toBe(true);

    // Initial spawned tree has untracked scaffold files -> should refuse without force
    await expect(
      orchestrator.archive('feature-feat-archive', { yes: true, force: false })
    ).rejects.toThrow(/uncommitted or untracked changes/);

    // Commit scaffold files to make it clean
    execSync('git add . && git commit -m "Scaffold files"', { cwd: wtPath });

    const archiveRes = await orchestrator.archive('feature-feat-archive', { yes: true });
    expect(archiveRes.ok).toBe(true);
    expect(fs.existsSync(wtPath)).toBe(false);

    // Verify git branch still exists
    const branches = await orchestrator.git.listLocalBranches();
    expect(branches).toContain('feature/feat-archive');

    // Verify record state is archived
    const record = await orchestrator.store.getWorktree('feature-feat-archive');
    expect(record?.status).toBe('archived');
  });

  it('restores archived worktree recreating worktree directory at original path', async () => {
    await orchestrator.spawn({ name: 'feat-restore', baseBranch: 'main' });
    const wtPath = path.join(tempRepo, '.worktrees', 'feat-restore');

    // Archive with force: true
    await orchestrator.archive('feature-feat-restore', { yes: true, force: true });
    expect(fs.existsSync(wtPath)).toBe(false);

    const restoreRes = await orchestrator.restore('feature-feat-restore', { yes: true });
    expect(restoreRes.ok).toBe(true);
    expect(fs.existsSync(wtPath)).toBe(true);

    const record = await orchestrator.store.getWorktree('feature-feat-restore');
    expect(record?.status).toBe('created');
  });
});
