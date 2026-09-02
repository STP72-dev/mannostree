# Quickstart Guide: Movement 9 — Cross-Repository Poly-Worktree Orchestration

This guide walks through configuring and operating synchronized poly-worktree clusters in Mannostree.

---

## 1. Configure Poly-Repository Manifest (`.mannostree.poly.yml`)

Create `.mannostree.poly.yml` in your project root or workspace cluster directory:

```yaml
version: 1
name: billing-cluster

repos:
  api:
    path: ./services/billing-api
    default_base_branch: main
    role: backend
  web:
    path: ./apps/billing-web
    default_base_branch: main
    role: frontend
    depends_on:
      - schema
  schema:
    path: ./packages/billing-schema
    default_base_branch: main
    role: lib

links:
  - source_repo: schema
    target_repo: web
    strategy: npm
    package_name: "@billing/schema"
```

---

## 2. Spawn Synchronized Poly-Worktree Group

```bash
# Preview the coordinated spawn across all 3 repositories
mannostree poly spawn invoice-pdf --base main --dry-run

# Execute atomic spawn (creates worktree and links dependencies in all 3 repos)
mannostree poly spawn invoice-pdf --base main
```

---

## 3. Check Cross-Repository Status

```bash
# View combined status dashboard across api, web, and schema
mannostree poly status invoice-pdf
```

---

## 4. Run Cross-Repo Tests

```bash
# Execute test suites across all worktrees in parallel
mannostree poly exec invoice-pdf npm test --parallel
```

---

## 5. Publish Joint Pull Requests

```bash
# Publish draft PRs to GitHub/GitLab with embedded cross-links to sibling PRs
mannostree poly pr invoice-pdf --push --draft
```

---

## 6. Clean Decommission

```bash
# Safely unlink and remove all 3 member worktrees
mannostree poly drop invoice-pdf --yes
```
