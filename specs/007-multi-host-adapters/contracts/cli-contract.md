# CLI Contract: Movement 7 — Multi-Host Adapters

## 1. CLI Commands & Options

### `mannostree pr <worktree_id>`
Publish PR/MR for a single worktree.
```bash
mannostree pr <worktree_id> [options]

Options:
  --push                  Push branch to remote origin
  --draft / --no-draft    Set PR/MR draft state (default: from config)
  --host <type>           Override auto-detected host (github, gitlab, gitea, bitbucket, generic)
  --remote <name>         Override git remote name (default: origin)
  --target-base <branch>  Target base branch for PR/MR
  --title <title>         Custom title for PR/MR
  --preview               Preview compiled body without network mutations
  --export-pr <path>      Export compiled PR markdown to file
```

### `mannostree parallel publish <feature>`
Publish winning variant with multi-host support.
```bash
mannostree parallel publish <feature> [options]

Options:
  --push                  Push branch to remote origin
  --draft / --no-draft    Set PR/MR draft state
  --host <type>           Override auto-detected host
  --remote <name>         Override git remote name
  --target-base <branch>  Target base branch
  --title <title>         Custom PR title
  --preview               Preview compiled PR body
  --export-pr <path>      Export compiled PR markdown to file
  --force                 Bypass failing quality gates
```

### `mannostree fleet publish`
Batch publish across multiple fleet worktrees.
```bash
mannostree fleet publish [options]

Options:
  --all                   Publish all eligible ready worktrees
  --selected <ids...>     Publish specific worktree IDs
  --host <type>           Override host adapter
  --push                  Push branches to remote
  --draft / --no-draft    Set PR/MR draft state
  --preview               Preview batch actions
  --force                 Force publish dirty worktrees
```

### `mannostree doctor`
Audits host adapter health and credentials.
```bash
mannostree doctor [options]

Options:
  --fix                   Apply automatic repair plan
  --yes                   Confirm repair execution
```

---

## 2. Structured JSON Output Envelopes

### `mannostree pr <id> --json`
```json
{
  "command": "pr",
  "ok": true,
  "dry_run": false,
  "result": {
    "id": "feature-auth",
    "mode": "published",
    "host_type": "gitlab",
    "title": "feat(auth): implement oauth2 token flow",
    "pr_number": 42,
    "pr_url": "https://gitlab.com/org/repo/-/merge_requests/42",
    "body_file": ".task/pr-body.md"
  },
  "warnings": [],
  "errors": []
}
```

### `mannostree doctor --json`
```json
{
  "command": "doctor",
  "ok": true,
  "result": {
    "healthy": true,
    "host_adapters": [
      {
        "host_type": "github",
        "available": true,
        "cli_found": true,
        "cli_name": "gh",
        "token_configured": true,
        "message": "GitHub CLI authenticated and active"
      },
      {
        "host_type": "gitlab",
        "available": true,
        "cli_found": false,
        "token_configured": true,
        "token_env_var": "GITLAB_TOKEN",
        "message": "GitLab REST API ready (token configured)"
      }
    ]
  }
}
```
