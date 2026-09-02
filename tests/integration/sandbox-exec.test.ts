import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { MannostreeOrchestrator } from '../../src/core/orchestrator.js';
import { loadConfig } from '../../src/config/loader.js';
import { MetadataStore } from '../../src/metadata/store.js';

const execFileAsync = promisify(execFile);

describe('Movement 8: Sandboxed Exec CLI & Orchestrator Integration', () => {
  let testDir: string;
  let orchestrator: MannostreeOrchestrator;

  beforeEach(async () => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mannostree-sandbox-cli-'));
    await execFileAsync('git', ['init', '-b', 'main'], { cwd: testDir });
    await execFileAsync('git', ['config', 'user.name', 'Test'], { cwd: testDir });
    await execFileAsync('git', ['config', 'user.email', 'test@example.com'], { cwd: testDir });

    fs.writeFileSync(path.join(testDir, 'README.md'), '# Main Repo\n');
    await execFileAsync('git', ['add', '.'], { cwd: testDir });
    await execFileAsync('git', ['commit', '-m', 'Initial commit'], { cwd: testDir });

    const config = loadConfig(undefined, testDir);
    orchestrator = new MannostreeOrchestrator(testDir, config);
    const store = new MetadataStore(testDir, config);
    await store.saveRegistry({
      version: 1,
      repo_root: testDir,
      default_base_branch: 'main',
      worktree_root: '.worktrees',
      metadata_root: '.mannostree',
      artifact_dir_name: '.task',
      created_at: new Date().toISOString(),
      worktrees: [],
      experiments: [],
    });
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('executes in-worktree command with local process runtime and persists execution receipt', async () => {
    const spawned = await orchestrator.spawn({
      name: 'sandbox-feat',
      baseBranch: 'main',
      noSetup: true,
    });

    const res = await orchestrator.exec(spawned.result!.id, {
      command: 'echo "running in sandbox"',
      sandbox: 'process',
    });

    expect(res.ok).toBe(true);
    expect(res.result?.stdout.trim()).toBe('running in sandbox');
    expect(res.result?.exit_code).toBe(0);

    // Verify receipt persisted to .task/sandbox-receipt.json
    const receiptPath = path.join(
      testDir,
      '.worktrees',
      'sandbox-feat',
      '.task',
      'sandbox-receipt.json'
    );
    expect(fs.existsSync(receiptPath)).toBe(true);

    const receiptContent = JSON.parse(fs.readFileSync(receiptPath, 'utf-8'));
    expect(receiptContent.worktree_id).toBe(spawned.result!.id);
    expect(receiptContent.runtime).toBe('process');
    expect(receiptContent.exit_code).toBe(0);
  });

  it('previews docker sandbox execution in dry-run mode without spawning container', async () => {
    const spawned = await orchestrator.spawn({
      name: 'docker-preview-feat',
      baseBranch: 'main',
      noSetup: true,
    });

    const res = await orchestrator.exec(spawned.result!.id, {
      command: 'npm run test:ci',
      sandbox: 'docker',
      image: 'node:20-alpine',
      dryRun: true,
    });

    expect(res.ok).toBe(true);
    expect(res.result?.runtime).toBe('docker');
    expect(res.result?.stdout).toContain('DRY-RUN: docker run');
    expect(res.result?.stdout).toContain('node:20-alpine');
  });
});
