import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BIN_PATH = path.resolve(__dirname, '../../bin/mannostree.js');


function formatArgs(args: string[]): string {
  return args.map((a) => (a.includes(' ') ? JSON.stringify(a) : a)).join(' ');
}

function runCli(args: string[], cwd: string) {
  return execSync(`node ${BIN_PATH} ${formatArgs(args)}`, {
    cwd,
    encoding: 'utf-8',
    env: { ...process.env, NO_COLOR: '1' },
  });
}

function runCliJson(args: string[], cwd: string): any {
  const output = execSync(`node ${BIN_PATH} ${formatArgs(args)} --json`, {
    cwd,
    encoding: 'utf-8',
    env: { ...process.env, NO_COLOR: '1' },
  });
  return JSON.parse(output);
}


describe('Movement 4: Fleet Tiering, Workspace Leases & Auto-Archive CLI Integration', () => {
  let tempRepo: string;

  beforeEach(() => {
    tempRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'mannostree-fleet-tier-cli-'));
    execSync('git init -b main', { cwd: tempRepo });
    execSync('git config user.name "Tier Tester"', { cwd: tempRepo });
    execSync('git config user.email "tiertest@example.com"', { cwd: tempRepo });
    fs.writeFileSync(path.join(tempRepo, 'README.md'), '# Fleet Tier Test Repo\n', 'utf-8');
    execSync('git add README.md && git commit -m "Initial commit"', { cwd: tempRepo });
  });

  afterEach(() => {
    try {
      execSync('git worktree prune', { cwd: tempRepo });
    } catch {}
    fs.rmSync(tempRepo, { recursive: true, force: true });
  });

  it('manages workspace leases via CLI (acquire, list, renew, release)', () => {
    // 1. Spawn workspace
    const spawnRes = runCliJson(['spawn', 'wt-lease'], tempRepo);
    expect(spawnRes.ok).toBe(true);
    const wtId = spawnRes.result.id;

    // 2. Acquire lease
    const acquireRes = runCliJson(
      ['fleet', 'lease', 'acquire', wtId, '--holder', 'agent-alpha', '--ttl', '30m', '--purpose', 'CLI integration test'],
      tempRepo
    );
    expect(acquireRes.ok).toBe(true);
    expect(acquireRes.result.holder).toBe('agent-alpha');
    expect(acquireRes.result.status).toBe('active');
    expect(acquireRes.result.ttl_seconds).toBe(1800);

    // 3. List active leases
    const listRes = runCliJson(['fleet', 'lease', 'list', '--active'], tempRepo);
    expect(listRes.ok).toBe(true);
    expect(listRes.result.length).toBe(1);
    expect(listRes.result[0].holder).toBe('agent-alpha');

    // 4. Renew lease
    const renewRes = runCliJson(['fleet', 'lease', 'renew', wtId, '--ttl', '45m'], tempRepo);
    expect(renewRes.ok).toBe(true);
    expect(renewRes.result.renew_count).toBe(1);
    expect(renewRes.result.ttl_seconds).toBe(2700);

    // 5. Release lease
    const releaseRes = runCliJson(['fleet', 'lease', 'release', wtId], tempRepo);
    expect(releaseRes.ok).toBe(true);
    expect(releaseRes.result.status).toBe('released');

    // 6. List active leases should now be empty
    const listEmptyRes = runCliJson(['fleet', 'lease', 'list', '--active'], tempRepo);
    expect(listEmptyRes.result.length).toBe(0);
  });

  it('manages tiering, pinning, unpinning, and tier list via CLI', () => {
    // 1. Spawn two worktrees
    const wt1 = runCliJson(['spawn', 'wt-alpha'], tempRepo).result.id;
    const wt2 = runCliJson(['spawn', 'wt-beta'], tempRepo).result.id;

    // 2. Pin wt1
    const pinRes = runCliJson(['fleet', 'tier', 'pin', wt1], tempRepo);
    expect(pinRes.ok).toBe(true);
    expect(pinRes.result.pinned).toBe(true);
    expect(pinRes.result.tier).toBe('pinned');

    // 3. Set explicit tier on wt2
    const setRes = runCliJson(['fleet', 'tier', 'set', wt2, 'warm'], tempRepo);
    expect(setRes.ok).toBe(true);
    expect(setRes.result.tier).toBe('warm');

    // 4. List tiers
    const listRes = runCliJson(['fleet', 'tier', 'list'], tempRepo);
    expect(listRes.ok).toBe(true);
    expect(listRes.result.length).toBe(2);

    const pinnedItem = listRes.result.find((i: any) => i.id === wt1);
    expect(pinnedItem.pinned).toBe(true);
    expect(pinnedItem.tier).toBe('pinned');

    // 5. Unpin wt1
    const unpinRes = runCliJson(['fleet', 'tier', 'unpin', wt1], tempRepo);
    expect(unpinRes.ok).toBe(true);
    expect(unpinRes.result.pinned).toBe(false);
  });

  it('runs auto-archive policy preview and execution via CLI', () => {
    // 1. Spawn worktree
    const wt = runCliJson(['spawn', 'idle-wt'], tempRepo).result.id;

    // 2. Preview auto-archive with capacity quota policy
    // Create config with max_active_worktrees: 0 to force archival
    fs.writeFileSync(
      path.join(tempRepo, '.mannostree.yaml'),
      `
fleet:
  policy:
    max_active_worktrees: 0
    idle_ttl_hours: 0
`
    );

    const previewRes = runCliJson(['fleet', 'auto-archive', '--preview', '--force'], tempRepo);
    expect(previewRes.ok).toBe(true);
    expect(previewRes.dry_run).toBe(true);
    expect(previewRes.result.archived_count).toBe(1);
    expect(previewRes.result.archived_worktrees[0].id).toBe(wt);

    // 3. Confirm execution with --yes --force
    const execRes = runCliJson(['fleet', 'auto-archive', '--yes', '--force'], tempRepo);
    expect(execRes.ok).toBe(true);
    expect(execRes.dry_run).toBe(false);
    expect(execRes.result.archived_count).toBe(1);

    // Verify worktree is unmounted on disk
    const wtPath = path.join(tempRepo, '.worktrees', 'idle-wt');
    expect(fs.existsSync(wtPath)).toBe(false);
  });


  it('displays fleet capacity and tier status dashboard via CLI', () => {
    // 1. Spawn worktrees
    const wt1 = runCliJson(['spawn', 'dash-1'], tempRepo).result.id;
    const wt2 = runCliJson(['spawn', 'dash-2'], tempRepo).result.id;

    // Pin dash-1
    runCliJson(['fleet', 'tier', 'pin', wt1], tempRepo);

    // Lease dash-2
    runCliJson(['fleet', 'lease', 'acquire', wt2, '--holder', 'dashboard-tester', '--ttl', '1h'], tempRepo);

    // 2. Query status
    const statusRes = runCliJson(['fleet', 'status'], tempRepo);
    expect(statusRes.ok).toBe(true);
    expect(statusRes.result.total_worktrees).toBe(2);
    expect(statusRes.result.pinned_count).toBe(1);
    expect(statusRes.result.hot_count).toBe(1);
    expect(statusRes.result.active_leases.length).toBe(1);

    // Formatted text output test
    const textOutput = runCli(['fleet', 'status'], tempRepo);
    expect(textOutput).toContain('Mannostree Fleet Status');
    expect(textOutput).toContain('Lifecycle Tier Distribution');
    expect(textOutput).toContain('dashboard-tester');
  });
});
