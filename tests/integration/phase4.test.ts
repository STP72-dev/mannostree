import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';

describe('Mannostree Phase 4 CLI Integration', () => {
  let tempRepo: string;
  const binPath = path.resolve(__dirname, '../../bin/mannostree.js');

  beforeEach(() => {
    tempRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'mannostree-phase4-cli-test-'));
    execSync('git init -b main', { cwd: tempRepo });
    execSync('git config user.name "Phase 4 Tester"', { cwd: tempRepo });
    execSync('git config user.email "p4@example.com"', { cwd: tempRepo });
    fs.writeFileSync(path.join(tempRepo, 'README.md'), '# Phase 4 Integration Repo\n', 'utf-8');
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

  it('runs parallel spawn, list, compare, pick, and drop via CLI binary with JSON output', () => {
    // 1. Parallel spawn
    const spawnOut = execSync(
      `node ${binPath} parallel spawn data-pipeline -n 2 -b main --json`,
      { cwd: tempRepo, encoding: 'utf-8' }
    );
    const spawnParsed = JSON.parse(spawnOut);
    expect(spawnParsed.command).toBe('parallel spawn');
    expect(spawnParsed.ok).toBe(true);
    expect(spawnParsed.result.variants.length).toBe(2);

    // 2. Parallel list
    const listOut = execSync(
      `node ${binPath} parallel list --json`,
      { cwd: tempRepo, encoding: 'utf-8' }
    );
    const listParsed = JSON.parse(listOut);
    expect(listParsed.command).toBe('parallel list');
    expect(listParsed.ok).toBe(true);
    expect(listParsed.result.length).toBe(1);
    expect(listParsed.result[0].feature).toBe('data-pipeline');

    // 3. Parallel compare
    const compareOut = execSync(
      `node ${binPath} parallel compare data-pipeline --json`,
      { cwd: tempRepo, encoding: 'utf-8' }
    );
    const compareParsed = JSON.parse(compareOut);
    expect(compareParsed.command).toBe('parallel compare');
    expect(compareParsed.ok).toBe(true);
    expect(compareParsed.result.variants.length).toBe(2);

    // 4. Parallel pick
    const pickOut = execSync(
      `node ${binPath} parallel pick data-pipeline --winner v1 --json`,
      { cwd: tempRepo, encoding: 'utf-8' }
    );
    const pickParsed = JSON.parse(pickOut);
    expect(pickParsed.command).toBe('parallel pick');
    expect(pickParsed.ok).toBe(true);
    expect(pickParsed.result.winner).toBe('experiment-data-pipeline-v1');

    // 5. Parallel drop
    const dropOut = execSync(
      `node ${binPath} parallel drop data-pipeline --yes --force --json`,
      { cwd: tempRepo, encoding: 'utf-8' }
    );
    const dropParsed = JSON.parse(dropOut);
    expect(dropParsed.command).toBe('parallel drop');
    expect(dropParsed.ok).toBe(true);
    expect(dropParsed.result.experiment_deleted).toBe(true);
  });
});
