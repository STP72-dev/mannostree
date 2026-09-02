import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { DoctorEngine } from '../../src/core/doctor.js';
import { MetadataStore } from '../../src/metadata/store.js';
import { GitEngine } from '../../src/git/engine.js';
import { MannostreeConfigSchema } from '../../src/config/schema.js';

describe('DoctorEngine - Poly Audits', () => {
  let tempDir: string;
  let repo1Path: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mannostree-poly-doctor-test-'));
    repo1Path = path.join(tempDir, 'repo1');
    fs.mkdirSync(repo1Path, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('reports manifest not found when .mannostree.poly.yml is absent', async () => {
    const config = MannostreeConfigSchema.parse({});
    const store = new MetadataStore(tempDir, config);
    const git = new GitEngine(tempDir);
    const doctor = new DoctorEngine(tempDir, config, git, store);

    const report = await doctor.diagnose();
    expect(report.poly_repositories?.manifest_found).toBe(false);
  });

  it('audits member repository accessibility when manifest is present', async () => {
    const manifestPath = path.join(tempDir, '.mannostree.poly.yml');
    fs.writeFileSync(
      manifestPath,
      `
version: 1
name: test-cluster
repos:
  repo1:
    path: ./repo1
  missing_repo:
    path: ./non_existent_path
`,
      'utf-8'
    );

    const config = MannostreeConfigSchema.parse({});
    const store = new MetadataStore(tempDir, config);
    const git = new GitEngine(tempDir);
    const doctor = new DoctorEngine(tempDir, config, git, store);

    const report = await doctor.diagnose();
    expect(report.poly_repositories?.manifest_found).toBe(true);
    expect(report.poly_repositories?.total_repos).toBe(2);
    expect(report.poly_repositories?.accessible_repos).toBe(1);
    expect(report.poly_repositories?.details).toContain('1/2 member repositories accessible');
  });
});
