# AGENTS.md

## Purpose
This repository builds **Mannostree**, a developer CLI for safe, explicit, git-worktree-based parallel development.

The tool manages:
- isolated worktree lifecycle
- explicit base-branch selection
- per-worktree metadata
- parallel variant experiments for the same feature
- comparison and winner selection
- optional agent-oriented task artifacts and publish flows

---

## What agents should optimize for
1. **Safety first** — no hidden branch selection, no silent deletion, no auto-merge.
2. **Explicit state** — every important lifecycle change must be reflected in metadata.
3. **Reproducibility** — commands, artifacts, and outputs should be deterministic and reviewable.
4. **Small blast radius** — prefer narrow, reversible changes over broad refactors unless the task requires otherwise.
5. **Artifact-first workflow** — durable files beat chat memory.

---

## Hard project rules
- **Mannostree owns branch/worktree lifecycle.** Worker agents must not invent or manage branch topology on their own.
- **Base branch must be explicit or deterministically resolved.** Never silently default to the current branch.
- **Parallel variants are first-class.** Variants for the same feature use distinct experiment branches and worktrees.
- **No automatic merge of any variant.** Selection and publish are separate steps.
- **Do not auto-delete losing variants.** Preserve them until the user explicitly cleans them up.
- **Do not assume the implementation stack.** Inspect the repository first; if the stack is not yet established, make the smallest reasonable scaffold change and document assumptions.
- **Keep docs and metadata aligned with behavior.** If code changes lifecycle semantics, update the relevant docs and schema definitions in the same change.

---

## Working model

### Core domain objects
Agents should think in terms of these first-class objects:
- **worktree record**
- **experiment record**
- **registry**
- **artifact pack**
- **publish state**

### Canonical concepts
- single workspace flow
- parallel variant flow
- explicit winner selection
- recoverable state
- dry-run support
- safe cleanup

---

## Expected repository areas
Until the final repo layout exists, treat this as the target structure:

```text
.
├── AGENTS.md
├── CLAUDE.md
├── README.md
├── docs/
├── src/                  # CLI/app code
├── tests/                # automated tests
├── .mannostree/          # metadata
├── .worktrees/           # spawned worktrees (runtime)
└── .task/                # per-worktree artifacts when applicable
```

If the real layout differs, follow the real layout and update this file when the difference becomes durable.

---

## Branch and naming policy

### Single-path branches
- `feature/<name>`
- `fix/<name>`
- `docs/<name>`
- `refactor/<name>`

### Parallel experiment branches
- `experiment/<feature>-v1`
- `experiment/<feature>-v2`
- `experiment/<feature>-vN`

### Worktree paths
- `.worktrees/<name>` for single-path work
- `.worktrees/<feature>-vN` for parallel variants

Do not introduce ad-hoc naming unless the task explicitly requires it.

---

## Command design expectations
Prefer commands that are:
- explicit
- composable
- script-friendly
- dry-run capable
- machine-readable when needed (`--json`, `--yaml`, or equivalent)

Core command families expected in this project:
- `spawn`
- `drop`
- `list`
- `info`
- `status`
- `sync`
- `setup`
- `env`
- `doctor`
- `pr`
- `issue`
- `parallel`
- `clean`
- `recover`
- `handoff`
- `task`

---

## Metadata expectations
Metadata is a product feature, not an implementation detail.

Expected persistent records:
- `.mannostree/registry.json`
- `.mannostree/worktrees/<id>.json`
- `.mannostree/experiments/<feature>.json`

When changing metadata behavior:
- preserve backward compatibility if practical
- version schema changes
- keep fields easy to inspect manually
- favor explicit timestamps and lifecycle states

---

## Validation expectations
Every change should validate the smallest relevant surface area.

Preferred order:
1. targeted unit validation
2. command-level validation for affected CLI behavior
3. integration validation for metadata/worktree behavior
4. docs/examples update if user-facing behavior changed

If the repo later defines exact commands, use those. Until then, do not invent heavyweight verification routines without evidence from the codebase.

---

## Done means
A task is done only when all of the following are true:
- the requested behavior is implemented
- affected commands or modules are validated appropriately
- metadata impacts are handled
- docs stay accurate
- no hidden destructive behavior was introduced
- output is reviewable and deterministic enough for follow-up work

---

## PR/change expectations
Changes should usually include:
- concise summary of what changed
- why the change was needed
- what was verified
- any schema or behavior changes that downstream commands/agents must know

For parallel workflow changes, clearly state:
- how variants are identified
- what comparison inputs are used
- how winner selection is stored
- whether cleanup semantics changed

---

## When to stop and ask
Pause and escalate if:
- the task would require changing core lifecycle semantics without a clear decision
- branch/base resolution becomes ambiguous
- cleanup behavior could delete user work unexpectedly
- a proposed change conflicts with the explicit product rules above

