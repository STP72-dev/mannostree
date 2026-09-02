import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { MannostreeOrchestrator } from '../../src/core/orchestrator.js';
import { loadConfig } from '../../src/config/loader.js';
import { GitEngine } from '../../src/git/engine.js';
import { MetadataStore } from '../../src/metadata/store.js';

const execFileAsync = promisify(execFile);

describe('Movement 7: Multi-Host CLI & Orchestrator Integration', () => {
  let testDir: string;
  let orchestrator: MannostreeOrchestrator;
  let git: GitEngine;

  beforeEach(async () => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mannostree-multi-host-cli-'));
    await execFileAsync('git', ['init', '-b', 'main'], { cwd: testDir });
    await execFileAsync('git', ['config', 'user.name', 'Test'], { cwd: testDir });
    await execFileAsync('git', ['config', 'user.email', 'test@example.com'], { cwd: testDir });

    fs.writeFileSync(path.join(testDir, 'README.md'), '# Main Repo\n');
    await execFileAsync('git', ['add', '.'], { cwd: testDir });
    await execFileAsync('git', ['commit', '-m', 'Initial commit'], { cwd: testDir });

    // Set a fake gitlab remote
    await execFileAsync('git', ['remote', 'add', 'origin', 'git@gitlab.com:enterprise/project.git'], {
      cwd: testDir,
    });

    const config = loadConfig(undefined, testDir);
    git = new GitEngine(testDir);
    orchestrator = new MannostreeOrchestrator(testDir, config);
    const store = new MetadataStore(testDir, config);
    await store.saveRegistry({
      version: 1,
      repo_root: testDir,
      default_base_branch: 'main',
      worktree_root: '.worktrees',
      metadata_root: '.mannostree',
      artifact_dir_name: '.task',
      created_at: new Date().toISOString(),
      worktrees: [],
      experiments: [],
    });
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('auto-detects GitLab remote host and prepares MR body in preview mode', async () => {
    const spawned = await orchestrator.spawn({
      name: 'gl-test',
      baseBranch: 'main',
      noSetup: true,
    });

    const res = await orchestrator.pr(spawned.result!.id, {
      title: 'feat: deliver gitlab feature',
      draft: true,
      push: false,
    });

    expect(res.ok).toBe(true);
    expect(res.result?.host_type).toBe('gitlab');
    expect(res.result?.mode).toBe('prepare-only');
    expect(res.result?.instructions).toContain('GitLab Merge Request');
  });

  it('allows explicit host override to Gitea in parallel publish preview', async () => {
    await orchestrator.parallelSpawn({
      feature: 'matrix-eval-feat',
      count: 2,
      baseBranch: 'main',
    });

    await orchestrator.parallelPick({
      feature: 'matrix-eval-feat',
      winner: 'v1',
      reason: 'Optimal performance score',
    });

    const res = await orchestrator.parallelPublish({
      featureName: 'matrix-eval-feat',
      host: 'gitea',
      preview: true,
    });

    expect(res.ok).toBe(true);
    expect(res.result?.feature_name).toBe('matrix-eval-feat');
    expect(res.result?.winner_variant).toContain('matrix-eval-feat-v1');
    expect(res.result?.pushed).toBe(false);
  });

  it('supports generic git remote fallback mode', async () => {
    const spawned = await orchestrator.spawn({
      name: 'generic-feat',
      baseBranch: 'main',
      noSetup: true,
    });

    const res = await orchestrator.pr(spawned.result!.id, {
      host: 'generic',
      push: false,
    });

    expect(res.ok).toBe(true);
    expect(res.result?.host_type).toBe('generic');
    expect(res.result?.mode).toBe('prepare-only');
  });
});
