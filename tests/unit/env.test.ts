import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { MannostreeOrchestrator } from '../../src/core/orchestrator.js';
import { loadConfig } from '../../src/config/loader.js';
import { MannostreeError } from '../../src/types/index.js';

describe('Environment Engine', () => {
  let tempRepo: string;
  let orchestrator: MannostreeOrchestrator;

  beforeEach(() => {
    tempRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'mannostree-env-test-'));
    execSync('git init -b main', { cwd: tempRepo });
    execSync('git config user.name "Env Tester"', { cwd: tempRepo });
    execSync('git config user.email "env@example.com"', { cwd: tempRepo });
    fs.writeFileSync(path.join(tempRepo, 'README.md'), '# Env Test\n', 'utf-8');
    fs.writeFileSync(path.join(tempRepo, '.env'), 'SECRET_KEY=12345\n', 'utf-8');
    execSync('git add README.md && git commit -m "Initial commit"', { cwd: tempRepo });

    const customConfig = `
version: 1
default_base_branch: main
worktree_root: .worktrees
metadata_root: .mannostree
artifact_dir_name: .task

profiles:
  node:
    env_mode: skip
    env_files:
      - .env
    generate_command: echo "GENERATED_VAR=abc" > .env.generated
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

  it('copies environment file explicitly in copy mode', async () => {
    await orchestrator.spawn({ name: 'copy-env-feat', baseBranch: 'main', profile: 'node' });
    const wtPath = path.join(tempRepo, '.worktrees', 'copy-env-feat');

    const envRes = await orchestrator.env('feature-copy-env-feat', { mode: 'copy' });
    expect(envRes.ok).toBe(true);

    const targetEnv = path.join(wtPath, '.env');
    expect(fs.existsSync(targetEnv)).toBe(true);
    expect(fs.readFileSync(targetEnv, 'utf-8')).toContain('SECRET_KEY=12345');
  });

  it('symlinks environment file in link mode', async () => {
    await orchestrator.spawn({ name: 'link-env-feat', baseBranch: 'main', profile: 'node' });
    const wtPath = path.join(tempRepo, '.worktrees', 'link-env-feat');

    const envRes = await orchestrator.env('feature-link-env-feat', { mode: 'link' });
    expect(envRes.ok).toBe(true);

    const targetEnv = path.join(wtPath, '.env');
    expect(fs.existsSync(targetEnv)).toBe(true);
    expect(fs.lstatSync(targetEnv).isSymbolicLink()).toBe(true);
  });

  it('generates environment file in generate mode', async () => {
    await orchestrator.spawn({ name: 'gen-env-feat', baseBranch: 'main', profile: 'node' });
    const wtPath = path.join(tempRepo, '.worktrees', 'gen-env-feat');

    const envRes = await orchestrator.env('feature-gen-env-feat', { mode: 'generate' });
    expect(envRes.ok).toBe(true);

    const genFile = path.join(wtPath, '.env.generated');
    expect(fs.existsSync(genFile)).toBe(true);
    expect(fs.readFileSync(genFile, 'utf-8')).toContain('GENERATED_VAR=abc');
  });

  it('rejects copy or link mode if source env file does not exist', async () => {
    // Delete .env in repo root
    fs.unlinkSync(path.join(tempRepo, '.env'));

    await orchestrator.spawn({ name: 'missing-env-feat', baseBranch: 'main', profile: 'node' });

    await expect(
      orchestrator.env('feature-missing-env-feat', { mode: 'copy' })
    ).rejects.toThrowError(MannostreeError);
  });
});
