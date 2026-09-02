# Research & Technical Architecture: Movement 9 — Cross-Repository Poly-Worktree Orchestration

**Feature**: Movement 9 — Cross-Repository Poly-Worktree Orchestration  
**Branch**: `009-cross-repo-poly-worktree`  
**Date**: 2026-09-02T11:20:30+02:00  

---

## 1. Multi-Repository Manifest & Discovery

### Context & Challenge
In poly-repository setups, related services or packages live in separate git repositories (e.g. `backend/`, `frontend/`, `shared-types/`). A single root manifest is required to describe the repository graph without forcing monorepo tooling or invasive submodule coupling.

### Decision
Support `.mannostree.poly.yml` located at the cluster root (or declared within `.mannostree.yml` `poly_repos` section). The manifest specifies:
- `name`: Cluster namespace identifier.
- `repos`: Keyed dictionary of member repositories with `path` (relative to cluster root or repo root), `default_base_branch`, `role` (`backend`, `frontend`, `lib`, `infra`, `custom`), and `depends_on` array.
- `links`: Array of package link rules defining source package path, target package path, and strategy (`npm`, `python`, `go`, `cargo`, `symlink`).

### Alternatives Considered
- *Git Submodules*: Fragile detached HEAD states, recursive update overhead, poor agent UX.
- *Google Repo / Meta tools*: Requires custom XML manifests and external Python tooling dependencies.
- *YAML Cluster Manifest (Selected)*: Zero external dependencies, pure declarative structure matching existing `.mannostree.yml` schema design.

---

## 2. Atomic Poly-Worktree Lifecycle & Rollback Mechanics

### Context & Challenge
Spawning worktrees across 3 to 10 repositories can fail midway (e.g., branch collision in repo 3, locked worktree in repo 5). If not handled atomically, the system leaves orphaned worktrees and branches.

### Decision
Implement `PolyEngine` utilizing a two-phase transactional execution pattern backed by `TransactionJournal`:
1. **Pre-flight Validation**: Verify all member repository paths exist, base branches are valid git references, and target worktree paths / branch names are unallocated.
2. **Execute Stage with Rollback Stack**: Create worktrees sequentially while pushing rollback closures onto an execution stack (`git worktree remove --force`, `git branch -D`).
3. **Transaction Commit**: If all member worktrees succeed, write `.mannostree/poly-registry.json` and mark transaction `committed`. If any step fails, unwind the rollback stack in reverse order and throw a structured `MannostreeError`.

### Alternatives Considered
- *Best-effort Spawning*: Leaves broken half-spawned clusters requiring manual cleanup.
- *Transactional Rollback Stack (Selected)*: Strictly adheres to Constitution Principle 1 & 2 (Safety First & State Integrity).

---

## 3. Cross-Repository Local Dependency Linking Strategies

### Context & Challenge
Local worktrees must reference each other during development without pushing intermediate builds to public/private artifact registries.

### Decision
Implement pluggable `PolyLinkStrategy` handlers:
- **`npm` / `pnpm` / `yarn` (JavaScript/TypeScript)**: Creates relative symlinks or registers package in local global link store (`npm link <source>` within target worktree directory).
- **`python` (pip / poetry)**: Installs editable dependency (`pip install -e <sourcePath>` or local `.pth` file injection).
- **`go` (Go Modules)**: Adds temporary `go.mod` `replace` directive (`go mod edit -replace <module>=<sourcePath>`).
- **`cargo` (Rust)**: Adds temporary `[patch.crates-io]` or `path` override to `Cargo.toml`.
- **`symlink` (Generic)**: Creates directory symlinks from target's vendor/dependency directory to source worktree.

Each established link stores a snapshot in `.mannostree/poly-links.json` enabling idempotent and safe `poly unlink` or cleanup.

---

## 4. Coordinated Multi-PR Publishing & Release Manifest Assembly

### Context & Challenge
When a poly-worktree feature is ready for code review, PRs must be opened in each member repository and cross-referenced with links to all other member PRs.

### Decision
`PolyPublishEngine` orchestrates publishing across all member repositories:
1. Pushes all member worktree branches to their respective remotes.
2. Resolves each member repo's remote host adapter (GitHub, GitLab, Gitea, Bitbucket).
3. Compiles a **Poly-Release Manifest Table** listing each repository, branch, and relative diff summary.
4. Generates PRs in parallel with embedded sibling markdown cross-links (e.g., `Part of multi-repo feature [checkout-v2]: Backend PR #42, Frontend PR #88`).
5. Persists `.mannostree/poly-releases/<feature>.json`.
