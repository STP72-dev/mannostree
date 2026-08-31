import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';

describe('Transaction Recovery Integration', () => {
  let tempRepo: string;
  const binPath = path.resolve(__dirname, '../../bin/mannostree.js');

  beforeEach(() => {
    tempRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'mannostree-tx-recovery-'));
    execSync('git init -b main', { cwd: tempRepo });
    execSync('git config user.name "Tx Tester"', { cwd: tempRepo });
    execSync('git config user.email "tx@example.com"', { cwd: tempRepo });
    fs.writeFileSync(path.join(tempRepo, 'README.md'), '# Tx Recovery Repo\n', 'utf-8');
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

  it('detects uncommitted transaction and recovers cleanly via recover command', () => {
    // Write an active uncommitted transaction directly into .mannostree/journal/active.json
    const journalDir = path.join(tempRepo, '.mannostree', 'journal');
    fs.mkdirSync(journalDir, { recursive: true });

    const activeTx = {
      transaction_id: 'tx_mock_interrupted_123',
      operation: 'spawn',
      entity_type: 'worktree',
      entity_id: 'feature-interrupted',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      state: 'in_flight',
      intents: [
        {
          file_path: path.join(tempRepo, '.mannostree', 'worktrees', 'feature-interrupted.json'),
          action: 'create',
        },
      ],
    };
    fs.writeFileSync(
      path.join(journalDir, 'active.json'),
      JSON.stringify(activeTx, null, 2),
      'utf-8'
    );

    // Also simulate the created file existing
    fs.mkdirSync(path.join(tempRepo, '.mannostree', 'worktrees'), { recursive: true });
    fs.writeFileSync(
      path.join(tempRepo, '.mannostree', 'worktrees', 'feature-interrupted.json'),
      JSON.stringify({ id: 'feature-interrupted' }),
      'utf-8'
    );

    // Run recover command
    const recoverOut = execSync(`node ${binPath} recover --yes --json`, {
      cwd: tempRepo,
      encoding: 'utf-8',
    });
    const parsed = JSON.parse(recoverOut);
    expect(parsed.ok).toBe(true);

    // Active transaction should be cleared and uncommitted file removed
    expect(fs.existsSync(path.join(journalDir, 'active.json'))).toBe(false);
    expect(
      fs.existsSync(
        path.join(tempRepo, '.mannostree', 'worktrees', 'feature-interrupted.json')
      )
    ).toBe(false);
  });
});
