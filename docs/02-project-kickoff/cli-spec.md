# CLI Specification

## Conventions

- Binary name: `mannostree` (alias suggestion: `mt`).
- Worktree identifier: a short, unique string derived from `<kind>-<name>` (e.g., `feature-retry-api-client`, `experiment-retry-api-client-v2`).
- Global flags (apply to all commands):

| Flag | Description |
|------|-------------|
| `--json` / `--yaml` / `--plain` | Structured output. Mutually exclusive. |
| `--verbose` / `-v` | Verbose human output. |
| `--quiet` / `-q` | Suppress non-essential output. |
| `--dry-run` | Plan without writing. Required-safe for state-changing commands. |
| `--config <file>` | Override `.mannostree.yml` location. |
| `--profile <name>` | Select named profile from config. |
| `--no-color` | Disable ANSI colors. |
| `--cwd <path>` | Run as if invoked from this directory. |

## Exit-code strategy

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Generic failure |
| 2 | User input / usage error |
| 3 | Validation failure (config, schema, state-transition rule) |
| 4 | Git operation failed |
| 5 | Setup / env policy failure |
| 6 | Metadata inconsistency (use `doctor`) |
| 7 | Publish / host-adapter failure |
| 8 | User-cancelled (e.g., refused destructive prompt) |
| 10 | Comparison incomplete (parallel) |
| 20 | Recoverable broken state detected |

## Command tree

```
mannostree
├── spawn
├── drop
├── list
├── info
├── status
├── sync
├── doctor
├── setup
├── env
├── exec
├── clean
├── recover
├── pr
│   ├── create
│   ├── view
│   └── checks
├── issue
│   └── start
└── parallel
    ├── spawn
    ├── run
    ├── list
    ├── compare
    ├── pick
    ├── pr
    │   └── create
    └── drop
```

---

## Core commands

### `spawn`

**Purpose.** Create a single isolated worktree from an explicit base branch.

**Syntax.**
```
mannostree spawn <name> [-b <base>] [--kind feature|fix|docs|refactor]
                       [--profile <name>] [--task-from <file|issue:#>]
                       [--no-setup] [--env <copy|link|skip|generate>]
                       [--dry-run]
```

**Behavior.**
1. Resolve base branch (CLI flag → profile → repo default → remote default).
2. Generate branch name (`<kind>/<name>`, default `feature/<name>`).
3. Reserve worktree id, create branch, add worktree under config-defined `worktree_root`.
4. Apply setup profile and env policy.
5. Scaffold `.task/` skeleton + `RESULTS.md`.
6. Persist worktree record (`lifecycle_state=CONTEXT_PACKED`, status=`created`).

**Defaults.** Kind=`feature`. Base=resolution order. Setup=on. Env=`skip`.

**Safety.** Refuses if name collides with an existing tracked worktree. `--dry-run` prints the full plan without touching disk.

**Outputs.** Human summary; `--json` returns the persisted worktree record.

**When to use.** Single-path development on a new branch.
**When not to use.** For multi-variant experimentation use `parallel spawn`.

**Host-neutral.** Yes.

---

### `drop`

**Purpose.** Safely remove a worktree and (optionally) its branch.

**Syntax.**
```
mannostree drop <id> [--keep-branch] [--force] [--archive] [--dry-run]
```

**Behavior.**
- Refuses if dirty / has untracked / branch unmerged unless `--force`.
- Removes worktree directory, branch (unless `--keep-branch`), and updates registry.
- With `--archive`, moves metadata to `.mannostree/archive/`.

**Safety.** Always requires confirmation unless `--yes` is set or run inside a non-interactive session with `--force`. Never removes the user's main working tree.

**Host-neutral.** Yes.

---

### `list`

**Purpose.** Enumerate tracked worktrees and experiments.

**Syntax.**
```
mannostree list [--state <state>] [--kind <kind>] [--experiment <name>]
                [--tag <tag>] [--json]
```

**Defaults.** Excludes archived. Sorts by `last_activity_at` desc.

**Outputs.** Table (id, kind, branch, base, state, last activity). `--json` returns array of records.

---

### `info`

**Purpose.** Show full worktree record for a single id.

**Syntax.** `mannostree info <id> [--json]`

**Outputs.** Pretty-printed metadata, with derived fields (path existence, branch existence, last quality-gate status).

---

### `status`

**Purpose.** Show live git + lifecycle status of a worktree (cheap; no fetch).

**Syntax.** `mannostree status <id> [--fetch] [--json]`

**Outputs.** ahead/behind, dirty/untracked, last commit, lifecycle state, validation status, review status.

---

### `sync`

**Purpose.** Update a worktree against its base branch.

**Syntax.**
```
mannostree sync <id> [--strategy rebase|merge|ff-only] [--fetch] [--dry-run]
```

**Defaults.** Strategy from config (default `rebase`). `--fetch` defaults to true.

**Safety.** Refuses if worktree is dirty. Aborts and restores on rebase/merge conflict; surfaces conflict files.

---

### `doctor`

**Purpose.** Diagnose tracked-vs-disk inconsistencies and repair candidates.

**Syntax.** `mannostree doctor [--json] [--fix]`

**Behavior.**
- For each registry entry: check disk path, branch existence, metadata schema.
- Detect untracked worktrees (under `worktree_root` but not in registry).
- Detect orphan branches with no worktree.
- With `--fix`, propose actions; never destructive without confirmation.

---

### `setup`

**Purpose.** Re-apply setup profile to an existing worktree.

**Syntax.**
```
mannostree setup <id> [--profile <name>] [--reinstall] [--dry-run]
```

---

### `env`

**Purpose.** Apply or re-apply env-file policy.

**Syntax.**
```
mannostree env <id> [--mode copy|link|skip|generate] [--from <path>] [--dry-run]
```

**Safety.** `copy` and `link` require explicit policy (config or flag) — never silent.

---

### `exec`

**Purpose.** Run a command inside a worktree's directory with the right environment.

**Syntax.**
```
mannostree exec <id> -- <command...>
```

**Behavior.** `cd` into worktree path, optionally inject profile env, exec command. Forwards exit code.

---

### `clean`

**Purpose.** Bulk cleanup of stale / merged / archived worktrees.

**Syntax.**
```
mannostree clean [--merged] [--stale-days <N>] [--state <state>]
                 [--dry-run] [--yes]
```

**Safety.** Defaults to `--dry-run` if no destructive flag is set. Always lists affected ids before acting.

---

### `recover`

**Purpose.** Reattach or repair a broken worktree.

**Syntax.**
```
mannostree recover <id> [--rebuild-metadata] [--reattach-worktree]
                        [--reattach-branch] [--dry-run]
```

---

### `pr create`

**Purpose.** Open a PR for a worktree's branch.

**Syntax.**
```
mannostree pr create <id> [--draft] [--title <t>] [--from-artifacts]
                          [--target <base>] [--push]
```

**Behavior.**
- Pushes branch (with `--push` or per config).
- Generates PR body from `.task/pr-body.md` (or composes from `RESULTS.md` + `review.md` + `quality-gates.md`).
- Records PR number/url in metadata.

**Host-specific.** Requires GitHub adapter (or future host adapter).

---

### `pr view`

**Purpose.** Show PR state for a worktree. Host-specific.

### `pr checks`

**Purpose.** Summarize CI checks. Host-specific.

---

### `issue start`

**Purpose.** Bootstrap a worktree from an issue.

**Syntax.**
```
mannostree issue start <issue-ref> [-b <base>] [--parallel <N>]
                                   [--profile <name>]
```

**Behavior.** Resolves issue title/body via host adapter, generates `task-contract.md`, then delegates to `spawn` or `parallel spawn`.

**Host-specific.** Yes (GitHub MVP).

---

## Parallel commands

### `parallel spawn`

**Purpose.** Create N isolated worktrees for the same feature.

**Syntax.**
```
mannostree parallel spawn <feature> <N> [-b <base>] [--plan <file>]
                                        [--profile <name>] [--dry-run]
```

**Behavior.**
1. Create experiment record `<feature>.json`.
2. Create N branches `experiment/<feature>-v1..vN` from base.
3. Create N worktrees under `worktree_root`.
4. Copy shared `--plan` file into each `.task/implementation-plan.md` (or leave for Planner to fill).
5. Persist variant records.

**Safety.** `N` capped by `parallel.max_variants` config (default 5).

---

### `parallel run`

**Purpose.** Same as `parallel spawn` plus invoke per-variant execution (e.g., agent worker) inline.

**Syntax.**
```
mannostree parallel run <feature> <N> [-b <base>] --plan <file>
                                       [--worker <cmd>] [--parallelism <K>]
```

**Behavior.** Spawns worktrees, then runs `--worker` (configurable) inside each. The worker is treated as a black-box subprocess that must produce `RESULTS.md`. Mannostree does not interpret worker behavior.

**When not to use.** If you intend humans (or interactive agents) to do the work, use `parallel spawn` and let workers attach manually.

---

### `parallel list`

**Purpose.** List variants of an experiment with cached summary fields.

```
mannostree parallel list <feature> [--json]
```

---

### `parallel compare`

**Purpose.** Produce a side-by-side comparison of variants.

```
mannostree parallel compare <feature> [--criteria <file>] [--json]
```

**Behavior.** Reads each variant's `RESULTS.md`, `quality-gates.md`, `review.md`, and metadata `summary` block; produces `.mannostree/experiments/<feature>/comparison.md` (or per-worktree copies).

---

### `parallel pick`

**Purpose.** Mark a winner. **Does not merge or push.**

```
mannostree parallel pick <feature> <variant-id> [--reason <text>]
```

**Behavior.** Updates experiment record (`winner.selected=true`) and variant record (`parallel.winner=true`). Refuses if comparison has not been completed unless `--force`.

---

### `parallel pr create`

**Purpose.** Open a PR for the winning variant only.

```
mannostree parallel pr create <feature> [--draft] [--from-artifacts]
```

---

### `parallel drop`

**Purpose.** Drop variants of an experiment.

```
mannostree parallel drop <feature> [--keep-winner] [--keep <id>...]
                                   [--archive] [--dry-run]
```

**Default.** Without `--keep-winner`, requires explicit `--yes` to drop the winner along with losers.

---

## Output contract

Every command that mutates state must, in `--json` mode, emit:

```json
{
  "command": "spawn",
  "ok": true,
  "dry_run": false,
  "result": { "...": "..." },
  "warnings": [],
  "errors": []
}
```

This contract makes Mannostree scriptable and CI-friendly.
