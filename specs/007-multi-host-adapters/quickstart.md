# Quickstart: Movement 7 — Multi-Host Adapters

This quickstart guides developers and release managers on configuring and publishing Pull/Merge Requests across GitLab, Gitea, Bitbucket, and GitHub.

---

## 1. Remote Host Auto-Detection

Mannostree automatically detects the host adapter from your git remote configuration:

```bash
# Check current remote URL
git remote get-url origin
# e.g. git@gitlab.com:my-team/auth-service.git

# Preview PR creation — automatically routes to GitLab Merge Request format
mannostree pr feature-oauth --preview
```

---

## 2. GitLab Merge Request Publishing

### Using GitLab Personal Access Token (`GITLAB_TOKEN`)
```bash
export GITLAB_TOKEN="glpat-xxxxxxxxxxxxxxxxxxxx"

# Publish feature worktree to GitLab Merge Request
mannostree pr feature-oauth --push --draft
```

### Publishing a Parallel Experiment Winner to GitLab
```bash
# Pick winner variant and publish directly to GitLab
mannostree parallel pick auth-eval --winner v2 --reason "Fastest JWT verification"
mannostree parallel publish auth-eval --push --draft
```

---

## 3. Gitea & Bitbucket Publishing

### Gitea / Forgejo
```bash
export GITEA_TOKEN="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

# Publish to Gitea
mannostree pr feature-cache --push --host gitea
```

### Atlassian Bitbucket
```bash
export BITBUCKET_TOKEN="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

# Publish to Bitbucket
mannostree pr feature-api --push --host bitbucket
```

---

## 4. Multi-Host Configuration in `.mannostree.yml`

Configure custom self-hosted domains and token environment variables:

```yaml
publish:
  default_remote: origin
  default_host: auto
  hosts:
    gitlab:
      base_url: https://gitlab.internal.corp/api/v4
      token_env: GITLAB_ENTERPRISE_TOKEN
    gitea:
      base_url: https://gitea.local:3000/api/v1
      token_env: GITEA_TOKEN
    bitbucket:
      workspace: my-enterprise-workspace
      token_env: BITBUCKET_TOKEN
```

---

## 5. Host Health Diagnostics

Audit your configured host adapters and credentials:

```bash
mannostree doctor
```
Output will list each adapter's readiness, CLI availability, and token configuration.
