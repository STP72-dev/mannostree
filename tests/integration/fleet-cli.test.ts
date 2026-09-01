import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BIN_PATH = path.resolve(__dirname, '../../bin/mannostree.js');

describe('Fleet Sync and Conflict Matrix CLI Integration', () => {
  let tempRepo: string;

  beforeEach(() => {
    tempRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'mannostree-fleet-cli-test-'));
    execSync('git init -b main', { cwd: tempRepo });
    execSync('git config user.name "Fleet CLI Tester"', { cwd: tempRepo });
    execSync('git config user.email "fleet-cli@example.com"', { cwd: tempRepo });
    fs.writeFileSync(path.join(tempRepo, 'common.ts'), 'export const val = 1;\n', 'utf-8');
    fs.writeFileSync(path.join(tempRepo, 'independent.ts'), 'export const util = true;\n', 'utf-8');
    execSync('git add -A && git commit -m "Init main"', { cwd: tempRepo });
  });

  afterEach(() => {
    try {
      execSync('git worktree prune', { cwd: tempRepo });
    } catch {}
    fs.rmSync(tempRepo, { recursive: true, force: true });
  });

  it('runs fleet sync --preview and outputs structured JSON divergence metrics', () => {
    // 1. Spawn two worktrees via CLI
    execSync(`node "${BIN_PATH}" spawn feat-a -b main --no-setup`, { cwd: tempRepo });
    execSync(`node "${BIN_PATH}" spawn feat-b -b main --no-setup`, { cwd: tempRepo });

    const wtA = path.join(tempRepo, '.worktrees', 'feat-a');
    const wtB = path.join(tempRepo, '.worktrees', 'feat-b');
    execSync('git add -A && git commit -m "Init wtA"', { cwd: wtA });
    execSync('git add -A && git commit -m "Init wtB"', { cwd: wtB });

    // 2. Advance main

    fs.writeFileSync(path.join(tempRepo, 'common.ts'), 'export const val = 2;\n', 'utf-8');
    execSync('git add common.ts && git commit -m "Update main"', { cwd: tempRepo });

    // 3. Execute fleet sync preview in JSON
    const out = execSync(`node "${BIN_PATH}" fleet sync --preview --json`, {
      cwd: tempRepo,
      encoding: 'utf-8',
    });

    const json = JSON.parse(out);
    expect(json.ok).toBe(true);
    expect(json.result.total_worktrees).toBe(2);
    expect(['BEHIND', 'DIVERGED']).toContain(json.result.worktrees[0].status);
    expect(json.result.worktrees[0].behind).toBe(1);
    expect(json.result.dry_run).toBe(true);

  });

  it('computes cross-worktree collision matrix and outputs hazards', () => {
    // Spawn two worktrees
    execSync(`node "${BIN_PATH}" spawn task-1 -b main --no-setup`, { cwd: tempRepo });
    execSync(`node "${BIN_PATH}" spawn task-2 -b main --no-setup`, { cwd: tempRepo });

    const wt1 = path.join(tempRepo, '.worktrees', 'task-1');
    const wt2 = path.join(tempRepo, '.worktrees', 'task-2');

    // Conflicting edit on common.ts
    fs.writeFileSync(path.join(wt1, 'common.ts'), 'export const val = "from_task_1";\n', 'utf-8');
    execSync('git add common.ts && git commit -m "task 1 edit"', { cwd: wt1 });

    fs.writeFileSync(path.join(wt2, 'common.ts'), 'export const val = "from_task_2";\n', 'utf-8');
    execSync('git add common.ts && git commit -m "task 2 edit"', { cwd: wt2 });

    const out = execSync(`node "${BIN_PATH}" fleet conflict-matrix --json`, {
      cwd: tempRepo,
      encoding: 'utf-8',
    });

    const json = JSON.parse(out);
    expect(json.ok).toBe(true);
    expect(json.result.total_worktrees).toBe(2);
    expect(json.result.conflict_hazard_count).toBeGreaterThan(0);
    expect(json.result.matrix[0][1].severity).toBe('CONFLICT');
    expect(json.result.matrix[0][1].shared_files).toContain('common.ts');

    // Verify markdown report
    const reportPath = path.join(wt1, '.task', 'conflict-matrix.md');
    expect(fs.existsSync(reportPath)).toBe(true);
  });
});
