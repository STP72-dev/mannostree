import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { MannostreeOrchestrator } from '../../src/core/orchestrator.js';
import { loadConfig } from '../../src/config/loader.js';

describe('Flag Safety & Strict Separation', () => {
  let tempRepo: string;
  let orchestrator: MannostreeOrchestrator;

  beforeEach(() => {
    tempRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'mannostree-flag-safety-'));
    execSync('git init -b main', { cwd: tempRepo });
    execSync('git config user.name "Flag Tester"', { cwd: tempRepo });
    execSync('git config user.email "flag@example.com"', { cwd: tempRepo });
    fs.writeFileSync(path.join(tempRepo, 'README.md'), '# Flag Safety Repo\n', 'utf-8');
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

  it('refuses to drop dirty worktree without explicit confirmation and force', async () => {
    await orchestrator.spawn({ name: 'safe-dirty', baseBranch: 'main' });
    const wtPath = path.join(tempRepo, '.worktrees', 'safe-dirty');

    // Create uncommitted dirty file
    fs.writeFileSync(path.join(wtPath, 'dirty.txt'), 'uncommitted content\n', 'utf-8');

    // Drop without force should reject
    await expect(orchestrator.drop('feature-safe-dirty', { force: false })).rejects.toThrow(
      /uncommitted or untracked changes/
    );

    // Worktree still exists
    expect(fs.existsSync(wtPath)).toBe(true);

    // Drop with force succeeds
    const dropRes = await orchestrator.drop('feature-safe-dirty', { force: true });
    expect(dropRes.ok).toBe(true);
    expect(fs.existsSync(wtPath)).toBe(false);
  });
});
