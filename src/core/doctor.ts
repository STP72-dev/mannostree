import path from 'node:path';
import fs from 'node:fs';
import { MannostreeConfig } from '../config/schema.js';
import { GitEngine } from '../git/engine.js';
import { MetadataStore, readJson } from '../metadata/store.js';
import { WorktreeRecordSchema } from '../metadata/schema.js';
import { HostHealthStatus, SandboxHealthStatus, PolyHealthStatus } from '../types/index.js';
import { createDefaultAdapterRegistry } from '../adapters/index.js';
import {
  SandboxRegistry,
  createDefaultSandboxRegistry,
} from '../sandbox/index.js';
import { findPolyManifest, loadPolyManifest } from '../poly/manifest.js';

export type FindingType =
  | 'MISSING_DISK'
  | 'MISSING_BRANCH'
  | 'SCHEMA_ERROR'
  | 'UNTRACKED_DIR'
  | 'ORPHAN_BRANCH'
  | 'REGISTRY_MISMATCH';

export interface DoctorFinding {
  type: FindingType;
  id?: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
  details?: Record<string, unknown>;
  proposed_action?: string;
}

export interface ProposedRepair {
  action: 'prune_registry' | 'sync_registry' | 'mark_broken' | 'repair_worktree_link';
  target_id: string;
  description: string;
}

export interface DoctorReport {
  timestamp: string;
  healthy: boolean;
  total_findings: number;
  error_count: number;
  warning_count: number;
  findings: DoctorFinding[];
  proposed_repairs: ProposedRepair[];
  host_adapters?: HostHealthStatus[];
  sandbox_environments?: SandboxHealthStatus[];
  poly_repositories?: PolyHealthStatus;
}

export class DoctorEngine {
  constructor(
    public repoRoot: string,
    public config: MannostreeConfig,
    public git: GitEngine,
    public store: MetadataStore,
    public sandboxRegistry: SandboxRegistry = createDefaultSandboxRegistry()
  ) {}

  public async diagnose(): Promise<DoctorReport> {
    const findings: DoctorFinding[] = [];
    const proposedRepairs: ProposedRepair[] = [];

    const registry = await this.store.getRegistry();
    const worktreeRecords = await this.store.listWorktrees();
    const localBranches = await this.git.listLocalBranches();

    // 1. Audit registry entries vs disk & git
    for (const record of worktreeRecords) {
      const fullPath = path.resolve(this.repoRoot, record.worktree_path);
      const diskExists = fs.existsSync(fullPath);
      const branchExists = await this.git.branchOrRefExists(record.branch);

      if (!diskExists) {
        findings.push({
          type: 'MISSING_DISK',
          id: record.id,
          severity: 'error',
          message: `Worktree '${record.id}' is tracked in registry, but directory is missing at '${record.worktree_path}'.`,
          proposed_action: 'Prune from registry or recreate worktree directory.',
        });
        proposedRepairs.push({
          action: 'prune_registry',
          target_id: record.id,
          description: `Remove missing worktree '${record.id}' from registry index`,
        });
      }

      if (!branchExists) {
        findings.push({
          type: 'MISSING_BRANCH',
          id: record.id,
          severity: 'error',
          message: `Worktree '${record.id}' points to branch '${record.branch}', but branch does not exist in git.`,
          proposed_action: 'Mark worktree state as BROKEN or re-create branch.',
        });
        proposedRepairs.push({
          action: 'mark_broken',
          target_id: record.id,
          description: `Mark worktree '${record.id}' as BROKEN due to missing branch`,
        });
      }
    }

    // 2. Audit metadata files on disk for unindexed records or schema errors
    const worktreesDir = path.resolve(this.repoRoot, this.config.metadata_root, 'worktrees');
    if (fs.existsSync(worktreesDir)) {
      const files = fs.readdirSync(worktreesDir).filter((f) => f.endsWith('.json'));
      for (const file of files) {
        const id = path.basename(file, '.json');
        const filePath = path.join(worktreesDir, file);

        try {
          const raw = readJson<unknown>(filePath);
          const parsed = WorktreeRecordSchema.safeParse(raw);
          if (!parsed.success) {
            findings.push({
              type: 'SCHEMA_ERROR',
              id,
              severity: 'error',
              message: `Worktree record file '${file}' fails schema validation: ${parsed.error.message}`,
              proposed_action: 'Repair or recreate metadata file.',
            });
          }
        } catch (err: any) {
          findings.push({
            type: 'SCHEMA_ERROR',
            id,
            severity: 'error',
            message: `Corrupted JSON metadata in '${file}': ${err.message}`,
            proposed_action: 'Rebuild metadata record.',
          });
        }

        if (!registry.worktrees.includes(id)) {
          findings.push({
            type: 'REGISTRY_MISMATCH',
            id,
            severity: 'warning',
            message: `Metadata file '${file}' exists on disk, but is missing from registry.json index.`,
            proposed_action: 'Re-index worktree in registry.json.',
          });
          proposedRepairs.push({
            action: 'sync_registry',
            target_id: id,
            description: `Add '${id}' to registry index`,
          });
        }
      }
    }

    // 3. Audit untracked directories under worktree_root (NEVER touch them)
    const wtRootFull = path.resolve(this.repoRoot, this.config.worktree_root);
    if (fs.existsSync(wtRootFull)) {
      const subdirs = fs
        .readdirSync(wtRootFull, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name);

      const trackedPaths = worktreeRecords.map((r) =>
        path.basename(r.worktree_path)
      );

      for (const dirName of subdirs) {
        if (!trackedPaths.includes(dirName)) {
          findings.push({
            type: 'UNTRACKED_DIR',
            severity: 'info',
            message: `Directory '${path.join(this.config.worktree_root, dirName)}' exists under worktree root but is not tracked by Mannostree.`,
            details: { directory: path.join(this.config.worktree_root, dirName) },
            proposed_action: 'Informational only (Mannostree will not mutate untracked folders).',
          });
        }
      }
    }

    // 4. Audit orphan branches
    const trackedBranches = worktreeRecords.map((r) => r.branch);
    const candidatePrefixes = ['feature/', 'fix/', 'experiment/', 'refactor/', 'docs/'];
    for (const b of localBranches) {
      if (
        candidatePrefixes.some((p) => b.startsWith(p)) &&
        !trackedBranches.includes(b)
      ) {
        findings.push({
          type: 'ORPHAN_BRANCH',
          severity: 'warning',
          message: `Branch '${b}' matches worktree naming conventions but has no active worktree record.`,
          details: { branch: b },
          proposed_action: 'Informational: branch may be cleaned up manually or reattached.',
        });
      }
    }

    // 5. Audit host adapters
    const hostAdapters = await this.auditHostAdapters();

    // 6. Audit sandbox container runtimes
    const sandboxEnvironments = await this.auditSandboxEnvironments();

    // 7. Audit poly-repository manifests & links
    const polyRepositories = await this.auditPolyRepositories();

    const errorCount = findings.filter((f) => f.severity === 'error').length;
    const warningCount = findings.filter((f) => f.severity === 'warning').length;

    return {
      timestamp: new Date().toISOString(),
      healthy: errorCount === 0,
      total_findings: findings.length,
      error_count: errorCount,
      warning_count: warningCount,
      findings,
      proposed_repairs: proposedRepairs,
      host_adapters: hostAdapters,
      sandbox_environments: sandboxEnvironments,
      poly_repositories: polyRepositories,
    };
  }

  public async auditPolyRepositories(): Promise<PolyHealthStatus> {
    const manifestPath = findPolyManifest(this.repoRoot);
    if (!manifestPath) {
      return {
        manifest_found: false,
        manifest_valid: false,
        total_repos: 0,
        accessible_repos: 0,
        broken_links_count: 0,
        details: 'No .mannostree.poly.yml manifest present.',
      };
    }

    try {
      const { manifest, manifestDir } = loadPolyManifest(manifestPath, this.repoRoot);
      const totalRepos = Object.keys(manifest.repos).length;
      let accessibleRepos = 0;

      for (const [name, cfg] of Object.entries(manifest.repos)) {
        const absPath = path.resolve(manifestDir, cfg.path);
        if (fs.existsSync(absPath)) {
          accessibleRepos++;
        }
      }

      const allLinks = await this.store.getPolyLinks();
      let brokenLinksCount = 0;
      for (const list of Object.values(allLinks.links)) {
        for (const link of list) {
          if (link.status === 'failed') {
            brokenLinksCount++;
          }
        }
      }

      return {
        manifest_found: true,
        manifest_path: manifestPath,
        manifest_valid: true,
        total_repos: totalRepos,
        accessible_repos: accessibleRepos,
        broken_links_count: brokenLinksCount,
        details: `${accessibleRepos}/${totalRepos} member repositories accessible.`,
      };
    } catch (err: any) {
      return {
        manifest_found: true,
        manifest_path: manifestPath,
        manifest_valid: false,
        total_repos: 0,
        accessible_repos: 0,
        broken_links_count: 0,
        details: `Manifest syntax/schema error: ${err.message}`,
      };
    }
  }

  public async auditSandboxEnvironments(): Promise<SandboxHealthStatus[]> {
    const runtimes = this.sandboxRegistry.getAll();
    const statuses: SandboxHealthStatus[] = [];

    for (const runtime of runtimes) {
      try {
        const health = await runtime.checkHealth(this.config.sandbox);
        statuses.push(health);
      } catch (err: any) {
        statuses.push({
          runtime: runtime.type,
          available: false,
          error: err.message,
          details: 'Failed to query runtime health check',
        });
      }
    }

    return statuses;
  }

  public async auditHostAdapters(): Promise<HostHealthStatus[]> {
    const registry = createDefaultAdapterRegistry();
    const adapters = registry.listAdapters();
    const statuses: HostHealthStatus[] = [];

    for (const adapter of adapters) {
      try {
        const status = await adapter.checkHealth(this.config.publish?.hosts);
        statuses.push(status);
      } catch (err: any) {
        statuses.push({
          host_type: adapter.hostType,
          available: false,
          cli_found: false,
          token_configured: false,
          message: `Health check failed: ${err.message}`,
        });
      }
    }

    return statuses;
  }

  public async applyRepairs(
    repairs: ProposedRepair[],
    dryRun: boolean = false
  ): Promise<{ applied: ProposedRepair[]; skipped: ProposedRepair[] }> {
    const applied: ProposedRepair[] = [];
    const skipped: ProposedRepair[] = [];

    if (dryRun) {
      return { applied: repairs, skipped: [] };
    }

    for (const rep of repairs) {
      try {
        if (rep.action === 'prune_registry') {
          await this.store.deleteWorktree(rep.target_id, false);
          applied.push(rep);
        } else if (rep.action === 'sync_registry') {
          const record = await this.store.getWorktree(rep.target_id);
          if (record) {
            const reg = await this.store.getRegistry();
            if (!reg.worktrees.includes(rep.target_id)) {
              reg.worktrees.push(rep.target_id);
              await this.store.saveRegistry(reg);
            }
            applied.push(rep);
          }
        } else if (rep.action === 'mark_broken') {
          const record = await this.store.getWorktree(rep.target_id);
          if (record) {
            record.lifecycle_state = 'BROKEN';
            record.status = 'broken';
            await this.store.saveWorktree(record);
            applied.push(rep);
          }
        }
      } catch {
        skipped.push(rep);
      }
    }

    return { applied, skipped };
  }
}
