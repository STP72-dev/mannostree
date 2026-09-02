import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JiraAdapter } from '../../src/issues/jira.js';

describe('JiraAdapter', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('correctly parses and fetches a Jira issue ticket', async () => {
    const mockIssueResponse = {
      key: 'PROJ-101',
      fields: {
        summary: 'Implement OAuth2 Refresh Token Rotation',
        description: 'Need refresh token rotation.\n- [ ] Store rotated tokens\n- [ ] Invalidate reuse',
        status: { name: 'In Progress', statusCategory: { key: 'indeterminate' } },
        priority: { name: 'High' },
        assignee: { displayName: 'Jane Doe', emailAddress: 'jane@example.com' },
        labels: ['auth', 'security'],
        created: '2026-09-01T10:00:00.000Z',
        updated: '2026-09-02T10:00:00.000Z',
      },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockIssueResponse,
    } as any);

    const adapter = new JiraAdapter({
      host: 'https://testorg.atlassian.net',
      email: 'dev@testorg.com',
      apiToken: 'fake-token',
    });

    const record = await adapter.fetchIssue('PROJ-101');

    expect(record.key).toBe('PROJ-101');
    expect(record.provider).toBe('jira');
    expect(record.title).toBe('Implement OAuth2 Refresh Token Rotation');
    expect(record.status).toBe('In Progress');
    expect(record.priority).toBe('High');
    expect(record.assignee?.name).toBe('Jane Doe');
    expect(record.labels).toContain('auth');
    expect(record.acceptance_criteria).toHaveLength(2);
    expect(record.acceptance_criteria[0]).toBe('Store rotated tokens');
    expect(record.url).toBe('https://testorg.atlassian.net/browse/PROJ-101');
  });

  it('performs transition by finding matching transition id', async () => {
    const mockTransitions = {
      transitions: [
        { id: '11', name: 'To Do' },
        { id: '21', name: 'In Progress' },
        { id: '31', name: 'In Review' },
        { id: '41', name: 'Done' },
      ],
    };

    global.fetch = vi.fn()
      // First call for GET /transitions
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockTransitions,
      } as any)
      // Second call for POST /transitions
      .mockResolvedValueOnce({
        ok: true,
        status: 204,
        text: async () => '',
      } as any);

    const adapter = new JiraAdapter({
      host: 'https://testorg.atlassian.net',
      email: 'dev@testorg.com',
      apiToken: 'fake-token',
    });

    const result = await adapter.transitionIssue('PROJ-101', 'In Review');

    expect(result.success).toBe(true);
    expect(result.transition_id).toBe('31');
    expect(result.new_status).toBe('In Review');
    expect(result.mode).toBe('transitioned');
  });

  it('supports dry-run simulation without sending POST transition', async () => {
    const mockTransitions = {
      transitions: [{ id: '21', name: 'In Progress' }],
    };

    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockTransitions,
    } as any);

    global.fetch = fetchMock;

    const adapter = new JiraAdapter({
      host: 'https://testorg.atlassian.net',
      email: 'dev@testorg.com',
      apiToken: 'fake-token',
    });

    const result = await adapter.transitionIssue('PROJ-101', 'In Progress', true);

    expect(result.success).toBe(true);
    expect(result.mode).toBe('transitioned');
    expect(fetchMock).toHaveBeenCalledTimes(1); // Only GET transitions, no POST
  });

  it('posts a markdown comment to the Jira issue', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ id: '10042', self: 'https://testorg.atlassian.net/rest/api/3/comment/10042' }),
    } as any);

    const adapter = new JiraAdapter({
      host: 'https://testorg.atlassian.net',
      email: 'dev@testorg.com',
      apiToken: 'fake-token',
    });

    const result = await adapter.postComment('PROJ-101', 'Test passed!');

    expect(result.success).toBe(true);
    expect(result.comment_id).toBe('10042');
  });
});
