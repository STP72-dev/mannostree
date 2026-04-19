# Worktree Lifecycle

## Lifecycle states (single-path)

| State | Owner | Required artifacts | Allowed next | Failure modes |
|-------|-------|--------------------|--------------|---------------|
| `NEW` | Task-Resolver | — | `TASK_RESOLVED`, `BROKEN` | task input invalid |
| `TASK_RESOLVED` | Task-Resolver | `.task/task-contract.md` | `WORKTREE_READY`, `BROKEN` | base branch unresolvable |
| `WORKTREE_READY` | Branch-Orchestrator | branch + worktree on disk | `CONTEXT_PACKED`, `BROKEN` | git failure, name collision |
| `CONTEXT_PACKED` | Setup engine | setup outcome recorded | `PLAN_READY`, `BROKEN` | install fail, env policy violation |
| `PLAN_READY` | Planner | `.task/implementation-plan.md` | `IMPLEMENTED`, `BROKEN` | plan missing required sections |
| `IMPLEMENTED` | Worker | `RESULTS.md` | `VERIFIED`, `BROKEN` | dirty fail, missing results |
| `VERIFIED` | Verifier | `.task/quality-gates.md` (passed) | `REVIEWED`, `IMPLEMENTED` | tests fail → back to worker |
| `REVIEWED` | Reviewer | `.task/review.md` | `PR_OPEN`, `IMPLEMENTED` | critical issues → back to worker |
| `PR_OPEN` | Publish adapter | `.task/pr-body.md`, publish record | `WAITING_USER_APPROVAL`, `BROKEN` | host failure |
| `WAITING_USER_APPROVAL` | User | — | `CLEANED`, `IMPLEMENTED` (post-review) | none |
| `CLEANED` | Mannostree (drop) | archived metadata | terminal | none |
| `BROKEN` | Diagnostics / user | doctor report | recovered state | unrecoverable → manual |

## Base-branch resolution

Order (first match wins):

1. `--base` / `-b` CLI flag.
2. Profile-level `base_branch` from `.mannostree.yml`.
3. Top-level `default_base_branch` from `.mannostree.yml`.
4. Repository-level default (`init.defaultBranch` or `HEAD` of origin).
5. Remote default (`origin/HEAD`).

**Hard rule.** The current checked-out branch is **never** used as a base unless the user explicitly passes `-b $(git branch --show-current)`. This prevents accidental experiment-on-experiment basing.

## Worktree placement

- Default root: `.worktrees/` at repo root (configurable via `.mannostree.yml: worktree_root`).
- Recommended in `.gitignore`.
- Each worktree path is `<worktree_root>/<id-tail>` where `<id-tail>` is the human part of the id (e.g., `retry-api-client-v2`).

## Setup and env handling

### Setup profile
- Defined in `.mannostree.yml: profiles.<name>`.
- Includes `install_commands`, `env_mode`, `validation_commands`.
- A worktree records which profile created it and whether install ran/succeeded.

### Env-file policy

| Mode | Behavior | Default? |
|------|----------|----------|
| `skip` | Do nothing. | yes |
| `copy` | Copy listed files from main worktree at spawn time. | no |
| `link` | Symlink listed files. | no |
| `generate` | Run `generate_command` from profile. | no |

`copy` and `link` require explicit opt-in in config or `--env`. There is no implicit `.env` propagation.

### Setup validation
- Profile may define `validation_commands` (e.g., `node --version`).
- Failures place the worktree in `BROKEN` with diagnostic notes.

## Cleanup behavior

| Trigger | Behavior |
|---------|----------|
| `drop <id>` | Refuses if dirty/unmerged unless `--force`. |
| `drop --archive` | Moves metadata to `.mannostree/archive/<id>.json`. |
| `clean --merged` | Lists merged worktrees; requires `--yes` to act. |
| `clean --stale-days N` | Lists worktrees with `last_activity_at` older than N days. |
| `parallel drop` | Per-variant policy; winner protected unless explicitly opted in. |
| post-PR | Worktree is **kept alive** through `WAITING_USER_APPROVAL`; cleanup only on explicit `drop`. |

## Recovery behavior

`mannostree doctor` enumerates:

- Registry entries with no on-disk worktree (proposes `recover --reattach-worktree`).
- On-disk worktrees not in registry (proposes `recover --rebuild-metadata`).
- Branches without worktrees (proposes `recover --reattach-branch` or branch deletion).
- Metadata schema-version drift (proposes migration).

`mannostree recover <id>` performs the proposed repair after explicit confirmation.

## Dry-run

Every state-mutating command supports `--dry-run`. Output includes:

- the resolved plan (base branch, branch name, worktree path, profile),
- which files would be written,
- which git operations would run.

No filesystem or git mutations occur in dry-run.
