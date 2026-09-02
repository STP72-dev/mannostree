# Data Model & Schema: Movement 9 — Cross-Repository Poly-Worktree Orchestration

**Feature Branch**: `009-cross-repo-poly-worktree`  
**Date**: 2026-09-02T11:20:45+02:00  

---

## 1. Poly-Repository Configuration Schema (`.mannostree.poly.yml`)

```yaml
version: 1
name: my-distributed-app
repos:
  backend:
    path: ./services/backend
    default_base_branch: main
    role: backend
    profile: node
  frontend:
    path: ./apps/web
    default_base_branch: main
    role: frontend
    profile: node
    depends_on:
      - shared-types
  shared-types:
    path: ./packages/types
    default_base_branch: main
    role: lib
    profile: node

links:
  - source_repo: shared-types
    target_repo: frontend
    strategy: npm # npm | python | go | cargo | symlink
    package_name: "@corp/types"
```

---

## 2. TypeScript Domain Models & Zod Schemas

```typescript
// 1. Member Repository Definition
export interface PolyRepoMemberConfig {
  path: string;
  default_base_branch?: string;
  role?: 'backend' | 'frontend' | 'lib' | 'infra' | 'custom';
  profile?: string;
  depends_on?: string[];
}

// 2. Link Configuration
export type PolyLinkStrategy = 'npm' | 'python' | 'go' | 'cargo' | 'symlink';

export interface PolyLinkRule {
  source_repo: string;
  target_repo: string;
  strategy: PolyLinkStrategy;
  package_name?: string;
  target_subpath?: string;
}

// 3. Poly Manifest Record
export interface PolyManifestConfig {
  version: number;
  name: string;
  repos: Record<string, PolyRepoMemberConfig>;
  links?: PolyLinkRule[];
}

// 4. Poly Worktree Member Instance
export interface PolyWorktreeMemberInstance {
  repo_name: string;
  repo_path: string;
  worktree_id: string;
  worktree_path: string;
  branch: string;
  base_branch: string;
  head_sha?: string;
  status: 'active' | 'synced' | 'dirty' | 'failed' | 'cleaned';
}

// 5. Poly Worktree Group Record (.mannostree/poly-registry.json)
export interface PolyWorktreeGroupRecord {
  version: number;
  feature: string;
  manifest_name: string;
  created_at: string;
  updated_at: string;
  members: Record<string, PolyWorktreeMemberInstance>;
  active_links: PolyLinkRecord[];
  status: 'active' | 'degraded' | 'cleaned';
}

// 6. Poly Link Record (.mannostree/poly-links.json)
export interface PolyLinkRecord {
  id: string;
  feature: string;
  source_repo: string;
  target_repo: string;
  strategy: PolyLinkStrategy;
  source_path: string;
  target_path: string;
  created_at: string;
  status: 'linked' | 'unlinked' | 'failed';
  original_state_backup?: string;
}

// 7. Poly Release Manifest (.mannostree/poly-releases/<feature>.json)
export interface PolyReleaseManifest {
  version: number;
  feature: string;
  published_at: string;
  members: Array<{
    repo_name: string;
    branch: string;
    base_branch: string;
    pr_number?: number | null;
    pr_url?: string | null;
    head_sha: string;
  }>;
  joint_release_table_markdown: string;
}
```
