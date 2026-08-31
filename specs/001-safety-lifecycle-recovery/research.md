# Research & Technical Decisions: Safety-First Lifecycle Recovery & Health Hardening

## Decision 1: Transaction Journal Architecture for Multi-File Metadata Transitions

### Context
Mannostree maintains multiple JSON metadata files (`registry.json`, `worktrees/<id>.json`, `experiments/<feature>.json`). Multi-step lifecycle commands (such as spawning N parallel variants, dropping experiments, or recording winner selection) modify several files in sequence. If a process is terminated mid-flight (SIGINT, crash, power loss), metadata can be left in an inconsistent state.

### Decision
Implement an append-only transaction journal stored at `.mannostree/journal/transactions.jsonl` (with active transactions tracked in `.mannostree/journal/active.json`).
- Before starting a multi-file mutation, an active transaction record is written containing `transaction_id`, `action`, `timestamp`, `state: "in_flight"`, and an array of atomic mutation intents (`target_file`, `action: "create" | "update" | "delete"`, `snapshot_content` or `rollback_payload`).
- On successful completion of all writes, the transaction status is updated to `"committed"` and moved/appended to the transaction log.
- If `doctor` or `recover` detects an `"in_flight"` transaction on startup, it reads the rollback payload and either safely rolls back incomplete writes or replays pending steps.

### Alternatives Considered
1. **In-place file locking only**: File locking prevents concurrent writes, but does not provide rollback capability if the process crashes midway through writing multiple files.
2. **SQLite database**: Introducing SQLite replaces simple human-readable JSON files, violating the architectural mandate that metadata records remain inspectable JSON text.
3. **Write-Ahead Logging with Snapshots (Chosen)**: Maintains pure JSON/JSONL format, low overhead, and full atomic rollback/replay capability.

---

## Decision 2: Experiment Health Diagnostics & Broken State Detection

### Context
Git worktrees and branches can be altered outside of Mannostree (e.g., manual `rm -rf`, `git branch -D`, directory renaming). When this happens, subsequent CLI operations fail with unhandled errors or cryptic messages.

### Decision
Extend the metadata schema and health verification engine:
- Add `health` field to `ExperimentRecord` and `WorktreeRecord` (`status: "healthy" | "degraded" | "broken"`).
- Define deterministic verification checks:
  1. `worktree_dir_exists`: Does the filesystem path exist?
  2. `git_worktree_registered`: Is the worktree recognized by `git worktree list`?
  3. `git_branch_exists`: Does `refs/heads/<branch>` exist?
  4. `metadata_record_valid`: Does the record match schema and registry pointers?
  5. `clean_git_status`: Are there untracked or uncommitted changes?
- When critical anomalies are detected (missing path, missing branch, missing registry reference), mark the record as `broken` and emit structured repair guidance (e.g., `mannostree recover --repair <id>`, `mannostree drop --force`).

### Alternatives Considered
1. **Silent automatic pruning (`git worktree prune`)**: Pruning automatically without user consent can destroy metadata association before the user realizes a directory was accidentally moved.
2. **Error and abort without state change**: Leaving the status as `created` or `running` causes repeated subsequent failures.
3. **Explicit `BROKEN` state with actionable recovery (Chosen)**: Preserves metadata for forensics, alerts the user clearly, and provides non-destructive remediation pathways.

---

## Decision 3: Strict Flag Hierarchy (`--force` vs `--discard-uncommitted --yes`)

### Context
Standard CLI tools often overload `--force` to mean both "ignore non-critical lockfiles" and "delete my uncommitted source code". This causes accidental data loss when users add `--force` to bypass a lock or warning.

### Decision
Enforce a strict two-tier flag hierarchy across all destructive or modifying commands (`drop`, `clean`, `archive`, `recover`):
- **`--force`**: Bypasses non-content operational blockers ONLY. Examples: ignoring stale lockfiles, bypassing detached HEAD warnings, skipping non-fatal network checks, or removing empty orphaned directories.
- **`--discard-uncommitted --yes`**: Required to drop or unmount any worktree that contains uncommitted or untracked changes. If `--discard-uncommitted` is omitted or `--yes` is absent, the command halts and protects the user's uncommitted work.

### Alternatives Considered
1. **Single `--force` flag**: High risk of accidental data loss.
2. **Interactive prompt only**: Fails in non-interactive CI/agent environments.
3. **Strict Flag Separation (Chosen)**: Unambiguous in automated scripts, safe in interactive shells, and prevents catastrophic data loss.

---

## Decision 4: Archive and Restore Lifecycle Architecture

### Context
Developers working on multiple parallel variants often want to free disk space or clean up their IDE project tree without permanently deleting branches, task artifacts, or comparison records.

### Decision
Add `archive` and `restore` lifecycle states and commands:
- **`mannostree archive <id|feature>`**:
  1. Verifies worktree is clean (or has `--discard-uncommitted --yes`).
  2. Records the head commit SHA, branch reference, configuration, and artifact locations in the metadata archive record.
  3. Unregisters and removes the physical worktree directory (`git worktree remove`).
  4. Keeps the Git branch in repository history.
  5. Updates worktree/experiment status to `archived`.
- **`mannostree restore <id|feature>`**:
  1. Verifies the target path is not occupied.
  2. Re-attaches git worktree via `git worktree add` using the preserved branch.
  3. Validates file structure and transitions status back to `planned` / `ready`.

### Alternatives Considered
1. **Git branch-only archiving**: Deleting metadata upon archive loses task scorecards, benchmark comparisons, and experiment relationships.
2. **Compressing worktrees to tarballs**: Heavyweight, duplicates git object storage, and is slow.
3. **Metadata-backed git worktree unmount/remount (Chosen)**: Fast, zero disk overhead, leverages git branch references, and preserves all experiment tracking.

---

## Decision 5: Parallel Drop Status & Partial Failure Retry Mechanics

### Context
Dropping an experiment with multiple variants may succeed on 2 variants but fail on 1 (e.g., dirty files). Deleting the experiment record abandons the surviving variant; failing completely without dropping clean variants wastes effort.

### Decision
Implement partial-failure resilience in `parallel drop`:
- Execute drops variant by variant, collecting structured outcomes (`status: "dropped" | "failed" | "preserved"`).
- If any variant fails (e.g. dirty files without `--discard-uncommitted`), retain the parent `ExperimentRecord` with updated `variants` array tracking only surviving worktrees.
- Provide `parallel drop-status <feature>` to inspect which variants survived and why.
- Support `parallel drop --retry <feature>` to resume cleanup seamlessly once the blocker is resolved.

---

## Decision 6: Packaged Parallel Handoff Architecture

### Context
After choosing a winning variant, the evidence justifying the decision (scorecards, benchmark logs, diffs) and the catalog of preserved non-winning variants should be cleanly packaged for team review or PR submission.

### Decision
Implement `parallel handoff` to compile a durable markdown and JSON handoff bundle:
- Written to `.task/parallel-handoff.md` and `.mannostree/experiments/<feature>-handoff.json`.
- Contains:
  - Experiment ID, base branch, timestamp.
  - Chosen winning variant and selection rationale.
  - Comparative scorecard across all variants (test passes, coverage, performance).
  - Preserved loser branch registry (branch names, commit SHAs, preserved worktree status).
  - Ready-to-use PR summary section.
