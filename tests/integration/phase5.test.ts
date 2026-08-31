import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';

describe('Mannostree Phase 5 CLI Integration', () => {
  let tempRepo: string;
  const binPath = path.resolve(__dirname, '../../bin/mannostree.js');

  beforeEach(() => {
    tempRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'mannostree-phase5-cli-test-'));
    execSync('git init -b main', { cwd: tempRepo });
    execSync('git config user.name "Phase 5 Tester"', { cwd: tempRepo });
    execSync('git config user.email "p5@example.com"', { cwd: tempRepo });
    fs.writeFileSync(path.join(tempRepo, 'README.md'), '# Phase 5 Integration Repo\n', 'utf-8');
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

  it('runs pr, issue, task, and handoff commands cleanly via CLI binary', () => {
    // 1. Spawn
    execSync(`node ${binPath} spawn p5-cli-feat -b main --no-setup`, { cwd: tempRepo });

    // 2. Issue link
    const issueOut = execSync(
      `node ${binPath} issue feature-p5-cli-feat --from-issue 88 --title "Fix authentication race condition" --json`,
      { cwd: tempRepo, encoding: 'utf-8' }
    );
    const issueParsed = JSON.parse(issueOut);
    expect(issueParsed.command).toBe('issue');
    expect(issueParsed.ok).toBe(true);
    expect(issueParsed.result.issue_number).toBe(88);

    // 3. Task validate
    const taskOut = execSync(
      `node ${binPath} task feature-p5-cli-feat --json`,
      { cwd: tempRepo, encoding: 'utf-8' }
    );
    const taskParsed = JSON.parse(taskOut);
    expect(taskParsed.command).toBe('task');
    expect(taskParsed.ok).toBe(true);
    expect(taskParsed.result.complete).toBe(true);

    // 4. PR prepare-only
    const prOut = execSync(
      `node ${binPath} pr feature-p5-cli-feat --json`,
      { cwd: tempRepo, encoding: 'utf-8' }
    );
    const prParsed = JSON.parse(prOut);
    expect(prParsed.command).toBe('pr');
    expect(prParsed.ok).toBe(true);
    expect(prParsed.result.mode).toBe('prepare-only');

    // 5. Handoff
    const handoffOut = execSync(
      `node ${binPath} handoff feature-p5-cli-feat --to "Lead Architect" --notes "Ready for final sign-off." --json`,
      { cwd: tempRepo, encoding: 'utf-8' }
    );
    const handoffParsed = JSON.parse(handoffOut);
    expect(handoffParsed.command).toBe('handoff');
    expect(handoffParsed.ok).toBe(true);
    expect(handoffParsed.result.target_recipient).toBe('Lead Architect');
  });
});
