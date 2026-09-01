# Research & Technical Decisions: Autonomous Agent Contract Runner

## Decision 1: Pluggable Command Template Execution Interface

### Context
Developers use different agent tools (Google Antigravity/Gemini CLI, Anthropic Claude CLI, Codex CLI, Aider, OpenCode, custom scripts). Hardcoding any specific LLM API client into Mannostree introduces heavy dependencies and ties the CLI to a single provider.

### Decision
Implement a pluggable command runner configured in `.mannostree.yml`:
```yaml
agent:
  default_command: "gemini --task {contract_path}"
  timeout_seconds: 1800
  env_passthrough:
    - GEMINI_API_KEY
    - ANTHROPIC_API_KEY
```
- Mannostree spawns the agent process with `cwd` set strictly to the target worktree root path (`.worktrees/<name>`).
- Supports placeholder interpolation:
  - `{worktree_path}`: Absolute path to the isolated worktree.
  - `{contract_path}`: Path to `.task/task-contract.md`.
  - `{feature}`: Target feature/experiment identifier.
  - `{role}`: Assigned agent role (`planner`, `worker`, `verifier`).
- If no command template is configured, `agent dispatch` runs in `contract_only` mode (writing the contract and waiting for manual or external agent trigger).

### Alternatives Considered
1. **Direct LLM API Integration**: Embeds API keys and SDK clients inside Mannostree. Rejected to keep Mannostree tool-agnostic and lightweight.
2. **Contract File Only**: Requires the developer to manually launch the agent in another terminal every time.
3. **Pluggable Command Template (Chosen)**: Universal, zero external LLM SDK dependencies, fully compatible with all AI tools and automated pipelines.

---

## Decision 2: Task Contract Schema & Checkbox Fulfillment Verification

### Context
Agents must receive an explicit, testable definition of work and must indicate completed items unambiguously.

### Decision
Standardize `.task/task-contract.md` with:
- **Title & Problem Statement**: Clear scope boundaries.
- **Acceptance Criteria**: Markdown checklists (`- [ ]` / `- [x]`).
- **Quality Gate References**: Paths to test suites or automated commands.
- **Safety Invariants**: Required base branches, protected paths, and publishing constraints.

Verification Algorithm:
1. Parse `.task/task-contract.md` using regex / markdown AST.
2. Count total acceptance checkboxes vs checked (`- [x]` / `- [X]`).
3. If checked < total, reject fulfillment with a list of unchecked items written to `.task/review.md`.
4. If checked === total, proceed to automated Quality Gate verification.

---

## Decision 3: Automated Quality Gate Verification Engine

### Context
Checking boxes is not enough; code must compile, pass lint checks, and pass all automated test suites before being certified as `FULFILLED`.

### Decision
Execute validation commands defined in `.task/quality-gates.md` or `.mannostree.yml`:
- Commands run in sequence inside the worktree sandbox (`npm run lint`, `npm test`, `npm run build`).
- Captures stdout/stderr, execution time, and exit codes.
- If any command exits non-zero, fulfillment is rejected and failure logs are appended to `.task/review.md`.
- Supports bounded retries (`--retries N`) to handle flaky network or transient environment issues.

---

## Decision 4: Sandboxed Working Directory Confinement & Path Protection

### Context
An autonomous agent executing arbitrary shell commands or code must be strictly prevented from mutating the root repository, `.git`, `.mannostree` metadata store, or sibling parallel worktrees.

### Decision
1. **Process Confinement**: Child processes are spawned with `cwd: path.resolve(repoRoot, worktreePath)`.
2. **Metadata Shielding**: Registry and record modifications remain exclusively handled by Mannostree APIs; agents do not have direct write access to `.mannostree/`.
3. **Path Validation**: Verification checks compare git diff paths to ensure all modified and created files reside within the worktree boundary.

---

## Decision 5: Execution Scorecard Aggregation (`.task/scorecard.md`)

### Context
When multiple variants of a feature are implemented by different agents or prompts, the developer needs an objective, quantitative scorecard to compare results.

### Decision
Upon successful verification (or failure), compile `.task/scorecard.md` containing:
- **Execution Time**: Start time, end time, total duration in seconds.
- **Git Diff Statistics**: Files changed, lines added (`+`), lines removed (`-`).
- **Quality Gate Results**: Unit tests passed/failed, lint status, build status.
- **Session Audit**: Agent role, process exit code, session ID.
