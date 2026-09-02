import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitHubIssueAdapter } from '../../src/issues/github.js';

describe('GitHubIssueAdapter', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('correctly queries and parses a GitHub issue ticket', async () => {
    const mockIssue = {
      number: 89,
      title: 'Support Poly-Worktree Linking',
      body: 'Add support for npm link and pth.\n- [ ] node symlink\n- [ ] pth python',
      state: 'open',
      user: { login: 'octocat' },
      assignee: { login: 'w7-loqker' },
      labels: [{ name: 'enhancement' }, { name: 'poly' }],
      html_url: 'https://github.com/organcorp/lsol/issues/89',
      created_at: '2026-09-01T12:00:00Z',
      updated_at: '2026-09-02T12:00:00Z',
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockIssue,
    } as any);

    const adapter = new GitHubIssueAdapter({
      owner: 'organcorp',
      repo: 'lsol',
      token: 'ghp_fake_token',
    });

    const record = await adapter.fetchIssue('89');

    expect(record.key).toBe('89');
    expect(record.provider).toBe('github');
    expect(record.title).toBe('Support Poly-Worktree Linking');
    expect(record.status).toBe('open');
    expect(record.assignee?.name).toBe('w7-loqker');
    expect(record.labels).toContain('enhancement');
    expect(record.acceptance_criteria).toHaveLength(2);
    expect(record.acceptance_criteria[0]).toBe('node symlink');
  });

  it('transitions state or adds workflow label', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ number: 89, state: 'closed' }),
      } as any);

    const adapter = new GitHubIssueAdapter({
      owner: 'organcorp',
      repo: 'lsol',
      token: 'ghp_fake_token',
    });

    const result = await adapter.transitionIssue('89', 'closed');

    expect(result.success).toBe(true);
    expect(result.new_status).toBe('closed');
  });

  it('posts comment to GitHub issue', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({
        id: 9912,
        html_url: 'https://github.com/organcorp/lsol/issues/89#issuecomment-9912',
      }),
    } as any);

    const adapter = new GitHubIssueAdapter({
      owner: 'organcorp',
      repo: 'lsol',
      token: 'ghp_fake_token',
    });

    const result = await adapter.postComment('89', 'All tests passing');

    expect(result.success).toBe(true);
    expect(result.comment_id).toBe('9912');
  });
});
