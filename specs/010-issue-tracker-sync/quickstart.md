# Quickstart Guide: Movement 10 — Issue Tracker Bi-directional Sync

This guide demonstrates how to configure, ingest, synchronize, and transition issues across **Jira**, **Linear**, and **GitHub Issues** using Mannostree.

---

## 1. Prerequisites & Environment Variables

Configure API credentials in your environment:

```bash
# For Jira Cloud
export JIRA_HOST="https://myorg.atlassian.net"
export JIRA_EMAIL="developer@myorg.com"
export JIRA_API_TOKEN="your-jira-api-token"

# For Linear
export LINEAR_API_KEY="lin_api_your_key_here"

# For GitHub Issues
export GITHUB_TOKEN="ghp_your_github_token_here"
```

---

## 2. Configure `.mannostree.yml`

Add an `issues` configuration block to `.mannostree.yml`:

```yaml
version: 1

issues:
  default_provider: jira # jira | linear | github | generic
  auto_transition: true
  transitions:
    on_spawn: "In Progress"
    on_pr: "In Review"
    on_archive: "Done"
    on_drop: "Cancelled"
  jira:
    host: "https://myorg.atlassian.net"
    project_key: "PROJ"
  linear:
    team_key: "ENG"
  github:
    owner: "organcorp"
    repo: "lsol"
```

---

## 3. Standard Operator Workflows

### 1. Spawn a Worktree Directly from an Issue Ticket
```bash
# Ingests ticket details, populates .task/task-contract.md, and auto-transitions ticket to "In Progress"
mannostree spawn feature-auth --issue PROJ-101 --base main

# Or preview first with dry-run
mannostree spawn feature-auth --issue PROJ-101 --dry-run
```

### 2. Standalone Issue Ingestion
```bash
# Ingest an issue into an existing worktree
mannostree issue ingest ENG-88
```

### 3. Check Real-Time Issue Drift & Status Matrix
```bash
mannostree issue status
```

### 4. Post Verification Evidence to Issue Ticket
```bash
# Attach quality gates and benchmark evaluation receipts to ticket
mannostree issue sync PROJ-101 --comment --evidence
```

### 5. Transition Ticket Lifecycle State
```bash
# Explicitly move ticket status
mannostree issue transition PROJ-101 "In Review"
```

### 6. Diagnose Issue Tracker Health & Credentials
```bash
mannostree doctor
```
