import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { DoctorEngine } from '../../src/core/doctor.js';
import { GitEngine } from '../../src/git/engine.js';
import { MetadataStore } from '../../src/metadata/store.js';
import { loadConfig } from '../../src/config/loader.js';
import { MannostreeOrchestrator } from '../../src/core/orchestrator.js';

describe('Health Doctor & Broken State Classification', () => {
  let tempRepo: string;
  let orchestrator: MannostreeOrchestrator;
  let doctorEngine: DoctorEngine;

  beforeEach(() => {
    tempRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'mannostree-health-test-'));
    execSync('git init -b main', { cwd: tempRepo });
    execSync('git config user.name "Health Tester"', { cwd: tempRepo });
    execSync('git config user.email "health@example.com"', { cwd: tempRepo });
    fs.writeFileSync(path.join(tempRepo, 'README.md'), '# Health Repo\n', 'utf-8');
    execSync('git add README.md && git commit -m "Initial commit"', { cwd: tempRepo });

    const config = loadConfig(undefined, tempRepo);
    const git = new GitEngine(tempRepo);
    const store = new MetadataStore(tempRepo, config);
    orchestrator = new MannostreeOrchestrator(tempRepo, config);
    doctorEngine = new DoctorEngine(tempRepo, config, git, store);
  });

  afterEach(() => {
    try {
      execSync('git worktree prune', { cwd: tempRepo });
    } catch {
      // ignore
    }
    fs.rmSync(tempRepo, { recursive: true, force: true });
  });

  it('classifies worktree as BROKEN when branch is deleted out-of-band', async () => {
    await orchestrator.spawn({ name: 'broken-branch', baseBranch: 'main' });
    const record = await orchestrator.store.getWorktree('feature-broken-branch');
    expect(record).not.toBeNull();

    // Delete branch out-of-band via update-ref
    execSync('git update-ref -d refs/heads/feature/broken-branch', { cwd: tempRepo });

    const report = await doctorEngine.diagnose();
    expect(report.healthy).toBe(false);
    const missingBranch = report.findings.find(
      (f) => f.type === 'MISSING_BRANCH' && f.id === 'feature-broken-branch'
    );
    expect(missingBranch).toBeDefined();
    expect(missingBranch?.severity).toBe('error');
  });

  it('audits experiment records and detects orphaned or broken variant references', async () => {
    await orchestrator.parallelSpawn({
      feature: 'test-health',
      count: 2,
      baseBranch: 'main',
    });

    const exp = await orchestrator.store.getExperiment('test-health');
    expect(exp?.variants.length).toBe(2);

    // Delete one variant worktree folder
    const v1Path = path.join(tempRepo, '.worktrees', 'test-health-v1');
    fs.rmSync(v1Path, { recursive: true, force: true });

    const report = await doctorEngine.diagnose();
    expect(report.healthy).toBe(false);
    expect(report.findings.some((f) => f.type === 'MISSING_DISK')).toBe(true);
  });
});
