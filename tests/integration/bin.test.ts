import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';

describe('Mannostree Binary Executable CLI', () => {
  let tempRepo: string;
  const binPath = path.resolve(__dirname, '../../bin/mannostree.js');

  beforeEach(() => {
    tempRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'mannostree-bin-test-'));
    execSync('git init -b main', { cwd: tempRepo });
    execSync('git config user.name "Bin Tester"', { cwd: tempRepo });
    execSync('git config user.email "bintester@example.com"', { cwd: tempRepo });
    fs.writeFileSync(path.join(tempRepo, 'README.md'), '# CLI Binary Test Repo\n', 'utf-8');
    execSync('git add README.md && git commit -m "Initial commit"', { cwd: tempRepo });

    // Copy .mannostree.yml
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

  it('prints help text with command tree and global flags', () => {
    const output = execSync(`node ${binPath} --help`, { cwd: tempRepo, encoding: 'utf-8' });
    expect(output).toContain('Usage: mannostree [options] [command]');
    expect(output).toContain('spawn');
    expect(output).toContain('list');
    expect(output).toContain('info');
    expect(output).toContain('drop');
    expect(output).toContain('--json');
    expect(output).toContain('--dry-run');
  });

  it('executes spawn with --dry-run and emits valid structured JSON', () => {
    const output = execSync(`node ${binPath} spawn dry-cli-feat -b main --dry-run --json`, {
      cwd: tempRepo,
      encoding: 'utf-8',
    });

    const parsed = JSON.parse(output);
    expect(parsed.command).toBe('spawn');
    expect(parsed.ok).toBe(true);
    expect(parsed.dry_run).toBe(true);
    expect(parsed.result.id).toBe('feature-dry-cli-feat');
  });

  it('executes real spawn, list, info, and force drop via CLI binary', () => {
    // Spawn
    const spawnOut = execSync(`node ${binPath} spawn live-cli-feat -b main --json`, {
      cwd: tempRepo,
      encoding: 'utf-8',
    });
    const spawnParsed = JSON.parse(spawnOut);
    expect(spawnParsed.ok).toBe(true);
    expect(spawnParsed.result.id).toBe('feature-live-cli-feat');

    // List
    const listOut = execSync(`node ${binPath} list --json`, {
      cwd: tempRepo,
      encoding: 'utf-8',
    });
    const listParsed = JSON.parse(listOut);
    expect(listParsed.ok).toBe(true);
    expect(listParsed.result.length).toBe(1);
    expect(listParsed.result[0].id).toBe('feature-live-cli-feat');

    // Info
    const infoOut = execSync(`node ${binPath} info feature-live-cli-feat --json`, {
      cwd: tempRepo,
      encoding: 'utf-8',
    });
    const infoParsed = JSON.parse(infoOut);
    expect(infoParsed.ok).toBe(true);
    expect(infoParsed.result.live_health.exists_on_disk).toBe(true);

    // Drop
    const dropOut = execSync(`node ${binPath} drop feature-live-cli-feat --force --json`, {
      cwd: tempRepo,
      encoding: 'utf-8',
    });
    const dropParsed = JSON.parse(dropOut);
    expect(dropParsed.ok).toBe(true);
    expect(dropParsed.result.removed_worktree).toBe(true);
  });
});
