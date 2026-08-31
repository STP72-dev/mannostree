import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';

describe('Parallel Handoff CLI Integration', () => {
  let tempRepo: string;
  const binPath = path.resolve(__dirname, '../../bin/mannostree.js');

  beforeEach(() => {
    tempRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'mannostree-cli-handoff-'));
    execSync('git init -b main', { cwd: tempRepo });
    execSync('git config user.name "Handoff CLI Tester"', { cwd: tempRepo });
    execSync('git config user.email "handoffcli@example.com"', { cwd: tempRepo });
    fs.writeFileSync(path.join(tempRepo, 'README.md'), '# Handoff CLI Repo\n', 'utf-8');
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

  it('executes full spawn -> compare -> pick -> handoff pipeline via CLI binary', () => {
    // 1. Spawn
    execSync(`node ${binPath} parallel spawn data-pipeline -n 2 -b main --json`, {
      cwd: tempRepo,
      encoding: 'utf-8',
    });

    const v1Path = path.join(tempRepo, '.worktrees', 'data-pipeline-v1');
    const v2Path = path.join(tempRepo, '.worktrees', 'data-pipeline-v2');

    // Commit changes
    fs.writeFileSync(path.join(v1Path, 'pipeline1.ts'), 'console.log("v1");\n', 'utf-8');
    execSync('git add . && git commit -m "Pipeline v1 implementation"', { cwd: v1Path });

    fs.writeFileSync(path.join(v2Path, 'pipeline2.ts'), 'console.log("v2");\n', 'utf-8');
    execSync('git add . && git commit -m "Pipeline v2 implementation"', { cwd: v2Path });

    // 2. Compare
    const compareOut = execSync(
      `node ${binPath} parallel compare data-pipeline --json`,
      {
        cwd: tempRepo,
        encoding: 'utf-8',
      }
    );
    const compareParsed = JSON.parse(compareOut);
    expect(compareParsed.ok).toBe(true);

    // 3. Pick winner
    const pickOut = execSync(
      `node ${binPath} parallel pick data-pipeline --winner experiment-data-pipeline-v1 --reason "Cleaner stream architecture" --json`,
      {
        cwd: tempRepo,
        encoding: 'utf-8',
      }
    );
    const pickParsed = JSON.parse(pickOut);
    expect(pickParsed.ok).toBe(true);

    // 4. Generate parallel handoff
    const handoffOut = execSync(
      `node ${binPath} parallel handoff data-pipeline --to "Lead Architect" --notes "Ready for merge review" --json`,
      {
        cwd: tempRepo,
        encoding: 'utf-8',
      }
    );
    const handoffParsed = JSON.parse(handoffOut);
    expect(handoffParsed.ok).toBe(true);
    expect(handoffParsed.result.winner.variant_id).toBe('experiment-data-pipeline-v1');
    expect(handoffParsed.result.preserved_losers.length).toBe(1);
    expect(handoffParsed.result.preserved_losers[0].variant_id).toBe('experiment-data-pipeline-v2');

    const handoffMd = path.join(v1Path, '.task', 'parallel-handoff.md');
    expect(fs.existsSync(handoffMd)).toBe(true);
  });
});
