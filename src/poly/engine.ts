import fs from 'node:fs';
import path from 'node:path';
import { GitEngine } from '../git/engine.js';
import { MetadataStore } from '../metadata/store.js';
import { MannostreeConfig } from '../config/schema.js';
import { loadPolyManifest } from './manifest.js';
import {
  ExitCode,
  MannostreeError,
  PolySpawnOptions,
  PolyDropOptions,
  PolyLinkOptions,
  PolySyncOptions,
  PolyStatusOptions,
  PolyStatusSummary,
  PolyMemberStatusSummary,
  PolyExecOptions,
  PolyWorktreeGroupRecord,
  PolyWorktreeMemberInstance,
  PolyLinkRecord,
} from '../types/index.js';
import { PolyLinkEngine } from './link.js';
import { SandboxRegistry, createDefaultSandboxRegistry } from '../sandbox/index.js';

export class PolyEngine {
  private config: MannostreeConfig;
  private store: MetadataStore;
  private git: GitEngine;
  private linkEngine: PolyLinkEngine;
  private sandboxRegistry: SandboxRegistry;

  constructor(
    config: MannostreeConfig,
    store: MetadataStore,
    git?: GitEngine,
    linkEngine?: PolyLinkEngine,
    sandboxRegistry?: SandboxRegistry
  ) {
    this.config = config;
    this.store = store;
    this.git = git || new GitEngine();
    this.linkEngine = linkEngine || new PolyLinkEngine(store);
    this.sandboxRegistry = sandboxRegistry || createDefaultSandboxRegistry();
  }

  /**
   * Resolves manifest and validates member repository paths.
   */
  public resolveClusterContext(customManifestPath?: string, cwd: string = process.cwd()) {
    const { manifest, manifestPath, manifestDir } = loadPolyManifest(customManifestPath, cwd);

    const resolvedRepos: Record<
      string,
      {
        name: string;
        path: string;
        defaultBaseBranch: string;
        role: string;
        profile?: string;
        dependsOn: string[];
      }
    > = {};

    for (const [name, memberConfig] of Object.entries(manifest.repos)) {
      const absPath = path.resolve(manifestDir, memberConfig.path);
      if (!fs.existsSync(absPath)) {
        throw new MannostreeError(
          `Member repository '${name}' path does not exist: ${absPath}`,
          ExitCode.USAGE_ERROR
        );
      }
      resolvedRepos[name] = {
        name,
        path: absPath,
        defaultBaseBranch:
          memberConfig.default_base_branch || this.config.default_base_branch || 'main',
        role: memberConfig.role || 'custom',
        profile: memberConfig.profile,
        dependsOn: memberConfig.depends_on || [],
      };
    }

    return {
      manifest,
      manifestPath,
      manifestDir,
      resolvedRepos,
    };
  }

  /**
   * Spawns synchronized worktrees across all member repositories atomically.
   */
  public async spawn(options: PolySpawnOptions): Promise<PolyWorktreeGroupRecord> {
    const { feature, base, manifest: manifestPath, noLink, dryRun } = options;

    if (!feature || feature.trim() === '') {
      throw new MannostreeError('Feature name is required for poly spawn.', ExitCode.USAGE_ERROR);
    }

    const { manifest, manifestName, resolvedRepos } = (() => {
      const ctx = this.resolveClusterContext(manifestPath);
      return {
        manifest: ctx.manifest,
        manifestName: ctx.manifest.name,
        resolvedRepos: ctx.resolvedRepos,
      };
    })();

    // Check if poly group already exists
    const existingGroup = await this.store.getPolyGroup(feature);
    if (existingGroup && existingGroup.status === 'active') {
      throw new MannostreeError(
        `Poly worktree group for feature '${feature}' already exists in active status.`,
        ExitCode.USAGE_ERROR
      );
    }

    if (dryRun) {
      const mockMembers: Record<string, PolyWorktreeMemberInstance> = {};
      for (const [name, repo] of Object.entries(resolvedRepos)) {
        const wtPath = path.join(repo.path, this.config.worktree_root || '.worktrees', feature);
        mockMembers[name] = {
          repo_name: name,
          repo_path: repo.path,
          worktree_id: `${name}-${feature}`,
          worktree_path: wtPath,
          branch: feature,
          base_branch: base || repo.defaultBaseBranch,
          status: 'active',
        };
      }
      return {
        version: 1,
        feature,
        manifest_name: manifestName,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        members: mockMembers,
        active_links: [],
        status: 'active',
      };
    }

    const rollbackStack: Array<() => Promise<void>> = [];
    const memberInstances: Record<string, PolyWorktreeMemberInstance> = {};

    try {
      for (const [name, repo] of Object.entries(resolvedRepos)) {
        const wtRoot = path.join(repo.path, this.config.worktree_root || '.worktrees');
        const wtPath = path.join(wtRoot, feature);
        const resolvedBase = base || repo.defaultBaseBranch;

        // Ensure worktree root directory exists
        if (!fs.existsSync(wtRoot)) {
          fs.mkdirSync(wtRoot, { recursive: true });
        }

        const memberGit = new GitEngine(repo.path);

        // Spawn git worktree in target repo
        await memberGit.createBranchAndWorktree(feature, wtPath, resolvedBase);

        // Record rollback action
        rollbackStack.push(async () => {
          try {
            await memberGit.deleteWorktree(wtPath, feature, true, false);
          } catch {
            // best-effort rollback
          }
        });

        const headSha = (await memberGit.getHeadCommit(wtPath)) || 'unknown';

        memberInstances[name] = {
          repo_name: name,
          repo_path: repo.path,
          worktree_id: `${name}-${feature}`,
          worktree_path: wtPath,
          branch: feature,
          base_branch: resolvedBase,
          head_sha: headSha,
          status: 'active',
        };
      }

      // Establish package links if enabled
      let activeLinks: PolyLinkRecord[] = [];
      if (!noLink && manifest.links && manifest.links.length > 0) {
        try {
          activeLinks = await this.linkEngine.linkGroup(feature, manifest, memberInstances);
        } catch {
          // Linking error does not abort worktree creation unless critical
        }
      }

      const groupRecord: PolyWorktreeGroupRecord = {
        version: 1,
        feature,
        manifest_name: manifestName,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        members: memberInstances,
        active_links: activeLinks,
        status: 'active',
      };

      await this.store.savePolyGroup(groupRecord);
      return groupRecord;
    } catch (err: any) {
      // Execute rollback stack in reverse
      while (rollbackStack.length > 0) {
        const rollback = rollbackStack.pop();
        if (rollback) {
          await rollback();
        }
      }
      throw new MannostreeError(
        `Atomic poly-spawn failed for feature '${feature}': ${err.message}`,
        err.code || ExitCode.GIT_ERROR
      );
    }
  }

  /**
   * Safely drops worktrees across all member repositories in a poly group.
   */
  public async drop(options: PolyDropOptions): Promise<{ feature: string; dropped: string[]; kept: string[] }> {
    const { feature, manifest: manifestPath, keepBranch, discardUncommitted, yes, dryRun } = options;

    if (!feature || feature.trim() === '') {
      throw new MannostreeError('Feature name is required for poly drop.', ExitCode.USAGE_ERROR);
    }

    const group = await this.store.getPolyGroup(feature);
    const { resolvedRepos } = this.resolveClusterContext(manifestPath);

    const membersToProcess = group ? group.members : {};

    // Fallback: If not in registry, construct from resolved manifest repos
    if (Object.keys(membersToProcess).length === 0) {
      for (const [name, repo] of Object.entries(resolvedRepos)) {
        const wtPath = path.join(repo.path, this.config.worktree_root || '.worktrees', feature);
        if (fs.existsSync(wtPath)) {
          membersToProcess[name] = {
            repo_name: name,
            repo_path: repo.path,
            worktree_id: `${name}-${feature}`,
            worktree_path: wtPath,
            branch: feature,
            base_branch: repo.defaultBaseBranch,
            status: 'active',
          };
        }
      }
    }

    // Unlink active package links first so injected symlinks do not mark worktree dirty
    if (group && group.active_links && group.active_links.length > 0 && !dryRun) {
      await this.linkEngine.unlinkGroup(feature);
    }

    // Safety checks: check dirty state across members
    for (const member of Object.values(membersToProcess)) {
      if (fs.existsSync(member.worktree_path)) {
        const memberGit = new GitEngine(member.repo_path);
        const isDirty = await memberGit.isWorktreeDirty(member.worktree_path);
        if (isDirty && (!discardUncommitted || !yes)) {
          throw new MannostreeError(
            `Cannot drop poly-worktree '${feature}': member repository '${member.repo_name}' contains uncommitted changes. Require '--discard-uncommitted --yes' to force deletion.`,
            ExitCode.USAGE_ERROR
          );
        }
      }
    }

    const dropped: string[] = [];
    const kept: string[] = [];

    if (dryRun) {
      return {
        feature,
        dropped: Object.keys(membersToProcess),
        kept: [],
      };
    }

    for (const member of Object.values(membersToProcess)) {
      try {
        const memberGit = new GitEngine(member.repo_path);
        if (fs.existsSync(member.worktree_path)) {
          await memberGit.deleteWorktree(member.worktree_path, member.branch, true, keepBranch);
        }
        dropped.push(member.repo_name);
      } catch {
        kept.push(member.repo_name);
      }
    }

    await this.store.deletePolyGroup(feature);

    return {
      feature,
      dropped,
      kept,
    };
  }

  /**
   * Returns composite status for a poly group across all member repositories.
   */
  public async getStatus(options: PolyStatusOptions): Promise<PolyStatusSummary> {
    const { feature, manifest: manifestPath, fetch } = options;
    const { manifest, resolvedRepos } = this.resolveClusterContext(manifestPath);

    const targetFeature = feature || Object.keys((await this.store.getPolyRegistry()).poly_groups)[0] || 'default';
    const group = await this.store.getPolyGroup(targetFeature);

    const memberSummaries: PolyMemberStatusSummary[] = [];

    for (const [name, repo] of Object.entries(resolvedRepos)) {
      const wtPath = group?.members[name]?.worktree_path || path.join(repo.path, this.config.worktree_root || '.worktrees', targetFeature);
      const branchName = group?.members[name]?.branch || targetFeature;
      const baseBranch = group?.members[name]?.base_branch || repo.defaultBaseBranch;
      const memberGit = new GitEngine(repo.path);

      if (fs.existsSync(wtPath)) {
        if (fetch) {
          try {
            await memberGit.fetchAll(wtPath);
          } catch {
            // ignore fetch errors
          }
        }

        const dirty = await memberGit.isWorktreeDirty(wtPath);
        const aheadBehind = await memberGit.getAheadBehindCount(wtPath, baseBranch, branchName);
        const headSha = (await memberGit.getHeadCommit(wtPath)) || 'unknown';

        memberSummaries.push({
          repo_name: name,
          repo_path: repo.path,
          branch: branchName,
          base_branch: baseBranch,
          head_sha: headSha,
          ahead: aheadBehind.ahead,
          behind: aheadBehind.behind,
          dirty,
          status: dirty ? 'dirty' : aheadBehind.behind > 0 ? 'behind' : 'clean',
        });
      } else {
        memberSummaries.push({
          repo_name: name,
          repo_path: repo.path,
          branch: branchName,
          base_branch: baseBranch,
          ahead: 0,
          behind: 0,
          dirty: false,
          status: 'missing',
        });
      }
    }

    const allHealthy = memberSummaries.every((m) => m.status !== 'missing' && m.status !== 'behind');

    return {
      feature: targetFeature,
      manifest_name: manifest.name,
      members: memberSummaries,
      active_links: group?.active_links || [],
      healthy: allHealthy,
    };
  }

  /**
   * Synchronizes base branches across all member repositories in a poly group.
   */
  public async sync(options: PolySyncOptions): Promise<{ feature: string; synced: string[]; errors: Record<string, string> }> {
    const { feature, manifest: manifestPath, strategy = 'rebase', fetch = true, dryRun } = options;

    if (!feature) {
      throw new MannostreeError('Feature name is required for poly sync.', ExitCode.USAGE_ERROR);
    }

    const { resolvedRepos } = this.resolveClusterContext(manifestPath);
    const group = await this.store.getPolyGroup(feature);

    const synced: string[] = [];
    const errors: Record<string, string> = {};

    for (const [name, repo] of Object.entries(resolvedRepos)) {
      const wtPath = group?.members[name]?.worktree_path || path.join(repo.path, this.config.worktree_root || '.worktrees', feature);
      const baseBranch = group?.members[name]?.base_branch || repo.defaultBaseBranch;
      const memberGit = new GitEngine(repo.path);

      if (!fs.existsSync(wtPath)) {
        errors[name] = `Worktree path '${wtPath}' does not exist.`;
        continue;
      }

      if (dryRun) {
        synced.push(name);
        continue;
      }

      try {
        if (fetch) {
          await memberGit.fetchAll(wtPath);
        }

        await memberGit.syncWorktree(wtPath, baseBranch, strategy, false);
        synced.push(name);
      } catch (err: any) {
        errors[name] = err.message;
      }
    }

    return { feature, synced, errors };
  }

  /**
   * Executes a command across all member worktrees sequentially or in parallel.
   */
  public async exec(options: PolyExecOptions): Promise<Record<string, { stdout: string; stderr: string; exitCode: number }>> {
    const { feature, command, args = [], manifest: manifestPath, parallel, repo: targetRepo, sandbox } = options;

    const group = await this.store.getPolyGroup(feature);
    const { resolvedRepos } = this.resolveClusterContext(manifestPath);

    const targetMembers = Object.entries(resolvedRepos).filter(([name]) => !targetRepo || name === targetRepo);

    const results: Record<string, { stdout: string; stderr: string; exitCode: number }> = {};

    const executeMember = async (name: string, repo: { path: string }) => {
      const wtPath = group?.members[name]?.worktree_path || path.join(repo.path, this.config.worktree_root || '.worktrees', feature);

      if (!fs.existsSync(wtPath)) {
        results[name] = {
          stdout: '',
          stderr: `Worktree directory does not exist: ${wtPath}`,
          exitCode: 1,
        };
        return;
      }

      const driver = this.sandboxRegistry.resolveRuntime(sandbox || 'process');
      const res = await driver.execute(wtPath, {
        command,
        args,
      });

      results[name] = {
        stdout: res.stdout,
        stderr: res.stderr,
        exitCode: res.exit_code,
      };
    };

    if (parallel) {
      await Promise.all(targetMembers.map(([name, repo]) => executeMember(name, repo)));
    } else {
      for (const [name, repo] of targetMembers) {
        await executeMember(name, repo);
      }
    }

    return results;
  }
}
