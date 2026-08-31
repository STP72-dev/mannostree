import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { resolveBaseBranch } from '../../src/git/base-resolver.js';
import { GitEngine } from '../../src/git/engine.js';
import { loadConfig } from '../../src/config/loader.js';
import { ExitCode, MannostreeError } from '../../src/types/index.js';

describe('Base Branch Resolver', () => {
  let tempRepo: string;
  let git: GitEngine;

  beforeEach(() => {
    tempRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'mannostree-resolver-test-'));
    execSync('git init -b main', { cwd: tempRepo });
    execSync('git config user.name "Test User"', { cwd: tempRepo });
    execSync('git config user.email "test@example.com"', { cwd: tempRepo });
    fs.writeFileSync(path.join(tempRepo, 'README.md'), '# Test', 'utf-8');
    execSync('git add README.md && git commit -m "Initial commit"', { cwd: tempRepo });
    git = new GitEngine(tempRepo);
  });

  afterEach(() => {
    fs.rmSync(tempRepo, { recursive: true, force: true });
  });

  it('resolves explicit CLI base branch when it exists', async () => {
    const config = loadConfig(undefined, tempRepo);
    const resolved = await resolveBaseBranch({
      cliBaseBranch: 'main',
      config,
      gitEngine: git,
    });
    expect(resolved).toBe('main');
  });

  it('rejects non-existent explicit CLI base branch with usage error', async () => {
    const config = loadConfig(undefined, tempRepo);
    await expect(
      resolveBaseBranch({
        cliBaseBranch: 'non-existent-branch',
        config,
        gitEngine: git,
      })
    ).rejects.toThrowError(MannostreeError);
  });

  it('resolves config default_base_branch when CLI base is not provided', async () => {
    const config = loadConfig(undefined, tempRepo);
    const resolved = await resolveBaseBranch({
      config,
      gitEngine: git,
    });
    expect(resolved).toBe('main');
  });

  it('forbids implicit fallback to current checked-out branch when config default is missing and forbid_current_branch_as_base is true', async () => {
    const config = loadConfig(undefined, tempRepo);
    config.default_base_branch = 'non-existent-base';
    config.base_branch_resolution.order = ['cli', 'config'];
    config.base_branch_resolution.forbid_current_branch_as_base = true;

    await expect(
      resolveBaseBranch({
        config,
        gitEngine: git,
      })
    ).rejects.toThrowError(MannostreeError);
  });
});
