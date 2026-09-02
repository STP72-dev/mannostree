import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { DoctorEngine } from '../../src/core/doctor.js';
import { GitEngine } from '../../src/git/engine.js';
import { MetadataStore } from '../../src/metadata/store.js';
import { loadConfig } from '../../src/config/loader.js';

describe('Movement 7: Host Doctor Diagnostics', () => {
  let tmpDir: string;
  let doctor: DoctorEngine;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mannostree-doc-test-'));
    const config = loadConfig(undefined, tmpDir);
    const git = new GitEngine(tmpDir);
    const store = new MetadataStore(tmpDir, config);
    doctor = new DoctorEngine(tmpDir, config, git, store);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('audits all 5 default host adapters and returns health status', async () => {
    const statuses = await doctor.auditHostAdapters();
    expect(statuses.length).toBe(5);

    const types = statuses.map((s) => s.host_type);
    expect(types).toContain('github');
    expect(types).toContain('gitlab');
    expect(types).toContain('gitea');
    expect(types).toContain('bitbucket');
    expect(types).toContain('generic');

    const genericStatus = statuses.find((s) => s.host_type === 'generic');
    expect(genericStatus?.available).toBe(true);
  });

  it('includes host_adapters breakdown in full diagnose report', async () => {
    const config = loadConfig(undefined, tmpDir);
    const store = new MetadataStore(tmpDir, config);
    await store.saveRegistry({
      version: 1,
      repo_root: tmpDir,
      default_base_branch: 'main',
      worktree_root: '.worktrees',
      metadata_root: '.mannostree',
      artifact_dir_name: '.task',
      created_at: new Date().toISOString(),
      worktrees: [],
      experiments: [],
    });

    const report = await doctor.diagnose();
    expect(report.host_adapters).toBeDefined();
    expect(report.host_adapters?.length).toBe(5);
  });
});
