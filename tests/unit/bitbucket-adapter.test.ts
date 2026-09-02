import { describe, it, expect } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { BitbucketAdapter } from '../../src/adapters/bitbucket.js';
import { RemoteHostInfo } from '../../src/types/index.js';

describe('Movement 7: Bitbucket Adapter', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mannostree-bb-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const sampleHostInfo: RemoteHostInfo = {
    host_type: 'bitbucket',
    hostname: 'bitbucket.org',
    owner: 'acme-corp',
    repo: 'mannostree-cli',
    remote_name: 'origin',
    remote_url: 'git@bitbucket.org:acme-corp/mannostree-cli.git',
    is_custom_domain: false,
  };

  it('creates Bitbucket Pull Request via REST API 2.0 with Bearer token', async () => {
    const mockFetch = async (url: any, opts: any) => {
      expect(url.toString()).toBe('https://api.bitbucket.org/2.0/repositories/acme-corp/mannostree-cli/pullrequests');
      expect(opts.headers.Authorization).toBe('Bearer bb-test-token');
      const body = JSON.parse(opts.body);
      expect(body.title).toBe('feat: bitbucket support');
      expect(body.source.branch.name).toBe('feature/bb');
      expect(body.destination.branch.name).toBe('main');

      return {
        ok: true,
        json: async () => ({
          id: 77,
          links: {
            html: {
              href: 'https://bitbucket.org/acme-corp/mannostree-cli/pull-requests/77',
            },
          },
        }),
      } as any;
    };

    const adapter = new BitbucketAdapter(mockFetch);
    const result = await adapter.createPullRequest(tmpDir, sampleHostInfo, {
      title: 'feat: bitbucket support',
      body: '# Bitbucket PR Body',
      source_branch: 'feature/bb',
      target_base: 'main',
      push: true,
      token: 'bb-test-token',
    });

    expect(result.host_type).toBe('bitbucket');
    expect(result.pr_number).toBe(77);
    expect(result.pr_url).toBe('https://bitbucket.org/acme-corp/mannostree-cli/pull-requests/77');
  });
});
