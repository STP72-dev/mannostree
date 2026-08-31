import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { MannostreeOrchestrator } from '../../src/core/orchestrator.js';
import { loadConfig } from '../../src/config/loader.js';

describe('Exec Engine', () => {
  let tempRepo: string;
  let orchestrator: MannostreeOrchestrator;

  beforeEach(() => {
    tempRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'mannostree-exec-test-'));
    execSync('git init -b main', { cwd: tempRepo });
    execSync('git config user.name "Exec Tester"', { cwd: tempRepo });
    execSync('git config user.email "exec@example.com"', { cwd: tempRepo });
    fs.writeFileSync(path.join(tempRepo, 'README.md'), '# Exec Test\n', 'utf-8');
    execSync('git add README.md && git commit -m "Initial commit"', { cwd: tempRepo });

    const customConfig = `
version: 1
default_base_branch: main
worktree_root: .worktrees
metadata_root: .mannostree
artifact_dir_name: .task

profiles:
  custom:
    env_vars:
      MY_CUSTOM_VAR: custom_value_123
`;
    fs.writeFileSync(path.join(tempRepo, '.mannostree.yml'), customConfig, 'utf-8');
    const config = loadConfig(undefined, tempRepo);
    orchestrator = new MannostreeOrchestrator(tempRepo, config);
  });

  afterEach(() => {
    try {
      execSync('git worktree prune', { cwd: tempRepo });
    } catch {
      // ignore
    }
    fs.rmSync(tempRepo, { recursive: true, force: true });
  });

  it('runs command inside the worktree directory and captures output', async () => {
    await orchestrator.spawn({ name: 'exec-feat', baseBranch: 'main' });
    const wtPath = path.join(tempRepo, '.worktrees', 'exec-feat');

    const res = await orchestrator.exec('feature-exec-feat', ['pwd'], { inheritStdio: false });
    expect(res.exitCode).toBe(0);
    expect(res.stdout).toBe(wtPath);
  });

  it('injects profile environment variables during execution', async () => {
    await orchestrator.spawn({ name: 'env-exec-feat', baseBranch: 'main', profile: 'custom' });

    const res = await orchestrator.exec('feature-env-exec-feat', ['node', '-e', '"console.log(process.env.MY_CUSTOM_VAR)"'], { inheritStdio: false });
    expect(res.exitCode).toBe(0);
    expect(res.stdout).toContain('custom_value_123');
  });

  it('forwards non-zero exit codes accurately', async () => {
    await orchestrator.spawn({ name: 'fail-exec-feat', baseBranch: 'main' });

    const res = await orchestrator.exec('feature-fail-exec-feat', ['node', '-e', '"process.exit(42)"'], { inheritStdio: false });
    expect(res.exitCode).toBe(42);
  });
});
