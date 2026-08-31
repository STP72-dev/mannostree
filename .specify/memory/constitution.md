# Project Constitution: Mannostree

## Principle 1: Safety First & Data Loss Prevention
- No silent deletion of user files, branches, or metadata.
- Destructive actions (discarding uncommitted code) strictly require `--discard-uncommitted --yes`.
- `--force` is restricted to non-content operational blockers (stale locks, broken reference links).
- Never auto-merge variants or auto-delete losing variants.
- Losing variants must remain preserved until the user issues an explicit cleanup command.

## Principle 2: Explicit Lifecycle & State Integrity
- All lifecycle state transitions must be durable, atomic, and recorded in metadata.
- Base branches must be explicitly or deterministically resolved; never silently default to current branch.
- Multi-step operations modifying multiple metadata files must use a durable transaction journal to support recovery from interrupted executions.
- Corrupted or desynchronized workspaces must be assigned explicit degraded/broken lifecycle states with actionable recovery guidance.

## Principle 3: Reproducibility & Observability
- All CLI commands must support deterministic output and machine-readable options (`--json`, `--yaml`).
- Destructive or complex actions must provide preview mode (`--dry-run`).
- Diagnostic and health checks must be non-destructive by default.

## Principle 4: Small Blast Radius & Backward Compatibility
- Prefer narrow, reversible changes over broad refactors.
- Metadata schemas must be versioned, self-documenting, and backward-compatible.
- Documentation, schemas, and CLI behavior must stay synchronized within the same change.
