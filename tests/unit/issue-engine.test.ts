import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { IssueSyncEngine } from '../../src/issues/engine.js';
import { IssueTrackerRegistry } from '../../src/issues/base.js';
import { GenericIssueAdapter } from '../../src/issues/generic.js';
import { MetadataStore } from '../../src/metadata/store.js';
import { WorktreeRecord } from '../../src/types/index.js';

describe('IssueSyncEngine', () => {
  let tempDir: string;
  let store: MetadataStore;
  let registry: IssueTrackerRegistry;
  let genericAdapter: GenericIssueAdapter;
  let engine: IssueSyncEngine;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mannostree-issue-test-'));
    const metadataDir = path.join(tempDir, '.mannostree');
    fs.mkdirSync(metadataDir, { recursive: true });

    store = new MetadataStore(tempDir, {
      version: 1,
      metadata_root: '.mannostree',
      worktree_root: '.worktrees',
    } as any);

    registry = new IssueTrackerRegistry();
    genericAdapter = new GenericIssueAdapter();
    registry.register(genericAdapter);

    engine = new IssueSyncEngine(store, registry, {
      version: 1,
      issues: {
        default_provider: 'generic',
        auto_transition: true,
      },
    } as any);
  });

  it('scaffolds task contract markdown content accurately', () => {
    const record = {
      version: 1,
      key: 'ENG-101',
      provider: 'linear' as const,
      title: 'Implement OAuth Refresh Flow',
      description: 'Need OAuth2 refresh flow with security checks.',
      status: 'In Progress',
      priority: 'Urgent',
      assignee: { name: 'Jane Doe' },
      labels: ['auth', 'security'],
      url: 'https://linear.app/issue/ENG-101',
      acceptance_criteria: ['Handle refresh tokens', 'Verify expiry'],
      created_at: '2026-09-01T00:00:00Z',
      updated_at: '2026-09-02T00:00:00Z',
      last_synced_at: '2026-09-02T00:00:00Z',
    };

    const content = engine.scaffoldTaskContractContent(record);
    expect(content).toContain('# Task Contract: [ENG-101] Implement OAuth Refresh Flow');
    expect(content).toContain('**Priority**: Urgent');
    expect(content).toContain('**Assignee**: Jane Doe');
    expect(content).toContain('- [ ] Handle refresh tokens');
    expect(content).toContain('- [ ] Verify expiry');
  });

  it('ingests issue and updates worktree metadata and task contract', async () => {
    // Create a mock worktree record
    const relWtPath = path.join('.worktrees', 'feature-auth');
    const fullWtPath = path.join(tempDir, relWtPath);
    fs.mkdirSync(fullWtPath, { recursive: true });

    const wtRecord: WorktreeRecord = {
      version: 1,
      id: 'feature-auth',
      repo_root: tempDir,
      worktree_path: relWtPath,
      metadata_path: '.mannostree/worktrees/feature-auth.json',
      branch: 'feature/auth',
      base_branch: 'main',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_activity_at: new Date().toISOString(),
      created_by: 'test',
      status: 'created',
      lifecycle_state: 'WORKTREE_READY',
      task: {
        id: 'feature-auth',
        status: 'READY',
      } as any,
    };

    await store.saveWorktree(wtRecord);

    const { record, contractPath } = await engine.ingestIssue({
      key: 'ENG-101',
      worktreeId: 'feature-auth',
      provider: 'generic',
    });

    expect(record.key).toBe('ENG-101');
    expect(fs.existsSync(contractPath)).toBe(true);

    const updatedWt = await store.getWorktree('feature-auth');
    expect((updatedWt?.task as any)?.issue_key).toBe('ENG-101');
    expect((updatedWt?.task as any)?.issue_provider).toBe('generic');
  });

  it('transitions issue status and updates cached issue record', async () => {
    const res = await engine.transitionIssue({
      key: 'PROJ-99',
      status: 'In Review',
      provider: 'generic',
    });

    expect(res.success).toBe(true);
    expect(res.new_status).toBe('In Review');
  });

  it('detects drift when remote status is closed while worktree is active', async () => {
    const relWtPath = path.join('.worktrees', 'feature-old');
    const fullWtPath = path.join(tempDir, relWtPath);
    fs.mkdirSync(fullWtPath, { recursive: true });

    const wtRecord: WorktreeRecord = {
      version: 1,
      id: 'feature-old',
      repo_root: tempDir,
      worktree_path: relWtPath,
      metadata_path: '.mannostree/worktrees/feature-old.json',
      branch: 'feature/old',
      base_branch: 'main',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_activity_at: new Date().toISOString(),
      created_by: 'test',
      status: 'created',
      lifecycle_state: 'WORKTREE_READY',
      task: {
        id: 'feature-old',
        status: 'READY',
        issue_key: 'ENG-202',
        issue_provider: 'generic',
      } as any,
    };

    await store.saveWorktree(wtRecord);

    // Mock fetchIssue to return closed

    vi.spyOn(genericAdapter, 'fetchIssue').mockResolvedValueOnce({
      version: 1,
      key: 'ENG-202',
      provider: 'generic',
      title: 'Old Feature',
      description: '',
      status: 'Closed',
      labels: [],
      url: 'issue://ENG-202',
      acceptance_criteria: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_synced_at: new Date().toISOString(),
    });

    const driftSummaries = await engine.checkIssueDrift('feature-old');
    expect(driftSummaries).toHaveLength(1);
    expect(driftSummaries[0].drift_detected).toBe(true);
    expect(driftSummaries[0].drift_reason).toContain('Remote ticket is "Closed"');
  });
});
