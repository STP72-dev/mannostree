import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { MetadataStore } from '../../src/metadata/store.js';
import { GitEngine } from '../../src/git/engine.js';
import { FleetEngine } from '../../src/core/fleet.js';
import { WorktreeRecord } from '../../src/types/index.js';

describe('Movement 5: Fleet Multi-Branch Merge-Sync Engine', () => {
  let tmpDir: string;
  let store: MetadataStore;
  let git: GitEngine;
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
    fleet: {
      default_sync_strategy: 'ff-only',
      policy: {
        max_active_worktrees: 10,
        idle_ttl_hours: 48,
      },
    },
  };

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mannostree-fleet-ms-'));
    fs.mkdirSync(path.join(tmpDir, '.mannostree'), { recursive: true });
    store = new MetadataStore(tmpDir, sampleConfig);
    git = new GitEngine(tmpDir);

    // Mock simulateMergeTree
    git.simulateMergeTree = async (base: string, branch: string) => {
      if (branch.includes('conflict')) {
        return {
          clean: false,
          conflicts: [{ file: 'src/conflicting.ts', detail: 'both modified' }],
          rawOutput: 'conflict in src/conflicting.ts',
        };
      }
      return { clean: true, conflicts: [], rawOutput: '' };
    };

    git.branchOrRefExists = async (ref: string) => ref === 'main' || ref === 'staging';
    git.getHeadCommit = async () => 'c0ffee1';
    git.exec = async () => ({ stdout: '', stderr: '' });

    fleetEngine = new FleetEngine(tmpDir, sampleConfig, git, store);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('runs pre-flight merge simulation and identifies conflict blockers in candidate branches', async () => {
    const wtClean: WorktreeRecord = {
      id: 'feature-clean',
      repo_root: tmpDir,
      branch: 'feature/clean',
      base_branch: 'main',
      worktree_path: '.worktrees/clean',
      status: 'implemented',
      lifecycle_state: 'IMPLEMENTED',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const wtConflict: WorktreeRecord = {
      id: 'feature-conflict',
      repo_root: tmpDir,
      branch: 'feature/conflict',
      base_branch: 'main',
      worktree_path: '.worktrees/conflict',
      status: 'implemented',
      lifecycle_state: 'IMPLEMENTED',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await store.saveWorktree(wtClean);
    await store.saveWorktree(wtConflict);

    const report = await fleetEngine.mergeSync({
      target: 'staging',
      preview: true,
    });

    expect(report.total_candidates).toBe(2);
    expect(report.clean_count).toBe(1);
    expect(report.conflict_count).toBe(1);
    expect(report.dry_run).toBe(true);

    const cleanCand = report.candidates.find((c) => c.worktree_id === 'feature-clean');
    expect(cleanCand?.can_merge_cleanly).toBe(true);
    expect(cleanCand?.status).toBe('READY');

    const conflictCand = report.candidates.find((c) => c.worktree_id === 'feature-conflict');
    expect(conflictCand?.can_merge_cleanly).toBe(false);
    expect(conflictCand?.status).toBe('CONFLICT_BLOCKED');
    expect(conflictCand?.conflicting_files).toContain('src/conflicting.ts');
  });

  it('assembles clean candidate branches and persists release manifest when confirmed', async () => {
    const wtClean1: WorktreeRecord = {
      id: 'feature-one',
      repo_root: tmpDir,
      branch: 'feature/one',
      base_branch: 'main',
      worktree_path: '.worktrees/one',
      status: 'implemented',
      lifecycle_state: 'IMPLEMENTED',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const wtClean2: WorktreeRecord = {
      id: 'feature-two',
      repo_root: tmpDir,
      branch: 'feature/two',
      base_branch: 'main',
      worktree_path: '.worktrees/two',
      status: 'implemented',
      lifecycle_state: 'IMPLEMENTED',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await store.saveWorktree(wtClean1);
    await store.saveWorktree(wtClean2);

    const report = await fleetEngine.mergeSync({
      target: 'staging',
      yes: true,
    });

    expect(report.clean_count).toBe(2);
    expect(report.conflict_count).toBe(0);
    expect(report.integrated_count).toBe(2);
    expect(report.dry_run).toBe(false);
    expect(report.release_manifest_path).toBeDefined();

    const manifest = await store.getReleaseManifest('staging');
    expect(manifest).not.toBeNull();
    expect(manifest?.target_branch).toBe('staging');
    expect(manifest?.integrated_worktrees.length).toBe(2);
  });
});
