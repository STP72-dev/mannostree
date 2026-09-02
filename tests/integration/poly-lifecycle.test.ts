import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { MannostreeOrchestrator } from '../../src/core/orchestrator.js';
import { MannostreeConfigSchema } from '../../src/config/schema.js';

describe('Poly-Worktree Lifecycle Integration', () => {
  let clusterDir: string;
  let repoADir: string;
  let repoBDir: string;

  beforeEach(() => {
    clusterDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mannostree-poly-integ-'));
    repoADir = path.join(clusterDir, 'service-a');
    repoBDir = path.join(clusterDir, 'service-b');

    fs.mkdirSync(repoADir, { recursive: true });
    fs.mkdirSync(repoBDir, { recursive: true });

    // Initialize git in repoA
    execSync('git init -b main', { cwd: repoADir, stdio: 'ignore' });
    execSync('git config user.name "Test User"', { cwd: repoADir, stdio: 'ignore' });
    execSync('git config user.email "test@example.com"', { cwd: repoADir, stdio: 'ignore' });
    fs.writeFileSync(path.join(repoADir, 'README.md'), '# Service A\n', 'utf-8');
    execSync('git add . && git commit -m "init service a"', { cwd: repoADir, stdio: 'ignore' });

    // Initialize git in repoB
    execSync('git init -b main', { cwd: repoBDir, stdio: 'ignore' });
    execSync('git config user.name "Test User"', { cwd: repoBDir, stdio: 'ignore' });
    execSync('git config user.email "test@example.com"', { cwd: repoBDir, stdio: 'ignore' });
    fs.writeFileSync(path.join(repoBDir, 'README.md'), '# Service B\n', 'utf-8');
    execSync('git add . && git commit -m "init service b"', { cwd: repoBDir, stdio: 'ignore' });

    // Create manifest in cluster root
    fs.writeFileSync(
      path.join(clusterDir, '.mannostree.poly.yml'),
      `
version: 1
name: integ-cluster
repos:
  service_a:
    path: ./service-a
    default_base_branch: main
  service_b:
    path: ./service-b
    default_base_branch: main
links:
  - source_repo: service_a
    target_repo: service_b
    strategy: symlink
`,
      'utf-8'
    );
  });

  afterEach(() => {
    if (fs.existsSync(clusterDir)) {
      fs.rmSync(clusterDir, { recursive: true, force: true });
    }
  });

  it('runs complete lifecycle: spawn -> status -> exec -> drop', async () => {
    const config = MannostreeConfigSchema.parse({});
    const orchestrator = new MannostreeOrchestrator(clusterDir, config);

    // 1. Spawn
    const spawnRes = await orchestrator.polyEngine.spawn({
      feature: 'order-flow',
      manifest: path.join(clusterDir, '.mannostree.poly.yml'),
    });

    expect(Object.keys(spawnRes.members)).toEqual(['service_a', 'service_b']);
    expect(fs.existsSync(path.join(repoADir, '.worktrees', 'order-flow'))).toBe(true);
    expect(fs.existsSync(path.join(repoBDir, '.worktrees', 'order-flow'))).toBe(true);

    // 2. Status
    const status = await orchestrator.polyEngine.getStatus({
      feature: 'order-flow',
      manifest: path.join(clusterDir, '.mannostree.poly.yml'),
    });

    expect(status.healthy).toBe(true);
    expect(status.members).toHaveLength(2);
    expect(status.members[0].status).toBe('clean');

    // 3. Exec
    const execRes = await orchestrator.polyEngine.exec({
      feature: 'order-flow',
      command: 'echo "test output"',
      manifest: path.join(clusterDir, '.mannostree.poly.yml'),
      parallel: true,
    });

    expect(execRes.service_a.exitCode).toBe(0);
    expect(execRes.service_a.stdout).toContain('test output');
    expect(execRes.service_b.exitCode).toBe(0);

    // 4. Drop
    const dropRes = await orchestrator.polyEngine.drop({
      feature: 'order-flow',
      manifest: path.join(clusterDir, '.mannostree.poly.yml'),
      yes: true,
    });

    expect(dropRes.dropped).toEqual(['service_a', 'service_b']);
    expect(fs.existsSync(path.join(repoADir, '.worktrees', 'order-flow'))).toBe(false);
    expect(fs.existsSync(path.join(repoBDir, '.worktrees', 'order-flow'))).toBe(false);
  });
});
