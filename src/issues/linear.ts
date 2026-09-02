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

export interface LinearAdapterOptions {
  apiKey?: string;
  apiUrl?: string;
  teamKey?: string;
}

export class LinearAdapter implements IssueTrackerAdapter {
  public readonly provider: IssueTrackerProvider = 'linear';
  private apiKey: string;
  private apiUrl: string;
  private teamKey: string;

  constructor(options: LinearAdapterOptions = {}) {
    this.apiKey = options.apiKey || process.env.LINEAR_API_KEY || '';
    this.apiUrl = options.apiUrl || process.env.LINEAR_API_URL || 'https://api.linear.app/graphql';
    this.teamKey = options.teamKey || process.env.LINEAR_TEAM_KEY || '';
  }

  private async executeGql(query: string, variables: Record<string, any> = {}): Promise<any> {
    if (!this.apiKey) {
      throw new MannostreeError(
        'Linear API key not found. Please set LINEAR_API_KEY environment variable.',
        ExitCode.VALIDATION_FAILURE
      );
    }

    let res: Response;
    try {
      res = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': this.apiKey,
        },
        body: JSON.stringify({ query, variables }),
      });
    } catch (err: any) {
      throw new MannostreeError(
        `Failed to reach Linear GraphQL API at ${this.apiUrl}: ${err.message}`,
        ExitCode.GENERIC_FAILURE
      );
    }


    if (!res.ok) {
      throw new MannostreeError(
        `Linear GraphQL HTTP error (${res.status}): ${await res.text().catch(() => '')}`,
        ExitCode.VALIDATION_FAILURE
      );
    }

    const payload: any = await res.json();
    if (payload.errors && payload.errors.length > 0) {
      throw new MannostreeError(
        `Linear GraphQL query error: ${payload.errors.map((e: any) => e.message).join('; ')}`,
        ExitCode.VALIDATION_FAILURE
      );
    }

    return payload.data;
  }

  public async fetchIssue(key: string): Promise<IssueRecord> {
    const cleanKey = key.trim();
    const query = `
      query GetIssue($id: String!) {
        issue(id: $id) {
          id
          identifier
          title
          description
          priority
          priorityLabel
          state {
            id
            name
            type
          }
          assignee {
            name
            email
          }
          labels {
            nodes {
              name
            }
          }
          url
          createdAt
          updatedAt
        }
      }
    `;

    const data = await this.executeGql(query, { id: cleanKey });
    const issue = data.issue;
    if (!issue) {
      throw new MannostreeError(
        `Linear issue "${cleanKey}" not found.`,
        ExitCode.VALIDATION_FAILURE
      );
    }

    const criteria = extractAcceptanceCriteria(issue.description || '');
    const priorityNames: Record<number, string> = {
      0: 'No priority',
      1: 'Urgent',
      2: 'High',
      3: 'Medium',
      4: 'Low',
    };
    const priorityName = priorityNames[issue.priority] || issue.priorityLabel || 'Medium';

    return {
      version: 1,
      key: issue.identifier || cleanKey,
      provider: 'linear',
      title: issue.title,
      description: issue.description || '',
      status: issue.state?.name || 'Unknown',
      status_category: issue.state?.type === 'started' ? 'in_progress' : issue.state?.type === 'completed' ? 'done' : 'todo',
      priority: priorityName,
      assignee: issue.assignee ? { name: issue.assignee.name, email: issue.assignee.email } : undefined,
      labels: issue.labels?.nodes ? issue.labels.nodes.map((n: any) => n.name) : [],
      url: issue.url || `https://linear.app/issue/${issue.identifier}`,
      acceptance_criteria: criteria,
      created_at: issue.createdAt || new Date().toISOString(),
      updated_at: issue.updatedAt || new Date().toISOString(),
      last_synced_at: new Date().toISOString(),
    };
  }

  public async transitionIssue(
    key: string,
    targetStatus: string,
    dryRun: boolean = false
  ): Promise<IssueTransitionResult> {
    const cleanKey = key.trim();
    const query = `
      query GetIssueAndStates($id: String!) {
        issue(id: $id) {
          id
          identifier
          state {
            name
          }
          team {
            states {
              nodes {
                id
                name
              }
            }
          }
        }
      }
    `;

    let data: any;
    try {
      data = await this.executeGql(query, { id: cleanKey });
    } catch (err: any) {
      return {
        key: cleanKey,
        provider: 'linear',
        previous_status: 'unknown',
        new_status: targetStatus,
        success: false,
        mode: 'failed',
        error: err.message,
      };
    }

    const issue = data.issue;
    if (!issue) {
      return {
        key: cleanKey,
        provider: 'linear',
        previous_status: 'unknown',
        new_status: targetStatus,
        success: false,
        mode: 'failed',
        error: `Linear issue ${cleanKey} not found`,
      };
    }

    const states: Array<{ id: string; name: string }> = issue.team?.states?.nodes || [];
    const match = states.find(
      (s) => s.name.toLowerCase() === targetStatus.toLowerCase()
    );

    if (!match) {
      return {
        key: cleanKey,
        provider: 'linear',
        previous_status: issue.state?.name || 'current',
        new_status: targetStatus,
        success: false,
        mode: 'noop',
        error: `No Linear state matching "${targetStatus}". Available: ${states.map((s) => s.name).join(', ')}`,
      };
    }

    if (dryRun) {
      return {
        key: cleanKey,
        provider: 'linear',
        previous_status: issue.state?.name || 'current',
        new_status: targetStatus,
        transition_id: match.id,
        success: true,
        mode: 'transitioned',
      };
    }

    const mutation = `
      mutation UpdateIssueState($id: String!, $stateId: String!) {
        issueUpdate(id: $id, input: { stateId: $stateId }) {
          success
          issue {
            id
            state {
              name
            }
          }
        }
      }
    `;

    const mutData = await this.executeGql(mutation, { id: issue.id, stateId: match.id });
    const success = mutData.issueUpdate?.success || false;

    return {
      key: cleanKey,
      provider: 'linear',
      previous_status: issue.state?.name || 'current',
      new_status: targetStatus,
      transition_id: match.id,
      success,
      mode: success ? 'transitioned' : 'failed',
    };
  }

  public async postComment(
    key: string,
    comment: string,
    dryRun: boolean = false
  ): Promise<IssueCommentResult> {
    const cleanKey = key.trim();
    if (dryRun) {
      return {
        key: cleanKey,
        provider: 'linear',
        comment_id: 'dry-run-comment-id',
        comment_url: `https://linear.app/issue/${cleanKey}`,
        success: true,
        posted_at: new Date().toISOString(),
      };
    }

    // Resolve issue UUID if needed
    let issueUuid = cleanKey;
    if (!/^[0-9a-fA-F-]{36}$/.test(cleanKey)) {
      try {
        const query = `query GetId($id: String!) { issue(id: $id) { id } }`;
        const d = await this.executeGql(query, { id: cleanKey });
        if (d?.issue?.id) {
          issueUuid = d.issue.id;
        }
      } catch {
        // fallback to using cleanKey
      }
    }


    const mutation = `
      mutation CreateComment($issueId: String!, $body: String!) {
        commentCreate(input: { issueId: $issueId, body: $body }) {
          success
          comment {
            id
            url
          }
        }
      }
    `;

    const data = await this.executeGql(mutation, { issueId: issueUuid, body: comment });
    const c = data.commentCreate?.comment;

    return {
      key: cleanKey,
      provider: 'linear',
      comment_id: c?.id || 'unknown',
      comment_url: c?.url || `https://linear.app/issue/${cleanKey}`,
      success: data.commentCreate?.success || false,
      posted_at: new Date().toISOString(),
    };
  }

  public async listIssues(filter?: { assignee?: string; status?: string }): Promise<IssueRecord[]> {
    const query = `
      query ListIssues($teamKey: String) {
        issues(filter: { team: { key: { eq: $teamKey } } }, first: 50) {
          nodes {
            id
            identifier
            title
            description
            priority
            state {
              name
              type
            }
            assignee {
              name
              email
            }
            labels {
              nodes {
                name
              }
            }
            url
            createdAt
            updatedAt
          }
        }
      }
    `;

    try {
      const data = await this.executeGql(query, { teamKey: this.teamKey || undefined });
      const nodes: any[] = data.issues?.nodes || [];
      return nodes.map((issue) => ({
        version: 1,
        key: issue.identifier,
        provider: 'linear',
        title: issue.title,
        description: issue.description || '',
        status: issue.state?.name || 'Unknown',
        priority: String(issue.priority),
        assignee: issue.assignee ? { name: issue.assignee.name, email: issue.assignee.email } : undefined,
        labels: issue.labels?.nodes ? issue.labels.nodes.map((n: any) => n.name) : [],
        url: issue.url,
        acceptance_criteria: extractAcceptanceCriteria(issue.description || ''),
        created_at: issue.createdAt || new Date().toISOString(),
        updated_at: issue.updatedAt || new Date().toISOString(),
        last_synced_at: new Date().toISOString(),
      }));
    } catch {
      return [];
    }
  }

  public async checkHealth(): Promise<IssueTrackerHealthStatus> {
    const tokenConfigured = Boolean(this.apiKey);
    if (!tokenConfigured) {
      return {
        provider: 'linear',
        available: false,
        token_configured: false,
        host_reachable: false,
        project_accessible: false,
        details: 'LINEAR_API_KEY not configured in environment',
      };
    }

    try {
      const query = `query CheckViewer { viewer { id name email } }`;
      const data = await this.executeGql(query);
      if (data.viewer) {
        return {
          provider: 'linear',
          available: true,
          token_configured: true,
          host_reachable: true,
          project_accessible: true,
          details: `Authenticated as ${data.viewer.name} (${data.viewer.email})`,
        };
      }
      return {
        provider: 'linear',
        available: false,
        token_configured: true,
        host_reachable: true,
        project_accessible: false,
        error: 'Viewer query did not return a user',
      };
    } catch (err: any) {
      return {
        provider: 'linear',
        available: false,
        token_configured: true,
        host_reachable: false,
        project_accessible: false,
        error: err.message,
      };
    }
  }
}
