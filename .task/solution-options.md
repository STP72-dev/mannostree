# Solution Options: GitHub CLI Adapter & Safe Binary Execution

## Option 1: Injected `GhAdapter` / `GhExecutor` with Native `execFile` Default (Recommended)

### Architecture & Module Boundaries
- Introduce `GhExecutor` interface in `src/core/publish.ts`:
  ```ts
  export type GhExecutor = (args: string[], cwd: string) => Promise<{ stdout: string; stderr: string }>;
  ```
- `PublishEngine` takes optional `ghExecutor` in constructor. Default uses `execFileAsync('gh', args, { cwd })`.
- `GitEngine` handles pure `git` commands; `PublishEngine` orchestrates git push + `gh` CLI invocation.

### State Transitions & Metadata Impact
- Accurately captures `pr_url` and `pr_number` into `record.publish` and updates `lifecycle_state: 'PR_OPEN'`.

### Dry-Run & Safety Invariants
- When `dryRun: true` or `push: false`, neither git push nor `gh pr create` is invoked.
- Full testability: Unit and integration tests can inject mock `GhExecutor` to verify argument serialization without network side-effects.

---

## Option 2: Global Process Monkey-Patching in Tests

### Architecture & Module Boundaries
- Hardcode `child_process.execFile` in `PublishEngine` and use Vitest `vi.spyOn` in test suites.

### State Transitions & Metadata Impact
- Brittle in concurrent test runs; couples tests to internal Node.js module loading mechanisms.

### Dry-Run & Safety Invariants
- High risk of leaking real process invocations across test boundaries.

---

## Option 3: Shell String Interpolation via `child_process.exec`

### Architecture & Module Boundaries
- Formats shell string `gh pr create --head "${branch}" ...` and executes via shell interpreter.

### State Transitions & Metadata Impact
- Vulnerable to shell injection if branch or title contains unescaped special characters.

### Dry-Run & Safety Invariants
- Disqualified by security risks.
