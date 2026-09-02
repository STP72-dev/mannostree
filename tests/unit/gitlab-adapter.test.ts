import { describe, it, expect } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { GitLabAdapter } from '../../src/adapters/gitlab.js';
import { RemoteHostInfo } from '../../src/types/index.js';

describe('Movement 7: GitLab Adapter', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mannostree-gl-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const sampleHostInfo: RemoteHostInfo = {
    host_type: 'gitlab',
    hostname: 'gitlab.com',
    owner: 'organcorp/subteam',
    repo: 'mannostree-core',
    remote_name: 'origin',
    remote_url: 'git@gitlab.com:organcorp/subteam/mannostree-core.git',
    is_custom_domain: false,
    project_id_encoded: 'organcorp%2Fsubteam%2Fmannostree-core',
  };

  it('creates GitLab Merge Request via mocked glab CLI', async () => {
    const mockGlab = async (args: string[]) => {
      expect(args).toContain('mr');
      expect(args).toContain('create');
      expect(args).toContain('--draft');
      return { stdout: 'https://gitlab.com/organcorp/subteam/mannostree-core/-/merge_requests/99\n', stderr: '' };
    };

    const adapter = new GitLabAdapter(mockGlab);
    const result = await adapter.createPullRequest(tmpDir, sampleHostInfo, {
      title: 'feat: add gitlab adapter',
      body: '# Summary of Changes',
      source_branch: 'feature/gl-adapter',
      target_base: 'main',
      draft: true,
      push: true,
    });

    expect(result.host_type).toBe('gitlab');
    expect(result.mode).toBe('published');
    expect(result.pr_number).toBe(99);
    expect(result.pr_url).toBe('https://gitlab.com/organcorp/subteam/mannostree-core/-/merge_requests/99');
  });

  it('creates GitLab Merge Request via direct REST API fallback when glab is missing', async () => {
    const mockFailingGlab = async () => {
      throw new Error('glab not found');
    };

    const mockFetch = async (url: any, opts: any) => {
      expect(url.toString()).toContain('/api/v4/projects/organcorp%2Fsubteam%2Fmannostree-core/merge_requests');
      const payload = JSON.parse(opts.body);
      expect(payload.title).toContain('Draft:');
      return {
        ok: true,
        json: async () => ({
          iid: 101,
          web_url: 'https://gitlab.com/organcorp/subteam/mannostree-core/-/merge_requests/101',
        }),
      } as any;
    };

    const adapter = new GitLabAdapter(mockFailingGlab, mockFetch);
    const result = await adapter.createPullRequest(tmpDir, sampleHostInfo, {
      title: 'feat: add gitlab adapter',
      body: '# Summary of Changes',
      source_branch: 'feature/gl-adapter',
      target_base: 'main',
      draft: true,
      push: true,
      token: 'glpat-test-token',
    });

    expect(result.host_type).toBe('gitlab');
    expect(result.pr_number).toBe(101);
    expect(result.pr_url).toBe('https://gitlab.com/organcorp/subteam/mannostree-core/-/merge_requests/101');
  });
});
