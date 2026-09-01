import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BIN_PATH = path.resolve(__dirname, '../../bin/mannostree.js');

describe('Parallel Matrix Evaluation CLI Integration', () => {
  let tempRepo: string;

  beforeEach(() => {
    tempRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'mannostree-parallel-eval-cli-'));
    execSync('git init -b main', { cwd: tempRepo });
    execSync('git config user.name "Matrix CLI Tester"', { cwd: tempRepo });
    execSync('git config user.email "matrix-tester@example.com"', { cwd: tempRepo });
    fs.writeFileSync(path.join(tempRepo, 'README.md'), '# Parallel Eval Repo\n', 'utf-8');
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

  it('runs parallel eval across spawned variants and outputs structured JSON matrix report', () => {
    // 1. Spawn 2 variants
    execSync(`node "${BIN_PATH}" parallel spawn cache-spike -n 2 -b main`, { cwd: tempRepo });

    // 2. Add modified files to variants to simulate different diffs
    const wt1 = path.join(tempRepo, '.worktrees', 'cache-spike-v1');
    const wt2 = path.join(tempRepo, '.worktrees', 'cache-spike-v2');

    fs.writeFileSync(path.join(wt1, 'cache.ts'), 'export const cache = "v1";\n', 'utf-8');
    execSync('git add cache.ts && git commit -m "Cache v1"', { cwd: wt1 });

    fs.writeFileSync(path.join(wt2, 'cache.ts'), 'export const cache = "v2_larger_implementation";\nexport const helper = 1;\n', 'utf-8');
    execSync('git add cache.ts && git commit -m "Cache v2"', { cwd: wt2 });

    // 3. Run parallel eval
    const evalOut = execSync(
      `node "${BIN_PATH}" parallel eval cache-spike --matrix "true" --json`,
      { cwd: tempRepo, encoding: 'utf-8' }
    );

    const evalJson = JSON.parse(evalOut);
    expect(evalJson.ok).toBe(true);
    expect(evalJson.result.report.feature_name).toBe('cache-spike');
    expect(evalJson.result.report.variants.length).toBe(2);
    expect(evalJson.result.report.recommended_winner_id).toBeDefined();

    // Verify matrix report was written to lead worktree
    const reportPath = path.join(wt1, '.task', 'matrix-report.md');
    expect(fs.existsSync(reportPath)).toBe(true);
    const reportContent = fs.readFileSync(reportPath, 'utf-8');
    expect(reportContent).toContain('Comparative Evaluation Matrix: cache-spike');
    expect(reportContent).toContain('Multi-Variant Comparison Matrix');
  });

  it('supports --auto-pick to immediately promote winning variant while preserving competitors', () => {
    execSync(`node "${BIN_PATH}" parallel spawn auth-spike -n 2 -b main`, { cwd: tempRepo });

    // Run parallel eval with --auto-pick
    const evalOut = execSync(
      `node "${BIN_PATH}" parallel eval auth-spike --matrix "true" --auto-pick --json`,
      { cwd: tempRepo, encoding: 'utf-8' }
    );

    const evalJson = JSON.parse(evalOut);
    expect(evalJson.ok).toBe(true);
    expect(evalJson.result.picked_winner).toBeDefined();

    // Verify experiment metadata in .mannostree
    const expPath = path.join(tempRepo, '.mannostree', 'experiments', 'auth-spike.json');
    expect(fs.existsSync(expPath)).toBe(true);
    const expData = JSON.parse(fs.readFileSync(expPath, 'utf-8'));
    expect(expData.winner).toBe(evalJson.result.picked_winner);
    expect(expData.eval_matrix).toBeDefined();
    expect(expData.variants.length).toBe(2);
  });
});
