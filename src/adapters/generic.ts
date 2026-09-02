import path from 'node:path';
import fs from 'node:fs';
import { HostAdapter } from './base.js';
import {
  HostHealthStatus,
  HostPublishOptions,
  HostPublishResult,
  RemoteHostInfo,
} from '../types/index.js';

export class GenericAdapter implements HostAdapter {
  public readonly hostType = 'generic';

  public detect(remoteUrl: string): boolean {
    return true;
  }

  public async createPullRequest(
    worktreePath: string,
    hostInfo: RemoteHostInfo,
    options: HostPublishOptions
  ): Promise<HostPublishResult> {
    const { body, source_branch, push = true, dryRun = false } = options;

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
        host_type: 'generic',
        mode: 'prepare-only',
        instructions: `PR body exported to ${prBodyRelPath}. Run with --push to push branch to remote '${hostInfo.remote_name}'.`,
      };
    }

    return {
      host_type: 'generic',
      mode: 'pushed-only',
      instructions: `Branch '${source_branch}' pushed to remote '${hostInfo.remote_name}'. Review PR description in ${prBodyRelPath}.`,
    };
  }

  public async checkHealth(config?: any): Promise<HostHealthStatus> {
    return {
      host_type: 'generic',
      available: true,
      cli_found: false,
      token_configured: false,
      message: 'Generic git remote adapter active (standard git push)',
    };
  }

  public getPrWebUrl(hostInfo: RemoteHostInfo, prNumberOrIid: number): string {
    return hostInfo.remote_url;
  }
}
