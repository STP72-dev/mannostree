import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LinearAdapter } from '../../src/issues/linear.js';

describe('LinearAdapter', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('correctly queries and parses a Linear issue via GraphQL', async () => {
    const mockGqlResponse = {
      data: {
        issue: {
          id: 'lin-issue-uuid',
          identifier: 'ENG-442',
          title: 'Implement Multi-Host Adapter Support',
          description: 'Add GitLab and Bitbucket adapters.\n* [ ] GitLab support\n* [ ] Bitbucket support',
          priority: 1,
          state: { id: 'state-in-prog', name: 'In Progress', type: 'started' },
          assignee: { name: 'Alex Rivera', email: 'alex@example.com' },
          labels: { nodes: [{ name: 'backend' }, { name: 'core' }] },
          url: 'https://linear.app/myorg/issue/ENG-442',
          createdAt: '2026-09-01T08:00:00.000Z',
          updatedAt: '2026-09-02T08:00:00.000Z',
        },
      },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockGqlResponse,
    } as any);

    const adapter = new LinearAdapter({
      apiKey: 'lin_api_fake_token',
    });

    const record = await adapter.fetchIssue('ENG-442');

    expect(record.key).toBe('ENG-442');
    expect(record.provider).toBe('linear');
    expect(record.title).toBe('Implement Multi-Host Adapter Support');
    expect(record.status).toBe('In Progress');
    expect(record.priority).toBe('Urgent');
    expect(record.assignee?.name).toBe('Alex Rivera');
    expect(record.labels).toContain('backend');
    expect(record.acceptance_criteria).toHaveLength(2);
    expect(record.acceptance_criteria[0]).toBe('GitLab support');
  });

  it('transitions issue state via GraphQL mutation', async () => {
    const mockIssueAndStates = {
      data: {
        issue: {
          id: 'lin-issue-uuid',
          team: {
            states: {
              nodes: [
                { id: 'state-todo', name: 'Todo' },
                { id: 'state-review', name: 'In Review' },
                { id: 'state-done', name: 'Done' },
              ],
            },
          },
        },
      },
    };

    const mockMutationResponse = {
      data: {
        issueUpdate: {
          success: true,
          issue: {
            id: 'lin-issue-uuid',
            state: { name: 'In Review' },
          },
        },
      },
    };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockIssueAndStates,
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockMutationResponse,
      } as any);

    const adapter = new LinearAdapter({
      apiKey: 'lin_api_fake_token',
    });

    const result = await adapter.transitionIssue('ENG-442', 'In Review');

    expect(result.success).toBe(true);
    expect(result.new_status).toBe('In Review');
    expect(result.mode).toBe('transitioned');
  });

  it('posts a comment via GraphQL mutation', async () => {
    const mockCommentResponse = {
      data: {
        commentCreate: {
          success: true,
          comment: {
            id: 'comment-uuid-123',
            url: 'https://linear.app/myorg/issue/ENG-442#comment-123',
          },
        },
      },
    };

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockCommentResponse,
    } as any);

    const adapter = new LinearAdapter({
      apiKey: 'lin_api_fake_token',
    });

    const result = await adapter.postComment('12345678-1234-1234-1234-123456789abc', 'Evaluation matrix: 100% Pass');

    expect(result.success).toBe(true);
    expect(result.comment_id).toBe('comment-uuid-123');
  });
});

