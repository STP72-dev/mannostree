# Feature Specification: Movement 9 — Cross-Repository Poly-Worktree Orchestration

**Feature Branch**: `009-cross-repo-poly-worktree`  
**Created**: 2026-09-02T11:18:40+02:00  
**Status**: DRAFT  
**Priority**: P1 (Multi-Repo Coordination, Atomic Lifecycle & Cross-Linking)

---

## 1. Purpose & Problem Statement

Modern enterprise software systems are frequently split across multiple interdependent git repositories (e.g., backend API services, web/mobile frontends, shared schema libraries, infrastructure modules). In such poly-repository environments:
1. **Uncoordinated Workspace Creation**: Developers and autonomous agents must manually create, name, and configure worktrees across multiple separate repositories to develop a single distributed feature.
2. **Desynchronized Base Branches**: Divergence across member repositories is untracked, causing contract mismatches (e.g. frontend worktree built against stale backend base).
3. **Brittle Dependency Inter-Wiring**: Linking local development worktrees across repositories (e.g. `npm link`, TypeScript path mapping, Go `replace`, Cargo `[patch]`, Python editable installs) is tedious, prone to forgotten unlinking, and creates dirty git state.
4. **Scattered Publishing & Review**: Publishing a multi-repo feature requires opening disconnected PRs/MRs across multiple repositories without joint evidence, missing synchronized release manifests, and lacking cross-repo verification scorecards.

**Movement 9** introduces **Cross-Repository Poly-Worktree Orchestration**, enabling developers and autonomous agents to define, spawn, synchronize, inter-link, evaluate, and publish synchronized worktrees across an arbitrary cluster of interdependent git repositories with atomic transaction guarantees and unified lifecycle control.

---

## 2. User Personas & Target Users

- **Full-Stack & Distributed System Developers**: Work on multi-tier features spanning frontend, backend, and shared libraries within synchronized, isolated worktrees.
- **Autonomous Multi-Agent Coordinators**: Dispatch specialized worker agents across paired repositories with shared task contracts and joint quality gates.
- **Release Engineers & System Operators**: Coordinate multi-repo release assemblies, joint merge readiness checks, and atomic cross-repository PR publishing.

---

## 3. User Scenarios & Acceptance Criteria

### User Story 1: Coordinated Poly-Worktree Spawning & Decommissioning (Priority: P1 - MVP)
As a developer or agent coordinator working across multiple interdependent repositories,  
I want to create synchronized worktrees across all member repositories with a single command,  
So that all workspaces share the same feature name, base branch lineage, and lifecycle tracking.

- **Acceptance Scenario 1.1 (Atomic Multi-Repo Spawn)**:  
  Given a poly-repository manifest in `.mannostree.poly.yml` defining member repositories `backend`, `frontend`, and `shared-types`,  
  When I execute `mannostree poly spawn checkout-v2 --base main`,  
  Then a dedicated worktree is created in each member repository under `.worktrees/checkout-v2`,  
  And if any repository fails to spawn, all previously created worktrees are rolled back cleanly.

- **Acceptance Scenario 1.2 (Safe Poly-Worktree Drop & Decommissioning)**:  
  Given an active poly-worktree group `checkout-v2`,  
  When I execute `mannostree poly drop checkout-v2 --dry-run`,  
  Then the system previews the removal across all member repositories without altering git state,  
  And when executed with `--yes`, it removes worktrees and prunes registry records across all members.

---

### User Story 2: Cross-Repository Dependency Inter-Wiring (Priority: P1)
As a developer developing across paired library and application repositories,  
I want Mannostree to automatically configure local dependency links between worktrees,  
So that application worktrees immediately consume local changes from the library worktree without publishing to a remote registry.

- **Acceptance Scenario 2.1 (Automated Local Package Wiring)**:  
  Given an active poly-worktree group where `frontend` depends on `shared-types`,  
  When running `mannostree poly link checkout-v2`,  
  Then the system configures local dependency links (supporting Node symlinks/npm link, Python editable paths, Cargo path overrides, or Go module replace directives),  
  And records the link state in `.mannostree/poly-links.json`.

- **Acceptance Scenario 2.2 (Safe Unlink on Decommission)**:  
  When dropping or unlinking a poly-worktree,  
  Then all cross-repository links are cleanly restored to avoid leaving dirty paths or broken symlinks.

---

### User Story 3: Coordinated Fleet Sync & Cross-Repository Conflict Matrix (Priority: P2)
As a release manager or developer integrating a multi-repo feature,  
I want to inspect merge conflicts and base drift across all member repositories simultaneously,  
So that I can verify cross-repository synchronization before initiating reviews.

- **Acceptance Scenario 3.1 (Poly-Fleet Base Sync)**:  
  When running `mannostree poly sync checkout-v2 --strategy rebase`,  
  Then base branches in all member repositories are fetched and synchronized with automatic abort on conflict.

- **Acceptance Scenario 3.2 (Cross-Repo Integration Matrix)**:  
  When running `mannostree poly status checkout-v2`,  
  Then a unified dashboard displays the branch, commit SHA, ahead/behind counts, dirty status, and lease status for each member repository.

---

### User Story 4: Coordinated Poly-Publish & Joint Pull Request Manifest (Priority: P2)
As an engineer completing a cross-repository feature,  
I want to publish pull requests across all member repositories with joint cross-linking and combined verification evidence,  
So that reviewers have immediate visibility into the complete end-to-end change.

- **Acceptance Scenario 4.1 (Coordinated Multi-PR Publishing)**:  
  Given a completed poly-worktree group `checkout-v2`,  
  When executing `mannostree poly pr checkout-v2 --push --draft`,  
  Then pull requests / merge requests are created across all member repositories using their respective host adapters (GitHub, GitLab, Gitea, Bitbucket),  
  And each PR description contains markdown cross-links to all sibling PRs and a joint release manifest table.

---

## 4. Functional Requirements

- **`FR-001` (Poly-Repository Manifest Specification)**: The system must support `.mannostree.poly.yml` (or `.mannostree.yml` `poly_repos` section) defining member repositories (path, default base branch, role, link targets).
- **`FR-002` (Atomic Poly-Spawn Engine)**: The system must provide atomic all-or-nothing worktree creation across all configured member repositories with automated rollback upon any single failure.
- **`FR-003` (Poly-Worktree Registry & Metadata)**: The system must track poly-worktree groups in `.mannostree/poly-registry.json` recording member IDs, paths, branches, and linked dependencies.
- **`FR-004` (Automated Cross-Repo Inter-Linking)**: The system must support automatic link creation (`npm link`, Python editable `-e`, Go `replace`, Cargo `[patch]`, and generic path symlinks) between paired worktrees.
- **`FR-005` (Coordinated Base Synchronization)**: The `poly sync` engine must synchronize base branches across all member repositories using configured rebase, merge, or fast-forward strategies.
- **`FR-006` (Cross-Repository Status & Conflict Inspection)**: The `poly status` engine must provide a composite terminal and JSON report detailing git status, ahead/behind counts, and dirty state across all members.
- **`FR-007` (Cross-Repo Command Execution)**: The `poly exec` command must execute commands concurrently or sequentially across all member worktrees with aggregated stdout/stderr output.
- **`FR-008` (Joint Poly-PR Publisher)**: The `poly pr` and `poly publish` engines must publish PRs across all member repositories and embed cross-referencing sibling links and combined release manifests.
- **`FR-009` (Poly-Doctor Health Audit)**: `mannostree doctor` must audit poly-repository manifests, verifying member path validity, git remote reachability, and active cross-link integrity.
- **`FR-010` (Dry-Run Preview Guarantee)**: All `poly` commands (`poly spawn`, `poly drop`, `poly sync`, `poly link`, `poly pr`) must support `--dry-run` to output planned actions without mutating disk or git state.

---

## 5. Non-Functional Requirements & Safety Invariants

1. **Transactional Atomicity**: Any partial failure during poly-spawn must automatically roll back all spawned worktrees and leave member repositories in their pristine initial state.
2. **No Implicit Remote Mutation**: Poly-worktree operations must never push branches or create remote PRs unless `--push` is explicitly provided.
3. **Link Hygiene**: All temporary package linkages and symlinks must be tracked in metadata and cleanly unlinked during drop or cleanup.
4. **Member Autonomy**: Each member repository must remain a valid, self-contained git repository with its own standard Mannostree metadata records.

---

## 6. Success Criteria

- **`SC-001` (Coordination Efficiency)**: Spawning a 3-repository poly-worktree group completes in $\le 2.0$ seconds.
- **`SC-002` (Atomic Rollback Reliability)**: 100% of simulated spawn failures across multi-repo groups achieve clean zero-leak rollback.
- **`SC-003` (Cross-Linking Accuracy)**: 100% of configured package links are correctly established and restored without residual dirty git state.
- **`SC-004` (End-to-End Traceability)**: 100% of published poly-PRs contain valid cross-links to all sibling repositories.

---

## 7. Assumptions & Constraints

- Member repositories are present on the local filesystem (relative paths) or cloneable from accessible remotes.
- Standard language package managers (npm, pip, cargo, go) are installed if corresponding link strategies are requested.
- Each member repository has git initialized and accessible permissions.
