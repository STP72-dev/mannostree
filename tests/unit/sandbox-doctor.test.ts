import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { DoctorEngine } from '../../src/core/doctor.js';
import { GitEngine } from '../../src/git/engine.js';
import { MetadataStore } from '../../src/metadata/store.js';
import { loadConfig } from '../../src/config/loader.js';
import { SandboxRegistry } from '../../src/sandbox/base.js';
import { ProcessRuntime } from '../../src/sandbox/process.js';
import { DockerRuntime } from '../../src/sandbox/docker.js';
import { PodmanRuntime } from '../../src/sandbox/podman.js';

describe('Movement 8: Doctor Sandbox Diagnostics Audit', () => {
  let tmpDir: string;
  let doctor: DoctorEngine;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mannostree-sandbox-doctor-'));
    const config = loadConfig(undefined, tmpDir);
    const git = new GitEngine(tmpDir);
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

    const registry = new SandboxRegistry();
    registry.register(new ProcessRuntime());
    registry.register(
      new DockerRuntime(async (args) => {
        if (args[0] === '--version') return { stdout: 'Docker version 27.0.3', stderr: '' };
        if (args[0] === 'info') return { stdout: 'Server Version: 27.0.3\nCgroup Version: 2', stderr: '' };
        return { stdout: '', stderr: '' };
      })
    );
    registry.register(
      new PodmanRuntime(async (args) => {
        if (args[0] === '--version') return { stdout: 'podman version 5.1.2', stderr: '' };
        if (args[0] === 'info') return { stdout: 'rootless: true', stderr: '' };
        return { stdout: '', stderr: '' };
      })
    );

    doctor = new DoctorEngine(tmpDir, config, git, store, registry);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('audits all sandbox container runtimes and reports health diagnostics', async () => {
    const report = await doctor.diagnose();

    expect(report.sandbox_environments).toBeDefined();
    expect(report.sandbox_environments?.length).toBe(3);

    const proc = report.sandbox_environments?.find((e) => e.runtime === 'process');
    expect(proc?.available).toBe(true);

    const docker = report.sandbox_environments?.find((e) => e.runtime === 'docker');
    expect(docker?.available).toBe(true);
    expect(docker?.version).toContain('27.0.3');
    expect(docker?.daemon_running).toBe(true);

    const podman = report.sandbox_environments?.find((e) => e.runtime === 'podman');
    expect(podman?.available).toBe(true);
    expect(podman?.version).toContain('5.1.2');
    expect(podman?.rootless).toBe(true);
  });
});
