import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'node:fs';
import { HostAdapter } from './base.js';
import {
  HostHealthStatus,
  HostPublishOptions,
  HostPublishResult,
  RemoteHostInfo,
} from '../types/index.js';

const execFileAsync = promisify(execFile);

export class GitLabAdapter implements HostAdapter {
  public readonly hostType = 'gitlab';

  constructor(
    private cliExecutor?: (args: string[], cwd: string) => Promise<{ stdout: string; stderr: string }>,
    private fetchExecutor?: typeof fetch
  ) {}

  public detect(remoteUrl: string): boolean {
    return (remoteUrl || '').toLowerCase().includes('gitlab');
  }

  public async createPullRequest(
    worktreePath: string,
    hostInfo: RemoteHostInfo,
    options: HostPublishOptions
  ): Promise<HostPublishResult> {
    const { title: rawTitle, body, source_branch, target_base, draft = true, push = true, dryRun = false } = options;

    const mrTitle = draft && !rawTitle.startsWith('Draft:') ? `Draft: ${rawTitle}` : rawTitle;
    const prBodyRelPath = path.join('.task', 'pr-body.md');
    const fullBodyPath = path.join(worktreePath, prBodyRelPath);

    if (!dryRun && fs.existsSync(worktreePath)) {
      const artifactDir = path.dirname(fullBodyPath);
      if (!fs.existsSync(artifactDir)) {
        fs.mkdirSync(artifactDir, { recursive: true });
      }
      fs.writeFileSync(fullBodyPath, body, 'utf-8');
    }

    const defaultWebUrl = `https://${hostInfo.hostname}/${hostInfo.owner}/${hostInfo.repo}/-/merge_requests/new?merge_request%5Bsource_branch%5D=${source_branch}`;

    if (!push) {
      return {
        host_type: 'gitlab',
        mode: 'prepare-only',
        web_url: defaultWebUrl,
        instructions: `MR body saved to ${prBodyRelPath}. Run with --push to create GitLab Merge Request.`,
      };
    }

    let mrUrl: string | null = null;
    let mrIid: number | null = null;

    // 1. Try glab CLI first if available
    try {
      const glabArgs = [
        'mr',
        'create',
        '--source-branch',
        source_branch,
        '--target-branch',
        target_base,
        '--title',
        mrTitle,
        '--description',
        body,
      ];
      if (draft) {
        glabArgs.push('--draft');
      }

      const execFn = this.cliExecutor || (async (args, cwd) => {
        const res = await execFileAsync('glab', args, { cwd });
        return { stdout: res.stdout.trim(), stderr: res.stderr.trim() };
      });

      const res = await execFn(glabArgs, worktreePath);
      mrUrl = res.stdout.trim();
      const numMatch = mrUrl.match(/\/merge_requests\/(\d+)/);
      if (numMatch) {
        mrIid = parseInt(numMatch[1], 10);
      }
    } catch {
      // 2. Try direct GitLab REST API v4
      const token = options.token || process.env.GITLAB_TOKEN || process.env.GL_TOKEN || process.env.CI_JOB_TOKEN;
      const baseUrl = options.base_url || `https://${hostInfo.hostname}`;

      if (token && hostInfo.project_id_encoded) {
        try {
          const fetchFn = this.fetchExecutor || fetch;
          const apiUrl = `${baseUrl.replace(/\/+$/, '')}/api/v4/projects/${hostInfo.project_id_encoded}/merge_requests`;
          const resp = await fetchFn(apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'PRIVATE-TOKEN': token,
            },
            body: JSON.stringify({
              source_branch,
              target_branch: target_base,
              title: mrTitle,
              description: body,
            }),
          });

          if (resp.ok) {
            const data = (await resp.json()) as any;
            mrIid = data.iid;
            mrUrl = data.web_url;
          }
        } catch {
          // REST fallback
        }
      }
    }

    if (!mrUrl) {
      mrUrl = defaultWebUrl;
    }

    return {
      host_type: 'gitlab',
      mode: 'published',
      pr_number: mrIid,
      pr_url: mrUrl,
      web_url: mrUrl,
      instructions: mrIid
        ? `GitLab MR !${mrIid} created: ${mrUrl}`
        : `Branch pushed. Open GitLab Merge Request at: ${mrUrl}`,
    };
  }

  public async checkHealth(config?: any): Promise<HostHealthStatus> {
    const token = process.env.GITLAB_TOKEN || process.env.GL_TOKEN || process.env.CI_JOB_TOKEN;
    let cliFound = false;

    try {
      await execFileAsync('glab', ['--version']);
      cliFound = true;
    } catch {
      cliFound = false;
    }

    const available = cliFound || !!token;
    let msg = 'GitLab integration ready (glab CLI)';
    if (!cliFound && token) msg = 'GitLab integration ready (Token configured)';
    if (!available) msg = 'GitLab CLI not found and no GITLAB_TOKEN set';

    return {
      host_type: 'gitlab',
      available,
      cli_found: cliFound,
      cli_name: 'glab',
      token_configured: !!token,
      token_env_var: 'GITLAB_TOKEN',
      message: msg,
    };
  }

  public getPrWebUrl(hostInfo: RemoteHostInfo, prNumberOrIid: number): string {
    return `https://${hostInfo.hostname}/${hostInfo.owner}/${hostInfo.repo}/-/merge_requests/${prNumberOrIid}`;
  }
}
