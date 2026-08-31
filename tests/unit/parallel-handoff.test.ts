import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { MannostreeOrchestrator } from '../../src/core/orchestrator.js';
import { loadConfig } from '../../src/config/loader.js';

describe('Parallel Handoff Engine', () => {
  let tempRepo: string;
  let orchestrator: MannostreeOrchestrator;

  beforeEach(() => {
    tempRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'mannostree-handoff-test-'));
    execSync('git init -b main', { cwd: tempRepo });
    execSync('git config user.name "Handoff Tester"', { cwd: tempRepo });
    execSync('git config user.email "handoff@example.com"', { cwd: tempRepo });
    fs.writeFileSync(path.join(tempRepo, 'README.md'), '# Handoff Repo\n', 'utf-8');
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

  it('generates parallel handoff package with winner rationale and preserved losers', async () => {
    // 1. Spawn variants
    await orchestrator.parallelSpawn({
      feature: 'perf-opt',
      count: 2,
      baseBranch: 'main',
    });

    const v1Path = path.join(tempRepo, '.worktrees', 'perf-opt-v1');
    const v2Path = path.join(tempRepo, '.worktrees', 'perf-opt-v2');

    // Make commits on variants
    fs.writeFileSync(path.join(v1Path, 'perf1.txt'), 'fast\n', 'utf-8');
    execSync('git add . && git commit -m "Optimize path 1"', { cwd: v1Path });

    fs.writeFileSync(path.join(v2Path, 'perf2.txt'), 'faster\n', 'utf-8');
    execSync('git add . && git commit -m "Optimize path 2"', { cwd: v2Path });

    // 2. Pick v2 as winner
    await orchestrator.parallelPick({
      feature: 'perf-opt',
      winner: 'experiment-perf-opt-v2',
      reason: '2x throughput in benchmarks',
    });

    // 3. Generate parallel handoff
    const handoffRes = await orchestrator.parallelHandoff('perf-opt', {
      to: 'Reviewer Agent',
      notes: 'Please review benchmark findings',
    });

    expect(handoffRes.ok).toBe(true);
    const pkg = handoffRes.result;
    expect(pkg?.winner.variant_id).toBe('experiment-perf-opt-v2');
    expect(pkg?.winner.selection_rationale).toBe('2x throughput in benchmarks');
    expect(pkg?.comparison_scorecard.length).toBe(2);
    expect(pkg?.preserved_losers.length).toBe(1);
    expect(pkg?.preserved_losers[0].variant_id).toBe('experiment-perf-opt-v1');

    // Check handoff JSON and Markdown files
    const handoffJson = path.join(
      tempRepo,
      '.mannostree',
      'experiments',
      'perf-opt-handoff.json'
    );
    expect(fs.existsSync(handoffJson)).toBe(true);

    const handoffMd = path.join(v2Path, '.task', 'parallel-handoff.md');
    expect(fs.existsSync(handoffMd)).toBe(true);
    const mdContent = fs.readFileSync(handoffMd, 'utf-8');
    expect(mdContent).toContain('Parallel Experiment Handoff: perf-opt');
    expect(mdContent).toContain('2x throughput in benchmarks');
    expect(mdContent).toContain('Preserved Non-Winning Variants');
  });
});
