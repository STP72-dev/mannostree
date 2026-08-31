import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { MetadataStore, writeAtomicJson, readJson } from '../../src/metadata/store.js';
import { loadConfig } from '../../src/config/loader.js';
import { WorktreeRecord } from '../../src/types/index.js';

describe('Metadata Engine', () => {
  let tempDir: string;
  let store: MetadataStore;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mannostree-metadata-test-'));
    const config = loadConfig(undefined, tempDir);
    store = new MetadataStore(tempDir, config);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('performs atomic writes using temporary files and renames', () => {
    const targetFile = path.join(tempDir, 'sub', 'test.json');
    writeAtomicJson(targetFile, { hello: 'world' });

    expect(fs.existsSync(targetFile)).toBe(true);
    const data = readJson<{ hello: string }>(targetFile);
    expect(data.hello).toBe('world');
  });

  it('initializes and saves registry record', async () => {
    const registry = await store.getRegistry();
    expect(registry.version).toBe(1);
    expect(registry.worktrees).toEqual([]);

    registry.worktrees.push('feature-test-1');
    await store.saveRegistry(registry);

    const reloaded = await store.getRegistry();
    expect(reloaded.worktrees).toContain('feature-test-1');
  });

  it('persists, queries, and archives worktree records', async () => {
    const now = new Date().toISOString();
    const record: WorktreeRecord = {
      version: 1,
      id: 'feature-sample',
      kind: 'feature',
      feature_name: 'sample',
      repo_root: tempDir,
      worktree_path: '.worktrees/sample',
      branch: 'feature/sample',
      base_branch: 'main',
      created_at: now,
      updated_at: now,
      status: 'created',
      lifecycle_state: 'WORKTREE_READY',
    };

    await store.saveWorktree(record);

    const fetched = await store.getWorktree('feature-sample');
    expect(fetched).not.toBeNull();
    expect(fetched?.id).toBe('feature-sample');
    expect(fetched?.branch).toBe('feature/sample');

    const all = await store.listWorktrees();
    expect(all.length).toBe(1);
    expect(all[0].id).toBe('feature-sample');

    // Archive and delete
    await store.deleteWorktree('feature-sample', true);
    const afterDelete = await store.getWorktree('feature-sample');
    expect(afterDelete).toBeNull();

    const archiveFile = store.getArchiveRecordPath('feature-sample');
    expect(fs.existsSync(archiveFile)).toBe(true);
  });

  it('validates transaction journal, health diagnostic, archive, and handoff schemas', async () => {
    const {
      TransactionJournalEntrySchema,
      HealthDiagnosticSchema,
      DropStatusReportSchema,
      ArchiveRecordSchema,
      ParallelHandoffPackageSchema,
    } = await import('../../src/metadata/schema.js');

    const txEntry = {
      transaction_id: 'tx_123',
      operation: 'spawn',
      entity_type: 'worktree',
      entity_id: 'feature-abc',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      state: 'in_flight',
      intents: [
        {
          file_path: '.mannostree/worktrees/feature-abc.json',
          action: 'create',
        },
      ],
    };
    expect(TransactionJournalEntrySchema.safeParse(txEntry).success).toBe(true);

    const healthDiag = {
      status: 'healthy',
      last_verified_at: new Date().toISOString(),
      checks: [
        {
          check_id: 'worktree_dir_exists',
          passed: true,
          severity: 'critical',
          message: 'Worktree exists',
        },
      ],
      recommended_actions: [],
    };
    expect(HealthDiagnosticSchema.safeParse(healthDiag).success).toBe(true);

    const dropReport = {
      feature: 'test-feat',
      experiment_id: 'exp-1',
      timestamp: new Date().toISOString(),
      dry_run: false,
      total_variants: 2,
      dropped_count: 2,
      surviving_count: 0,
      experiment_record_retained: false,
      variants: [],
      next_steps: [],
    };
    expect(DropStatusReportSchema.safeParse(dropReport).success).toBe(true);

    const archiveRec = {
      entity_id: 'feature-abc',
      entity_type: 'worktree',
      archived_at: new Date().toISOString(),
      base_branch: 'main',
      head_sha: 'abcdef1234567890',
      original_worktree_path: '.worktrees/abc',
      branch_name: 'feature/abc',
      metadata_snapshot_path: '.mannostree/archives/feature-abc.json',
      artifacts: [],
    };
    expect(ArchiveRecordSchema.safeParse(archiveRec).success).toBe(true);

    const handoffPkg = {
      handoff_id: 'h_123',
      feature: 'feat',
      base_branch: 'main',
      created_at: new Date().toISOString(),
      winner: {
        variant_id: 'v1',
        branch: 'exp-v1',
        head_sha: 'sha1',
        selection_rationale: 'Best performance',
      },
      comparison_scorecard: [],
      preserved_losers: [],
      pr_summary_markdown: '# Summary',
      artifact_path: '.task/parallel-handoff.md',
    };
    expect(ParallelHandoffPackageSchema.safeParse(handoffPkg).success).toBe(true);
  });
});
