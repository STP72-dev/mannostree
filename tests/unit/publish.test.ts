import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { MannostreeOrchestrator } from '../../src/core/orchestrator.js';
import { loadConfig } from '../../src/config/loader.js';
import { GhExecutor } from '../../src/core/publish.js';

describe('Publish Engine', () => {
  let tempRepo: string;
  let remoteRepo: string;
  let orchestrator: MannostreeOrchestrator;
  let mockGh: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Bare remote repository
    remoteRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'mannostree-remote-'));
    execSync('git init --bare -b main', { cwd: remoteRepo });

    // Working local repository
    tempRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'mannostree-publish-test-'));
    execSync('git init -b main', { cwd: tempRepo });
    execSync('git config user.name "Publish Tester"', { cwd: tempRepo });
    execSync('git config user.email "publish@example.com"', { cwd: tempRepo });
    execSync(`git remote add origin ${remoteRepo}`, { cwd: tempRepo });
    fs.writeFileSync(path.join(tempRepo, 'README.md'), '# Base Project\n', 'utf-8');
    execSync('git add README.md && git commit -m "Initial commit"', { cwd: tempRepo });
    execSync('git push -u origin main', { cwd: tempRepo });

    mockGh = vi.fn();

    const config = loadConfig(undefined, tempRepo);
    orchestrator = new MannostreeOrchestrator(
      tempRepo,
      config,
      mockGh as unknown as GhExecutor
    );
  });

  afterEach(() => {
    try {
      execSync('git worktree prune', { cwd: tempRepo });
    } catch {
      // ignore
    }
    fs.rmSync(tempRepo, { recursive: true, force: true });
    fs.rmSync(remoteRepo, { recursive: true, force: true });
  });

  it('assembles PR body from durable task artifacts in prepare-only mode', async () => {
    await orchestrator.spawn({ name: 'pr-feat', baseBranch: 'main', noSetup: true });
    const wtPath = path.join(tempRepo, '.worktrees', 'pr-feat');

    // Add content to RESULTS.md
    fs.writeFileSync(path.join(wtPath, 'RESULTS.md'), '## Summary\nImplemented pr-feat cleanly.\n', 'utf-8');

    const prRes = await orchestrator.pr('feature-pr-feat', {
      title: 'feat: deliver pr-feat',
    });

    expect(prRes.ok).toBe(true);
    expect(prRes.result?.mode).toBe('prepare-only');
    expect(prRes.result?.body).toContain('Implemented pr-feat cleanly.');
    expect(fs.existsSync(path.join(wtPath, '.task', 'pr-body.md'))).toBe(true);
    expect(mockGh).not.toHaveBeenCalled();
  });

  it('previews PR compilation without writing file in dry-run mode', async () => {
    await orchestrator.spawn({ name: 'dry-pr-feat', baseBranch: 'main', noSetup: true });
    const wtPath = path.join(tempRepo, '.worktrees', 'dry-pr-feat');
    const prBodyFile = path.join(wtPath, '.task', 'pr-body.md');

    const prRes = await orchestrator.pr('feature-dry-pr-feat', {
      dryRun: true,
    });

    expect(prRes.ok).toBe(true);
    expect(prRes.dry_run).toBe(true);
    expect(fs.existsSync(prBodyFile)).toBe(false);
    expect(mockGh).not.toHaveBeenCalled();
  });

  it('executes git push and invokes gh pr create when --push is passed', async () => {
    await orchestrator.spawn({ name: 'push-feat', baseBranch: 'main', noSetup: true });
    const wtPath = path.join(tempRepo, '.worktrees', 'push-feat');

    fs.writeFileSync(path.join(wtPath, 'index.ts'), 'export const x = 1;\n', 'utf-8');
    execSync('git add index.ts && git commit -m "feat: add x"', { cwd: wtPath });

    mockGh.mockResolvedValueOnce({
      stdout: 'https://github.com/ludmansolutions/mannostree/pull/42\n',
      stderr: '',
    });

    const prRes = await orchestrator.pr('feature-push-feat', {
      push: true,
      draft: true,
      title: 'feat: deliver push-feat',
    });

    expect(prRes.ok).toBe(true);
    expect(prRes.result?.mode).toBe('published');
    expect(prRes.result?.pr_url).toBe('https://github.com/ludmansolutions/mannostree/pull/42');
    expect(prRes.result?.pr_number).toBe(42);

    // Verify gh CLI arguments
    expect(mockGh).toHaveBeenCalledTimes(1);
    const calledArgs = mockGh.mock.calls[0][0];
    expect(calledArgs).toContain('pr');
    expect(calledArgs).toContain('create');
    expect(calledArgs).toContain('--head');
    expect(calledArgs).toContain('feature/push-feat');
    expect(calledArgs).toContain('--base');
    expect(calledArgs).toContain('main');
    expect(calledArgs).toContain('--draft');
    expect(calledArgs).toContain('--title');

    // Verify metadata was updated
    const updatedRecord = await orchestrator.store.getWorktree('feature-push-feat');
    expect(updatedRecord?.publish?.pushed).toBe(true);
    expect(updatedRecord?.publish?.pr_number).toBe(42);
    expect(updatedRecord?.publish?.pr_url).toBe('https://github.com/ludmansolutions/mannostree/pull/42');
    expect(updatedRecord?.lifecycle_state).toBe('PR_OPEN');
  });

  it('handles gh CLI failure gracefully when branch push succeeds', async () => {
    await orchestrator.spawn({ name: 'push-fail-feat', baseBranch: 'main', noSetup: true });
    const wtPath = path.join(tempRepo, '.worktrees', 'push-fail-feat');

    fs.writeFileSync(path.join(wtPath, 'file.ts'), 'export const y = 2;\n', 'utf-8');
    execSync('git add file.ts && git commit -m "feat: add y"', { cwd: wtPath });

    mockGh.mockRejectedValueOnce(new Error('gh: command not found'));

    const prRes = await orchestrator.pr('feature-push-fail-feat', {
      push: true,
    });

    expect(prRes.ok).toBe(true);
    expect(prRes.result?.mode).toBe('published');
    expect(prRes.result?.pr_url).toBeNull();
    expect(prRes.result?.instructions).toContain('pushed to remote');
  });
});
