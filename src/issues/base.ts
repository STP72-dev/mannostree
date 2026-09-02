import {
  IssueCommentResult,
  IssueRecord,
  IssueTrackerHealthStatus,
  IssueTrackerProvider,
  IssueTransitionResult,
  MannostreeError,
  ExitCode,
} from '../types/index.js';
import { IssueTrackerConfig } from '../config/schema.js';
import { JiraAdapter } from './jira.js';
import { LinearAdapter } from './linear.js';
import { GitHubIssueAdapter } from './github.js';
import { GenericIssueAdapter } from './generic.js';

export interface IssueTrackerAdapter {
  readonly provider: IssueTrackerProvider;
  fetchIssue(key: string): Promise<IssueRecord>;
  transitionIssue(key: string, targetStatus: string, dryRun?: boolean): Promise<IssueTransitionResult>;
  postComment(key: string, comment: string, dryRun?: boolean): Promise<IssueCommentResult>;
  listIssues(filter?: { assignee?: string; status?: string }): Promise<IssueRecord[]>;
  checkHealth(): Promise<IssueTrackerHealthStatus>;
}

export class IssueTrackerRegistry {
  private adapters = new Map<IssueTrackerProvider, IssueTrackerAdapter>();

  public register(adapter: IssueTrackerAdapter): void {
    this.adapters.set(adapter.provider, adapter);
  }

  public getAdapter(provider: IssueTrackerProvider): IssueTrackerAdapter | null {
    return this.adapters.get(provider) || null;
  }

  public listAdapters(): IssueTrackerAdapter[] {
    return Array.from(this.adapters.values());
  }

  public resolveAdapterForIssue(key: string, config?: IssueTrackerConfig): IssueTrackerAdapter {
    // 1. If provider is explicitly given in config, prefer that
    if (config?.default_provider && this.adapters.has(config.default_provider)) {
      // If key looks specifically like GitHub (#123 or pure number) and provider is not set or default
      if (/^#?\d+$/.test(key) && this.adapters.has('github')) {
        return this.adapters.get('github')!;
      }
      return this.adapters.get(config.default_provider)!;
    }

    // 2. Heuristic based on key format
    if (/^#?\d+$/.test(key)) {
      const gh = this.adapters.get('github');
      if (gh) return gh;
    }

    if (/^[A-Z0-9]+-\d+$/i.test(key)) {
      // Could be Jira or Linear. Default to Jira if available, else Linear
      if (this.adapters.has('jira')) return this.adapters.get('jira')!;
      if (this.adapters.has('linear')) return this.adapters.get('linear')!;
    }

    // 3. Fallback to generic or first registered
    if (this.adapters.has('generic')) {
      return this.adapters.get('generic')!;
    }

    const first = Array.from(this.adapters.values())[0];
    if (first) {
      return first;
    }

    throw new MannostreeError(
      `No issue tracker adapter available to handle issue key "${key}".`,
      ExitCode.VALIDATION_FAILURE
    );
  }
}

export function createDefaultIssueTrackerRegistry(config?: IssueTrackerConfig): IssueTrackerRegistry {
  const registry = new IssueTrackerRegistry();
  registry.register(
    new JiraAdapter(
      config?.jira
        ? {
            host: config.jira.host,
            projectKey: config.jira.project_key,
            apiVersion: config.jira.api_version,
          }
        : undefined
    )
  );
  registry.register(
    new LinearAdapter(
      config?.linear
        ? {
            teamKey: config.linear.team_key,
          }
        : undefined
    )
  );
  registry.register(
    new GitHubIssueAdapter(
      config?.github
        ? {
            owner: config.github.owner,
            repo: config.github.repo,
          }
        : undefined
    )
  );
  registry.register(
    new GenericIssueAdapter(
      config?.generic
        ? {
            webhookUrl: config.generic.webhook_url,
          }
        : undefined
    )
  );
  return registry;
}

