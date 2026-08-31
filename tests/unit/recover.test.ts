import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { MannostreeOrchestrator } from '../../src/core/orchestrator.js';
import { loadConfig } from '../../src/config/loader.js';
import { MannostreeError } from '../../src/types/index.js';

describe('Recover Engine', () => {
  let tempRepo: string;
  let orchestrator: MannostreeOrchestrator;

  beforeEach(() => {
    tempRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'mannostree-rec-test-'));
    execSync('git init -b main', { cwd: tempRepo });
    execSync('git config user.name "Rec Tester"', { cwd: tempRepo });
    execSync('git config user.email "rec@example.com"', { cwd: tempRepo });
    fs.writeFileSync(path.join(tempRepo, 'README.md'), '# Recover test\n', 'utf-8');
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

  it('rebuilds metadata for an on-disk worktree directory', async () => {
    await orchestrator.spawn({ name: 'recover-me', baseBranch: 'main' });

    // Delete metadata file
    const metaFile = orchestrator.store.getWorktreeRecordPath('feature-recover-me');
    fs.unlinkSync(metaFile);

    const recRes = await orchestrator.recover('feature-recover-me', {
      rebuildMetadata: true,
      yes: true,
    });

    expect(recRes.ok).toBe(true);
    expect(fs.existsSync(metaFile)).toBe(true);

    const reloaded = await orchestrator.store.getWorktree('feature-recover-me');
    expect(reloaded).not.toBeNull();
    expect(reloaded?.status).toBe('recovered');
  });

  it('rejects recover if multiple or zero repair flags are provided', async () => {
    await expect(
      orchestrator.recover('feature-xyz', {})
    ).rejects.toThrowError(MannostreeError);

    await expect(
      orchestrator.recover('feature-xyz', { rebuildMetadata: true, reattachWorktree: true })
    ).rejects.toThrowError(MannostreeError);
  });
});
