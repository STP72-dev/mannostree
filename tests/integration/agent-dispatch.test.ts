import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BIN_PATH = path.resolve(__dirname, '../../bin/mannostree.js');

describe('Agent Dispatch CLI Integration', () => {
  let tempRepo: string;

  beforeEach(() => {
    tempRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'mannostree-agent-cli-'));
    execSync('git init -b main', { cwd: tempRepo });
    execSync('git config user.name "Agent Integration Tester"', { cwd: tempRepo });
    execSync('git config user.email "agent-tester@example.com"', { cwd: tempRepo });
    fs.writeFileSync(path.join(tempRepo, 'README.md'), '# Agent Test\n', 'utf-8');
    execSync('git add README.md && git commit -m "Initial commit"', { cwd: tempRepo });
  });

  afterEach(() => {
    try {
      execSync('git worktree prune', { cwd: tempRepo });
    } catch {
      // ignore
    }
    fs.rmSync(tempRepo, { recursive: true, force: true });
  });

  it('runs agent dispatch, status, and cancel via CLI binary', () => {
    // 1. Spawn a worktree
    execSync(`node "${BIN_PATH}" spawn test-worker --base-branch main`, { cwd: tempRepo });

    // 2. Dispatch agent session
    const dispatchOut = execSync(
      `node "${BIN_PATH}" agent dispatch feature-test-worker --title "Add Payment Retry" --criteria "Add exponential backoff" "Test timeout" --json`,
      { cwd: tempRepo, encoding: 'utf-8' }
    );
    const dispatchJson = JSON.parse(dispatchOut);
    expect(dispatchJson.ok).toBe(true);
    expect(dispatchJson.result.sessions.length).toBe(1);
    expect(dispatchJson.result.sessions[0].state).toBe('dispatched');

    // Verify task contract file was scaffolded
    const contractPath = path.join(tempRepo, '.worktrees', 'test-worker', '.task', 'task-contract.md');
    expect(fs.existsSync(contractPath)).toBe(true);

    // 3. Inspect agent status
    const statusOut = execSync(`node "${BIN_PATH}" agent status feature-test-worker --json`, {
      cwd: tempRepo,
      encoding: 'utf-8',
    });
    const statusJson = JSON.parse(statusOut);
    expect(statusJson.ok).toBe(true);
    expect(statusJson.result.sessions.length).toBe(1);

    // 4. Cancel session
    const cancelOut = execSync(`node "${BIN_PATH}" agent cancel feature-test-worker --json`, {
      cwd: tempRepo,
      encoding: 'utf-8',
    });
    const cancelJson = JSON.parse(cancelOut);
    expect(cancelJson.ok).toBe(true);
    expect(cancelJson.result.cancelled).toBe(true);
  });

  it('runs parallel agent dispatch across all variants of an experiment', () => {
    // 1. Spawn 2 variants
    execSync(`node "${BIN_PATH}" parallel spawn fleet-test --variants 2 --base-branch main`, { cwd: tempRepo });

    // 2. Dispatch parallel sessions
    const dispatchOut = execSync(
      `node "${BIN_PATH}" agent dispatch fleet-test --parallel --title "Implement Fleet" --json`,
      { cwd: tempRepo, encoding: 'utf-8' }
    );
    const dispatchJson = JSON.parse(dispatchOut);
    expect(dispatchJson.ok).toBe(true);
    expect(dispatchJson.result.sessions.length).toBe(2);

    // 3. Query fleet status
    const statusOut = execSync(`node "${BIN_PATH}" agent status --json`, {
      cwd: tempRepo,
      encoding: 'utf-8',
    });
    const statusJson = JSON.parse(statusOut);
    expect(statusJson.ok).toBe(true);
    expect(statusJson.result.sessions.length).toBeGreaterThanOrEqual(2);
  });
});
