import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';

describe('Archive and Restore CLI Integration', () => {
  let tempRepo: string;
  const binPath = path.resolve(__dirname, '../../bin/mannostree.js');

  beforeEach(() => {
    tempRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'mannostree-cli-archive-'));
    execSync('git init -b main', { cwd: tempRepo });
    execSync('git config user.name "Archive CLI Tester"', { cwd: tempRepo });
    execSync('git config user.email "archivecli@example.com"', { cwd: tempRepo });
    fs.writeFileSync(path.join(tempRepo, 'README.md'), '# Archive CLI Repo\n', 'utf-8');
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

  it('runs archive and restore commands via CLI binary', () => {
    execSync(`node ${binPath} spawn test-cli-archive -b main --json`, {
      cwd: tempRepo,
      encoding: 'utf-8',
    });

    const wtDir = path.join(tempRepo, '.worktrees', 'test-cli-archive');
    expect(fs.existsSync(wtDir)).toBe(true);

    // Archive with --force
    const archiveOut = execSync(`node ${binPath} archive feature-test-cli-archive --yes --force --json`, {
      cwd: tempRepo,
      encoding: 'utf-8',
    });
    const archParsed = JSON.parse(archiveOut);
    expect(archParsed.ok).toBe(true);
    expect(fs.existsSync(wtDir)).toBe(false);

    // Restore
    const restoreOut = execSync(`node ${binPath} restore feature-test-cli-archive --yes --json`, {
      cwd: tempRepo,
      encoding: 'utf-8',
    });
    const restParsed = JSON.parse(restoreOut);
    expect(restParsed.ok).toBe(true);
    expect(fs.existsSync(wtDir)).toBe(true);
  });
});
