import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { MetadataStore } from '../../src/metadata/store.js';
import { GitEngine } from '../../src/git/engine.js';
import { PublishEngine } from '../../src/core/publish.js';
import { FleetEngine } from '../../src/core/fleet.js';
import { WorktreeRecord } from '../../src/types/index.js';

describe('Movement 5: Fleet Batch Publishing', () => {
  let tmpDir: string;
  let store: MetadataStore;
  let git: GitEngine;
  let publishEngine: PublishEngine;
  let fleetEngine: FleetEngine;

  const sampleConfig: any = {
    version: 1,
    default_base_branch: 'main',
    worktree_root: '.worktrees',
    metadata_root: '.mannostree',
    artifact_dir_name: '.task',
    journal_dir_name: 'journal',
    archive_dir_name: 'archives',
    sessions_dir_name: 'sessions',
    leases_dir_name: 'leases',
    releases_dir_name: 'releases',
    publish: {
      default_remote: 'origin',
      default_draft: true,
      push_on_pr_create: false,
    },
    fleet: {
      policy: {
        max_active_worktrees: 10,
        idle_ttl_hours: 48,
      },
    },
  };

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mannostree-fleet-pub-'));
    fs.mkdirSync(path.join(tmpDir, '.mannostree'), { recursive: true });
    store = new MetadataStore(tmpDir, sampleConfig);
    git = new GitEngine(tmpDir);

    git.isWorktreeDirty = async () => false;
    git.exec = async () => ({ stdout: '', stderr: '' });

    publishEngine = new PublishEngine(tmpDir, sampleConfig, git, async () => {
      return { stdout: 'https://github.com/org/repo/pull/77', stderr: '' };
    });

    fleetEngine = new FleetEngine(tmpDir, sampleConfig, git, store);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('batch publishes eligible worktrees and releases concurrency leases', async () => {
    const wt1Dir = path.join(tmpDir, '.worktrees', 'wt1');
    const wt2Dir = path.join(tmpDir, '.worktrees', 'wt2');
    fs.mkdirSync(path.join(wt1Dir, '.task'), { recursive: true });
    fs.mkdirSync(path.join(wt2Dir, '.task'), { recursive: true });

    const wt1: WorktreeRecord = {
      id: 'feature-wt1',
      repo_root: tmpDir,
      branch: 'feature/wt1',
      base_branch: 'main',
      worktree_path: '.worktrees/wt1',
      status: 'ready_for_pr',
      lifecycle_state: 'VERIFIED',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const wt2: WorktreeRecord = {
      id: 'feature-wt2',
      repo_root: tmpDir,
      branch: 'feature/wt2',
      base_branch: 'main',
      worktree_path: '.worktrees/wt2',
      status: 'ready_for_pr',
      lifecycle_state: 'VERIFIED',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await store.saveWorktree(wt1);
    await store.saveWorktree(wt2);

    // Acquire lease on wt1
    await fleetEngine.acquireLease('feature-wt1', { holder: 'Agent-X', ttl: '1h' });
    const leaseBefore = await fleetEngine.hasActiveLease('feature-wt1');
    expect(leaseBefore.active).toBe(true);

    const report = await publishEngine.batchPublish(
      { all: true, push: true, draft: true },
      store,
      fleetEngine
    );

    expect(report.total_targeted).toBe(2);
    expect(report.published_count).toBe(2);
    expect(report.failed_count).toBe(0);

    // Verify lease on wt1 was released
    const leaseAfter = await fleetEngine.hasActiveLease('feature-wt1');
    expect(leaseAfter.active).toBe(false);
  });
});
