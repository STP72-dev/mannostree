import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { loadConfig } from '../../src/config/loader.js';
import { ExitCode, MannostreeError } from '../../src/types/index.js';

describe('Configuration Loader', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mannostree-config-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('loads default configuration when no config file exists in tree', () => {
    const config = loadConfig(undefined, tempDir);
    expect(config.version).toBe(1);
    expect(config.default_base_branch).toBe('main');
    expect(config.worktree_root).toBe('.worktrees');
    expect(config.metadata_root).toBe('.mannostree');
    expect(config.artifact_dir_name).toBe('.task');
  });

  it('loads and validates a valid .mannostree.yml file', () => {
    const yamlContent = `
version: 1
default_base_branch: develop
worktree_root: .custom-worktrees
metadata_root: .custom-mannostree
artifact_dir_name: .custom-task
`;
    fs.writeFileSync(path.join(tempDir, '.mannostree.yml'), yamlContent, 'utf-8');

    const config = loadConfig(undefined, tempDir);
    expect(config.default_base_branch).toBe('develop');
    expect(config.worktree_root).toBe('.custom-worktrees');
    expect(config.metadata_root).toBe('.custom-mannostree');
  });

  it('throws validation error with exit code 3 on malformed YAML or invalid schema', () => {
    const invalidYaml = `
version: "invalid-number"
default_base_branch: 123
`;
    fs.writeFileSync(path.join(tempDir, '.mannostree.yml'), invalidYaml, 'utf-8');

    expect(() => loadConfig(undefined, tempDir)).toThrowError(MannostreeError);
    try {
      loadConfig(undefined, tempDir);
    } catch (err: any) {
      expect(err.exitCode).toBe(ExitCode.VALIDATION_FAILURE);
    }
  });

  it('throws error when explicit config path does not exist', () => {
    expect(() => loadConfig('non-existent.yml', tempDir)).toThrowError(MannostreeError);
  });
});
