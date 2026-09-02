import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { PolyEngine } from '../../src/poly/engine.js';
import { MetadataStore } from '../../src/metadata/store.js';
import { MannostreeConfigSchema } from '../../src/config/schema.js';
import { GitEngine } from '../../src/git/engine.js';
import { MannostreeError, ExitCode } from '../../src/types/index.js';

describe('PolyEngine - Spawn', () => {
  let tempDir: string;
  let repo1Path: string;
  let repo2Path: string;
  let manifestPath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mannostree-poly-spawn-test-'));
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
    default_base_branch: main
  repo2:
    path: ./repo2
    default_base_branch: develop
`,
      'utf-8'
    );
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('spawns synchronized worktrees across all member repositories in dry-run mode', async () => {
    const config = MannostreeConfigSchema.parse({});
    const store = new MetadataStore(tempDir, config);
    const engine = new PolyEngine(config, store);

    const result = await engine.spawn({
      feature: 'checkout-flow',
      manifest: manifestPath,
      dryRun: true,
    });

    expect(result.feature).toBe('checkout-flow');
    expect(result.manifest_name).toBe('test-cluster');
    expect(Object.keys(result.members)).toEqual(['repo1', 'repo2']);
    expect(result.members.repo1.base_branch).toBe('main');
    expect(result.members.repo2.base_branch).toBe('develop');
  });

  it('atomically creates worktrees in each repository and stores registry record', async () => {
    const config = MannostreeConfigSchema.parse({});
    const store = new MetadataStore(tempDir, config);

    const createSpy = vi.spyOn(GitEngine.prototype, 'createBranchAndWorktree').mockResolvedValue(undefined as any);
    const headSpy = vi.spyOn(GitEngine.prototype, 'getHeadCommit').mockResolvedValue('abc12345');

    const engine = new PolyEngine(config, store);

    const result = await engine.spawn({
      feature: 'billing-v2',
      manifest: manifestPath,
    });

    expect(createSpy).toHaveBeenCalledTimes(2);

    const group = await store.getPolyGroup('billing-v2');
    expect(group).not.toBeNull();
    expect(group?.feature).toBe('billing-v2');
    expect(group?.members.repo1.head_sha).toBe('abc12345');

    createSpy.mockRestore();
    headSpy.mockRestore();
  });

  it('triggers rollback stack and cleans up previously created worktrees if one repository fails to spawn', async () => {
    const config = MannostreeConfigSchema.parse({});
    const store = new MetadataStore(tempDir, config);

    let calls = 0;
    const createSpy = vi.spyOn(GitEngine.prototype, 'createBranchAndWorktree').mockImplementation(() => {
      calls++;
      if (calls === 2) {
        return Promise.reject(new Error('Branch conflict in repo2'));
      }
      return Promise.resolve(undefined as any);
    });
    const deleteSpy = vi.spyOn(GitEngine.prototype, 'deleteWorktree').mockResolvedValue(undefined as any);
    const headSpy = vi.spyOn(GitEngine.prototype, 'getHeadCommit').mockResolvedValue('sha111');

    const engine = new PolyEngine(config, store);

    await expect(
      engine.spawn({
        feature: 'failing-feature',
        manifest: manifestPath,
      })
    ).rejects.toThrow('Atomic poly-spawn failed for feature \'failing-feature\'');

    expect(deleteSpy).toHaveBeenCalled();

    // Verify registry was not saved
    const group = await store.getPolyGroup('failing-feature');
    expect(group).toBeNull();

    createSpy.mockRestore();
    deleteSpy.mockRestore();
    headSpy.mockRestore();
  });
});

