import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';

describe('Mannostree Phase 3 CLI Integration', () => {
  let tempRepo: string;
  const binPath = path.resolve(__dirname, '../../bin/mannostree.js');

  beforeEach(() => {
    tempRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'mannostree-phase3-cli-test-'));
    execSync('git init -b main', { cwd: tempRepo });
    execSync('git config user.name "Phase 3 Tester"', { cwd: tempRepo });
    execSync('git config user.email "p3@example.com"', { cwd: tempRepo });
    fs.writeFileSync(path.join(tempRepo, 'README.md'), '# Phase 3 Integration Repo\n', 'utf-8');
    fs.writeFileSync(path.join(tempRepo, '.env'), 'APP_SECRET=test_secret_abc\n', 'utf-8');
    execSync('git add README.md && git commit -m "Initial commit"', { cwd: tempRepo });

    const configContent = `
version: 1
default_base_branch: main
worktree_root: .worktrees
metadata_root: .mannostree
artifact_dir_name: .task

profiles:
  node_app:
    install_commands:
      - echo "node_installed" > pkg.installed
    env_mode: skip
    env_files:
      - .env
    env_vars:
      PROFILE_ENV: node_active
    validation_commands:
      - test -f pkg.installed
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

  it('executes setup, env, and exec CLI commands cleanly', () => {
    // 1. Spawn with no setup
    execSync(`node ${binPath} spawn p3-cli-feat -b main --profile node_app --no-setup`, { cwd: tempRepo });

    // 2. Setup dry-run
    const setupDryOut = execSync(`node ${binPath} setup feature-p3-cli-feat --dry-run --json`, {
      cwd: tempRepo,
      encoding: 'utf-8',
    });
    const setupDryParsed = JSON.parse(setupDryOut);
    expect(setupDryParsed.command).toBe('setup');
    expect(setupDryParsed.dry_run).toBe(true);

    // 3. Real setup
    const setupOut = execSync(`node ${binPath} setup feature-p3-cli-feat --json`, {
      cwd: tempRepo,
      encoding: 'utf-8',
    });
    const setupParsed = JSON.parse(setupOut);
    expect(setupParsed.ok).toBe(true);

    const wtPath = path.join(tempRepo, '.worktrees', 'p3-cli-feat');
    expect(fs.existsSync(path.join(wtPath, 'pkg.installed'))).toBe(true);

    // 4. Env copy
    const envOut = execSync(`node ${binPath} env feature-p3-cli-feat --mode copy --json`, {
      cwd: tempRepo,
      encoding: 'utf-8',
    });
    const envParsed = JSON.parse(envOut);
    expect(envParsed.ok).toBe(true);
    expect(fs.existsSync(path.join(wtPath, '.env'))).toBe(true);

    // 5. Exec
    const execOut = execSync(`node ${binPath} exec feature-p3-cli-feat -- cat .env`, {
      cwd: tempRepo,
      encoding: 'utf-8',
    });
    expect(execOut).toContain('APP_SECRET=test_secret_abc');
  });
});
