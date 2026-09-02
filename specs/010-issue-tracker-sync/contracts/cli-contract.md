# CLI Interface Contract: Movement 10 — Issue Tracker Bi-directional Sync

**Feature Branch**: `010-issue-tracker-sync`  
**Date**: 2026-09-02T11:55:25+02:00  
**Status**: COMPLETE  

---

## 1. CLI Commands & Signatures

### 1. `mannostree spawn <name> --issue <KEY>`
Spawns a new worktree and automatically binds and ingests the issue ticket.

```bash
mannostree spawn feature-auth --issue PROJ-101 --base main
```

#### Options:
- `--issue <key>`: Ingest remote issue ticket (`PROJ-101`, `ENG-88`, `#42`)
- `--provider <name>`: Explicit issue tracker provider (`jira`, `linear`, `github`, `generic`)
- `--no-transition`: Do not auto-transition issue status to "In Progress" on spawn
- `--dry-run`: Preview worktree creation and issue contract generation without modifying disk, git, or remote tracker

---

### 2. `mannostree issue ingest <KEY>`
Ingests a remote issue ticket into the active or specified worktree.

```bash
mannostree issue ingest PROJ-101 [--worktree <id>] [--provider <p>] [--dry-run]
```

#### JSON Output:
```json
{
  "ok": true,
  "result": {
    "key": "PROJ-101",
    "provider": "jira",
    "title": "Implement OAuth2 Refresh Token Rotation",
    "status": "In Progress",
    "assignee": "Jane Doe",
    "url": "https://myorg.atlassian.net/browse/PROJ-101",
    "contract_file": ".task/task-contract.md"
  },
  "warnings": [],
  "dry_run": false
}
```

---

### 3. `mannostree issue transition <KEY> <status>`
Explicitly transitions a remote issue ticket to a target workflow status.

```bash
mannostree issue transition PROJ-101 "In Review" [--provider <p>] [--dry-run]
```

#### Options:
- `<KEY>`: Issue identifier
- `<status>`: Target state name (e.g. `In Progress`, `In Review`, `Done`, `Cancelled`)
- `--dry-run`: Verify transition mapping without applying transition remotely

---

### 4. `mannostree issue comment <KEY> <message>`
Posts a markdown comment to the remote issue ticket.

```bash
mannostree issue comment PROJ-101 "Completed verification test run with 100% pass rate."
```

#### Options:
- `<KEY>`: Issue identifier
- `<message>`: Comment text or markdown body
- `--body-file <path>`: Read comment text from markdown file
- `--dry-run`: Preview comment formatting without posting

---

### 5. `mannostree issue sync [<KEY>]`
Synchronizes local verification evidence, quality gates, and PR links to the linked issue ticket.

```bash
mannostree issue sync [PROJ-101] [--evidence] [--comment] [--dry-run]
```

#### Options:
- `--evidence`: Attach quality gate and benchmark receipts from `.task/RESULTS.md`
- `--comment`: Post comprehensive sync summary comment
- `--dry-run`: Preview evidence payload without posting

---

### 6. `mannostree issue status`
Displays a dashboard of active worktrees, linked issues, local states, and remote tracker states.

```bash
mannostree issue status [--json]
```

#### Human Output:
```text
🎫 Mannostree Issue Tracker Status Dashboard
------------------------------------------------------------------------------------------------------
Worktree ID     Branch         Issue Key   Provider  Local State     Remote Status   Drift
------------------------------------------------------------------------------------------------------
feature-auth    feature/auth   PROJ-101    Jira      WORKTREE_READY  In Progress     Clean
fix-billing     fix/billing    ENG-442     Linear    PR_OPEN         In Review       Clean
api-refactor    refactor/api   #89         GitHub    IMPLEMENTED     Closed          DRIFT DETECTED
------------------------------------------------------------------------------------------------------
```

---

### 7. `mannostree issue list`
Lists assigned or open issues from configured issue tracker.

```bash
mannostree issue list [--provider <p>] [--assigned-to me] [--status open]
```

---

## 2. Global Options & Flags

All `mannostree issue` commands respect global CLI options:
- `--json`: Format output as JSON
- `--yaml`: Format output as YAML
- `--plain`: Format output as plain text
- `--dry-run`: Simulate API calls and disk writes without mutating state
- `-v, --verbose`: Display detailed HTTP request/response payloads
- `-q, --quiet`: Suppress non-essential output
