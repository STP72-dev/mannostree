import {
  IssueCommentResult,
  IssueRecord,
  IssueTrackerHealthStatus,
  IssueTrackerProvider,
  IssueTransitionResult,
  MannostreeError,
  ExitCode,
} from '../types/index.js';
import { IssueTrackerAdapter } from './base.js';
import { extractAcceptanceCriteria } from './jira.js';

export interface GitHubIssueAdapterOptions {
  owner?: string;
  repo?: string;
  token?: string;
  apiBaseUrl?: string;
}

export class GitHubIssueAdapter implements IssueTrackerAdapter {
  public readonly provider: IssueTrackerProvider = 'github';
  private owner: string;
  private repo: string;
  private token: string;
  private apiBaseUrl: string;

  constructor(options: GitHubIssueAdapterOptions = {}) {
    this.owner = options.owner || process.env.GITHUB_OWNER || '';
    this.repo = options.repo || process.env.GITHUB_REPO || '';
    this.token = options.token || process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
    this.apiBaseUrl = (options.apiBaseUrl || 'https://api.github.com').replace(/\/$/, '');
  }

  private getAuthHeader(): Record<string, string> {
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Mannostree-CLI',
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  private parseIssueNumber(key: string): string {
    const cleaned = key.trim().replace(/^#/, '');
    const match = cleaned.match(/\d+/);
    if (!match) {
      throw new MannostreeError(
        `Invalid GitHub issue number "${key}". Must be an integer or #<number>.`,
        ExitCode.VALIDATION_FAILURE
      );
    }
    return match[0];
  }

  public async fetchIssue(key: string): Promise<IssueRecord> {
    const issueNum = this.parseIssueNumber(key);
    if (!this.owner || !this.repo) {
      throw new MannostreeError(
        'GitHub owner/repo not configured. Please set owner and repo in config or env.',
        ExitCode.VALIDATION_FAILURE
      );
    }

    const url = `${this.apiBaseUrl}/repos/${this.owner}/${this.repo}/issues/${issueNum}`;
    let res: Response;
    try {
      res = await fetch(url, { method: 'GET', headers: this.getAuthHeader() });
    } catch (err: any) {
      throw new MannostreeError(
        `Failed to reach GitHub API at ${url}: ${err.message}`,
        ExitCode.GENERIC_FAILURE
      );
    }


    if (!res.ok) {
      throw new MannostreeError(
        `GitHub API error fetching issue #${issueNum} (${res.status}): ${await res.text().catch(() => '')}`,
        ExitCode.VALIDATION_FAILURE
      );
    }

    const issue: any = await res.json();
    const criteria = extractAcceptanceCriteria(issue.body || '');

    return {
      version: 1,
      key: String(issue.number),
      provider: 'github',
      title: issue.title,
      description: issue.body || '',
      status: issue.state || 'open',
      status_category: issue.state === 'closed' ? 'done' : 'in_progress',
      assignee: issue.assignee ? { name: issue.assignee.login } : undefined,
      labels: Array.isArray(issue.labels) ? issue.labels.map((l: any) => (typeof l === 'string' ? l : l.name)) : [],
      url: issue.html_url || `https://github.com/${this.owner}/${this.repo}/issues/${issueNum}`,
      acceptance_criteria: criteria,
      created_at: issue.created_at || new Date().toISOString(),
      updated_at: issue.updated_at || new Date().toISOString(),
      last_synced_at: new Date().toISOString(),
    };
  }

  public async transitionIssue(
    key: string,
    targetStatus: string,
    dryRun: boolean = false
  ): Promise<IssueTransitionResult> {
    const issueNum = this.parseIssueNumber(key);
    const normalized = targetStatus.toLowerCase();

    let targetState: 'open' | 'closed' | undefined;
    if (['closed', 'done', 'cancelled', 'resolved'].includes(normalized)) {
      targetState = 'closed';
    } else if (['open', 'in progress', 'in review', 'todo', 'reopened'].includes(normalized)) {
      targetState = 'open';
    }

    if (!targetState) {
      return {
        key: issueNum,
        provider: 'github',
        previous_status: 'current',
        new_status: targetStatus,
        success: false,
        mode: 'noop',
        error: `Cannot map status "${targetStatus}" to GitHub issue state (open/closed).`,
      };
    }

    if (dryRun) {
      return {
        key: issueNum,
        provider: 'github',
        previous_status: 'current',
        new_status: targetState,
        success: true,
        mode: 'transitioned',
      };
    }

    const url = `${this.apiBaseUrl}/repos/${this.owner}/${this.repo}/issues/${issueNum}`;
    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeader(),
      },
      body: JSON.stringify({ state: targetState }),
    });

    if (!res.ok) {
      return {
        key: issueNum,
        provider: 'github',
        previous_status: 'current',
        new_status: targetState,
        success: false,
        mode: 'failed',
        error: `GitHub API error transitioning issue #${issueNum} (${res.status}): ${await res.text().catch(() => '')}`,
      };
    }

    return {
      key: issueNum,
      provider: 'github',
      previous_status: 'current',
      new_status: targetState,
      success: true,
      mode: 'transitioned',
    };
  }

  public async postComment(
    key: string,
    comment: string,
    dryRun: boolean = false
  ): Promise<IssueCommentResult> {
    const issueNum = this.parseIssueNumber(key);
    if (dryRun) {
      return {
        key: issueNum,
        provider: 'github',
        comment_id: 'dry-run-comment-id',
        comment_url: `https://github.com/${this.owner}/${this.repo}/issues/${issueNum}`,
        success: true,
        posted_at: new Date().toISOString(),
      };
    }

    const url = `${this.apiBaseUrl}/repos/${this.owner}/${this.repo}/issues/${issueNum}/comments`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeader(),
      },
      body: JSON.stringify({ body: comment }),
    });

    if (!res.ok) {
      throw new MannostreeError(
        `Failed to post comment to GitHub issue #${issueNum} (${res.status}): ${await res.text().catch(() => '')}`,
        ExitCode.VALIDATION_FAILURE
      );
    }

    const data: any = await res.json();
    return {
      key: issueNum,
      provider: 'github',
      comment_id: String(data.id),
      comment_url: data.html_url,
      success: true,
      posted_at: new Date().toISOString(),
    };
  }

  public async listIssues(filter?: { assignee?: string; status?: string }): Promise<IssueRecord[]> {
    if (!this.owner || !this.repo) return [];
    let state = 'open';
    if (filter?.status === 'closed' || filter?.status === 'done') {
      state = 'closed';
    }

    let url = `${this.apiBaseUrl}/repos/${this.owner}/${this.repo}/issues?state=${state}&per_page=50`;
    if (filter?.assignee) {
      url += `&assignee=${encodeURIComponent(filter.assignee)}`;
    }

    try {
      const res = await fetch(url, { method: 'GET', headers: this.getAuthHeader() });
      if (!res.ok) return [];

      const items: any[] = (await res.json()) as any[];
      return items

        .filter((i) => !i.pull_request) // filter out PRs
        .map((issue) => ({
          version: 1,
          key: String(issue.number),
          provider: 'github',
          title: issue.title,
          description: issue.body || '',
          status: issue.state,
          assignee: issue.assignee ? { name: issue.assignee.login } : undefined,
          labels: Array.isArray(issue.labels) ? issue.labels.map((l: any) => (typeof l === 'string' ? l : l.name)) : [],
          url: issue.html_url,
          acceptance_criteria: extractAcceptanceCriteria(issue.body || ''),
          created_at: issue.created_at || new Date().toISOString(),
          updated_at: issue.updated_at || new Date().toISOString(),
          last_synced_at: new Date().toISOString(),
        }));
    } catch {
      return [];
    }
  }

  public async checkHealth(): Promise<IssueTrackerHealthStatus> {
    const tokenConfigured = Boolean(this.token);
    if (!this.owner || !this.repo) {
      return {
        provider: 'github',
        available: false,
        token_configured: tokenConfigured,
        host_reachable: false,
        project_accessible: false,
        details: 'GitHub owner/repo not configured',
      };
    }

    try {
      const url = `${this.apiBaseUrl}/repos/${this.owner}/${this.repo}`;
      const res = await fetch(url, { method: 'GET', headers: this.getAuthHeader() });

      if (res.ok) {
        return {
          provider: 'github',
          available: true,
          token_configured: tokenConfigured,
          host_reachable: true,
          project_accessible: true,
          details: `Connected to repository ${this.owner}/${this.repo}`,
        };
      }

      return {
        provider: 'github',
        available: false,
        token_configured: tokenConfigured,
        host_reachable: true,
        project_accessible: false,
        error: `GitHub repository check returned status ${res.status}`,
      };
    } catch (err: any) {
      return {
        provider: 'github',
        available: false,
        token_configured: tokenConfigured,
        host_reachable: false,
        project_accessible: false,
        error: err.message,
      };
    }
  }
}
