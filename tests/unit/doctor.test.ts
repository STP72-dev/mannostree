import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { MannostreeOrchestrator } from '../../src/core/orchestrator.js';
import { loadConfig } from '../../src/config/loader.js';

describe('Doctor Diagnostics Engine', () => {
  let tempRepo: string;
  let orchestrator: MannostreeOrchestrator;

  beforeEach(() => {
    tempRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'mannostree-doc-test-'));
    execSync('git init -b main', { cwd: tempRepo });
    execSync('git config user.name "Doc Tester"', { cwd: tempRepo });
    execSync('git config user.email "doc@example.com"', { cwd: tempRepo });
    fs.writeFileSync(path.join(tempRepo, 'README.md'), '# Doctor test\n', 'utf-8');
    execSync('git add README.md && git commit -m "Initial commit"', { cwd: tempRepo });

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

  it('reports healthy state when all records and worktrees are aligned', async () => {
    await orchestrator.spawn({ name: 'healthy-feature', baseBranch: 'main' });

    const report = await orchestrator.doctor();
    expect(report.ok).toBe(true);
    expect(report.result?.healthy).toBe(true);
    expect(report.result?.error_count).toBe(0);
  });

  it('detects missing on-disk worktree directory and proposes repair', async () => {
    await orchestrator.spawn({ name: 'missing-disk-feature', baseBranch: 'main' });

    // Manually delete the worktree folder
    const wtPath = path.join(tempRepo, '.worktrees', 'missing-disk-feature');
    fs.rmSync(wtPath, { recursive: true, force: true });

    const report = await orchestrator.doctor();
    expect(report.ok).toBe(false);
    expect(report.result?.healthy).toBe(false);
    expect(report.result?.findings.some((f) => f.type === 'MISSING_DISK')).toBe(true);

    // Apply repair with --fix --yes
    const fixed = await orchestrator.doctor({ fix: true, yes: true });
    expect(fixed.result?.repairs_applied?.length).toBeGreaterThan(0);
  });

  it('detects untracked directory in worktree_root without modifying it', async () => {
    const untrackedPath = path.join(tempRepo, '.worktrees', 'untracked-custom-folder');
    fs.mkdirSync(untrackedPath, { recursive: true });
    fs.writeFileSync(path.join(untrackedPath, 'notes.txt'), 'secret notes', 'utf-8');

    const report = await orchestrator.doctor();
    const untrackedFinding = report.result?.findings.find((f) => f.type === 'UNTRACKED_DIR');
    expect(untrackedFinding).toBeDefined();

    // Confirm doctor never deletes or alters untracked directories
    expect(fs.existsSync(untrackedPath)).toBe(true);
    expect(fs.existsSync(path.join(untrackedPath, 'notes.txt'))).toBe(true);
  });
});
