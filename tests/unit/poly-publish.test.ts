import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { PolyPublishEngine } from '../../src/poly/publish.js';
import { MetadataStore } from '../../src/metadata/store.js';
import { MannostreeConfigSchema } from '../../src/config/schema.js';
import { GitEngine } from '../../src/git/engine.js';
import { AdapterRegistry } from '../../src/adapters/base.js';

describe('PolyPublishEngine', () => {
  let tempDir: string;
  let repo1Path: string;
  let repo2Path: string;
  let manifestPath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mannostree-poly-publish-test-'));
    repo1Path = path.join(tempDir, 'repo1');
    repo2Path = path.join(tempDir, 'repo2');
    fs.mkdirSync(path.join(repo1Path, '.worktrees', 'feat-pr'), { recursive: true });
    fs.mkdirSync(path.join(repo2Path, '.worktrees', 'feat-pr'), { recursive: true });

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
    default_base_branch: main
`,
      'utf-8'
    );
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('generates joint release manifest and markdown table in dry-run mode', async () => {
    const config = MannostreeConfigSchema.parse({});
    const store = new MetadataStore(tempDir, config);

    const headSpy = vi.spyOn(GitEngine.prototype, 'getHeadCommit').mockResolvedValue('c0ffee123456');

    const engine = new PolyPublishEngine(config, store);

    const manifest = await engine.publishPolyPR({
      feature: 'feat-pr',
      manifest: manifestPath,
      dryRun: true,
    });

    expect(manifest.feature).toBe('feat-pr');
    expect(manifest.members).toHaveLength(2);
    expect(manifest.joint_release_table_markdown).toContain('Coordinated Poly-Repository Feature');
    expect(manifest.joint_release_table_markdown).toContain('repo1');
    expect(manifest.joint_release_table_markdown).toContain('repo2');

    headSpy.mockRestore();
  });

  it('publishes PRs across all member repositories and saves poly-release record on disk', async () => {
    const config = MannostreeConfigSchema.parse({});
    const store = new MetadataStore(tempDir, config);

    const headSpy = vi.spyOn(GitEngine.prototype, 'getHeadCommit').mockResolvedValue('deadbeef9999');
    const execSpy = vi.spyOn(GitEngine.prototype, 'exec').mockResolvedValue({ stdout: 'https://github.com/myorg/repo.git\n', stderr: '' });

    const mockAdapter = {
      hostType: 'github' as const,
      createPullRequest: vi.fn().mockResolvedValue({
        host_type: 'github',
        mode: 'published',
        pr_number: 42,
        pr_url: 'https://github.com/myorg/repo/pull/42',
      }),
      checkHealth: vi.fn().mockResolvedValue({ host_type: 'github', available: true }),
    };

    const registry = new AdapterRegistry();
    registry.registerAdapter(mockAdapter as any);

    const engine = new PolyPublishEngine(config, store, undefined, registry);

    const result = await engine.publishPolyPR({
      feature: 'feat-pr',
      manifest: manifestPath,
      push: true,
    });

    expect(mockAdapter.createPullRequest).toHaveBeenCalledTimes(2);
    expect(result.members[0].pr_number).toBe(42);

    const savedRecord = await store.getPolyReleaseManifest('feat-pr');
    expect(savedRecord).not.toBeNull();
    expect(savedRecord?.feature).toBe('feat-pr');
    expect(savedRecord?.members[0].pr_url).toBe('https://github.com/myorg/repo/pull/42');

    headSpy.mockRestore();
    execSpy.mockRestore();
  });
});

