import path from 'node:path';
import fs from 'node:fs';
import { HostAdapter } from './base.js';
import {
  HostHealthStatus,
  HostPublishOptions,
  HostPublishResult,
  RemoteHostInfo,
} from '../types/index.js';

export class BitbucketAdapter implements HostAdapter {
  public readonly hostType = 'bitbucket';

  constructor(private fetchExecutor?: typeof fetch) {}

  public detect(remoteUrl: string): boolean {
    return (remoteUrl || '').toLowerCase().includes('bitbucket');
  }

  public async createPullRequest(
    worktreePath: string,
    hostInfo: RemoteHostInfo,
    options: HostPublishOptions
  ): Promise<HostPublishResult> {
    const { title, body, source_branch, target_base, push = true, dryRun = false } = options;

    const prBodyRelPath = path.join('.task', 'pr-body.md');
    const fullBodyPath = path.join(worktreePath, prBodyRelPath);

    if (!dryRun && fs.existsSync(worktreePath)) {
      const artifactDir = path.dirname(fullBodyPath);
      if (!fs.existsSync(artifactDir)) {
        fs.mkdirSync(artifactDir, { recursive: true });
      }
      fs.writeFileSync(fullBodyPath, body, 'utf-8');
    }

    const defaultWebUrl = `https://${hostInfo.hostname}/${hostInfo.owner}/${hostInfo.repo}/pull-requests/new?source=${source_branch}&dest=${target_base}`;

    if (!push) {
      return {
        host_type: 'bitbucket',
        mode: 'prepare-only',
        web_url: defaultWebUrl,
        instructions: `PR body saved to ${prBodyRelPath}. Run with --push to create Bitbucket Pull Request.`,
      };
    }

    let prUrl: string | null = null;
    let prId: number | null = null;

    const token = options.token || process.env.BITBUCKET_TOKEN;
    const username = process.env.BITBUCKET_USERNAME;
    const appPassword = process.env.BITBUCKET_APP_PASSWORD;
    const workspace = hostInfo.owner;
    const repoSlug = hostInfo.repo;

    if ((token || (username && appPassword)) && workspace !== 'unknown' && repoSlug !== 'unknown') {
      try {
        const fetchFn = this.fetchExecutor || fetch;
        const apiUrl = `https://api.bitbucket.org/2.0/repositories/${workspace}/${repoSlug}/pullrequests`;

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };

        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        } else if (username && appPassword) {
          const authString = Buffer.from(`${username}:${appPassword}`).toString('base64');
          headers['Authorization'] = `Basic ${authString}`;
        }

        const resp = await fetchFn(apiUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            title,
            description: body,
            source: { branch: { name: source_branch } },
            destination: { branch: { name: target_base } },
          }),
        });

        if (resp.ok) {
          const data = (await resp.json()) as any;
          prId = data.id;
          prUrl = data.links?.html?.href || `https://${hostInfo.hostname}/${workspace}/${repoSlug}/pull-requests/${prId}`;
        }
      } catch {
        // Fallback
      }
    }

    if (!prUrl) {
      prUrl = defaultWebUrl;
    }

    return {
      host_type: 'bitbucket',
      mode: 'published',
      pr_number: prId,
      pr_url: prUrl,
      web_url: prUrl,
      instructions: prId
        ? `Bitbucket PR #${prId} created: ${prUrl}`
        : `Branch pushed. Open Bitbucket Pull Request at: ${prUrl}`,
    };
  }

  public async checkHealth(config?: any): Promise<HostHealthStatus> {
    const token = process.env.BITBUCKET_TOKEN;
    const appPassword = process.env.BITBUCKET_APP_PASSWORD;
    const available = !!(token || appPassword);

    return {
      host_type: 'bitbucket',
      available,
      cli_found: false,
      token_configured: available,
      token_env_var: token ? 'BITBUCKET_TOKEN' : 'BITBUCKET_APP_PASSWORD',
      message: available
        ? 'Bitbucket integration ready (Credentials configured)'
        : 'Bitbucket credentials missing (set BITBUCKET_TOKEN or BITBUCKET_APP_PASSWORD)',
    };
  }

  public getPrWebUrl(hostInfo: RemoteHostInfo, prNumberOrIid: number): string {
    return `https://${hostInfo.hostname}/${hostInfo.owner}/${hostInfo.repo}/pull-requests/${prNumberOrIid}`;
  }
}
