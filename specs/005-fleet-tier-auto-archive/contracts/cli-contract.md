# CLI Contract: Fleet Tiering, Workspace Leases & Auto-Archive Policy

**Feature**: `005-fleet-tier-auto-archive` (Movement 4)  
**Date**: 2026-09-01  
**Status**: Ready for Planning

---

## 1. Command Specification

### 1.1 `mannostree fleet lease acquire <worktree_id>`
Acquire an exclusive concurrency lease on a workspace.

```text
Usage: mannostree fleet lease acquire <worktree_id> [options]

Arguments:
  worktree_id              Target worktree identifier (e.g. feature-auth-v1)

Options:
  --holder <name>          Name or identifier of agent/developer claiming lease (default: current user/agent)
  --ttl <duration>         Lease duration (e.g. "30m", "2h", "1d", "3600s", default: "60m")
  --purpose <description>  Declared intention/task (default: "Development lease")
  --json                   Output structured JSON envelope
  --yaml                   Output YAML format
  -h, --help               Display help
```

#### JSON Output:
```json
{
  "ok": true,
  "command": "fleet lease acquire",
  "result": {
    "lease_id": "lease-feat-1-1725184000",
    "worktree_id": "feature-feat-1",
    "holder": "agent-worker-01",
    "purpose": "Run unit test matrix",
    "acquired_at": "2026-09-01T12:00:00.000Z",
    "expires_at": "2026-09-01T13:00:00.000Z",
    "ttl_seconds": 3600,
    "status": "active"
  },
  "errors": [],
  "warnings": []
}
```

---

### 1.2 `mannostree fleet lease release <worktree_id>`
Release an active lease lock on a workspace.

```text
Usage: mannostree fleet lease release <worktree_id> [options]

Arguments:
  worktree_id              Target worktree identifier

Options:
  --force                  Force release lease even if held by a different holder or unexpired
  --json                   Output structured JSON envelope
  --yaml                   Output YAML format
  -h, --help               Display help
```

---

### 1.3 `mannostree fleet lease renew <worktree_id>`
Extend the TTL duration of an active lease.

```text
Usage: mannostree fleet lease renew <worktree_id> [options]

Options:
  --ttl <duration>         Extension duration (e.g. "30m", "1h", default: "60m")
  --json                   Output structured JSON envelope
```

---

### 1.4 `mannostree fleet lease list`
List all active and expired workspace leases across the fleet.

```text
Usage: mannostree fleet lease list [options]

Options:
  --active                 Show only active unexpired leases
  --json                   Output structured JSON envelope
  --yaml                   Output YAML format
```

---

### 1.5 `mannostree fleet tier set <worktree_id> <tier>` & `tier pin/unpin`
Explicitly set or inspect workspace lifecycle tiers.

```text
Usage: mannostree fleet tier set <worktree_id> <tier>
       mannostree fleet tier pin <worktree_id>
       mannostree fleet tier unpin <worktree_id>
       mannostree fleet tier list [options]

Arguments:
  worktree_id              Target worktree identifier
  tier                     Target tier: hot | warm | cold | pinned
```

---

### 1.6 `mannostree fleet auto-archive`
Evaluate retention policies and auto-archive eligible warm/idle worktrees.

```text
Usage: mannostree fleet auto-archive [options]

Options:
  --preview                Preview candidate worktrees and policy decisions without modifying disk
  --yes                    Confirm execution without interactive prompt
  --force                  Bypass non-critical operational blockers
  --json                   Output structured JSON report
  --yaml                   Output YAML format
  -h, --help               Display help
```

#### JSON Output:
```json
{
  "ok": true,
  "command": "fleet auto-archive",
  "dry_run": false,
  "result": {
    "timestamp": "2026-09-01T12:30:00.000Z",
    "total_evaluated": 6,
    "archived_count": 2,
    "skipped_count": 4,
    "archived_worktrees": [
      { "id": "feature-exp-v1", "branch": "experiment/exp-v1", "reason": "Idle for 72 hours (exceeds 48h limit)" },
      { "id": "feature-exp-v2", "branch": "experiment/exp-v2", "reason": "Exceeds max active quota (limit: 4)" }
    ],
    "skipped_worktrees": [
      { "id": "feature-pinned-wt", "reason": "Worktree is pinned" },
      { "id": "feature-leased-wt", "reason": "Active lease held by agent-01" },
      { "id": "feature-dirty-wt", "reason": "Uncommitted changes (policy: refuse)" }
    ]
  },
  "errors": [],
  "warnings": []
}
```

---

### 1.7 `mannostree fleet status`
Comprehensive fleet capacity and resource dashboard.

```text
Usage: mannostree fleet status [options]

Options:
  --json                   Output structured JSON dashboard
  --yaml                   Output YAML format
  -h, --help               Display help
```

#### CLI Terminal Formatted Output:
```text
┌─────────────────────────────────────────────────────────────┐
│                   Mannostree Fleet Status                   │
├─────────────────────────────────────────────────────────────┤
│ Capacity: 4 / 8 Active Worktrees (50% quota utilized)      │
│ Total Managed Branches: 12 (4 Active, 8 Cold Archived)      │
│ Estimated Disk Footprint: 320 MB                            │
├─────────────────────────────────────────────────────────────┤
│ Lifecycle Tier Distribution:                                │
│   🔥 Hot (Active / Leased): 2                               │
│   🌤️ Warm (Mounted Idle):   1                               │
│   🧊 Cold (Archived Ref):   8                               │
│   📌 Pinned:                1                               │
├─────────────────────────────────────────────────────────────┤
│ Active Leases (2):                                          │
│   • feature-auth (Holder: agent-01, Expires in: 42m)        │
│   • feature-search (Holder: human-alice, Expires in: 1h 15m)│
└─────────────────────────────────────────────────────────────┘
```
