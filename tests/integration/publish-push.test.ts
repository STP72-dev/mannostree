import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';

describe('Mannostree PR Push Integration with Mock gh Executable', () => {
  let tempRepo: string;
  let remoteRepo: string;
  let mockBinDir: string;
  const binPath = path.resolve(__dirname, '../../bin/mannostree.js');

  beforeEach(() => {
    // 1. Setup mock remote bare repository
    remoteRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'mannostree-remote-'));
    execSync('git init --bare -b main', { cwd: remoteRepo });

    // 2. Setup working repository
    tempRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'mannostree-push-cli-test-'));
    execSync('git init -b main', { cwd: tempRepo });
    execSync('git config user.name "Push Tester"', { cwd: tempRepo });
    execSync('git config user.email "push@example.com"', { cwd: tempRepo });
    execSync(`git remote add origin ${remoteRepo}`, { cwd: tempRepo });
    execSync(`git remote set-url --push origin ${remoteRepo}`, { cwd: tempRepo });
    execSync('git remote set-url origin https://github.com/STP72-dev/mannostree.git', { cwd: tempRepo });
    fs.writeFileSync(path.join(tempRepo, 'README.md'), '# Integration Repo\n', 'utf-8');
    execSync('git add README.md && git commit -m "Initial commit"', { cwd: tempRepo });
    execSync('git push -u origin main', { cwd: tempRepo });

    const configContent = `
version: 1
default_base_branch: main
worktree_root: .worktrees
metadata_root: .mannostree
artifact_dir_name: .task
publish:
  default_remote: origin
  default_draft: true
`;
    fs.writeFileSync(path.join(tempRepo, '.mannostree.yml'), configContent, 'utf-8');

    // 3. Setup mock gh executable in a temporary bin folder
    mockBinDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mannostree-mock-gh-'));
    const mockGhScript = `#!/usr/bin/env node
console.log('https://github.com/STP72-dev/mannostree/pull/99');
`;
    const mockGhPath = path.join(mockBinDir, 'gh');
    fs.writeFileSync(mockGhPath, mockGhScript, { mode: 0o755 });
  });

  afterEach(() => {
    try {
      execSync('git worktree prune', { cwd: tempRepo });
    } catch {
      // ignore
    }
    fs.rmSync(tempRepo, { recursive: true, force: true });
    fs.rmSync(remoteRepo, { recursive: true, force: true });
    fs.rmSync(mockBinDir, { recursive: true, force: true });
  });

  it('invokes gh binary and pushes branch to remote when --push is executed via CLI binary', () => {
    // 1. Spawn worktree
    execSync(`node ${binPath} spawn release-flow -b main --no-setup`, { cwd: tempRepo });

    // 2. Commit a change in worktree
    const wtPath = path.join(tempRepo, '.worktrees', 'release-flow');
    fs.writeFileSync(path.join(wtPath, 'module.ts'), 'export const ready = true;\n', 'utf-8');
    execSync('git add module.ts && git commit -m "feat: add release module"', { cwd: wtPath });

    // 3. Run mannostree pr with --push and PATH prepended with mockBinDir
    const env = {
      ...process.env,
      PATH: `${mockBinDir}:${process.env.PATH}`,
    };

    const prOut = execSync(
      `node ${binPath} pr feature-release-flow --push --json`,
      { cwd: tempRepo, env, encoding: 'utf-8' }
    );

    const prParsed = JSON.parse(prOut);
    expect(prParsed.command).toBe('pr');
    expect(prParsed.ok).toBe(true);
    expect(prParsed.result.mode).toBe('published');
    expect(prParsed.result.pr_url).toBe('https://github.com/STP72-dev/mannostree/pull/99');
    expect(prParsed.result.pr_number).toBe(99);


    // Verify remote received the pushed branch
    const remoteBranches = execSync(`git --git-dir=${remoteRepo} branch -a`, { encoding: 'utf-8' });
    expect(remoteBranches).toContain('feature/release-flow');
  });
});
