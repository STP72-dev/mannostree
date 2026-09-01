import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BIN_PATH = path.resolve(__dirname, '../../bin/mannostree.js');

describe('Agent Fulfillment & Scorecard Integration', () => {
  let tempRepo: string;

  beforeEach(() => {
    tempRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'mannostree-agent-verify-'));
    execSync('git init -b main', { cwd: tempRepo });
    execSync('git config user.name "Verify Tester"', { cwd: tempRepo });
    execSync('git config user.email "verify@example.com"', { cwd: tempRepo });
    fs.writeFileSync(path.join(tempRepo, 'README.md'), '# Verify Repo\n', 'utf-8');
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

  it('rejects fulfillment when acceptance criteria are unchecked', () => {
    execSync(`node "${BIN_PATH}" spawn test-verify --base-branch main`, { cwd: tempRepo });
    execSync(
      `node "${BIN_PATH}" agent dispatch feature-test-verify --title "Unchecked Task" --criteria "Task 1" "Task 2"`,
      { cwd: tempRepo }
    );

    // Run verification on unchecked contract
    try {
      execSync(`node "${BIN_PATH}" agent verify feature-test-verify --json`, {
        cwd: tempRepo,
        encoding: 'utf-8',
      });
    } catch (err: any) {
      const output = JSON.parse(err.stdout);
      expect(output.ok).toBe(false);
      expect(output.result.report.status).toBe('rejected');
      expect(output.result.report.unmet_criteria.length).toBe(2);
      expect(output.warnings.length).toBeGreaterThan(0);
    }

    // Verify diagnostic file was written
    const reviewPath = path.join(tempRepo, '.worktrees', 'test-verify', '.task', 'review.md');
    expect(fs.existsSync(reviewPath)).toBe(true);
    const reviewContent = fs.readFileSync(reviewPath, 'utf-8');
    expect(reviewContent).toContain('REJECTED');
    expect(reviewContent).toContain('Unmet Acceptance Criteria');
  });

  it('certifies fulfillment and generates scorecard when criteria are checked', () => {
    execSync(`node "${BIN_PATH}" spawn test-pass --base-branch main`, { cwd: tempRepo });
    execSync(
      `node "${BIN_PATH}" agent dispatch feature-test-pass --title "Checked Task" --criteria "Task Done"`,
      { cwd: tempRepo }
    );

    // Manually mark criteria complete in contract
    const contractPath = path.join(tempRepo, '.worktrees', 'test-pass', '.task', 'task-contract.md');
    let contractContent = fs.readFileSync(contractPath, 'utf-8');
    contractContent = contractContent.replace(/- \[ \] AC-001/, '- [x] AC-001');
    fs.writeFileSync(contractPath, contractContent, 'utf-8');

    // Create a modified file to produce diff statistics
    const wtPath = path.join(tempRepo, '.worktrees', 'test-pass');
    fs.writeFileSync(path.join(wtPath, 'solution.ts'), 'export const solution = 42;\n', 'utf-8');
    execSync('git add solution.ts && git commit -m "Implement solution"', { cwd: wtPath });

    // Run verification
    const verifyOut = execSync(`node "${BIN_PATH}" agent verify feature-test-pass --json`, {
      cwd: tempRepo,
      encoding: 'utf-8',
    });
    const verifyJson = JSON.parse(verifyOut);
    expect(verifyJson.ok).toBe(true);
    expect(verifyJson.result.report.status).toBe('fulfilled');
    expect(verifyJson.result.scorecard).toBeDefined();
    expect(verifyJson.result.scorecard.git_diff.files_changed).toBe(1);

    // Verify scorecard artifact was written
    const scorecardPath = path.join(wtPath, '.task', 'scorecard.md');
    expect(fs.existsSync(scorecardPath)).toBe(true);
    const scorecardContent = fs.readFileSync(scorecardPath, 'utf-8');
    expect(scorecardContent).toContain('FULFILLED');
    expect(scorecardContent).toContain('Summary Metrics');
  });
});
