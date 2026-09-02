# Technical Research: Movement 7 — Multi-Host Adapters

## 1. Remote Git URL Parsing & Host Detection

### Decision
Implement a zero-dependency remote URL parser [`parseRemoteUrl(remoteUrl: string): RemoteHostInfo`](#) supporting:
- Standard SSH: `git@github.com:owner/repo.git`, `git@gitlab.com:group/subgroup/project.git`
- Custom Port SSH: `ssh://git@git.internal.acme.corp:2222/team/repo.git`
- Standard HTTPS: `https://github.com/owner/repo.git`, `https://gitlab.com/group/project.git`
- Self-Hosted / Enterprise Custom Domains: `https://gitea.corp.local/team/project.git`, `https://bitbucket.company.com/scm/proj/repo.git`

### Host Type Detection Algorithm
1. Inspect hostname from parsed URL:
   - Contains `github.com` $\to$ `github`
   - Contains `gitlab` $\to$ `gitlab`
   - Contains `gitea` or `forgejo` $\to$ `gitea`
   - Contains `bitbucket` $\to$ `bitbucket`
2. If hostname does not match standard keywords:
   - Check `.mannostree.yml` `publish.hosts` domain mapping table (e.g. `hosts.acme_git.domain: "git.internal.acme.corp"`, `type: "gitlab"`).
   - If no match found $\to$ fall back to `generic`.

### Alternatives Considered
- *External regex package (`git-url-parse`)*: Rejected to avoid extra external dependencies when standard Node.js URL parsing and lightweight regex handle 100% of cases.

---

## 2. Pluggable Host Adapter Architecture

### Decision
Define a uniform `HostAdapter` interface in `src/adapters/base.ts`:
```typescript
export interface HostAdapter {
  readonly hostType: HostAdapterType;
  detect(remoteUrl: string): boolean;
  createPullRequest(worktreePath: string, options: HostPublishOptions): Promise<HostPublishResult>;
  checkHealth(config?: HostConfig): Promise<HostHealthStatus>;
  getPrWebUrl(hostInfo: RemoteHostInfo, prNumberOrIid: number): string;
}
```

Implement concrete adapters:
- `GitHubAdapter`: Uses `gh pr create` or GitHub REST API `POST /repos/{owner}/{repo}/pulls`.
- `GitLabAdapter`: Uses `glab mr create` or GitLab REST API `POST /api/v4/projects/{id}/merge_requests`.
- `GiteaAdapter`: Uses `tea pr create` or Gitea REST API `POST /api/v1/repos/{owner}/{repo}/pulls`.
- `BitbucketAdapter`: Uses Bitbucket 2.0 REST API `POST /2.0/repositories/{workspace}/{repo_slug}/pullrequests`.
- `GenericAdapter`: Executes `git push -u <remote> <branch>` and returns local Markdown export path with instructions.

### Rationale
Clean polymorphism ensures that `PublishEngine`, `ParallelEngine`, and `FleetEngine` interact with a unified interface rather than littering platform `if/else` branches throughout core code.

---

## 3. CLI vs Direct HTTP REST Execution Priority

### Decision
Adopt a 2-tier execution strategy per adapter:
1. **Tier 1 (Native CLI Binary)**: If native CLI tool (`gh`, `glab`, `tea`) is installed and authenticated in PATH, delegate to it for frictionless SSO / token management.
2. **Tier 2 (Direct HTTP Fetch API)**: If CLI binary is not present, use standard Node.js `fetch` with environment tokens (`GITLAB_TOKEN`, `GITEA_TOKEN`, `BITBUCKET_TOKEN`).
3. **Tier 3 (Graceful Fallback)**: If no token or CLI is available, push branch to remote and output formatted Markdown body to `.task/pr-body.md` with instructions.

---

## 4. Credential & Environment Variable Resolution

### Decision
Map standard environment variables with configurable overrides:
- **GitHub**: `GITHUB_TOKEN`, `GH_TOKEN`
- **GitLab**: `GITLAB_TOKEN`, `GL_TOKEN`, `CI_JOB_TOKEN`
- **Gitea / Forgejo**: `GITEA_TOKEN`
- **Bitbucket**: `BITBUCKET_TOKEN`, `BITBUCKET_APP_PASSWORD` + `BITBUCKET_USERNAME`

Configuration in `.mannostree.yml`:
```yaml
publish:
  default_remote: origin
  default_host: auto
  hosts:
    gitlab:
      base_url: https://gitlab.internal.corp
      token_env: CUSTOM_GITLAB_API_KEY
```
All credential reads occur strictly at runtime; tokens are never logged or stored in metadata.
