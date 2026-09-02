import { describe, it, expect } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { DoctorEngine } from '../../src/core/doctor.js';
import { MetadataStore } from '../../src/metadata/store.js';
import { GitEngine } from '../../src/git/engine.js';
import { IssueTrackerRegistry } from '../../src/issues/base.js';
import { GenericIssueAdapter } from '../../src/issues/generic.js';

describe('DoctorEngine Issue Tracker Diagnostics', () => {
  it('audits issue tracker adapters and reports health status', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mannostree-doc-issue-'));
    fs.mkdirSync(path.join(tempDir, '.mannostree'), { recursive: true });

    const store = new MetadataStore(tempDir, {
      version: 1,
      metadata_root: '.mannostree',
    } as any);

    const git = new GitEngine(tempDir);

    const issueRegistry = new IssueTrackerRegistry();
    issueRegistry.register(new GenericIssueAdapter());

    const doctor = new DoctorEngine(
      tempDir,
      {
        version: 1,
        metadata_root: '.mannostree',
        worktree_root: '.worktrees',
        issues: {
          default_provider: 'generic',
        },
      } as any,
      git,
      store,
      undefined,
      undefined,
      issueRegistry
    );

    const report = await doctor.diagnose();

    expect(report.healthy).toBe(true);
    expect(report.issue_trackers).toBeDefined();
    expect(report.issue_trackers?.length).toBeGreaterThan(0);
    expect(report.issue_trackers?.[0].provider).toBe('generic');
    expect(report.issue_trackers?.[0].available).toBe(true);
  });
});
