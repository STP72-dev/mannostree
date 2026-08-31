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

  it('lists parallel experiments and filters by status', async () => {
    await orchestrator.parallelSpawn({
      feature: 'feature-a',
      count: 2,
      baseBranch: 'main',
    });

    await orchestrator.parallelSpawn({
      feature: 'feature-b',
      count: 2,
      baseBranch: 'main',
    });

    await orchestrator.parallelPick({
      feature: 'feature-a',
      winner: 'v1',
    });

    const allList = await orchestrator.parallelList();
    expect(allList.ok).toBe(true);
    expect(allList.result?.length).toBe(2);

    const activeList = await orchestrator.parallelList('active');
    expect(activeList.result?.length).toBe(1);
    expect(activeList.result?.[0].feature).toBe('feature-b');

    const completedList = await orchestrator.parallelList('completed');
    expect(completedList.result?.length).toBe(1);
    expect(completedList.result?.[0].feature).toBe('feature-a');
  });

  it('drops entire parallel experiment group with confirmation', async () => {
    await orchestrator.parallelSpawn({
      feature: 'drop-test',
      count: 2,
      baseBranch: 'main',
    });

    const v1Path = path.join(tempRepo, '.worktrees', 'drop-test-v1');
    const v2Path = path.join(tempRepo, '.worktrees', 'drop-test-v2');
    expect(fs.existsSync(v1Path)).toBe(true);
    expect(fs.existsSync(v2Path)).toBe(true);

    // Preview without yes: dry_run is true
    const previewRes = await orchestrator.parallelDrop({
      feature: 'drop-test',
      yes: false,
    });
    expect(previewRes.ok).toBe(true);
    expect(previewRes.dry_run).toBe(true);
    expect(previewRes.result?.experiment_deleted).toBe(false);
    expect(fs.existsSync(v1Path)).toBe(true);

    // Drop with yes
    const dropRes = await orchestrator.parallelDrop({
      feature: 'drop-test',
      yes: true,
      force: true,
    });
    expect(dropRes.ok).toBe(true);
    expect(dropRes.dry_run).toBe(false);
    expect(dropRes.result?.experiment_deleted).toBe(true);
    expect(fs.existsSync(v1Path)).toBe(false);
    expect(fs.existsSync(v2Path)).toBe(false);

    const checkExp = await orchestrator.store.getExperiment('drop-test');
    expect(checkExp).toBeNull();
  });

  it('protects winner variant during parallel drop unless force is specified', async () => {
    await orchestrator.parallelSpawn({
      feature: 'winner-protect',
      count: 2,
      baseBranch: 'main',
    });

    const v1Path = path.join(tempRepo, '.worktrees', 'winner-protect-v1');
    const v2Path = path.join(tempRepo, '.worktrees', 'winner-protect-v2');

    // Clean worktrees by committing scaffold files
    execSync('git add . && git commit -m "Scaffold files"', { cwd: v1Path });
    execSync('git add . && git commit -m "Scaffold files"', { cwd: v2Path });

    // Pick v1 as winner
    await orchestrator.parallelPick({
      feature: 'winner-protect',
      winner: 'v1',
    });

    // Drop without force: v2 should be dropped, v1 (winner) protected
    const dropRes = await orchestrator.parallelDrop({
      feature: 'winner-protect',
      yes: true,
      force: false,
    });

    expect(dropRes.ok).toBe(true);
    expect(dropRes.result?.winner_protected).toBe('experiment-winner-protect-v1');
    expect(dropRes.result?.dropped_variants).toContain('experiment-winner-protect-v2');
    expect(dropRes.result?.surviving_variants).toContain('experiment-winner-protect-v1');
    expect(dropRes.result?.experiment_deleted).toBe(false);

    expect(fs.existsSync(v1Path)).toBe(true);
    expect(fs.existsSync(v2Path)).toBe(false);

    // Experiment record should still exist and list v1 as sole surviving variant
    const exp = await orchestrator.store.getExperiment('winner-protect');
    expect(exp).not.toBeNull();
    expect(exp?.variants).toEqual(['experiment-winner-protect-v1']);

    // Now drop with force: should drop winner and delete experiment record
    const forceDropRes = await orchestrator.parallelDrop({
      feature: 'winner-protect',
      yes: true,
      force: true,
    });

    expect(forceDropRes.ok).toBe(true);
    expect(forceDropRes.result?.experiment_deleted).toBe(true);
    expect(fs.existsSync(v1Path)).toBe(false);

    const checkExp = await orchestrator.store.getExperiment('winner-protect');
    expect(checkExp).toBeNull();
  });

  it('handles partial drop failure on dirty variant without deleting experiment record', async () => {
    await orchestrator.parallelSpawn({
      feature: 'dirty-fail-test',
      count: 2,
      baseBranch: 'main',
    });

    const v1Path = path.join(tempRepo, '.worktrees', 'dirty-fail-test-v1');
    const v2Path = path.join(tempRepo, '.worktrees', 'dirty-fail-test-v2');

    // Clean v1 by committing scaffold files
    execSync('git add . && git commit -m "Scaffold files"', { cwd: v1Path });

    // Make v2 dirty by adding uncommitted change
    fs.writeFileSync(path.join(v2Path, 'dirty.txt'), 'uncommitted content\n', 'utf-8');

    // Drop without force
    const dropRes = await orchestrator.parallelDrop({
      feature: 'dirty-fail-test',
      yes: true,
      force: false,
    });

    // Should report partial failure
    expect(dropRes.ok).toBe(false);
    expect(dropRes.result?.dropped_variants).toContain('experiment-dirty-fail-test-v1');
    expect(dropRes.result?.failed_variants.length).toBe(1);
    expect(dropRes.result?.failed_variants[0].id).toBe('experiment-dirty-fail-test-v2');
    expect(dropRes.result?.surviving_variants).toContain('experiment-dirty-fail-test-v2');
    expect(dropRes.result?.experiment_deleted).toBe(false);

    // v1 is gone, v2 remains
    expect(fs.existsSync(v1Path)).toBe(false);
    expect(fs.existsSync(v2Path)).toBe(true);

    // Experiment record should still exist with surviving v2
    const exp = await orchestrator.store.getExperiment('dirty-fail-test');
    expect(exp).not.toBeNull();
    expect(exp?.variants).toEqual(['experiment-dirty-fail-test-v2']);
  });
});
