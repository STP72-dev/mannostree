import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { MannostreeOrchestrator } from '../../src/core/orchestrator.js';

describe('Issue Sync Lifecycle Integration', () => {
  let repoDir: string;

  beforeEach(() => {
    repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mannostree-issue-int-'));

    // Initialize git repo
    execSync('git init -b main', { cwd: repoDir, stdio: 'ignore' });
    execSync('git config user.email "test@example.com"', { cwd: repoDir, stdio: 'ignore' });
    execSync('git config user.name "Test User"', { cwd: repoDir, stdio: 'ignore' });

    fs.writeFileSync(path.join(repoDir, 'README.md'), '# Test Project\n');
    execSync('git add . && git commit -m "initial commit"', { cwd: repoDir, stdio: 'ignore' });
  });

  afterEach(() => {
    if (fs.existsSync(repoDir)) {
      try {
        fs.rmSync(repoDir, { recursive: true, force: true });
      } catch {
        // ignore cleanup error
      }
    }
  });

  it('spawns worktree with --issue, ingests contract, and auto-transitions', async () => {
    const orchestrator = new MannostreeOrchestrator(repoDir, {
      version: 1,
      metadata_root: '.mannostree',
      worktree_root: '.worktrees',
      artifact_dir_name: '.task',
      profiles: {
        default: {
          install_commands: [],
          env_mode: 'skip',
          env_files: [],
          env_vars: {},
          validation_commands: [],
        },
      },
      issues: {
        default_provider: 'generic',
        auto_transition: true,
        transitions: {
          on_spawn: 'In Progress',
          on_pr: 'In Review',
        },
      },
    } as any);

    // 1. Spawn worktree with issue key
    const spawnRes = await orchestrator.spawn({
      name: 'auth-v2',
      baseBranch: 'main',
      issue: 'ENG-505',
    });

    expect(spawnRes.ok).toBe(true);
    expect(spawnRes.result.id).toBe('feature-auth-v2');

    // 2. Verify .task/task-contract.md generated
    const contractFile = path.join(spawnRes.result.worktree_path, '.task', 'task-contract.md');
    const fullContractPath = path.resolve(repoDir, contractFile);
    expect(fs.existsSync(fullContractPath)).toBe(true);

    const contractContent = fs.readFileSync(fullContractPath, 'utf-8');
    expect(contractContent).toContain('# Task Contract: [ENG-505]');

    // 3. Verify .mannostree/issues/ENG-505.json cached
    const issueRecord = await orchestrator.store.getIssueRecord('ENG-505');
    expect(issueRecord).toBeDefined();
    expect(issueRecord?.key).toBe('ENG-505');
    expect(issueRecord?.status).toBe('In Progress');

    // 4. Verify worktree metadata records issue
    const wtRecord = await orchestrator.store.getWorktree('feature-auth-v2');
    expect((wtRecord?.task as any)?.issue_key).toBe('ENG-505');
    expect((wtRecord?.task as any)?.issue_status).toBe('In Progress');

    // 5. Test evidence synchronization
    const resultsPath = path.join(repoDir, spawnRes.result.worktree_path, '.task', 'RESULTS.md');
    fs.writeFileSync(resultsPath, '### Test Matrix Results: 100% Passed\n');

    const syncRes = await orchestrator.issueSyncEngine.syncEvidence({
      worktreeId: 'feature-auth-v2',
      provider: 'generic',
    });

    expect(syncRes.commentResult.success).toBe(true);
    expect(syncRes.evidenceSummary).toContain('100% Passed');

    // 6. Test issue status drift dashboard
    const driftSummaries = await orchestrator.issueSyncEngine.checkIssueDrift('feature-auth-v2');
    expect(driftSummaries).toHaveLength(1);
    expect(driftSummaries[0].issue_key).toBe('ENG-505');
    expect(driftSummaries[0].drift_detected).toBe(false);
  });
});
