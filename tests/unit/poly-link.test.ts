import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { PolyLinkEngine } from '../../src/poly/link.js';
import { MetadataStore } from '../../src/metadata/store.js';
import { MannostreeConfigSchema } from '../../src/config/schema.js';
import { PolyManifestConfig, PolyWorktreeMemberInstance } from '../../src/types/index.js';

describe('PolyLinkEngine', () => {
  let tempDir: string;
  let sourcePath: string;
  let targetPath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mannostree-poly-link-test-'));
    sourcePath = path.join(tempDir, 'types-wt');
    targetPath = path.join(tempDir, 'web-wt');
    fs.mkdirSync(sourcePath, { recursive: true });
    fs.mkdirSync(targetPath, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('establishes and unlinks npm symlink package in target worktree node_modules', async () => {
    const config = MannostreeConfigSchema.parse({});
    const store = new MetadataStore(tempDir, config);
    const linkEngine = new PolyLinkEngine(store);

    const manifest: PolyManifestConfig = {
      version: 1,
      name: 'test-cluster',
      repos: {
        types: { path: './types' },
        web: { path: './web' },
      },
      links: [
        {
          source_repo: 'types',
          target_repo: 'web',
          strategy: 'npm',
          package_name: '@corp/types',
        },
      ],
    };

    const members: Record<string, PolyWorktreeMemberInstance> = {
      types: {
        repo_name: 'types',
        repo_path: path.join(tempDir, 'types'),
        worktree_id: 'types-f1',
        worktree_path: sourcePath,
        branch: 'f1',
        base_branch: 'main',
        status: 'active',
      },
      web: {
        repo_name: 'web',
        repo_path: path.join(tempDir, 'web'),
        worktree_id: 'web-f1',
        worktree_path: targetPath,
        branch: 'f1',
        base_branch: 'main',
        status: 'active',
      },
    };

    const links = await linkEngine.linkGroup('f1', manifest, members);
    expect(links.length).toBe(1);
    expect(links[0].status).toBe('linked');

    const expectedSymlink = path.join(targetPath, 'node_modules', '@corp/types');
    expect(fs.existsSync(expectedSymlink)).toBe(true);

    const linksFile = await store.getPolyLinks();
    expect(linksFile.links.f1).toHaveLength(1);

    // Unlink
    await linkEngine.unlinkGroup('f1');
    expect(fs.existsSync(expectedSymlink)).toBe(false);
    const updatedLinks = await store.getPolyLinks();
    expect(updatedLinks.links.f1).toBeUndefined();
  });

  it('creates python .pth editable link file and removes it on unlink', async () => {
    const config = MannostreeConfigSchema.parse({});
    const store = new MetadataStore(tempDir, config);
    const linkEngine = new PolyLinkEngine(store);

    const manifest: PolyManifestConfig = {
      version: 1,
      name: 'py-cluster',
      repos: {
        core: { path: './core' },
        service: { path: './service' },
      },
      links: [
        {
          source_repo: 'core',
          target_repo: 'service',
          strategy: 'python',
        },
      ],
    };

    const members: Record<string, PolyWorktreeMemberInstance> = {
      core: {
        repo_name: 'core',
        repo_path: path.join(tempDir, 'core'),
        worktree_id: 'core-f2',
        worktree_path: sourcePath,
        branch: 'f2',
        base_branch: 'main',
        status: 'active',
      },
      service: {
        repo_name: 'service',
        repo_path: path.join(tempDir, 'service'),
        worktree_id: 'service-f2',
        worktree_path: targetPath,
        branch: 'f2',
        base_branch: 'main',
        status: 'active',
      },
    };

    await linkEngine.linkGroup('f2', manifest, members);
    const pthFile = path.join(targetPath, `.mannostree_${path.basename(sourcePath)}.pth`);
    expect(fs.existsSync(pthFile)).toBe(true);
    expect(fs.readFileSync(pthFile, 'utf-8')).toContain(sourcePath);

    await linkEngine.unlinkGroup('f2');
    expect(fs.existsSync(pthFile)).toBe(false);
  });
});
