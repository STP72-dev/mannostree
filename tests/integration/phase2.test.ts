import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';

describe('Mannostree Phase 2 CLI Integration', () => {
  let tempRepo: string;
  const binPath = path.resolve(__dirname, '../../bin/mannostree.js');

  beforeEach(() => {
    tempRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'mannostree-phase2-cli-test-'));
    execSync('git init -b main', { cwd: tempRepo });
    execSync('git config user.name "Phase 2 Tester"', { cwd: tempRepo });
    execSync('git config user.email "p2@example.com"', { cwd: tempRepo });
    fs.writeFileSync(path.join(tempRepo, 'README.md'), '# Phase 2 Integration Repo\n', 'utf-8');
    execSync('git add README.md && git commit -m "Initial commit"', { cwd: tempRepo });

    const configContent = `
version: 1
default_base_branch: main
worktree_root: .worktrees
metadata_root: .mannostree
artifact_dir_name: .task
`;
    fs.writeFileSync(path.join(tempRepo, '.mannostree.yml'), configContent, 'utf-8');
  });

  afterEach(() => {
    try {
      execSync('git worktree prune', { cwd: tempRepo });
    } catch {
      // ignore
    }
    fs.rmSync(tempRepo, { recursive: true, force: true });
  });

  it('runs status command and returns structured JSON git and lifecycle state', () => {
    // Spawn worktree
    execSync(`node ${binPath} spawn p2-status-feat -b main`, { cwd: tempRepo });

    const statusOut = execSync(`node ${binPath} status feature-p2-status-feat --json`, {
      cwd: tempRepo,
      encoding: 'utf-8',
    });

    const parsed = JSON.parse(statusOut);
    expect(parsed.command).toBe('status');
    expect(parsed.ok).toBe(true);
    expect(parsed.result.id).toBe('feature-p2-status-feat');
    expect(parsed.result.git_state).toBeDefined();
    expect(parsed.result.live_health.health_status).toBe('ok');
  });

  it('runs doctor command and outputs clean health report in JSON', () => {
    const docOut = execSync(`node ${binPath} doctor --json`, {
      cwd: tempRepo,
      encoding: 'utf-8',
    });

    const parsed = JSON.parse(docOut);
    expect(parsed.command).toBe('doctor');
    expect(parsed.ok).toBe(true);
    expect(parsed.result.healthy).toBe(true);
    expect(parsed.result.error_count).toBe(0);
  });

  it('runs sync, clean, and recover preview flows in JSON', () => {
    execSync(`node ${binPath} spawn p2-flow-feat -b main`, { cwd: tempRepo });
    const wtPath = path.join(tempRepo, '.worktrees', 'p2-flow-feat');
    execSync('git add . && git commit -m "Scaffold files"', { cwd: wtPath });

    // Sync dry-run
    const syncOut = execSync(`node ${binPath} sync feature-p2-flow-feat --dry-run --json`, {
      cwd: tempRepo,
      encoding: 'utf-8',
    });
    const syncParsed = JSON.parse(syncOut);
    expect(syncParsed.command).toBe('sync');
    expect(syncParsed.dry_run).toBe(true);

    // Clean preview
    const cleanOut = execSync(`node ${binPath} clean --merged --json`, {
      cwd: tempRepo,
      encoding: 'utf-8',
    });
    const cleanParsed = JSON.parse(cleanOut);
    expect(cleanParsed.command).toBe('clean');
    expect(cleanParsed.dry_run).toBe(true);

    // Recover preview
    const recOut = execSync(
      `node ${binPath} recover feature-p2-flow-feat --rebuild-metadata --dry-run --json`,
      { cwd: tempRepo, encoding: 'utf-8' }
    );
    const recParsed = JSON.parse(recOut);
    expect(recParsed.command).toBe('recover');
    expect(recParsed.dry_run).toBe(true);
  });
});
