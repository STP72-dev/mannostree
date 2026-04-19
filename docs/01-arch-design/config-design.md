## `.mannostree.yml` — proposed config design

This file should define the **default workspace behavior**, **naming rules**, **setup policy**, **parallel experiment behavior**, and **publish/review conventions** for a repo.

---

## Design goals

The config should be:

* **explicit**
* **safe by default**
* **repo-local**
* **automation-friendly**
* **easy for agents to read**
* **able to support both single-path and parallel-variant workflows**

---

## Example config

```yaml
version: 1

repo:
  default_base_branch: main
  allow_current_branch_as_base: false
  worktree_root: .worktrees
  metadata_root: .mannostree
  artifact_dir_name: .task

branching:
  single_prefix_map:
    feature: feature
    fix: fix
    docs: docs
    refactor: refactor
    experiment: experiment

  parallel_branch_template: "experiment/{feature}-v{n}"
  single_branch_template: "{type}/{name}"

  validate_branch_names: true
  forbid_reusing_existing_branch_names: true

spawn:
  copy_env_by_default: false
  install_by_default: false
  auto_push_by_default: false
  auto_pr_by_default: false
  auto_task_init: true
  require_explicit_base_branch: false

setup:
  mode: agents_md
  fallback_strategy: manual
  allow_missing_setup_section: true

env:
  mode: skip
  allowed_modes:
    - copy
    - link
    - skip
  files:
    - .env
    - .env.local

artifacts:
  enabled: true
  write_task_contract: true
  write_results: true
  write_quality_gates: true
  write_review: true
  write_comparison: true
  write_pr_body: true

parallel:
  min_variants: 2
  max_variants: 5
  default_variants: 3
  create_comparison_report: true
  preserve_losing_variants: true
  require_explicit_winner_selection: true
  results_file: RESULTS.md

quality_gates:
  source: agents_md
  commands: []
  stop_on_failure: true
  record_results: true

agents:
  enabled: true
  task_contract_file: .task/task-contract.md
  solution_options_file: .task/solution-options.md
  implementation_plan_file: .task/implementation-plan.md
  quality_gates_file: .task/quality-gates.md
  review_file: .task/review.md
  comparison_file: .task/comparison.md
  pr_body_file: .task/pr-body.md

  roles:
    - task-resolver
    - planner
    - worker
    - verifier
    - reviewer
    - comparator

pr:
  enabled: true
  default_draft: false
  auto_fill_from_artifacts: true
  include_issue_reference: true
  include_quality_gates: true
  include_review_notes: true

cleanup:
  allow_drop_with_uncommitted_changes: false
  allow_force_branch_delete: true
  preserve_worktree_after_pr: true
  stale_after_days: 30

output:
  default_format: text
  supported_formats:
    - text
    - json
    - yaml
  verbose_by_default: false
```

---

## Section-by-section model

### `repo`

Global repo-level defaults.

```yaml
repo:
  default_base_branch: main
  allow_current_branch_as_base: false
  worktree_root: .worktrees
  metadata_root: .mannostree
  artifact_dir_name: .task
```

Purpose:

* defines where worktrees live
* defines where metadata lives
* controls base branch fallback behavior

---

### `branching`

Controls naming policy.

```yaml
branching:
  single_branch_template: "{type}/{name}"
  parallel_branch_template: "experiment/{feature}-v{n}"
```

Purpose:

* keeps naming predictable
* makes parallel variants easy to identify
* prevents workers from inventing branch names ad hoc

Good default outputs:

* `feature/retry-api-client`
* `fix/helm-values-layered`
* `experiment/retry-api-client-v1`

---

### `spawn`

Controls default creation behavior.

```yaml
spawn:
  copy_env_by_default: false
  install_by_default: false
  auto_push_by_default: false
  auto_pr_by_default: false
  auto_task_init: true
```

This should stay conservative:

* no automatic env copy unless requested
* no automatic install unless configured
* no automatic push/PR by default

---

### `setup`

Defines where setup instructions come from.

```yaml
setup:
  mode: agents_md
  fallback_strategy: manual
```

Suggested modes:

* `agents_md`
* `config_only`
* `auto_detect`

Best default: `agents_md`

That keeps setup logic aligned with project documentation.

---

### `env`

Controls environment-file behavior.

```yaml
env:
  mode: skip
  allowed_modes: [copy, link, skip]
  files:
    - .env
    - .env.local
```

Recommended default:

* `skip`

Because env handling is often the most dangerous hidden state.

---

### `artifacts`

Controls durable handoff files.

```yaml
artifacts:
  enabled: true
  write_task_contract: true
  write_results: true
  write_quality_gates: true
```

This is important for agent workflows.
The CLI should treat `.task/` as the durable state layer, not chat memory.

---

### `parallel`

Defines multi-variant behavior.

```yaml
parallel:
  min_variants: 2
  max_variants: 5
  default_variants: 3
  preserve_losing_variants: true
  require_explicit_winner_selection: true
```

Important rules:

* never auto-delete losing variants
* never auto-pick a winner silently
* always keep comparison explicit

---

### `quality_gates`

Defines validation behavior.

```yaml
quality_gates:
  source: agents_md
  commands: []
  stop_on_failure: true
  record_results: true
```

Two models should be supported:

1. **read from AGENTS.md**
2. **define directly in config**

That gives flexibility per repo maturity.

---

### `agents`

Defines file contracts and enabled roles.

```yaml
agents:
  enabled: true
  roles:
    - task-resolver
    - planner
    - worker
    - verifier
    - reviewer
    - comparator
```

This section is valuable because it makes the tool agent-aware without hardcoding every repo’s workflow.

---

### `pr`

Defines PR generation behavior.

```yaml
pr:
  enabled: true
  default_draft: false
  auto_fill_from_artifacts: true
```

PR body should be built from:

* task contract
* results
* quality gates
* review notes

Not from volatile runtime memory.

---

### `cleanup`

Defines lifecycle safety.

```yaml
cleanup:
  allow_drop_with_uncommitted_changes: false
  preserve_worktree_after_pr: true
  stale_after_days: 30
```

Good default:

* keep worktree after PR
* do not allow destructive cleanup silently

---

## Good override model: profiles

A strong addition would be:

```yaml
profiles:
  docs:
    spawn:
      install_by_default: false
      copy_env_by_default: false
    quality_gates:
      commands:
        - markdownlint .
  
  python:
    spawn:
      install_by_default: true
    env:
      mode: copy
    quality_gates:
      commands:
        - uv run pytest
        - uv run ruff check .
  
  node:
    spawn:
      install_by_default: true
    quality_gates:
      commands:
        - npm test
        - npm run lint
        - npm run build
```

Then:

```bash
mannostree spawn retry-api-client --profile python
mannostree parallel spawn docs-reorg 3 --profile docs
```

This is much cleaner than scattering rules across commands.

---

## Best config principles

### 1. Safe defaults

* no auto-merge
* no auto-delete
* no hidden env copy
* no implicit current-branch base

### 2. Explicit base branch logic

Resolution order should be:

1. CLI `--base`
2. profile override
3. repo `default_base_branch`
4. git remote default branch

Not current branch by accident.

### 3. Artifact-first design

Every meaningful phase should produce a file under `.task/`.

### 4. Parallel is first-class

Parallel experiments should not feel like a hack on top of single spawn.

---

## Minimal recommended config

If you want a very lean version:

```yaml
version: 1

repo:
  default_base_branch: main
  worktree_root: .worktrees
  metadata_root: .mannostree
  artifact_dir_name: .task

branching:
  single_branch_template: "{type}/{name}"
  parallel_branch_template: "experiment/{feature}-v{n}"

spawn:
  copy_env_by_default: false
  install_by_default: false
  auto_task_init: true

env:
  mode: skip

parallel:
  min_variants: 2
  max_variants: 5
  preserve_losing_variants: true
  require_explicit_winner_selection: true

pr:
  auto_fill_from_artifacts: true

cleanup:
  allow_drop_with_uncommitted_changes: false
  preserve_worktree_after_pr: true
```

---

## One-line positioning for the config

**`.mannostree.yml` should be the policy file that defines how a repository creates, validates, compares, publishes, and cleans up isolated worktree-based development flows.**

Next step would be the **metadata schema** for `.mannostree/registry + worktree records`.
