import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { MannostreeOrchestrator } from '../../src/core/orchestrator.js';
import { loadConfig } from '../../src/config/loader.js';
import { MannostreeError } from '../../src/types/index.js';

describe('Parallel Engine', () => {
  let tempRepo: string;
  let orchestrator: MannostreeOrchestrator;

  beforeEach(() => {
    tempRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'mannostree-parallel-test-'));
    execSync('git init -b main', { cwd: tempRepo });
    execSync('git config user.name "Parallel Tester"', { cwd: tempRepo });
    execSync('git config user.email "parallel@example.com"', { cwd: tempRepo });
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

  it('spawns N variants from shared base branch and creates experiment record', async () => {
    const spawnRes = await orchestrator.parallelSpawn({
      feature: 'auth-strategy',
      count: 2,
      baseBranch: 'main',
    });

    expect(spawnRes.ok).toBe(true);
    expect(spawnRes.result?.variants.length).toBe(2);

    const v1Path = path.join(tempRepo, '.worktrees', 'auth-strategy-v1');
    const v2Path = path.join(tempRepo, '.worktrees', 'auth-strategy-v2');
    expect(fs.existsSync(v1Path)).toBe(true);
    expect(fs.existsSync(v2Path)).toBe(true);

    // Verify experiment record in metadata
    const experiment = await orchestrator.store.getExperiment('auth-strategy');
    expect(experiment).not.toBeNull();
    expect(experiment?.variants).toEqual([
      'experiment-auth-strategy-v1',
      'experiment-auth-strategy-v2',
    ]);
    expect(experiment?.winner).toBeNull();
  });

  it('compares variants with ahead/behind and diff metrics', async () => {
    await orchestrator.parallelSpawn({
      feature: 'cache-layer',
      count: 2,
      baseBranch: 'main',
    });

    const v1Path = path.join(tempRepo, '.worktrees', 'cache-layer-v1');
    fs.writeFileSync(path.join(v1Path, 'redis.ts'), 'export const redis = {};\n', 'utf-8');
    execSync('git add redis.ts && git commit -m "Add redis cache"', { cwd: v1Path });

    const compareRes = await orchestrator.parallelCompare('cache-layer');
    expect(compareRes.ok).toBe(true);
    expect(compareRes.result?.variants.length).toBe(2);

    const v1 = compareRes.result?.variants.find((v) => v.id === 'experiment-cache-layer-v1');
    expect(v1?.ahead_count).toBe(1);
    expect(v1?.files_changed).toBe(1);
    expect(v1?.lines_added).toBe(1);
  });

  it('picks winner without auto-merging and preserves losing variants by default', async () => {
    await orchestrator.parallelSpawn({
      feature: 'search-engine',
      count: 2,
      baseBranch: 'main',
    });

    const v1Path = path.join(tempRepo, '.worktrees', 'search-engine-v1');
    const v2Path = path.join(tempRepo, '.worktrees', 'search-engine-v2');

    const pickRes = await orchestrator.parallelPick({
      feature: 'search-engine',
      winner: 'v1',
      reason: 'Faster query execution',
    });

    expect(pickRes.ok).toBe(true);
    expect(pickRes.result?.winner).toBe('experiment-search-engine-v1');

    // Verify winner metadata
    const winnerRecord = await orchestrator.store.getWorktree('experiment-search-engine-v1');
    expect(winnerRecord?.parallel?.winner).toBe(true);

    const experiment = await orchestrator.store.getExperiment('search-engine');
    expect(experiment?.winner).toBe('experiment-search-engine-v1');
    expect(experiment?.selection_reason).toBe('Faster query execution');

    // Verify loser is preserved by default (no auto-delete)
    expect(fs.existsSync(v2Path)).toBe(true);
  });

  it('cleans losing variants only when explicitly requested with confirmation', async () => {
    await orchestrator.parallelSpawn({
      feature: 'router-impl',
      count: 2,
      baseBranch: 'main',
    });

    const v1Path = path.join(tempRepo, '.worktrees', 'router-impl-v1');
    const v2Path = path.join(tempRepo, '.worktrees', 'router-impl-v2');

    const pickRes = await orchestrator.parallelPick({
      feature: 'router-impl',
      winner: 'v1',
      cleanupLosers: true,
      yes: true,
    });

    expect(pickRes.ok).toBe(true);
    expect(pickRes.result?.cleaned_losers).toContain('experiment-router-impl-v2');

    // Verify winner exists, loser is cleaned
    expect(fs.existsSync(v1Path)).toBe(true);
    expect(fs.existsSync(v2Path)).toBe(false);
  });
});
