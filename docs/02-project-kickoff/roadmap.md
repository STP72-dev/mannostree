# Roadmap

## MVP (Phase 1–2)

**Goal.** Make single-path worktree workflows safe, traceable, and recoverable. Lay the metadata foundation.

Includes:

- `.mannostree.yml` loader with profile + base resolution.
- Metadata engine: `registry.json`, per-worktree records, atomic writes, schema versioning.
- Git engine: base resolution, branch create, `git worktree add/remove`, status, sync.
- CLI commands: `spawn`, `drop`, `list`, `info`, `status`, `sync`, `doctor`, `recover`, `clean` (dry-run defaults).
- Setup engine with `default` and one language profile (e.g., `node`).
- Env policy: `skip` (default), `copy`, `link`, `generate`.
- Artifact scaffolding: `.task/` + `RESULTS.md`.
- Output: human + `--json`.

**Out of scope for MVP.** Parallel, agents, GitHub, host adapters.

## V2 (Phase 3–4)

**Goal.** Parallel variants and project-aware setup.

- Parallel engine + experiment records.
- CLI: `parallel spawn`, `parallel list`, `parallel compare`, `parallel pick`, `parallel drop`.
- Standardized `RESULTS.md` validation; comparison report generation.
- Profile expansion: multiple language profiles, validation commands.
- `exec` command.
- Tags, filtering on `list`.

## V3 (Phase 5–6)

**Goal.** Publish flows and agent-oriented artifact contracts.

- Publish adapter abstraction.
- GitHub adapter: `pr create`, `pr view`, `pr checks`, `issue start`, `parallel pr create`.
- Full artifact contract: `solution-options.md`, `implementation-plan.md`, `quality-gates.md`, `review.md`, `comparison.md`, `pr-body.md`.
- `task init`, `handoff` derivative commands.
- Optional comparator/criteria templates.

## V4+ (later)

- Additional host adapters (GitLab, Gitea, Bitbucket).
- Pluggable agent runners for `parallel run`.
- Project-board integrations.
- Cross-repo experiments.
- Migration tooling for schema evolution.

## Day-1 implementation blueprint

### Build order
1. Config loader (`.mannostree.yml`) + validation.
2. Metadata engine (registry + worktree record), atomic writes.
3. Git engine (base resolution, create branch, add worktree, status).
4. CLI scaffolding with global flags + output renderer.
5. `spawn` + `info` end-to-end.
6. `list`, `status`, `drop` (with safety gates).
7. `doctor` and `recover` for trustability.
8. `setup` + `env` + profile loader.
9. `sync`, `clean`, `exec`.
10. Then start V2 (parallel).

### Module boundaries

```
src/
  cli/                  # arg parsing, output rendering
    commands/
      spawn.ts
      drop.ts
      list.ts
      info.ts
      status.ts
      sync.ts
      doctor.ts
      setup.ts
      env.ts
      exec.ts
      clean.ts
      recover.ts
      pr/
      issue/
      parallel/
  app/                  # orchestration / lifecycle rules
    spawn.ts
    drop.ts
    publish.ts
    parallel.ts
  metadata/             # registry, worktree records, experiments
    registry.ts
    worktree.ts
    experiment.ts
    schema/
  git/                  # all git/worktree operations
    base.ts
    branch.ts
    worktree.ts
    status.ts
    sync.ts
  setup/                # profile + env policy
    profile.ts
    env.ts
  parallel/             # experiment lifecycle, comparison
    spawn.ts
    compare.ts
    pick.ts
  artifact/             # .task scaffold + validation
    scaffold.ts
    validate.ts
    pr_body.ts
  diagnostics/          # doctor + recover
    doctor.ts
    recover.ts
  publish/              # host-neutral push + adapters
    push.ts
    adapters/
      github.ts
  config/               # .mannostree.yml loader
    load.ts
    schema.ts
  io/                   # atomic file writes, fs helpers
  log/                  # structured logging
```

### Minimum command set for a usable Day-1 product
`spawn`, `list`, `info`, `status`, `drop`, `doctor`. Everything else is layered on top.

### Minimum metadata for Day-1
- `registry.json`
- `worktrees/<id>.json` with the **required minimal fields** from `metadata-schema.md`.

### Recommended implementation choices (revisable)
- Language: TypeScript on Node, distributed via npm (good ecosystem fit, easy plugin model). Go is a viable alternative.
- CLI framework: `commander` or `clipanion` (TS) / `cobra` (Go).
- Config: YAML via `yaml` (TS) / `gopkg.in/yaml.v3` (Go); validate with JSON Schema.
- Tests: `vitest` (TS) / `go test` (Go).
- GitHub adapter: shell out to `gh` for MVP, native API later.
