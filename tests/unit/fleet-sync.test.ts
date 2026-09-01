import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { FleetEngine } from '../../src/core/fleet.js';
import { GitEngine } from '../../src/git/engine.js';
import { MetadataStore } from '../../src/metadata/store.js';
import { loadConfig } from '../../src/config/loader.js';
import { AgentSessionRecord, WorktreeRecord } from '../../src/types/index.js';

describe('FleetEngine Fleet Sync Unit Tests', () => {
  let tempRepo: string;
  let fleetEngine: FleetEngine;
  let store: MetadataStore;
  let git: GitEngine;

  beforeEach(async () => {
    tempRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'mannostree-fleet-sync-unit-'));
    execSync('git init -b main', { cwd: tempRepo });
    execSync('git config user.name "Fleet Tester"', { cwd: tempRepo });
    execSync('git config user.email "fleet@example.com"', { cwd: tempRepo });
    fs.writeFileSync(path.join(tempRepo, 'README.md'), '# Fleet Repo\n', 'utf-8');
    execSync('git add README.md && git commit -m "Init main"', { cwd: tempRepo });

    const config = loadConfig(undefined, tempRepo);
    git = new GitEngine(tempRepo);
    store = new MetadataStore(tempRepo, config);
    fleetEngine = new FleetEngine(tempRepo, config, git, store);
  });

  afterEach(() => {
    try {
      execSync('git worktree prune', { cwd: tempRepo });
    } catch {}
    fs.rmSync(tempRepo, { recursive: true, force: true });
  });

  it('detects behind divergence and previews fleet sync without modifying branches', async () => {
    // 1. Create worktree wt1
    const wtPath = path.join(tempRepo, '.worktrees', 'feat-1');
    execSync(`git worktree add -b feature/feat-1 "${wtPath}" main`, { cwd: tempRepo });

    const rec: WorktreeRecord = {
      version: 1,
      id: 'feat-1',
      repo_root: tempRepo,
      branch: 'feature/feat-1',
      base_branch: 'main',
      kind: 'feature',
      profile: 'default',
      worktree_path: '.worktrees/feat-1',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: 'active',
      tags: [],
      lifecycle_state: 'WORKTREE_READY',
    };
    await store.saveWorktree(rec);

    // 2. Advance main
    fs.writeFileSync(path.join(tempRepo, 'README.md'), '# Fleet Repo Updated\n', 'utf-8');
    execSync('git add README.md && git commit -m "Main update"', { cwd: tempRepo });

    // 3. Preview fleet sync
    const report = await fleetEngine.syncFleet({ preview: true });
    expect(report.total_worktrees).toBe(1);
    expect(report.worktrees[0].status).toBe('BEHIND');
    expect(report.worktrees[0].behind).toBe(1);
    expect(report.dry_run).toBe(true);
  });

  it('safely skips dirty worktrees during fleet sync', async () => {
    const wtPath = path.join(tempRepo, '.worktrees', 'feat-dirty');
    execSync(`git worktree add -b feature/feat-dirty "${wtPath}" main`, { cwd: tempRepo });

    const rec: WorktreeRecord = {
      version: 1,
      id: 'feat-dirty',
      repo_root: tempRepo,
      branch: 'feature/feat-dirty',
      base_branch: 'main',
      kind: 'feature',
      profile: 'default',
      worktree_path: '.worktrees/feat-dirty',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: 'active',
      tags: [],
      lifecycle_state: 'WORKTREE_READY',
    };
    await store.saveWorktree(rec);

    // Advance main
    fs.writeFileSync(path.join(tempRepo, 'README.md'), '# Advance main\n', 'utf-8');
    execSync('git add README.md && git commit -m "Advance"', { cwd: tempRepo });

    // Make worktree dirty
    fs.writeFileSync(path.join(wtPath, 'dirty.txt'), 'uncommitted work\n', 'utf-8');

    const report = await fleetEngine.syncFleet({ preview: false });
    expect(report.skipped_count).toBe(1);
    expect(report.worktrees[0].status).toBe('DIRTY_SKIPPED');
    expect(report.worktrees[0].dirty).toBe(true);
  });

  it('safely skips worktrees with active agent sessions', async () => {
    const wtPath = path.join(tempRepo, '.worktrees', 'feat-agent');
    execSync(`git worktree add -b feature/feat-agent "${wtPath}" main`, { cwd: tempRepo });

    const rec: WorktreeRecord = {
      version: 1,
      id: 'feat-agent',
      repo_root: tempRepo,
      branch: 'feature/feat-agent',
      base_branch: 'main',
      kind: 'feature',
      profile: 'default',
      worktree_path: '.worktrees/feat-agent',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: 'active',
      tags: [],
      lifecycle_state: 'WORKTREE_READY',
    };
    await store.saveWorktree(rec);

    // Save active session
    const session: AgentSessionRecord = {
      session_id: 'session-123',
      worktree_id: 'feat-agent',
      role: 'worker',
      command: 'agent exec',
      state: 'working',
      started_at: new Date().toISOString(),
      contract_path: '.task/task-contract.md',
    };
    await store.saveSession(session);

    // Advance main
    fs.writeFileSync(path.join(tempRepo, 'README.md'), '# Advance main for agent test\n', 'utf-8');
    execSync('git add README.md && git commit -m "Advance for agent"', { cwd: tempRepo });

    const report = await fleetEngine.syncFleet({ preview: false });
    expect(report.skipped_count).toBe(1);
    expect(report.worktrees[0].status).toBe('SESSION_ACTIVE_SKIPPED');
    expect(report.worktrees[0].active_session_id).toBe('session-123');
  });

  it('performs live rebase synchronization when worktree is clean', async () => {
    const wtPath = path.join(tempRepo, '.worktrees', 'feat-clean');
    execSync(`git worktree add -b feature/feat-clean "${wtPath}" main`, { cwd: tempRepo });

    // Commit feature change
    fs.writeFileSync(path.join(wtPath, 'feature.txt'), 'feature code\n', 'utf-8');
    execSync('git add feature.txt && git commit -m "feat commit"', { cwd: wtPath });

    const rec: WorktreeRecord = {
      version: 1,
      id: 'feat-clean',
      repo_root: tempRepo,
      branch: 'feature/feat-clean',
      base_branch: 'main',
      kind: 'feature',
      profile: 'default',
      worktree_path: '.worktrees/feat-clean',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: 'active',
      tags: [],
      lifecycle_state: 'WORKTREE_READY',
    };
    await store.saveWorktree(rec);

    // Advance main with non-conflicting commit
    fs.writeFileSync(path.join(tempRepo, 'README.md'), '# Updated main docs\n', 'utf-8');
    execSync('git add README.md && git commit -m "Update docs"', { cwd: tempRepo });

    const report = await fleetEngine.syncFleet({ strategy: 'rebase', preview: false });
    expect(report.synced_count).toBe(1);
    expect(report.failed_count).toBe(0);
    expect(report.worktrees[0].status).toBe('SYNCED');
    expect(report.worktrees[0].behind).toBe(0);
  });

  it('throws usage error when targeted worktree does not exist in registry', async () => {
    await expect(fleetEngine.syncFleet({ target: 'non-existent-wt' })).rejects.toThrow(
      /Target worktree 'non-existent-wt' not found/
    );
  });
});
