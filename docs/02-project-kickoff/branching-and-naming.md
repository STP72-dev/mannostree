# Branching and Naming

## Identifier model

- **Worktree id** is the canonical key. Format: `<kind>-<name>` for single-path; `experiment-<feature>-v<i>` for variants.
- **Branch name** is derived from id: single-path `<kind>/<name>`; experiment `experiment/<feature>-v<i>`.
- **Worktree directory** is `<worktree_root>/<id-tail>` where `<id-tail>` strips the leading `<kind>-` prefix for readability (`feature-retry` → `.worktrees/retry`; `experiment-retry-v1` → `.worktrees/retry-v1`).

## Single-path branches

| Kind | Branch pattern | Worktree id |
|------|---------------|-------------|
| feature | `feature/<name>` | `feature-<name>` |
| fix | `fix/<name>` | `fix-<name>` |
| docs | `docs/<name>` | `docs-<name>` |
| refactor | `refactor/<name>` | `refactor-<name>` |

## Experiment branches

- Pattern: `experiment/<feature>-v<i>`
- `<i>` is a contiguous integer assigned at experiment creation.
- All variants share the same base branch and (by default) the same profile.

## Naming rules

- `<name>` and `<feature>` must match `^[a-z0-9][a-z0-9-]{1,63}$`.
- No uppercase, no underscores (use hyphens), no leading/trailing hyphen.
- Reserved prefixes (`mannostree-`, `wt-`) are forbidden.
- Mannostree validates names at spawn time and rejects collisions with existing branches/worktrees.

## Collision handling

| Situation | Behavior |
|-----------|----------|
| Branch exists locally, no worktree | Refuse; suggest `recover --reattach-worktree` or pick a new name. |
| Worktree directory exists, not in registry | Refuse; suggest `recover --rebuild-metadata`. |
| Both exist and tracked | Refuse; suggest `info <id>`. |
| Variant index already taken | Auto-pick next free index unless `--strict-index` is set. |

## Why branch lifecycle belongs to a dedicated layer

If workers (human or AI) create branches:

- naming drifts (`feat-x`, `feature-x`, `feature/x`, `lp/x`),
- base branch is implicit (often the current branch),
- cleanup is unsafe (no metadata link from branch to context),
- recovery is impossible (no record of what was attempted).

Centralizing branch lifecycle in the Branch-Orchestrator (driven by Mannostree) gives:

- deterministic naming,
- explicit base resolution,
- traceable metadata,
- safe cleanup and reliable recovery.

This is the single rule that makes everything else in Mannostree work.
