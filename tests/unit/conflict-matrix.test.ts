import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { FleetEngine } from '../../src/core/fleet.js';
import { GitEngine } from '../../src/git/engine.js';
import { MetadataStore } from '../../src/metadata/store.js';
import { loadConfig } from '../../src/config/loader.js';
import { WorktreeRecord } from '../../src/types/index.js';

describe('FleetEngine Conflict Matrix Unit Tests', () => {
  let tempRepo: string;
  let fleetEngine: FleetEngine;
  let store: MetadataStore;
  let git: GitEngine;

  beforeEach(async () => {
    tempRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'mannostree-conflict-matrix-unit-'));
    execSync('git init -b main', { cwd: tempRepo });
    execSync('git config user.name "Matrix Tester"', { cwd: tempRepo });
    execSync('git config user.email "matrix@example.com"', { cwd: tempRepo });
    fs.writeFileSync(path.join(tempRepo, 'common.txt'), 'line 1\nline 2\nline 3\n', 'utf-8');
    fs.writeFileSync(path.join(tempRepo, 'other.txt'), 'other file\n', 'utf-8');
    execSync('git add -A && git commit -m "Initial commit"', { cwd: tempRepo });

    const config = loadConfig(undefined, tempRepo);
    git = new GitEngine(tempRepo);
    store = new MetadataStore(tempRepo, config);
    fleetEngine = new FleetEngine(tempRepo, config, git, store);
  });

  afterEach(() => {
    try {
      execSync('git worktree prune', { cwd: tempRepo });
    } catch {}
    fs.rmSync(tempRepo, { recursive: true, force: true });
  });

  it('accurately identifies clean pairs and collision pairs across active worktrees', async () => {
    // WT1 modifies common.txt line 1
    const wt1Path = path.join(tempRepo, '.worktrees', 'wt1');
    execSync(`git worktree add -b feature/wt1 "${wt1Path}" main`, { cwd: tempRepo });
    fs.writeFileSync(path.join(wt1Path, 'common.txt'), 'line 1 modified by wt1\nline 2\nline 3\n', 'utf-8');
    execSync('git add common.txt && git commit -m "wt1 commit"', { cwd: wt1Path });

    // WT2 modifies common.txt line 1 (Direct conflict with WT1)
    const wt2Path = path.join(tempRepo, '.worktrees', 'wt2');
    execSync(`git worktree add -b feature/wt2 "${wt2Path}" main`, { cwd: tempRepo });
    fs.writeFileSync(path.join(wt2Path, 'common.txt'), 'line 1 modified by wt2 differently\nline 2\nline 3\n', 'utf-8');
    execSync('git add common.txt && git commit -m "wt2 commit"', { cwd: wt2Path });

    // WT3 modifies other.txt (Clean)
    const wt3Path = path.join(tempRepo, '.worktrees', 'wt3');
    execSync(`git worktree add -b feature/wt3 "${wt3Path}" main`, { cwd: tempRepo });
    fs.writeFileSync(path.join(wt3Path, 'other.txt'), 'other file modified by wt3\n', 'utf-8');
    execSync('git add other.txt && git commit -m "wt3 commit"', { cwd: wt3Path });

    const recs: WorktreeRecord[] = [
      {
        version: 1,
        id: 'wt1',
        repo_root: tempRepo,
        branch: 'feature/wt1',
        base_branch: 'main',
        kind: 'feature',
        profile: 'default',
        worktree_path: '.worktrees/wt1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'active',
        tags: [],
        lifecycle_state: 'WORKTREE_READY',
      },
      {
        version: 1,
        id: 'wt2',
        repo_root: tempRepo,
        branch: 'feature/wt2',
        base_branch: 'main',
        kind: 'feature',
        profile: 'default',
        worktree_path: '.worktrees/wt2',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'active',
        tags: [],
        lifecycle_state: 'WORKTREE_READY',
      },
      {
        version: 1,
        id: 'wt3',
        repo_root: tempRepo,
        branch: 'feature/wt3',
        base_branch: 'main',
        kind: 'feature',
        profile: 'default',
        worktree_path: '.worktrees/wt3',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'active',
        tags: [],
        lifecycle_state: 'WORKTREE_READY',
      },
    ];


    for (const r of recs) {
      await store.saveWorktree(r);
    }

    const report = await fleetEngine.computeConflictMatrix({ simulateMerge: true });
    expect(report.total_worktrees).toBe(3);
    expect(report.conflict_hazard_count).toBeGreaterThan(0);
    expect(report.high_risk_pairs.length).toBeGreaterThan(0);

    // Verify wt1 vs wt2 is CONFLICT
    const cell12 = report.matrix.flat().find((c) => c.source_id === 'wt1' && c.target_id === 'wt2');
    expect(cell12).toBeDefined();
    expect(cell12!.severity).toBe('CONFLICT');
    expect(cell12!.shared_files).toContain('common.txt');

    // Verify wt1 vs wt3 is CLEAN
    const cell13 = report.matrix.flat().find((c) => c.source_id === 'wt1' && c.target_id === 'wt3');
    expect(cell13).toBeDefined();
    expect(cell13!.severity).toBe('CLEAN');
  });

  it('generates GFM markdown table containing conflict overview', () => {
    const report = {
      analyzed_at: '2026-09-01T11:00:00.000Z',
      total_worktrees: 2,
      worktree_ids: ['wt1', 'wt2'],
      conflict_hazard_count: 1,
      shared_file_pair_count: 1,
      matrix: [
        [
          { source_id: 'wt1', target_id: 'wt1', source_branch: 'b1', target_branch: 'b1', severity: 'CLEAN' as const, shared_files: [], conflicting_files: [], conflict_details: [], auto_mergeable: true },
          { source_id: 'wt1', target_id: 'wt2', source_branch: 'b1', target_branch: 'b2', severity: 'CONFLICT' as const, shared_files: ['common.txt'], conflicting_files: ['common.txt'], conflict_details: [], auto_mergeable: false },
        ],
        [
          { source_id: 'wt2', target_id: 'wt1', source_branch: 'b2', target_branch: 'b1', severity: 'CONFLICT' as const, shared_files: ['common.txt'], conflicting_files: ['common.txt'], conflict_details: [], auto_mergeable: false },
          { source_id: 'wt2', target_id: 'wt2', source_branch: 'b2', target_branch: 'b2', severity: 'CLEAN' as const, shared_files: [], conflicting_files: [], conflict_details: [], auto_mergeable: true },
        ],
      ],
      high_risk_pairs: [{ source_id: 'wt1', target_id: 'wt2', conflicting_files: ['common.txt'] }],
    };

    const md = fleetEngine.generateConflictMatrixMarkdown(report);
    expect(md).toContain('# Fleet Cross-Worktree Conflict Matrix');
    expect(md).toContain('`wt1`');
    expect(md).toContain('`wt2`');
    expect(md).toContain('CONFLICT');
  });
});
