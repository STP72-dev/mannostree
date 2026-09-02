import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { loadPolyManifest, findPolyManifest } from '../../src/poly/manifest.js';
import { MannostreeError } from '../../src/types/index.js';

describe('PolyManifest', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mannostree-poly-manifest-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('parses valid .mannostree.poly.yml manifest file', () => {
    const manifestPath = path.join(tempDir, '.mannostree.poly.yml');
    const content = `
version: 1
name: my-cluster
repos:
  api:
    path: ./services/api
    default_base_branch: main
    role: backend
  web:
    path: ./apps/web
    default_base_branch: develop
    role: frontend
    depends_on:
      - types
  types:
    path: ./packages/types
    default_base_branch: main
    role: lib
links:
  - source_repo: types
    target_repo: web
    strategy: npm
    package_name: "@corp/types"
`;
    fs.writeFileSync(manifestPath, content, 'utf-8');

    const result = loadPolyManifest(undefined, tempDir);
    expect(result.manifest.name).toBe('my-cluster');
    expect(result.manifest.version).toBe(1);
    expect(Object.keys(result.manifest.repos)).toEqual(['api', 'web', 'types']);
    expect(result.manifest.repos.web.depends_on).toEqual(['types']);
    expect(result.manifest.links?.[0].package_name).toBe('@corp/types');
    expect(result.manifestPath).toBe(manifestPath);
  });

  it('throws MannostreeError when manifest is missing', () => {
    expect(() => loadPolyManifest(undefined, tempDir)).toThrow(MannostreeError);
  });

  it('throws MannostreeError on invalid yaml syntax or schema violation', () => {
    const manifestPath = path.join(tempDir, '.mannostree.poly.yml');
    fs.writeFileSync(manifestPath, 'version: "invalid-number"\nname: 12345', 'utf-8');

    expect(() => loadPolyManifest(manifestPath, tempDir)).toThrow(MannostreeError);
  });
});
