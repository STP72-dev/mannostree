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

describe('FleetEngine Workspace Leases & Concurrency Protection (User Story 1)', () => {
  let tempRepo: string;
  let fleetEngine: FleetEngine;
  let orchestrator: MannostreeOrchestrator;
  let store: MetadataStore;
  let git: GitEngine;

  beforeEach(async () => {
    tempRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'mannostree-fleet-lease-unit-'));
    execSync('git init -b main', { cwd: tempRepo });
    execSync('git config user.name "Lease Tester"', { cwd: tempRepo });
    execSync('git config user.email "lease@example.com"', { cwd: tempRepo });
    fs.writeFileSync(path.join(tempRepo, 'README.md'), '# Lease Repo\n', 'utf-8');
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

  it('acquires, inspects, renews, and releases a workspace lease', async () => {
    // 1. Spawn workspace
    const wt = await orchestrator.spawn({ name: 'lease-test-wt' });
    const wtId = wt.result.id;
    expect(wtId).toBe('feature-lease-test-wt');

    // 2. Acquire lease
    const lease = await fleetEngine.acquireLease(wtId, {
      holder: 'agent-alice',
      ttl: '1h',
      purpose: 'Authentication migration test',
    });

    expect(lease.worktree_id).toBe(wtId);
    expect(lease.holder).toBe('agent-alice');
    expect(lease.status).toBe('active');
    expect(lease.ttl_seconds).toBe(3600);
    expect(new Date(lease.expires_at).getTime()).toBeGreaterThan(Date.now());

    // Verify stored lease
    const fetchedLease = await store.getLease(wtId);
    expect(fetchedLease).not.toBeNull();
    expect(fetchedLease?.holder).toBe('agent-alice');

    // 3. Reject concurrent lease by agent-bob
    await expect(
      fleetEngine.acquireLease(wtId, {
        holder: 'agent-bob',
        ttl: '30m',
        purpose: 'Competing run',
      })
    ).rejects.toThrow(/is currently leased by agent-alice/);

    // 4. Renew lease
    const renewed = await fleetEngine.renewLease(wtId, { ttl: '2h' });
    expect(renewed.renew_count).toBe(1);
    expect(renewed.ttl_seconds).toBe(7200);

    // 5. List active leases
    const activeLeases = await fleetEngine.listLeases({ activeOnly: true });
    expect(activeLeases.length).toBe(1);
    expect(activeLeases[0].holder).toBe('agent-alice');

    // 6. Release lease
    const released = await fleetEngine.releaseLease(wtId);
    expect(released.status).toBe('released');

    // 7. Now agent-bob can acquire
    const bobLease = await fleetEngine.acquireLease(wtId, {
      holder: 'agent-bob',
      ttl: '15m',
      purpose: 'Bob execution',
    });
    expect(bobLease.holder).toBe('agent-bob');
    expect(bobLease.status).toBe('active');
  });

  it('enforces lease guard interception against drop, archive, and sync without force', async () => {
    // 1. Spawn workspace
    const wt = await orchestrator.spawn({ name: 'guarded-wt' });
    const wtId = wt.result.id;

    // 2. Acquire active lease
    await fleetEngine.acquireLease(wtId, {
      holder: 'agent-charlie',
      ttl: '1h',
      purpose: 'Guarded operations',
    });

    // 3. Attempt drop without force -> REJECTED
    await expect(orchestrator.drop(wtId)).rejects.toThrow(
      /Cannot drop actively leased worktree 'feature-guarded-wt'/
    );

    // 4. Attempt archive without force -> REJECTED
    await expect(orchestrator.archive(wtId, { yes: true })).rejects.toThrow(
      /Cannot archive actively leased worktree 'feature-guarded-wt'/
    );

    // 5. Fleet sync safely skips leased worktree
    // Advance main
    fs.writeFileSync(path.join(tempRepo, 'README.md'), '# Advance main for sync test\n', 'utf-8');
    execSync('git add README.md && git commit -m "Main advance"', { cwd: tempRepo });

    const syncReport = await fleetEngine.syncFleet({ preview: false });
    expect(syncReport.skipped_count).toBe(1);
    expect(syncReport.worktrees[0].status).toBe('SESSION_ACTIVE_SKIPPED');

    // 6. Force release breaks lease
    const broken = await fleetEngine.releaseLease(wtId, { force: true });
    expect(broken.status).toBe('released');
  });

});
