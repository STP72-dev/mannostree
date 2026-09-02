import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { PolyEngine } from '../../src/poly/engine.js';
import { MetadataStore } from '../../src/metadata/store.js';
import { MannostreeConfigSchema } from '../../src/config/schema.js';
import { GitEngine } from '../../src/git/engine.js';

describe('PolyEngine - Sync, Status & Exec', () => {
  let tempDir: string;
  let repo1Path: string;
  let repo2Path: string;
  let manifestPath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mannostree-poly-sync-test-'));
    repo1Path = path.join(tempDir, 'repo1');
    repo2Path = path.join(tempDir, 'repo2');
    fs.mkdirSync(path.join(repo1Path, '.worktrees', 'feat-sync'), { recursive: true });
    fs.mkdirSync(path.join(repo2Path, '.worktrees', 'feat-sync'), { recursive: true });

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

  it('performs poly sync across all member worktrees with configured rebase strategy', async () => {
    const config = MannostreeConfigSchema.parse({});
    const store = new MetadataStore(tempDir, config);

    const fetchSpy = vi.spyOn(GitEngine.prototype, 'fetchAll').mockResolvedValue(undefined);
    const syncSpy = vi.spyOn(GitEngine.prototype, 'syncWorktree').mockResolvedValue(undefined as any);

    const engine = new PolyEngine(config, store);

    const result = await engine.sync({
      feature: 'feat-sync',
      manifest: manifestPath,
      strategy: 'rebase',
    });

    expect(result.synced).toEqual(['repo1', 'repo2']);
    expect(syncSpy).toHaveBeenCalledTimes(2);

    fetchSpy.mockRestore();
    syncSpy.mockRestore();
  });

  it('computes composite status matrix across all member worktrees', async () => {
    const config = MannostreeConfigSchema.parse({});
    const store = new MetadataStore(tempDir, config);

    const dirtySpy = vi.spyOn(GitEngine.prototype, 'isWorktreeDirty').mockImplementation((p: string) => Promise.resolve(p.includes('repo1')));
    const abSpy = vi.spyOn(GitEngine.prototype, 'getAheadBehindCount').mockResolvedValue({ ahead: 2, behind: 0 });
    const headSpy = vi.spyOn(GitEngine.prototype, 'getHeadCommit').mockResolvedValue('sha-test-123');

    const engine = new PolyEngine(config, store);

    const status = await engine.getStatus({
      feature: 'feat-sync',
      manifest: manifestPath,
    });

    expect(status.feature).toBe('feat-sync');
    expect(status.manifest_name).toBe('test-cluster');
    expect(status.members).toHaveLength(2);
    expect(status.members[0].dirty).toBe(true);
    expect(status.members[0].status).toBe('dirty');
    expect(status.members[1].dirty).toBe(false);
    expect(status.members[1].status).toBe('clean');

    dirtySpy.mockRestore();
    abSpy.mockRestore();
    headSpy.mockRestore();
  });

  it('executes command across member worktrees sequentially or in parallel', async () => {
    const config = MannostreeConfigSchema.parse({});
    const store = new MetadataStore(tempDir, config);

    const engine = new PolyEngine(config, store);

    const results = await engine.exec({
      feature: 'feat-sync',
      command: 'echo "hello poly"',
      manifest: manifestPath,
      parallel: true,
    });

    expect(Object.keys(results).sort()).toEqual(['repo1', 'repo2']);
    expect(results.repo1.exitCode).toBe(0);
    expect(results.repo1.stdout).toContain('hello poly');
    expect(results.repo2.exitCode).toBe(0);
    expect(results.repo2.stdout).toContain('hello poly');
  });
});

