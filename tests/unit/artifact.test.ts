import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { scaffoldArtifacts } from '../../src/artifact/scaffold.js';

describe('Artifact Scaffolding Engine', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mannostree-artifact-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('scaffolds required task artifacts and RESULTS.md', () => {
    scaffoldArtifacts({
      worktreeFullPath: tempDir,
      artifactDirName: '.task',
      featureName: 'retry-client',
      baseBranch: 'main',
    });

    const taskDir = path.join(tempDir, '.task');
    expect(fs.existsSync(path.join(taskDir, 'task-contract.md'))).toBe(true);
    expect(fs.existsSync(path.join(taskDir, 'solution-options.md'))).toBe(true);
    expect(fs.existsSync(path.join(taskDir, 'implementation-plan.md'))).toBe(true);
    expect(fs.existsSync(path.join(taskDir, 'quality-gates.md'))).toBe(true);
    expect(fs.existsSync(path.join(taskDir, 'review.md'))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, 'RESULTS.md'))).toBe(true);

    const taskContract = fs.readFileSync(path.join(taskDir, 'task-contract.md'), 'utf-8');
    expect(taskContract).toContain('## Problem');
    expect(taskContract).toContain('## Scope');
    expect(taskContract).toContain('## Acceptance criteria');
  });

  it('does nothing in dry-run mode', () => {
    scaffoldArtifacts({
      worktreeFullPath: tempDir,
      artifactDirName: '.task',
      featureName: 'retry-client',
      baseBranch: 'main',
      dryRun: true,
    });

    expect(fs.existsSync(path.join(tempDir, '.task'))).toBe(false);
    expect(fs.existsSync(path.join(tempDir, 'RESULTS.md'))).toBe(false);
  });
});
