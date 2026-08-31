import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { MannostreeOrchestrator } from '../../src/core/orchestrator.js';
import { loadConfig } from '../../src/config/loader.js';

describe('Publish Engine', () => {
  let tempRepo: string;
  let orchestrator: MannostreeOrchestrator;

  beforeEach(() => {
    tempRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'mannostree-publish-test-'));
    execSync('git init -b main', { cwd: tempRepo });
    execSync('git config user.name "Publish Tester"', { cwd: tempRepo });
    execSync('git config user.email "publish@example.com"', { cwd: tempRepo });
    fs.writeFileSync(path.join(tempRepo, 'README.md'), '# Base Project\n', 'utf-8');
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

  it('assembles PR body from durable task artifacts in prepare-only mode', async () => {
    await orchestrator.spawn({ name: 'pr-feat', baseBranch: 'main', noSetup: true });
    const wtPath = path.join(tempRepo, '.worktrees', 'pr-feat');

    // Add content to RESULTS.md
    fs.writeFileSync(path.join(wtPath, 'RESULTS.md'), '## Summary\nImplemented pr-feat cleanly.\n', 'utf-8');

    const prRes = await orchestrator.pr('feature-pr-feat', {
      title: 'feat: deliver pr-feat',
    });

    expect(prRes.ok).toBe(true);
    expect(prRes.result?.mode).toBe('prepare-only');
    expect(prRes.result?.body).toContain('Implemented pr-feat cleanly.');
    expect(fs.existsSync(path.join(wtPath, '.task', 'pr-body.md'))).toBe(true);
  });

  it('previews PR compilation without writing file in dry-run mode', async () => {
    await orchestrator.spawn({ name: 'dry-pr-feat', baseBranch: 'main', noSetup: true });
    const wtPath = path.join(tempRepo, '.worktrees', 'dry-pr-feat');
    const prBodyFile = path.join(wtPath, '.task', 'pr-body.md');

    const prRes = await orchestrator.pr('feature-dry-pr-feat', {
      dryRun: true,
    });

    expect(prRes.ok).toBe(true);
    expect(prRes.dry_run).toBe(true);
    expect(fs.existsSync(prBodyFile)).toBe(false);
  });
});
