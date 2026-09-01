import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BIN_PATH = path.resolve(__dirname, '../../bin/mannostree.js');

function formatArgs(args: string[]): string {
  return args.map((a) => (a.includes(' ') ? JSON.stringify(a) : a)).join(' ');
}

function runCliJson(args: string[], cwd: string): any {
  const output = execSync(`node ${BIN_PATH} ${formatArgs(args)} --json`, {
    cwd,
    encoding: 'utf-8',
    env: { ...process.env, NO_COLOR: '1' },
  });
  return JSON.parse(output);
}

describe('Movement 5: Parallel Winner Publishing CLI Integration', () => {
  let tempRepo: string;

  beforeEach(() => {
    tempRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'mannostree-parallel-pub-cli-'));
    execSync('git init -b main', { cwd: tempRepo });
    execSync('git config user.name "Publish Tester"', { cwd: tempRepo });
    execSync('git config user.email "pubtest@example.com"', { cwd: tempRepo });
    fs.writeFileSync(path.join(tempRepo, 'README.md'), '# Parallel Publish Test Repo\n', 'utf-8');
    execSync('git add README.md && git commit -m "Initial commit"', { cwd: tempRepo });
  });

  afterEach(() => {
    fs.rmSync(tempRepo, { recursive: true, force: true });
  });

  it('runs parallel publish --preview via CLI binary and returns structured JSON with embedded comparison', () => {
    // 1. Spawn 2 variants
    runCliJson(['parallel', 'spawn', 'auth-feat', '-n', '2', '-b', 'main'], tempRepo);

    // 2. Pick winner
    runCliJson(['parallel', 'pick', 'auth-feat', '--winner', 'v1', '--reason', 'Fastest performance'], tempRepo);

    // 3. Publish preview
    const exportPath = path.join(tempRepo, 'exported-pr.md');
    const pubRes = runCliJson(['parallel', 'publish', 'auth-feat', '--preview', '--export-pr', exportPath], tempRepo);

    expect(pubRes.ok).toBe(true);
    expect(pubRes.command).toBe('parallel publish');
    expect(pubRes.result.feature_name).toBe('auth-feat');
    expect(pubRes.result.pushed).toBe(false);
    expect(pubRes.result.pr_title).toContain('auth-feat');
    expect(pubRes.result.pr_body).toContain('# Pull Request: auth-feat');
    expect(fs.existsSync(exportPath)).toBe(true);
  });
});
