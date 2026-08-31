import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { MannostreeOrchestrator } from '../../src/core/orchestrator.js';
import { loadConfig } from '../../src/config/loader.js';

describe('Task Engine & Handoff', () => {
  let tempRepo: string;
  let orchestrator: MannostreeOrchestrator;

  beforeEach(() => {
    tempRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'mannostree-task-test-'));
    execSync('git init -b main', { cwd: tempRepo });
    execSync('git config user.name "Task Tester"', { cwd: tempRepo });
    execSync('git config user.email "task@example.com"', { cwd: tempRepo });
    fs.writeFileSync(path.join(tempRepo, 'README.md'), '# Base Project\n', 'utf-8');
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

  it('validates task artifact completeness', async () => {
    await orchestrator.spawn({ name: 'validate-feat', baseBranch: 'main', noSetup: true });
    const wtPath = path.join(tempRepo, '.worktrees', 'validate-feat');

    const taskRes = await orchestrator.task('feature-validate-feat', { validate: true });
    expect(taskRes.ok).toBe(true);
    expect(taskRes.result?.score_percentage).toBe(100);
    expect(taskRes.result?.artifacts.task_contract.present).toBe(true);
    expect(taskRes.result?.artifacts.results.present).toBe(true);
  });

  it('links GitHub issue and updates task contract file', async () => {
    await orchestrator.spawn({ name: 'issue-feat', baseBranch: 'main', noSetup: true });
    const wtPath = path.join(tempRepo, '.worktrees', 'issue-feat');

    const issueRes = await orchestrator.issue('feature-issue-feat', {
      issue: 42,
      title: 'Support multi-tenant authorization',
    });

    expect(issueRes.ok).toBe(true);
    expect(issueRes.result?.issue_number).toBe(42);

    const record = await orchestrator.store.getWorktree('feature-issue-feat');
    expect(record?.task?.issue_number).toBe(42);
    expect(record?.task?.issue_title).toContain('multi-tenant');

    const contractFile = path.join(wtPath, '.task', 'task-contract.md');
    expect(fs.readFileSync(contractFile, 'utf-8')).toContain('Issue #42');
  });

  it('generates agent and human handoff package', async () => {
    await orchestrator.spawn({ name: 'handoff-feat', baseBranch: 'main', noSetup: true });

    const handoffRes = await orchestrator.handoff('feature-handoff-feat', {
      to: 'QA Specialist',
      notes: 'Ready for full regression and penetration testing.',
    });

    expect(handoffRes.ok).toBe(true);
    expect(handoffRes.result?.target_recipient).toBe('QA Specialist');
    expect(handoffRes.result?.handoff_notes).toContain('penetration testing');
    expect(handoffRes.result?.git_summary).toBeDefined();
  });
});
