# Open Questions and Risks

## Open design questions

| # | Question | Why it matters | Recommendation |
|---|----------|----------------|----------------|
| 1 | Implementation language: TypeScript/Node vs Go? | Affects distribution, ecosystem, plugin model. | Default to TypeScript/Node for ecosystem; revisit if perf requires. |
| 2 | One-process vs file-locked multi-process metadata? | Multiple agents may write concurrently. | Use file locks per record + atomic rename; document concurrency limits. |
| 3 | How strict should artifact validation be? | Too strict blocks adoption; too loose breaks comparison. | Validate **section presence** only in MVP; add stricter linting later. |
| 4 | Should `.task/` be committed or ignored by git? | Committed = traceable; ignored = avoids review noise. | Default ignored; add config flag to commit subset. |
| 5 | How to support monorepos with multiple `.mannostree.yml` scopes? | Common in large teams. | Defer to V2; design config loader to allow nested overrides. |
| 6 | Should comparison criteria be code or markdown? | Code = scriptable; markdown = readable. | Markdown rubric in MVP, optional JS/TS criteria function later. |
| 7 | How are profiles selected — explicit only or inferred? | Inference is convenient but surprising. | Explicit only by default; add opt-in inference. |
| 8 | Do we need a daemon for live `status`? | Cheap status is nice; daemon is a big commitment. | No daemon. `status` is on-demand. |
| 9 | How is GitHub auth handled? | OAuth vs `gh` CLI vs PAT. | Delegate to `gh` in MVP; pluggable later. |
| 10 | Should `parallel run` ship with a default worker? | Convenience vs avoiding vendor lock-in. | Ship `parallel spawn` only in MVP; `parallel run` in V2 with `--worker` required. |

## Technical risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Worktree corruption from external `git` use | Mannostree state diverges. | Strong `doctor` checks; surface unknown worktrees. |
| Concurrent metadata writes | Lost updates. | Per-record file locks + write-temp+rename. |
| Schema evolution breaks old workspaces | Users locked out. | Versioned schemas + `recover --migrate`. |
| Long-lived worktrees rot (uninstalled deps, stale env) | False sense of readiness. | `doctor` flags stale `last_activity_at`; `setup --reinstall`. |
| Disk usage explosion from many parallel variants | User pain. | `parallel.max_variants` cap; `clean --stale-days`. |
| Large repos slow to add worktree | Spawn UX suffers. | Document expectation; consider `--shallow` later. |
| Vendor coupling via agent runners | Locks users in. | Worker is a generic subprocess; artifacts are vendor-neutral. |

## Workflow / adoption risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Coexisting legacy worktree scripts | Two sources of truth, drift, dangerous cleanup. | ADR-001: Mannostree is sole lifecycle owner; ship migration guide. |
| Developers expect auto-merge | Frustration; or worse, requested footguns. | Document non-goal explicitly; PR body always shows artifact links. |
| Reviewers ignore `.task/` artifacts | Loss of value. | PR body links artifacts inline. |
| Parallel variants over-used | Cognitive load, disk waste. | Doc guidance: parallel for high-uncertainty tasks only. |
| Env policy misconfiguration leaks secrets | Severe. | Default `skip`; warn on `copy`/`link` of files matching `*.env*`. |
| GitHub-only mental model | Users assume PR = merge. | Docs explicitly separate publish from merge; `pr` commands never merge. |

## Recommended next decisions

1. **Pick implementation language** (and freeze for MVP).
2. **Confirm `.mannostree.yml` schema v1** and write JSON Schema.
3. **Decide GitHub adapter shape** for MVP (`gh` CLI vs native API).
4. **Write ADR-009** on whether `.task/` is committed by default.
5. **Define migration plan** for any existing legacy worktree scripts in pilot repos.
