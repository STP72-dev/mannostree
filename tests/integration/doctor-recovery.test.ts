import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';

describe('Doctor Recovery Integration', () => {
  let tempRepo: string;
  const binPath = path.resolve(__dirname, '../../bin/mannostree.js');

  beforeEach(() => {
    tempRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'mannostree-doc-recovery-'));
    execSync('git init -b main', { cwd: tempRepo });
    execSync('git config user.name "Doctor Recovery Tester"', { cwd: tempRepo });
    execSync('git config user.email "doc-recovery@example.com"', { cwd: tempRepo });
    fs.writeFileSync(path.join(tempRepo, 'README.md'), '# Doc Recovery Repo\n', 'utf-8');
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

  it('runs doctor command via CLI binary to detect out-of-band folder deletion and guides repair', () => {
    execSync(`node ${binPath} spawn feature-oob -b main --json`, {
      cwd: tempRepo,
      encoding: 'utf-8',
    });

    const wtDir = path.join(tempRepo, '.worktrees', 'feature-oob');
    expect(fs.existsSync(wtDir)).toBe(true);

    // Delete directory out-of-band
    fs.rmSync(wtDir, { recursive: true, force: true });

    let doctorOut = '';
    let exitCode = 0;
    try {
      doctorOut = execSync(`node ${binPath} doctor --json`, {
        cwd: tempRepo,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (err: any) {
      exitCode = err.status;
      doctorOut = err.stdout ? err.stdout.toString() : '';
    }

    // Doctor with unhealed issues returns ok: false
    expect(exitCode).toBe(1);
    const parsed = JSON.parse(doctorOut);
    expect(parsed.ok).toBe(false);
    expect(parsed.result.healthy).toBe(false);
    expect(parsed.result.findings.some((f: any) => f.type === 'MISSING_DISK')).toBe(true);
  });
});
