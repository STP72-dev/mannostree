import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { MannostreeOrchestrator } from '../../src/core/orchestrator.js';
import { loadConfig } from '../../src/config/loader.js';

describe('Clean Engine', () => {
  let tempRepo: string;
  let orchestrator: MannostreeOrchestrator;

  beforeEach(() => {
    tempRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'mannostree-clean-test-'));
    execSync('git init -b main', { cwd: tempRepo });
    execSync('git config user.name "Clean Tester"', { cwd: tempRepo });
    execSync('git config user.email "clean@example.com"', { cwd: tempRepo });
    fs.writeFileSync(path.join(tempRepo, 'README.md'), '# Clean test\n', 'utf-8');
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

  it('runs candidate report in dry-run mode when no confirmation is passed', async () => {
    await orchestrator.spawn({ name: 'merged-feature', baseBranch: 'main' });
    const wtPath = path.join(tempRepo, '.worktrees', 'merged-feature');
    execSync('git add . && git commit -m "Commit in feature"', { cwd: wtPath });

    // Merge feature branch into main
    execSync('git merge feature/merged-feature', { cwd: tempRepo });

    // Clean preview with --merged
    const preview = await orchestrator.clean({ merged: true });
    expect(preview.ok).toBe(true);
    expect(preview.dry_run).toBe(true);
    expect(preview.result?.candidates).toContain('feature-merged-feature');
    expect(preview.result?.cleaned.length).toBe(0);

    // Verify worktree still exists on disk
    expect(fs.existsSync(wtPath)).toBe(true);
  });

  it('performs real removal when explicit filter and --yes are provided', async () => {
    await orchestrator.spawn({ name: 'merged-real', baseBranch: 'main' });
    const wtPath = path.join(tempRepo, '.worktrees', 'merged-real');
    execSync('git add . && git commit -m "Commit in feature"', { cwd: wtPath });

    // Merge feature branch into main
    execSync('git merge feature/merged-real', { cwd: tempRepo });

    // Clean with --merged and --yes
    const res = await orchestrator.clean({ merged: true, yes: true });
    expect(res.ok).toBe(true);
    expect(res.dry_run).toBe(false);
    expect(res.result?.cleaned).toContain('feature-merged-real');

    // Verify worktree is removed
    expect(fs.existsSync(wtPath)).toBe(false);
  });
});
