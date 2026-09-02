import { describe, it, expect } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { GiteaAdapter } from '../../src/adapters/gitea.js';
import { RemoteHostInfo } from '../../src/types/index.js';

describe('Movement 7: Gitea Adapter', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mannostree-tea-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const sampleHostInfo: RemoteHostInfo = {
    host_type: 'gitea',
    hostname: 'gitea.local',
    owner: 'team-infra',
    repo: 'mannostree',
    remote_name: 'origin',
    remote_url: 'https://gitea.local/team-infra/mannostree.git',
    is_custom_domain: true,
  };

  it('creates Gitea Pull Request via tea CLI', async () => {
    const mockTea = async (args: string[]) => {
      expect(args).toContain('pr');
      expect(args).toContain('create');
      return { stdout: 'https://gitea.local/team-infra/mannostree/pulls/12\n', stderr: '' };
    };

    const adapter = new GiteaAdapter(mockTea);
    const result = await adapter.createPullRequest(tmpDir, sampleHostInfo, {
      title: 'feat: add gitea adapter',
      body: '# PR Content',
      source_branch: 'feature/gitea',
      target_base: 'main',
      push: true,
    });

    expect(result.host_type).toBe('gitea');
    expect(result.pr_number).toBe(12);
    expect(result.pr_url).toBe('https://gitea.local/team-infra/mannostree/pulls/12');
  });

  it('creates Gitea Pull Request via direct REST API fallback', async () => {
    const mockFailingTea = async () => {
      throw new Error('tea not found');
    };

    const mockFetch = async (url: any, opts: any) => {
      expect(url.toString()).toContain('/api/v1/repos/team-infra/mannostree/pulls');
      expect(opts.headers.Authorization).toBe('token gitea-secret-token');
      return {
        ok: true,
        json: async () => ({
          number: 15,
          html_url: 'https://gitea.local/team-infra/mannostree/pulls/15',
        }),
      } as any;
    };

    const adapter = new GiteaAdapter(mockFailingTea, mockFetch);
    const result = await adapter.createPullRequest(tmpDir, sampleHostInfo, {
      title: 'feat: add gitea adapter',
      body: '# PR Content',
      source_branch: 'feature/gitea',
      target_base: 'main',
      push: true,
      token: 'gitea-secret-token',
    });

    expect(result.host_type).toBe('gitea');
    expect(result.pr_number).toBe(15);
    expect(result.pr_url).toBe('https://gitea.local/team-infra/mannostree/pulls/15');
  });
});
