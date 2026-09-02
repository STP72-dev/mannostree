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

export interface JiraAdapterOptions {
  host?: string;
  email?: string;
  apiToken?: string;
  pat?: string;
  projectKey?: string;
  apiVersion?: string;
}

export function extractAcceptanceCriteria(text: string): string[] {
  if (!text) return [];
  const lines = text.split('\n');
  const criteria: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // Matches markdown checkboxes - [ ] or * [ ] or [ ]
    const checkboxMatch = trimmed.match(/^[-*]?\s*\[\s*\]\s+(.+)$/);
    if (checkboxMatch && checkboxMatch[1]) {
      criteria.push(checkboxMatch[1].trim());
    }
  }

  return criteria;
}

export class JiraAdapter implements IssueTrackerAdapter {
  public readonly provider: IssueTrackerProvider = 'jira';
  private host: string;
  private email: string;
  private apiToken: string;
  private pat: string;
  private projectKey: string;
  private apiVersion: string;

  constructor(options: JiraAdapterOptions = {}) {
    this.host = options.host || process.env.JIRA_HOST || '';
    this.email = options.email || process.env.JIRA_EMAIL || '';
    this.apiToken = options.apiToken || process.env.JIRA_API_TOKEN || '';
    this.pat = options.pat || process.env.JIRA_PAT || '';
    this.projectKey = options.projectKey || process.env.JIRA_PROJECT_KEY || '';
    this.apiVersion = options.apiVersion || '3';

    if (this.host.endsWith('/')) {
      this.host = this.host.slice(0, -1);
    }
  }

  private getAuthHeader(): Record<string, string> {
    if (this.pat) {
      return { Authorization: `Bearer ${this.pat}` };
    }
    if (this.email && this.apiToken) {
      const encoded = Buffer.from(`${this.email}:${this.apiToken}`).toString('base64');
      return { Authorization: `Basic ${encoded}` };
    }
    return {};
  }

  public async fetchIssue(key: string): Promise<IssueRecord> {
    const cleanKey = key.trim().toUpperCase();
    const url = `${this.host}/rest/api/${this.apiVersion}/issue/${cleanKey}`;
    const headers = {
      'Accept': 'application/json',
      ...this.getAuthHeader(),
    };

    let res: Response;
    try {
      res = await fetch(url, { method: 'GET', headers });
    } catch (err: any) {
      throw new MannostreeError(
        `Failed to reach Jira host at ${this.host}: ${err.message}`,
        ExitCode.GENERIC_FAILURE
      );
    }


    if (!res.ok) {
      throw new MannostreeError(
        `Jira API error fetching issue ${cleanKey} (${res.status}): ${await res.text().catch(() => '')}`,
        ExitCode.VALIDATION_FAILURE
      );
    }

    const data: any = await res.json();
    const fields = data.fields || {};

    let descriptionText = '';
    if (typeof fields.description === 'string') {
      descriptionText = fields.description;
    } else if (fields.description && typeof fields.description === 'object') {
      // Very basic ADF text extract
      descriptionText = JSON.stringify(fields.description);
    }

    const criteria = extractAcceptanceCriteria(descriptionText);
    const statusName = fields.status?.name || 'Unknown';
    const statusCatKey = fields.status?.statusCategory?.key;
    let statusCategory: 'todo' | 'in_progress' | 'done' | 'cancelled' | undefined;
    if (statusCatKey === 'new') statusCategory = 'todo';
    else if (statusCatKey === 'indeterminate') statusCategory = 'in_progress';
    else if (statusCatKey === 'done') statusCategory = 'done';

    const issueUrl = `${this.host}/browse/${cleanKey}`;

    return {
      version: 1,
      key: cleanKey,
      provider: 'jira',
      title: fields.summary || cleanKey,
      description: descriptionText,
      status: statusName,
      status_category: statusCategory,
      priority: fields.priority?.name,
      assignee: fields.assignee
        ? {
            name: fields.assignee.displayName || fields.assignee.name,
            email: fields.assignee.emailAddress,
          }
        : undefined,
      labels: Array.isArray(fields.labels) ? fields.labels : [],
      url: issueUrl,
      acceptance_criteria: criteria,
      created_at: fields.created || new Date().toISOString(),
      updated_at: fields.updated || new Date().toISOString(),
      last_synced_at: new Date().toISOString(),
    };
  }

  public async transitionIssue(
    key: string,
    targetStatus: string,
    dryRun: boolean = false
  ): Promise<IssueTransitionResult> {
    const cleanKey = key.trim().toUpperCase();
    const transitionsUrl = `${this.host}/rest/api/${this.apiVersion}/issue/${cleanKey}/transitions`;
    const headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...this.getAuthHeader(),
    };

    let res: Response;
    try {
      res = await fetch(transitionsUrl, { method: 'GET', headers });
    } catch (err: any) {
      return {
        key: cleanKey,
        provider: 'jira',
        previous_status: 'unknown',
        new_status: targetStatus,
        success: false,
        mode: 'failed',
        error: `Failed to fetch Jira transitions: ${err.message}`,
      };
    }

    if (!res.ok) {
      return {
        key: cleanKey,
        provider: 'jira',
        previous_status: 'unknown',
        new_status: targetStatus,
        success: false,
        mode: 'failed',
        error: `Jira API error querying transitions (${res.status}): ${await res.text().catch(() => '')}`,
      };
    }

    const data: any = await res.json();
    const transitions: Array<{ id: string; name: string }> = data.transitions || [];

    // Find matching transition
    const match = transitions.find(
      (t) => t.name.toLowerCase() === targetStatus.toLowerCase()
    );

    if (!match) {
      return {
        key: cleanKey,
        provider: 'jira',
        previous_status: 'current',
        new_status: targetStatus,
        success: false,
        mode: 'noop',
        error: `No transition found matching "${targetStatus}". Available: ${transitions.map((t) => t.name).join(', ')}`,
      };
    }

    if (dryRun) {
      return {
        key: cleanKey,
        provider: 'jira',
        previous_status: 'current',
        new_status: targetStatus,
        transition_id: match.id,
        success: true,
        mode: 'transitioned',
      };
    }

    const postRes = await fetch(transitionsUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        transition: { id: match.id },
      }),
    });

    if (!postRes.ok) {
      return {
        key: cleanKey,
        provider: 'jira',
        previous_status: 'current',
        new_status: targetStatus,
        transition_id: match.id,
        success: false,
        mode: 'failed',
        error: `Jira transition execution failed (${postRes.status}): ${await postRes.text().catch(() => '')}`,
      };
    }

    return {
      key: cleanKey,
      provider: 'jira',
      previous_status: 'current',
      new_status: targetStatus,
      transition_id: match.id,
      success: true,
      mode: 'transitioned',
    };
  }

  public async postComment(
    key: string,
    comment: string,
    dryRun: boolean = false
  ): Promise<IssueCommentResult> {
    const cleanKey = key.trim().toUpperCase();
    if (dryRun) {
      return {
        key: cleanKey,
        provider: 'jira',
        comment_id: 'dry-run-comment-id',
        comment_url: `${this.host}/browse/${cleanKey}`,
        success: true,
        posted_at: new Date().toISOString(),
      };
    }

    const url = `${this.host}/rest/api/${this.apiVersion}/issue/${cleanKey}/comment`;
    const headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...this.getAuthHeader(),
    };

    let bodyPayload: any;
    if (this.apiVersion === '3') {
      bodyPayload = {
        body: {
          type: 'doc',
          version: 1,
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: comment }],
            },
          ],
        },
      };
    } else {
      bodyPayload = { body: comment };
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(bodyPayload),
    });

    if (!res.ok) {
      throw new MannostreeError(
        `Failed to post Jira comment (${res.status}): ${await res.text().catch(() => '')}`,
        ExitCode.VALIDATION_FAILURE
      );
    }

    const data: any = await res.json();
    return {
      key: cleanKey,
      provider: 'jira',
      comment_id: String(data.id),
      comment_url: data.self || `${this.host}/browse/${cleanKey}`,
      success: true,
      posted_at: new Date().toISOString(),
    };
  }

  public async listIssues(filter?: { assignee?: string; status?: string }): Promise<IssueRecord[]> {
    let jql = this.projectKey ? `project = "${this.projectKey}"` : 'created >= -30d';
    if (filter?.assignee) {
      jql += ` AND assignee = "${filter.assignee}"`;
    }
    if (filter?.status) {
      jql += ` AND status = "${filter.status}"`;
    }

    const url = `${this.host}/rest/api/${this.apiVersion}/search?jql=${encodeURIComponent(jql)}&maxResults=50`;
    const headers = {
      'Accept': 'application/json',
      ...this.getAuthHeader(),
    };

    const res = await fetch(url, { method: 'GET', headers });
    if (!res.ok) {
      return [];
    }

    const data: any = await res.json();
    const issues: any[] = data.issues || [];
    return issues.map((i) => ({
      version: 1,
      key: i.key,
      provider: 'jira',
      title: i.fields?.summary || i.key,
      description: typeof i.fields?.description === 'string' ? i.fields.description : '',
      status: i.fields?.status?.name || 'Unknown',
      priority: i.fields?.priority?.name,
      assignee: i.fields?.assignee ? { name: i.fields.assignee.displayName } : undefined,
      labels: Array.isArray(i.fields?.labels) ? i.fields.labels : [],
      url: `${this.host}/browse/${i.key}`,
      acceptance_criteria: extractAcceptanceCriteria(
        typeof i.fields?.description === 'string' ? i.fields.description : ''
      ),
      created_at: i.fields?.created || new Date().toISOString(),
      updated_at: i.fields?.updated || new Date().toISOString(),
      last_synced_at: new Date().toISOString(),
    }));
  }

  public async checkHealth(): Promise<IssueTrackerHealthStatus> {
    const tokenConfigured = Boolean(this.pat || (this.email && this.apiToken));
    if (!this.host) {
      return {
        provider: 'jira',
        available: false,
        token_configured: tokenConfigured,
        host_reachable: false,
        project_accessible: false,
        details: 'Jira host not configured (missing JIRA_HOST or config host)',
      };
    }

    try {
      const url = `${this.host}/rest/api/${this.apiVersion}/myself`;
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          ...this.getAuthHeader(),
        },
      });

      if (res.ok) {
        return {
          provider: 'jira',
          available: true,
          token_configured: tokenConfigured,
          host_reachable: true,
          project_accessible: true,
          details: `Authenticated with Jira (${this.host})`,
        };
      }

      return {
        provider: 'jira',
        available: false,
        token_configured: tokenConfigured,
        host_reachable: true,
        project_accessible: false,
        error: `Jira authentication check returned status ${res.status}`,
      };
    } catch (err: any) {
      return {
        provider: 'jira',
        available: false,
        token_configured: tokenConfigured,
        host_reachable: false,
        project_accessible: false,
        error: err.message,
      };
    }
  }
}
