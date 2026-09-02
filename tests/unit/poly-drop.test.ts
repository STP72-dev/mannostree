import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { PolyEngine } from '../../src/poly/engine.js';
import { MetadataStore } from '../../src/metadata/store.js';
import { MannostreeConfigSchema } from '../../src/config/schema.js';
import { GitEngine } from '../../src/git/engine.js';
import { MannostreeError } from '../../src/types/index.js';

describe('PolyEngine - Drop', () => {
  let tempDir: string;
  let repo1Path: string;
  let repo2Path: string;
  let manifestPath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mannostree-poly-drop-test-'));
    repo1Path = path.join(tempDir, 'repo1');
    repo2Path = path.join(tempDir, 'repo2');
    fs.mkdirSync(repo1Path, { recursive: true });
    fs.mkdirSync(repo2Path, { recursive: true });

    manifestPath = path.join(tempDir, '.mannostree.poly.yml');
    fs.writeFileSync(
      manifestPath,
      `
version: 1
name: test-cluster
repos:
  repo1:
    path: ./repo1
  repo2:
    path: ./repo2
`,
      'utf-8'
    );
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('rejects drop if member repository is dirty without --discard-uncommitted --yes', async () => {
    const config = MannostreeConfigSchema.parse({});
    const store = new MetadataStore(tempDir, config);

    // Save active poly group
    const wt1 = path.join(repo1Path, '.worktrees', 'feat-x');
    const wt2 = path.join(repo2Path, '.worktrees', 'feat-x');
    fs.mkdirSync(wt1, { recursive: true });
    fs.mkdirSync(wt2, { recursive: true });

    await store.savePolyGroup({
      version: 1,
      feature: 'feat-x',
      manifest_name: 'test-cluster',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      members: {
        repo1: {
          repo_name: 'repo1',
          repo_path: repo1Path,
          worktree_id: 'repo1-feat-x',
          worktree_path: wt1,
          branch: 'feat-x',
          base_branch: 'main',
          status: 'active',
        },
        repo2: {
          repo_name: 'repo2',
          repo_path: repo2Path,
          worktree_id: 'repo2-feat-x',
          worktree_path: wt2,
          branch: 'feat-x',
          base_branch: 'main',
          status: 'active',
        },
      },
      active_links: [],
      status: 'active',
    });

    const dirtySpy = vi.spyOn(GitEngine.prototype, 'isWorktreeDirty').mockImplementation((wtPath: string) => {
      if (wtPath === wt1) return Promise.resolve(true);
      return Promise.resolve(false);
    });

    const engine = new PolyEngine(config, store);

    await expect(
      engine.drop({
        feature: 'feat-x',
        manifest: manifestPath,
      })
    ).rejects.toThrow(MannostreeError);

    dirtySpy.mockRestore();
  });

  it('successfully drops clean poly worktrees and removes registry record', async () => {
    const config = MannostreeConfigSchema.parse({});
    const store = new MetadataStore(tempDir, config);

    const wt1 = path.join(repo1Path, '.worktrees', 'feat-clean');
    const wt2 = path.join(repo2Path, '.worktrees', 'feat-clean');
    fs.mkdirSync(wt1, { recursive: true });
    fs.mkdirSync(wt2, { recursive: true });

    await store.savePolyGroup({
      version: 1,
      feature: 'feat-clean',
      manifest_name: 'test-cluster',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      members: {
        repo1: {
          repo_name: 'repo1',
          repo_path: repo1Path,
          worktree_id: 'repo1-feat-clean',
          worktree_path: wt1,
          branch: 'feat-clean',
          base_branch: 'main',
          status: 'active',
        },
        repo2: {
          repo_name: 'repo2',
          repo_path: repo2Path,
          worktree_id: 'repo2-feat-clean',
          worktree_path: wt2,
          branch: 'feat-clean',
          base_branch: 'main',
          status: 'active',
        },
      },
      active_links: [],
      status: 'active',
    });

    const dirtySpy = vi.spyOn(GitEngine.prototype, 'isWorktreeDirty').mockResolvedValue(false);
    const deleteSpy = vi.spyOn(GitEngine.prototype, 'deleteWorktree').mockResolvedValue(undefined as any);

    const engine = new PolyEngine(config, store);

    const result = await engine.drop({
      feature: 'feat-clean',
      manifest: manifestPath,
    });

    expect(result.dropped).toEqual(['repo1', 'repo2']);
    expect(deleteSpy).toHaveBeenCalledTimes(2);

    const group = await store.getPolyGroup('feat-clean');
    expect(group).toBeNull();

    dirtySpy.mockRestore();
    deleteSpy.mockRestore();
  });
});

