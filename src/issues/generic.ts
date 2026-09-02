import {
  IssueCommentResult,
  IssueRecord,
  IssueTrackerHealthStatus,
  IssueTrackerProvider,
  IssueTransitionResult,
} from '../types/index.js';
import { IssueTrackerAdapter } from './base.js';

export interface GenericIssueAdapterOptions {
  webhookUrl?: string;
}

export class GenericIssueAdapter implements IssueTrackerAdapter {
  public readonly provider: IssueTrackerProvider = 'generic';
  private webhookUrl: string;

  constructor(options: GenericIssueAdapterOptions = {}) {
    this.webhookUrl = options.webhookUrl || process.env.GENERIC_ISSUE_WEBHOOK_URL || '';
  }

  public async fetchIssue(key: string): Promise<IssueRecord> {
    return {
      version: 1,
      key,
      provider: 'generic',
      title: `Issue ${key}`,
      description: `Generic task specification for ${key}`,
      status: 'Open',
      labels: ['generic'],
      url: this.webhookUrl || `issue://${key}`,
      acceptance_criteria: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_synced_at: new Date().toISOString(),
    };
  }

  public async transitionIssue(
    key: string,
    targetStatus: string,
    dryRun: boolean = false
  ): Promise<IssueTransitionResult> {
    if (this.webhookUrl && !dryRun) {
      try {
        await fetch(this.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'issue_transition',
            key,
            target_status: targetStatus,
            timestamp: new Date().toISOString(),
          }),
        });
      } catch {
        // ignore webhook delivery failure
      }
    }

    return {
      key,
      provider: 'generic',
      previous_status: 'current',
      new_status: targetStatus,
      success: true,
      mode: 'transitioned',
    };
  }

  public async postComment(
    key: string,
    comment: string,
    dryRun: boolean = false
  ): Promise<IssueCommentResult> {
    if (this.webhookUrl && !dryRun) {
      try {
        await fetch(this.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'issue_comment',
            key,
            comment,
            timestamp: new Date().toISOString(),
          }),
        });
      } catch {
        // ignore
      }
    }

    return {
      key,
      provider: 'generic',
      comment_id: `generic-${Date.now()}`,
      comment_url: this.webhookUrl || `issue://${key}`,
      success: true,
      posted_at: new Date().toISOString(),
    };
  }

  public async listIssues(): Promise<IssueRecord[]> {
    return [];
  }

  public async checkHealth(): Promise<IssueTrackerHealthStatus> {
    return {
      provider: 'generic',
      available: true,
      token_configured: true,
      host_reachable: true,
      project_accessible: true,
      details: this.webhookUrl ? `Webhook configured (${this.webhookUrl})` : 'Generic offline mode active',
    };
  }
}
