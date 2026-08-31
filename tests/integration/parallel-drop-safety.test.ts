import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';

describe('Parallel Drop Safety Integration', () => {
  let tempRepo: string;
  const binPath = path.resolve(__dirname, '../../bin/mannostree.js');

  beforeEach(() => {
    tempRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'mannostree-drop-safety-test-'));
    execSync('git init -b main', { cwd: tempRepo });
    execSync('git config user.name "Drop Safety Tester"', { cwd: tempRepo });
    execSync('git config user.email "safety@example.com"', { cwd: tempRepo });
    fs.writeFileSync(path.join(tempRepo, 'README.md'), '# Drop Safety Repo\n', 'utf-8');
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

  it('handles partial drop failure, preserves surviving dirty variant, and allows retry with force', () => {
    // 1. Spawn parallel variants
    execSync(`node ${binPath} parallel spawn feature-drop -n 2 -b main --json`, {
      cwd: tempRepo,
      encoding: 'utf-8',
    });

    const v1Path = path.join(tempRepo, '.worktrees', 'feature-drop-v1');
    const v2Path = path.join(tempRepo, '.worktrees', 'feature-drop-v2');

    // Clean v1 by committing scaffold files
    execSync('git add . && git commit -m "Scaffold files"', { cwd: v1Path });

    // Make v2 dirty
    fs.writeFileSync(path.join(v2Path, 'dirty.txt'), 'uncommitted content\n', 'utf-8');

    // 2. Initial drop attempt without force should drop v1 and preserve v2
    let dropExitCode = 0;
    let stdout = '';
    try {
      stdout = execSync(`node ${binPath} parallel drop feature-drop --yes --json`, {
        cwd: tempRepo,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (err: any) {
      dropExitCode = err.status;
      stdout = err.stdout ? err.stdout.toString() : '';
    }

    expect(dropExitCode).toBe(1);
    const dropParsed = JSON.parse(stdout);
    expect(dropParsed.ok).toBe(false);
    expect(dropParsed.result.dropped_variants).toContain('experiment-feature-drop-v1');
    expect(dropParsed.result.surviving_variants).toContain('experiment-feature-drop-v2');
    expect(fs.existsSync(v1Path)).toBe(false);
    expect(fs.existsSync(v2Path)).toBe(true);

    // 3. Retry drop with --force to remove surviving variant
    const retryOut = execSync(`node ${binPath} parallel drop feature-drop --yes --force --json`, {
      cwd: tempRepo,
      encoding: 'utf-8',
    });
    const retryParsed = JSON.parse(retryOut);
    expect(retryParsed.ok).toBe(true);
    expect(retryParsed.result.experiment_deleted).toBe(true);
    expect(fs.existsSync(v2Path)).toBe(false);
  });
});
