import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { FleetEngine } from '../../src/core/fleet.js';
import { GitEngine } from '../../src/git/engine.js';
import { MetadataStore } from '../../src/metadata/store.js';
import { loadConfig } from '../../src/config/loader.js';
import { MannostreeOrchestrator } from '../../src/core/orchestrator.js';

describe('FleetEngine Workspace Lifecycle Tiering & Pinning (User Story 2)', () => {
  let tempRepo: string;
  let fleetEngine: FleetEngine;
  let orchestrator: MannostreeOrchestrator;
  let store: MetadataStore;
  let git: GitEngine;

  beforeEach(async () => {
    tempRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'mannostree-fleet-tier-unit-'));
    execSync('git init -b main', { cwd: tempRepo });
    execSync('git config user.name "Tier Tester"', { cwd: tempRepo });
    execSync('git config user.email "tier@example.com"', { cwd: tempRepo });
    fs.writeFileSync(path.join(tempRepo, 'README.md'), '# Tier Repo\n', 'utf-8');
    execSync('git add README.md && git commit -m "Init main"', { cwd: tempRepo });

    const config = loadConfig(undefined, tempRepo);
    git = new GitEngine(tempRepo);
    store = new MetadataStore(tempRepo, config);
    fleetEngine = new FleetEngine(tempRepo, config, git, store);
    orchestrator = new MannostreeOrchestrator(tempRepo, config);
  });

  afterEach(() => {
    try {
      execSync('git worktree prune', { cwd: tempRepo });
    } catch {}
    fs.rmSync(tempRepo, { recursive: true, force: true });
  });

  it('manages workspace tier transitions, pinning, unpinning, and effective tier computation', async () => {
    // 1. Spawn worktrees
    const wt1 = (await orchestrator.spawn({ name: 'wt-tier-1' })).result.id;
    const wt2 = (await orchestrator.spawn({ name: 'wt-tier-2' })).result.id;

    // 2. Initial effective tier for newly spawned worktree is hot (created recently)
    const record1 = await store.getWorktree(wt1);
    expect(record1).not.toBeNull();
    const effective1 = fleetEngine.getEffectiveTier(record1!);
    expect(effective1).toBe('hot');

    // 3. Pin worktree 1
    const pinnedRecord = await fleetEngine.pinWorktree(wt1);
    expect(pinnedRecord.pinned).toBe(true);
    expect(pinnedRecord.tier).toBe('pinned');
    expect(fleetEngine.getEffectiveTier(pinnedRecord)).toBe('pinned');

    // 4. Set explicit tier on worktree 2
    const setWarm = await fleetEngine.setTier(wt2, 'warm');
    expect(setWarm.tier).toBe('warm');
    expect(setWarm.pinned).toBe(false);

    // 5. Unpin worktree 1
    const unpinnedRecord = await fleetEngine.unpinWorktree(wt1);
    expect(unpinnedRecord.pinned).toBe(false);
    expect(unpinnedRecord.tier).toBe('warm');

    // 6. List all tiers
    const tiers = await fleetEngine.listTiers();
    expect(tiers.length).toBe(2);
    expect(tiers.find((t) => t.id === wt1)?.pinned).toBe(false);
    expect(tiers.find((t) => t.id === wt2)?.tier).toBe('warm');
  });

  it('computes effective cold tier for archived worktree and hot for leased worktree', async () => {
    const wt = (await orchestrator.spawn({ name: 'wt-cold' })).result.id;

    // Acquire active lease -> effective tier is hot
    await fleetEngine.acquireLease(wt, { holder: 'active-worker', ttl: '1h' });
    let rec = (await store.getWorktree(wt))!;
    let lease = await store.getLease(wt);
    expect(fleetEngine.getEffectiveTier(rec, lease)).toBe('hot');

    // Release lease
    await fleetEngine.releaseLease(wt);

    // Archive worktree -> effective tier is cold
    await orchestrator.archive(wt, { yes: true, force: true });
    rec = (await store.getWorktree(wt))!;
    expect(fleetEngine.getEffectiveTier(rec)).toBe('cold');
  });
});
