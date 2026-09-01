import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { AgentRunner } from '../../src/core/agent-runner.js';
import { MetadataStore } from '../../src/metadata/store.js';
import { loadConfig } from '../../src/config/loader.js';
import { WorktreeRecord } from '../../src/types/index.js';

describe('AgentRunner', () => {
  let tempRepo: string;
  let store: MetadataStore;
  let runner: AgentRunner;

  beforeEach(() => {
    tempRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'mannostree-agent-runner-test-'));
    execSync('git init -b main', { cwd: tempRepo });
    execSync('git config user.name "Tester"', { cwd: tempRepo });
    execSync('git config user.email "test@example.com"', { cwd: tempRepo });
    fs.writeFileSync(path.join(tempRepo, 'README.md'), '# Temp\n', 'utf-8');
    execSync('git add README.md && git commit -m "Init"', { cwd: tempRepo });

    const config = loadConfig(undefined, tempRepo);
    store = new MetadataStore(tempRepo, config);
    runner = new AgentRunner(tempRepo, store, config);
  });

  afterEach(() => {
    fs.rmSync(tempRepo, { recursive: true, force: true });
  });

  it('interpolates command template tokens accurately', () => {
    const template = 'gemini --worktree {worktree_path} --contract {contract_path} --role {role} --feature {feature}';
    const interpolated = runner.interpolateCommand(template, {
      worktreePath: '/tmp/worktree',
      contractPath: '/tmp/contract.md',
      role: 'worker',
      feature: 'auth',
    });

    expect(interpolated).toBe('gemini --worktree /tmp/worktree --contract /tmp/contract.md --role worker --feature auth');
  });

  it('dispatches session and updates worktree lifecycle state', async () => {
    const wtDir = path.join(tempRepo, '.worktrees', 'worker-test');
    fs.mkdirSync(wtDir, { recursive: true });

    const now = new Date().toISOString();
    const record: WorktreeRecord = {
      version: 1,
      id: 'worker-test',
      repo_root: tempRepo,
      worktree_path: '.worktrees/worker-test',
      branch: 'feature/worker-test',
      base_branch: 'main',
      created_at: now,
      updated_at: now,
      status: 'created',
      lifecycle_state: 'WORKTREE_READY',
    };
    await store.saveWorktree(record);

    const session = await runner.dispatchSession({
      target: 'worker-test',
      role: 'worker',
      title: 'Implement Auth',
      criteria: ['Add login endpoint', 'Add password hash'],
    });

    expect(session.session_id).toBeDefined();
    expect(session.worktree_id).toBe('worker-test');
    expect(session.state).toBe('dispatched');

    // Verify task contract file was generated in sandbox
    const contractPath = path.join(wtDir, '.task', 'task-contract.md');
    expect(fs.existsSync(contractPath)).toBe(true);

    const contractContent = fs.readFileSync(contractPath, 'utf-8');
    expect(contractContent).toContain('Implement Auth');
    expect(contractContent).toContain('Add login endpoint');

    // Verify worktree record updated
    const updatedWt = await store.getWorktree('worker-test');
    expect(updatedWt?.status).toBe('dispatched');
    expect(updatedWt?.lifecycle_state).toBe('TASK_RESOLVED');
  });
});
