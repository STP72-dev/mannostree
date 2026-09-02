import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { AgentRunner } from '../../src/core/agent-runner.js';
import { MetadataStore } from '../../src/metadata/store.js';
import { loadConfig } from '../../src/config/loader.js';

describe('Movement 8: Sandboxed Agent Dispatch', () => {
  let tmpDir: string;
  let runner: AgentRunner;
  let store: MetadataStore;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mannostree-sandbox-agent-'));
    const config = loadConfig(undefined, tmpDir);
    store = new MetadataStore(tmpDir, config);
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

    const wtDir = path.join(tmpDir, '.worktrees', 'agent-wt');
    fs.mkdirSync(wtDir, { recursive: true });

    await store.saveWorktree({
      version: 1,
      id: 'agent-wt',
      repo_root: tmpDir,
      branch: 'feature/agent-wt',
      base_branch: 'main',
      worktree_path: '.worktrees/agent-wt',
      profile: 'default',
      status: 'active',
      created_at: new Date().toISOString(),
      lifecycle_state: 'WORKTREE_READY',
    });

    runner = new AgentRunner(tmpDir, store, config);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('records sandbox runtime and image on dispatched session in dry-run mode', async () => {
    const session = await runner.dispatchSession({
      target: 'agent-wt',
      role: 'worker',
      command: 'npm test',
      sandbox: 'docker',
      image: 'node:20-alpine',
      dryRun: true,
    });

    expect(session.sandbox).toBe('docker');
    expect(session.image).toBe('node:20-alpine');
    expect(session.state).toBe('dispatched');
  });

  it('persists sandbox metadata into session store on actual dispatch', async () => {
    const session = await runner.dispatchSession({
      target: 'agent-wt',
      role: 'planner',
      sandbox: 'docker',
      image: 'node:20-alpine',
    });

    expect(session.sandbox).toBe('docker');
    expect(session.image).toBe('node:20-alpine');

    const saved = await store.getSession(session.session_id);
    expect(saved?.sandbox).toBe('docker');
    expect(saved?.image).toBe('node:20-alpine');
  });
});
