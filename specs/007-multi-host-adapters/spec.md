# Feature Specification: Movement 7 — Multi-Host Adapters

**Feature Branch**: `007-multi-host-adapters`  
**Created**: 2026-09-02  
**Status**: Ready for Planning  
**Input**: User description: "Movement 7: Multi-Host Adapters"

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Automatic Remote Host Detection & Pluggable Publishing (Priority: P1) 🎯 MVP

Engineering teams and autonomous agents run development worktrees across diverse hosting providers (GitHub, GitLab, Gitea, Bitbucket, and self-hosted on-premise git instances). When executing `mannostree pr`, `mannostree parallel publish`, or `mannostree fleet publish`, the system must automatically inspect the git remote URL (e.g. `git@gitlab.com:org/repo.git`, `https://gitea.internal/team/project.git`), identify the host type, and seamlessly route PR/MR creation through the appropriate platform adapter without requiring manual host flags.

**Why this priority**: Removes single-vendor lock-in to GitHub, enabling Mannostree to function seamlessly across any enterprise git infrastructure.

**Independent Test**: Configure test git repositories with varying remote URLs (GitHub, GitLab, Gitea, Bitbucket, generic SSH), execute `mannostree pr <id> --preview`, and verify that the correct host adapter is auto-detected and formats host-specific metadata (MR vs PR syntax).

**Acceptance Scenarios**:
1. **Given** a repository with a `gitlab.com` or custom self-hosted GitLab remote, **When** `mannostree pr <id>` or `mannostree parallel publish <feature>` is executed, **Then** the system automatically selects the GitLab adapter, compiles Markdown conforming to GitLab MR formatting, and targets the configured GitLab endpoint.
2. **Given** a repository with an explicit `--host <name>` flag (e.g. `--host gitea`), **When** publishing is triggered, **Then** the explicit host flag overrides automatic remote URL detection.
3. **Given** an unknown or generic git remote without a supported API adapter, **When** publishing is triggered with `--push`, **Then** the branch is pushed to the remote and the system outputs a generic web URL or instructions for manual PR/MR opening.

---

### User Story 2 - Native GitLab Merge Request Adapter (Priority: P1) 🎯 MVP

Developers and CI/CD pipelines hosting projects on GitLab (SaaS or Self-Hosted) need first-class Merge Request creation (`mannostree pr`, `mannostree parallel publish`). The GitLab adapter must support draft status (`Draft: ...` title prefix or GitLab API draft flag), target branch selection, rich markdown descriptions (including task contracts, benchmark comparison matrices, and review checklists), and token authentication via environment variables (`GITLAB_TOKEN` / `GL_TOKEN`) or `glab` CLI fallback.

**Why this priority**: GitLab is the second-largest enterprise code hosting platform; supporting native MR creation is critical for enterprise adoption.

**Independent Test**: In a worktree pointing to a GitLab remote, run `mannostree pr <id> --draft --push` (with mocked API/CLI) and verify that the MR is created with correct source branch, target branch, title, and rich description body.

**Acceptance Scenarios**:
1. **Given** a valid GitLab token or `glab` CLI installation, **When** the user publishes a winning experiment variant via `mannostree parallel publish <feature> --push`, **Then** the adapter pushes the branch, creates a GitLab Merge Request, and records the MR web URL and IID in metadata.
2. **Given** the `--draft` option, **When** publishing to GitLab, **Then** the Merge Request is opened with the `Draft:` prefix or `draft=true` parameter.

---

### User Story 3 - Gitea/Forgejo and Bitbucket Cloud/Server Adapters (Priority: P2)

Organizations utilizing Gitea, Forgejo, or Atlassian Bitbucket (Cloud or Data Center) require dedicated publishing adapters to create Pull Requests directly via REST APIs or CLI utilities (`tea` CLI for Gitea).

**Why this priority**: Completes support across the major open-source self-hosted and enterprise code collaboration suites.

**Independent Test**: Configure Gitea and Bitbucket remote endpoints, run publish preview and execution tests, and verify correct API request payload generation and response parsing.

**Acceptance Scenarios**:
1. **Given** a Gitea/Forgejo remote and `GITEA_TOKEN` environment variable, **When** `mannostree pr <id> --push` is executed, **Then** a Gitea Pull Request is created via the Gitea REST API (`/api/v1/repos/{owner}/{repo}/pulls`).
2. **Given** a Bitbucket remote with `BITBUCKET_TOKEN` or `BITBUCKET_APP_PASSWORD`, **When** `mannostree pr <id> --push` is executed, **Then** a Bitbucket Pull Request is created via the Bitbucket 2.0 REST API.

---

### User Story 4 - Multi-Host Credential Resolution & Diagnostic Doctor (Priority: P2)

Operators managing multi-host environments need visibility into adapter readiness, authentication status, and API reachability. `mannostree doctor` must audit configured host adapters, check credential environment variables, verify CLI tool availability (`gh`, `glab`, `tea`), and report actionable remediation guidance.

**Why this priority**: Prevents runtime publishing failures by surfacing missing credentials or uninstalled CLI tools during setup.

**Independent Test**: Run `mannostree doctor` with various combinations of missing/present environment tokens and CLI binaries, verifying that diagnostic findings reflect accurate host adapter readiness.

**Acceptance Scenarios**:
1. **Given** a configured GitLab remote with missing `GITLAB_TOKEN` and missing `glab` binary, **When** `mannostree doctor` executes, **Then** doctor reports a warning with specific installation and token configuration steps.
2. **Given** valid credentials configured across multiple hosts, **When** `mannostree doctor` executes, **Then** all host adapters report healthy status.

---

### Edge Cases

- **Self-Hosted Custom Domains**: Remote URLs like `git@git.internal.acme.corp:group/project.git` must be mapped to specific adapter types via `.mannostree.yml` host rules when domain names do not contain standard keywords (`gitlab`, `github`, `gitea`, `bitbucket`).
- **SSH vs HTTPS URL Formats**: Parser must cleanly extract repository owner and project path from both SSH (`git@host:owner/repo.git` / `ssh://git@host:port/owner/repo.git`) and HTTPS (`https://host/owner/repo.git`) formats.
- **Offline / Tokenless Operation**: When no API token or CLI is available, the system must never crash; it must push the branch to remote and export the compiled PR/MR markdown body to disk with a direct web URL link.
- **Rate Limiting & Network Retries**: Host API calls must handle transient HTTP 429/503 responses gracefully with informative error messages.

---

## Requirements *(mandatory)*

### Functional Requirements

- **`FR-001`**: The system MUST implement a pluggable `HostAdapter` interface supporting `detect`, `createPullRequest`, `checkStatus`, and `getWebUrl` operations.
- **`FR-002`**: The system MUST provide native adapters for: `GitHub`, `GitLab`, `Gitea`/`Forgejo`, `Bitbucket`, and `Generic Git Remote`.
- **`FR-003`**: The system MUST automatically detect the host adapter type by parsing remote URLs configured in git.
- **`FR-004`**: The system MUST support explicit host overrides via configuration (`.mannostree.yml`) and CLI options (`--host <type>`).
- **`FR-005`**: The GitLab adapter MUST support creating Merge Requests via GitLab REST API v4 and `glab` CLI fallback, supporting draft mode and Markdown descriptions.
- **`FR-006`**: The Gitea/Forgejo adapter MUST support creating Pull Requests via Gitea REST API v1 and `tea` CLI fallback.
- **`FR-007`**: The Bitbucket adapter MUST support creating Pull Requests via Bitbucket Cloud and Server REST APIs.
- **`FR-008`**: The system MUST resolve authentication credentials from standard environment variables (`GITHUB_TOKEN`, `GH_TOKEN`, `GITLAB_TOKEN`, `GL_TOKEN`, `GITEA_TOKEN`, `BITBUCKET_TOKEN`, `BITBUCKET_APP_PASSWORD`) or custom environment variable names configured in `.mannostree.yml`.
- **`FR-009`**: `mannostree parallel publish` and `mannostree pr` MUST use the detected or configured host adapter to push branches and open PRs/MRs.
- **`FR-010`**: `mannostree fleet publish` MUST batch-publish PRs/MRs using the appropriate host adapter for each workspace repository.
- **`FR-011`**: `mannostree doctor` MUST audit host adapter configuration, credential presence, and CLI binary availability, reporting actionable diagnostic findings.
- **`FR-012`**: All multi-host publishing results MUST be recorded in metadata with `host_type`, `pr_url`, `pr_number` (or `mr_iid`), `pushed`, and `published_at` fields.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **`SC-001`**: 100% of standard remote URLs (GitHub, GitLab, Gitea, Bitbucket) are accurately auto-detected without requiring manual host configuration.
- **`SC-002`**: Single-command publishing (`parallel publish`, `pr`, `fleet publish`) works natively across GitLab, Gitea, and Bitbucket with zero platform-specific boilerplate.
- **`SC-003`**: Zero unhandled exceptions when working offline or without host API tokens (graceful degradation to branch push + exported PR body).
- **`SC-004`**: Host diagnostic checks complete in under 500ms during `mannostree doctor`.

---

## Key Entities & Data Model

### 1. `HostAdapterType` & `RemoteHostInfo`
```typescript
export type HostAdapterType = 'github' | 'gitlab' | 'gitea' | 'bitbucket' | 'generic';

export interface RemoteHostInfo {
  host_type: HostAdapterType;
  hostname: string;
  owner: string;
  repo: string;
  remote_name: string;
  remote_url: string;
  is_custom_domain: boolean;
}
```

### 2. `HostPublishOptions` & `HostPublishResult`
```typescript
export interface HostPublishOptions {
  title: string;
  body: string;
  source_branch: string;
  target_base: string;
  draft?: boolean;
  push?: boolean;
  host_override?: HostAdapterType;
}

export interface HostPublishResult {
  host_type: HostAdapterType;
  mode: 'published' | 'prepare-only' | 'pushed-only';
  pr_number?: number | null;
  pr_url?: string | null;
  web_url?: string | null;
  instructions?: string;
}
```

### 3. `HostConfig` in `.mannostree.yml`
```yaml
publish:
  default_remote: origin
  default_host: auto
  hosts:
    gitlab:
      base_url: https://gitlab.internal.corp/api/v4
      token_env: GITLAB_TOKEN
    gitea:
      base_url: https://gitea.local/api/v1
      token_env: GITEA_TOKEN
    bitbucket:
      workspace: myteam
      token_env: BITBUCKET_TOKEN
```

---

## Assumptions & Dependencies

- **API Token Security**: Sensitive API tokens are read exclusively from environment variables or secure credential helpers and are NEVER written to metadata or log files.
- **Network Resilience**: Network operations have configurable timeouts (default 10s) and do not block CLI execution indefinitely.
- **CLI vs API Priority**: If a native platform CLI (`gh`, `glab`, `tea`) is available and authenticated in PATH, the adapter may delegate to it; otherwise, the adapter uses lightweight direct REST API HTTP calls.
