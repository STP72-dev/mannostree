import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { MannostreeOrchestrator } from '../../src/core/orchestrator.js';
import { loadConfig } from '../../src/config/loader.js';
import { MannostreeError } from '../../src/types/index.js';

describe('Mannostree End-to-End Orchestration', () => {
  let tempRepo: string;
  let orchestrator: MannostreeOrchestrator;

  beforeEach(() => {
    tempRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'mannostree-e2e-test-'));
    execSync('git init -b main', { cwd: tempRepo });
    execSync('git config user.name "Integration Tester"', { cwd: tempRepo });
    execSync('git config user.email "tester@example.com"', { cwd: tempRepo });
    fs.writeFileSync(path.join(tempRepo, 'README.md'), '# Mannostree Test Repo\n', 'utf-8');
    execSync('git add README.md && git commit -m "Initial root commit"', { cwd: tempRepo });

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

  it('performs spawn with --dry-run without touching disk or git', async () => {
    const output = await orchestrator.spawn({
      name: 'dry-feature',
      baseBranch: 'main',
      dryRun: true,
    });

    expect(output.ok).toBe(true);
    expect(output.dry_run).toBe(true);
    expect(output.result?.id).toBe('feature-dry-feature');

    // Confirm nothing was created
    expect(fs.existsSync(path.join(tempRepo, '.worktrees', 'dry-feature'))).toBe(false);
    expect(fs.existsSync(path.join(tempRepo, '.mannostree', 'worktrees', 'feature-dry-feature.json'))).toBe(false);
  });

  it('spawns a new worktree, lists it, gets info, and drops it with clean/committed state', async () => {
    // 1. Spawn
    const spawnRes = await orchestrator.spawn({
      name: 'real-feature',
      baseBranch: 'main',
      kind: 'feature',
    });

    expect(spawnRes.ok).toBe(true);
    expect(spawnRes.result?.id).toBe('feature-real-feature');
    expect(spawnRes.result?.branch).toBe('feature/real-feature');
    expect(spawnRes.result?.lifecycle_state).toBe('CONTEXT_PACKED');

    const wtPath = path.join(tempRepo, '.worktrees', 'real-feature');
    expect(fs.existsSync(wtPath)).toBe(true);
    expect(fs.existsSync(path.join(wtPath, '.task', 'task-contract.md'))).toBe(true);
    expect(fs.existsSync(path.join(wtPath, 'RESULTS.md'))).toBe(true);

    // 2. List
    const listRes = await orchestrator.list();
    expect(listRes.ok).toBe(true);
    expect(listRes.result?.length).toBe(1);
    expect(listRes.result?.[0].id).toBe('feature-real-feature');

    // 3. Info
    const infoRes = await orchestrator.info('feature-real-feature');
    expect(infoRes.ok).toBe(true);
    expect(infoRes.result?.live_health.exists_on_disk).toBe(true);
    expect(infoRes.result?.live_health.branch_exists).toBe(true);
    expect(infoRes.result?.live_health.health_status).toBe('ok');

    // Commit scaffolded files so worktree is clean
    execSync('git add . && git commit -m "Scaffold task artifacts"', { cwd: wtPath });

    // 4. Drop clean worktree
    const dropRes = await orchestrator.drop('feature-real-feature');
    expect(dropRes.ok).toBe(true);
    expect(fs.existsSync(wtPath)).toBe(false);

    // Verify list is empty
    const listAfterDrop = await orchestrator.list();
    expect(listAfterDrop.result?.length).toBe(0);
  });

  it('refuses to drop dirty/uncommitted worktree without force flag and succeeds with force', async () => {
    await orchestrator.spawn({
      name: 'dirty-feature',
      baseBranch: 'main',
    });

    const wtPath = path.join(tempRepo, '.worktrees', 'dirty-feature');
    // Worktree contains uncommitted scaffold files / dirty files
    await expect(orchestrator.drop('feature-dirty-feature')).rejects.toThrowError(MannostreeError);

    // Drop with force succeeds
    const forceDrop = await orchestrator.drop('feature-dirty-feature', { force: true });
    expect(forceDrop.ok).toBe(true);
    expect(fs.existsSync(wtPath)).toBe(false);
  });
});
