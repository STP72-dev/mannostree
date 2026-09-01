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

describe('FleetEngine Auto-Archive Policy Engine (User Story 3)', () => {
  let tempRepo: string;
  let fleetEngine: FleetEngine;
  let orchestrator: MannostreeOrchestrator;
  let store: MetadataStore;
  let git: GitEngine;

  beforeEach(async () => {
    tempRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'mannostree-fleet-archive-unit-'));
    execSync('git init -b main', { cwd: tempRepo });
    execSync('git config user.name "Archive Tester"', { cwd: tempRepo });
    execSync('git config user.email "archive@example.com"', { cwd: tempRepo });
    fs.writeFileSync(path.join(tempRepo, 'README.md'), '# Auto-Archive Repo\n', 'utf-8');
    execSync('git add README.md && git commit -m "Init main"', { cwd: tempRepo });

    const config = loadConfig(undefined, tempRepo);
    // Configure zero quota and zero idle TTL for testing
    config.fleet = {
      ...config.fleet,
      policy: {
        max_active_worktrees: 0,
        idle_ttl_hours: 0,
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

  it('respects safety guards: skips pinned, leased, and dirty worktrees', async () => {
    // 1. Spawn three worktrees
    const wtPinned = (await orchestrator.spawn({ name: 'wt-pinned' })).result.id;
    const wtLeased = (await orchestrator.spawn({ name: 'wt-leased' })).result.id;
    const wtIdle = (await orchestrator.spawn({ name: 'wt-idle' })).result.id;

    // Pin wtPinned
    await fleetEngine.pinWorktree(wtPinned);

    // Lease wtLeased
    await fleetEngine.acquireLease(wtLeased, { holder: 'lease-holder', ttl: '2h' });

    // Preview auto-archive with --force
    const previewReport = await fleetEngine.autoArchive({ preview: true, force: true });
    expect(previewReport.dry_run).toBe(true);
    expect(previewReport.total_evaluated).toBe(3);
    expect(previewReport.archived_count).toBe(1);
    expect(previewReport.archived_worktrees[0].id).toBe(wtIdle);
    expect(previewReport.skipped_count).toBe(2);

    const skippedPinned = previewReport.skipped_worktrees.find((s) => s.id === wtPinned);
    expect(skippedPinned?.reason).toContain('Worktree is pinned');

    const skippedLeased = previewReport.skipped_worktrees.find((s) => s.id === wtLeased);
    expect(skippedLeased?.reason).toContain('Active lease held by lease-holder');

    // Confirm execution with yes: true
    const execReport = await fleetEngine.autoArchive({ yes: true, force: true });
    expect(execReport.dry_run).toBe(false);
    expect(execReport.archived_count).toBe(1);

    // Verify metadata and disk for wtIdle
    const idleRec = await store.getWorktree(wtIdle);
    expect(idleRec?.status).toBe('archived');
    expect(idleRec?.tier).toBe('cold');
    expect(idleRec?.lifecycle_state).toBe('CLEANED');

    const idlePath = path.resolve(tempRepo, idleRec!.worktree_path);
    expect(fs.existsSync(idlePath)).toBe(false);
  });
});
