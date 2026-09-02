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

export class GitHubAdapter implements HostAdapter {
  public readonly hostType = 'github';

  constructor(
    private cliExecutor?: (args: string[], cwd: string) => Promise<{ stdout: string; stderr: string }>
  ) {}

  public detect(remoteUrl: string): boolean {
    return (remoteUrl || '').toLowerCase().includes('github.com');
  }

  public async createPullRequest(
    worktreePath: string,
    hostInfo: RemoteHostInfo,
    options: HostPublishOptions
  ): Promise<HostPublishResult> {
    const { title, body, source_branch, target_base, draft = true, push = true, dryRun = false } = options;

    const prBodyRelPath = path.join('.task', 'pr-body.md');
    const fullBodyPath = path.join(worktreePath, prBodyRelPath);

    if (!dryRun && fs.existsSync(worktreePath)) {
      const artifactDir = path.dirname(fullBodyPath);
      if (!fs.existsSync(artifactDir)) {
        fs.mkdirSync(artifactDir, { recursive: true });
      }
      fs.writeFileSync(fullBodyPath, body, 'utf-8');
    }

    if (!push) {
      return {
        host_type: 'github',
        mode: 'prepare-only',
        web_url: `https://${hostInfo.hostname}/${hostInfo.owner}/${hostInfo.repo}/pull/new/${source_branch}`,
        instructions: `PR body saved to ${prBodyRelPath}. Run with --push to create GitHub PR.`,
      };
    }

    // Attempt gh CLI create
    let prUrl: string | null = null;
    let prNumber: number | null = null;

    try {
      const ghArgs = [
        'pr',
        'create',
        '--head',
        source_branch,
        '--base',
        target_base,
        '--title',
        title,
        '--body-file',
        fullBodyPath,
      ];
      if (draft) {
        ghArgs.push('--draft');
      }

      const execFn = this.cliExecutor || (async (args, cwd) => {
        const res = await execFileAsync('gh', args, { cwd });
        return { stdout: res.stdout.trim(), stderr: res.stderr.trim() };
      });

      const res = await execFn(ghArgs, worktreePath);
      prUrl = res.stdout.trim();
      const numMatch = prUrl.match(/\/pull\/(\d+)/);
      if (numMatch) {
        prNumber = parseInt(numMatch[1], 10);
      }
    } catch {
      // gh CLI failed; branch is pushed but PR not created via API
      prUrl = null;
    }

    const webUrl = prUrl || `https://${hostInfo.hostname}/${hostInfo.owner}/${hostInfo.repo}/pull/new/${source_branch}`;

    return {
      host_type: 'github',
      mode: 'published',
      pr_number: prNumber,
      pr_url: prUrl,
      web_url: webUrl,
      instructions: prNumber
        ? `GitHub PR #${prNumber} created: ${prUrl}`
        : `Branch '${source_branch}' pushed to remote. Create PR using GitHub web UI at: ${webUrl}`,
    };
  }

  public async checkHealth(config?: any): Promise<HostHealthStatus> {
    const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
    let cliFound = false;

    try {
      await execFileAsync('gh', ['--version']);
      cliFound = true;
    } catch {
      cliFound = false;
    }

    const available = cliFound || !!token;
    let msg = 'GitHub integration ready (gh CLI)';
    if (!cliFound && token) msg = 'GitHub integration ready (Token configured)';
    if (!available) msg = 'GitHub CLI not found and no GITHUB_TOKEN set';

    return {
      host_type: 'github',
      available,
      cli_found: cliFound,
      cli_name: 'gh',
      token_configured: !!token,
      token_env_var: 'GITHUB_TOKEN',
      message: msg,
    };
  }

  public getPrWebUrl(hostInfo: RemoteHostInfo, prNumberOrIid: number): string {
    return `https://${hostInfo.hostname}/${hostInfo.owner}/${hostInfo.repo}/pull/${prNumberOrIid}`;
  }
}
