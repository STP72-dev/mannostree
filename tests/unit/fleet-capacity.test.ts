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

describe('FleetEngine Quota & Capacity Dashboard (User Story 4)', () => {
  let tempRepo: string;
  let fleetEngine: FleetEngine;
  let orchestrator: MannostreeOrchestrator;
  let store: MetadataStore;
  let git: GitEngine;

  beforeEach(async () => {
    tempRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'mannostree-fleet-cap-unit-'));
    execSync('git init -b main', { cwd: tempRepo });
    execSync('git config user.name "Capacity Tester"', { cwd: tempRepo });
    execSync('git config user.email "cap@example.com"', { cwd: tempRepo });
    fs.writeFileSync(path.join(tempRepo, 'README.md'), '# Capacity Repo\n', 'utf-8');
    execSync('git add README.md && git commit -m "Init main"', { cwd: tempRepo });

    const config = loadConfig(undefined, tempRepo);
    config.fleet = {
      ...config.fleet,
      policy: {
        max_active_worktrees: 5,
        idle_ttl_hours: 24,
        hot_threshold_hours: 4,
        archive_dirty_policy: 'refuse',
        default_lease_ttl_minutes: 60,
      },
    };

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

  it('aggregates fleet quota, tier distribution, active leases, and candidates', async () => {
    // 1. Spawn 3 worktrees
    const wt1 = (await orchestrator.spawn({ name: 'cap-1' })).result.id;
    const wt2 = (await orchestrator.spawn({ name: 'cap-2' })).result.id;
    const wt3 = (await orchestrator.spawn({ name: 'cap-3' })).result.id;

    // Pin wt1
    await fleetEngine.pinWorktree(wt1);

    // Lease wt2
    await fleetEngine.acquireLease(wt2, { holder: 'engineer-dave', ttl: '1h', purpose: 'Refactoring' });

    // Set wt3 to warm and archive candidate (simulate idle)
    await fleetEngine.setTier(wt3, 'warm');
    const rec3 = (await store.getWorktree(wt3))!;
    rec3.last_accessed_at = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
    await store.saveWorktree(rec3);

    // 2. Fetch capacity report
    const report = await fleetEngine.getFleetCapacityReport();
    expect(report.total_worktrees).toBe(3);
    expect(report.max_capacity).toBe(5);
    expect(report.pinned_count).toBe(1);
    expect(report.hot_count).toBe(1); // wt2 is leased
    expect(report.warm_count).toBe(1); // wt3 is warm
    expect(report.active_leases.length).toBe(1);
    expect(report.active_leases[0].holder).toBe('engineer-dave');
    expect(report.archive_candidates.length).toBe(1);
    expect(report.archive_candidates[0].id).toBe(wt3);
    expect(report.total_disk_bytes).toBeGreaterThan(0);
  });
});
