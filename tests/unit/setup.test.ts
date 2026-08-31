import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { MannostreeOrchestrator } from '../../src/core/orchestrator.js';
import { loadConfig } from '../../src/config/loader.js';

describe('Setup Engine', () => {
  let tempRepo: string;
  let orchestrator: MannostreeOrchestrator;

  beforeEach(() => {
    tempRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'mannostree-setup-test-'));
    execSync('git init -b main', { cwd: tempRepo });
    execSync('git config user.name "Setup Tester"', { cwd: tempRepo });
    execSync('git config user.email "setup@example.com"', { cwd: tempRepo });
    fs.writeFileSync(path.join(tempRepo, 'README.md'), '# Setup Test\n', 'utf-8');
    execSync('git add README.md && git commit -m "Initial commit"', { cwd: tempRepo });

    const customConfig = `
version: 1
default_base_branch: main
worktree_root: .worktrees
metadata_root: .mannostree
artifact_dir_name: .task

profiles:
  custom:
    install_commands:
      - echo "installed" > install.log
    validation_commands:
      - test -f install.log
  failing:
    install_commands:
      - exit 1
    validation_commands: []
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

  it('applies setup profile and runs install and validation commands', async () => {
    await orchestrator.spawn({
      name: 'setup-feat',
      baseBranch: 'main',
      noSetup: true,
    });

    const wtPath = path.join(tempRepo, '.worktrees', 'setup-feat');
    expect(fs.existsSync(path.join(wtPath, 'install.log'))).toBe(false);

    // Apply setup profile
    const setupRes = await orchestrator.setup('feature-setup-feat', {
      profile: 'custom',
    });

    expect(setupRes.ok).toBe(true);
    expect(fs.existsSync(path.join(wtPath, 'install.log'))).toBe(true);

    const record = await orchestrator.store.getWorktree('feature-setup-feat');
    expect(record?.setup?.install_succeeded).toBe(true);
    expect(record?.setup?.setup_mode).toBe('custom');
  });

  it('marks worktree as BROKEN if setup install command fails', async () => {
    await orchestrator.spawn({
      name: 'broken-setup',
      baseBranch: 'main',
      noSetup: true,
    });

    const setupRes = await orchestrator.setup('feature-broken-setup', {
      profile: 'failing',
    });

    expect(setupRes.ok).toBe(false);
    const record = await orchestrator.store.getWorktree('feature-broken-setup');
    expect(record?.lifecycle_state).toBe('BROKEN');
    expect(record?.status).toBe('broken');
  });

  it('previews commands without executing them in dry-run mode', async () => {
    await orchestrator.spawn({
      name: 'dry-setup',
      baseBranch: 'main',
      noSetup: true,
    });

    const wtPath = path.join(tempRepo, '.worktrees', 'dry-setup');

    const dryRes = await orchestrator.setup('feature-dry-setup', {
      profile: 'custom',
      dryRun: true,
    });

    expect(dryRes.ok).toBe(true);
    expect(dryRes.dry_run).toBe(true);
    expect(fs.existsSync(path.join(wtPath, 'install.log'))).toBe(false);
  });
});
