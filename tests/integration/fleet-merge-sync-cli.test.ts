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

function runCliJson(args: string[], cwd: string): any {
  const output = execSync(`node ${BIN_PATH} ${formatArgs(args)} --json`, {
    cwd,
    encoding: 'utf-8',
    env: { ...process.env, NO_COLOR: '1' },
  });
  return JSON.parse(output);
}

describe('Movement 5: Fleet Merge-Sync & Batch Publish CLI Integration', () => {
  let tempRepo: string;

  beforeEach(() => {
    tempRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'mannostree-fleet-ms-cli-'));
    execSync('git init -b main', { cwd: tempRepo });
    execSync('git config user.name "Merge Tester"', { cwd: tempRepo });
    execSync('git config user.email "mergetest@example.com"', { cwd: tempRepo });
    fs.writeFileSync(path.join(tempRepo, 'README.md'), '# Fleet Merge Sync Repo\n', 'utf-8');
    execSync('git add README.md && git commit -m "Initial commit"', { cwd: tempRepo });
  });

  afterEach(() => {
    fs.rmSync(tempRepo, { recursive: true, force: true });
  });

  it('runs fleet merge-sync --preview via CLI binary and outputs structured candidate simulation', () => {
    // 1. Spawn 2 separate feature worktrees
    runCliJson(['spawn', 'mod-a', '-b', 'main'], tempRepo);
    runCliJson(['spawn', 'mod-b', '-b', 'main'], tempRepo);

    // 2. Run fleet merge-sync --target staging --preview
    const msRes = runCliJson(['fleet', 'merge-sync', '--target', 'staging', '--preview'], tempRepo);

    expect(msRes.ok).toBe(true);
    expect(msRes.command).toBe('fleet merge-sync');
    expect(msRes.result.target_branch).toBe('staging');
    expect(msRes.result.dry_run).toBe(true);
    expect(msRes.result.total_candidates).toBe(2);
    expect(msRes.result.clean_count).toBe(2);
    expect(msRes.result.conflict_count).toBe(0);
  });

  it('runs fleet publish --preview via CLI binary and outputs batch summary', () => {
    runCliJson(['spawn', 'mod-c', '-b', 'main'], tempRepo);

    const pubRes = runCliJson(['fleet', 'publish', '--all', '--preview'], tempRepo);
    expect(pubRes.ok).toBe(true);
    expect(pubRes.command).toBe('fleet publish');
    expect(pubRes.result.total_targeted).toBeGreaterThanOrEqual(1);
    expect(pubRes.result.published_count).toBeGreaterThanOrEqual(1);
  });
});
