# Implementation Plan: Movement 9 — Cross-Repository Poly-Worktree Orchestration

**Branch**: `009-cross-repo-poly-worktree` | **Date**: 2026-09-02T11:21:20+02:00 | **Spec**: [`specs/009-cross-repo-poly-worktree/spec.md`](spec.md)  
**Input**: Feature specification from `specs/009-cross-repo-poly-worktree/spec.md`

---

## Summary

Movement 9 builds the **Cross-Repository Poly-Worktree Orchestration Engine** for Mannostree, enabling coordinated multi-repository workspace management. It introduces declarative poly-manifest definitions (`.mannostree.poly.yml`), atomic multi-repo worktree spawning with rollback guarantees, automated cross-repository dependency linking (`npm`, `python`, `go`, `cargo`, symlink), concurrent cross-repo base synchronization, aggregated status reporting, and joint multi-PR publishing with sibling cross-referencing.

---

## Technical Context

**Language/Version**: TypeScript 5.7.3 / Node.js >= 20.0.0 (ESM `"type": "module"`)  
**Primary Dependencies**: `commander` (CLI), `chalk` (styling), `zod` (runtime schema validation), `yaml` (YAML manifest parser)  
**Storage**: Persistent JSON files in `.mannostree/poly-registry.json`, `.mannostree/poly-links.json`, `.mannostree/poly-releases/`  
**Testing**: Vitest (`npm test`)  
**Target Platform**: Linux, macOS, Windows (POSIX & Windows path compatibility)  
**Project Type**: CLI Developer Tooling & Multi-Repo Workspace Orchestration  
**Performance Goals**: Multi-repo atomic spawn across 3 repositories $\le 2.0$s  
**Constraints**: Atomic transaction rollback upon any member failure; zero residual dirty link state; strict adherence to safety flags (`--discard-uncommitted --yes`)  

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Principle 1 (Safety First & Data Loss Prevention)**: PASS. Poly-spawn uses a two-phase transactional execution stack with automated rollback on failure. Decommissioning dirty workspaces strictly requires `--discard-uncommitted --yes`.
- **Principle 2 (Explicit Lifecycle & State Integrity)**: PASS. Poly-worktree cluster state is recorded in `.mannostree/poly-registry.json` and package link state is saved in `.mannostree/poly-links.json`.
- **Principle 3 (Reproducibility & Observability)**: PASS. All `poly` commands support `--json`, `--yaml`, `--plain`, and `--dry-run` preview modes.
- **Principle 4 (Small Blast Radius & Backward Compatibility)**: PASS. Extends Mannostree core with `PolyEngine`, keeping existing single-repo commands and metadata 100% backward-compatible.

---

## Project Structure

### Documentation (this feature)

```text
specs/009-cross-repo-poly-worktree/
├── plan.md              # Implementation plan
├── research.md          # Architecture & linking research
├── data-model.md        # Schemas and domain types
├── quickstart.md        # Operator quickstart guide
├── contracts/
│   └── cli-contract.md  # CLI command specifications
├── checklists/
│   └── requirements.md  # Specification quality checklist
└── tasks.md             # Implementation tasks (generated via /speckit.tasks)
```

### Source Code Architecture

```text
src/
├── poly/
│   ├── manifest.ts      # .mannostree.poly.yml parser and validator
│   ├── engine.ts        # PolyEngine: atomic multi-repo spawn, drop, sync, status
│   ├── link.ts          # Cross-package linking drivers (npm, python, go, cargo, symlink)
│   ├── publish.ts       # PolyPublishEngine: multi-PR publishing and manifest assembly
│   └── index.ts         # Barrel export
├── core/
│   ├── orchestrator.ts  # MannostreeOrchestrator poly delegation methods
│   └── doctor.ts        # Poly-repo manifest and link health audits
├── cli/
│   └── commands/
│       └── poly.ts      # mannostree poly CLI commands (spawn, drop, link, unlink, sync, status, exec, pr)
```

---

## Planned Execution Phases

1. **Phase 1: Setup & Manifest Schemas**: Poly-manifest parsing, Zod schemas in `src/metadata/schema.ts`, domain types in `src/types/index.ts`.
2. **Phase 2: Foundational PolyEngine & Transaction Stack**: Core `PolyEngine` with rollback stack and registry in `src/poly/engine.ts`.
3. **Phase 3: User Story 1 (Atomic Poly-Spawn & Drop)**: `poly spawn`, `poly drop`, and integration tests.
4. **Phase 4: User Story 2 (Cross-Repository Dependency Linking)**: `poly link`, `poly unlink`, linking drivers (`npm`, `python`, `go`, `cargo`, `symlink`).
5. **Phase 5: User Story 3 (Poly-Sync & Conflict Status Matrix)**: `poly sync`, `poly status`, `poly exec`.
6. **Phase 6: User Story 4 (Poly-PR Publisher & Release Manifest)**: `poly pr`, multi-host joint PR publishing.
7. **Phase 7: Doctor Diagnostics & Polish**: `mannostree doctor` poly audit, CLI formatting in `src/cli/output.ts`, full verification.
