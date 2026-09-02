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

export class GiteaAdapter implements HostAdapter {
  public readonly hostType = 'gitea';

  constructor(
    private cliExecutor?: (args: string[], cwd: string) => Promise<{ stdout: string; stderr: string }>,
    private fetchExecutor?: typeof fetch
  ) {}

  public detect(remoteUrl: string): boolean {
    const lower = (remoteUrl || '').toLowerCase();
    return lower.includes('gitea') || lower.includes('forgejo');
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

    const defaultWebUrl = `https://${hostInfo.hostname}/${hostInfo.owner}/${hostInfo.repo}/compare/${target_base}...${source_branch}`;

    if (!push) {
      return {
        host_type: 'gitea',
        mode: 'prepare-only',
        web_url: defaultWebUrl,
        instructions: `PR body saved to ${prBodyRelPath}. Run with --push to create Gitea Pull Request.`,
      };
    }

    let prUrl: string | null = null;
    let prIndex: number | null = null;

    // 1. Try tea CLI
    try {
      const teaArgs = [
        'pr',
        'create',
        '--head',
        source_branch,
        '--base',
        target_base,
        '--title',
        title,
        '--description',
        body,
      ];

      const execFn = this.cliExecutor || (async (args, cwd) => {
        const res = await execFileAsync('tea', args, { cwd });
        return { stdout: res.stdout.trim(), stderr: res.stderr.trim() };
      });

      const res = await execFn(teaArgs, worktreePath);
      prUrl = res.stdout.trim();
      const numMatch = prUrl.match(/\/pulls\/(\d+)/);
      if (numMatch) {
        prIndex = parseInt(numMatch[1], 10);
      }
    } catch {
      // 2. Try direct Gitea REST API v1
      const token = options.token || process.env.GITEA_TOKEN;
      const baseUrl = options.base_url || `https://${hostInfo.hostname}`;

      if (token && hostInfo.owner !== 'unknown' && hostInfo.repo !== 'unknown') {
        try {
          const fetchFn = this.fetchExecutor || fetch;
          const apiUrl = `${baseUrl.replace(/\/+$/, '')}/api/v1/repos/${hostInfo.owner}/${hostInfo.repo}/pulls`;
          const resp = await fetchFn(apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `token ${token}`,
            },
            body: JSON.stringify({
              head: source_branch,
              base: target_base,
              title,
              body,
            }),
          });

          if (resp.ok) {
            const data = (await resp.json()) as any;
            prIndex = data.number || data.id;
            prUrl = data.html_url;
          }
        } catch {
          // REST fallback
        }
      }
    }

    if (!prUrl) {
      prUrl = defaultWebUrl;
    }

    return {
      host_type: 'gitea',
      mode: 'published',
      pr_number: prIndex,
      pr_url: prUrl,
      web_url: prUrl,
      instructions: prIndex
        ? `Gitea PR #${prIndex} created: ${prUrl}`
        : `Branch pushed. Open Gitea Pull Request at: ${prUrl}`,
    };
  }

  public async checkHealth(config?: any): Promise<HostHealthStatus> {
    const token = process.env.GITEA_TOKEN;
    let cliFound = false;

    try {
      await execFileAsync('tea', ['--version']);
      cliFound = true;
    } catch {
      cliFound = false;
    }

    const available = cliFound || !!token;
    let msg = 'Gitea integration ready (tea CLI)';
    if (!cliFound && token) msg = 'Gitea integration ready (Token configured)';
    if (!available) msg = 'Gitea CLI (tea) not found and no GITEA_TOKEN set';

    return {
      host_type: 'gitea',
      available,
      cli_found: cliFound,
      cli_name: 'tea',
      token_configured: !!token,
      token_env_var: 'GITEA_TOKEN',
      message: msg,
    };
  }

  public getPrWebUrl(hostInfo: RemoteHostInfo, prNumberOrIid: number): string {
    return `https://${hostInfo.hostname}/${hostInfo.owner}/${hostInfo.repo}/pulls/${prNumberOrIid}`;
  }
}
