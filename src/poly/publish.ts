import fs from 'node:fs';
import path from 'node:path';
import { MetadataStore } from '../metadata/store.js';
import { GitEngine } from '../git/engine.js';
import { MannostreeConfig } from '../config/schema.js';
import { loadPolyManifest } from './manifest.js';
import {
  ExitCode,
  MannostreeError,
  PolyPrOptions,
  PolyReleaseManifest,
  HostPublishResult,
} from '../types/index.js';
import {
  createDefaultAdapterRegistry,
  AdapterRegistry,
} from '../adapters/index.js';

export class PolyPublishEngine {
  private config: MannostreeConfig;
  private store: MetadataStore;
  private git: GitEngine;
  private adapterRegistry: AdapterRegistry;

  constructor(
    config: MannostreeConfig,
    store: MetadataStore,
    git?: GitEngine,
    adapterRegistry?: AdapterRegistry
  ) {
    this.config = config;
    this.store = store;
    this.git = git || new GitEngine();
    this.adapterRegistry = adapterRegistry || createDefaultAdapterRegistry();
  }

  public async publishPolyPR(options: PolyPrOptions): Promise<PolyReleaseManifest> {
    const { feature, manifest: manifestPath, title, draft = true, push = false, remote = 'origin', dryRun } = options;

    if (!feature) {
      throw new MannostreeError('Feature name is required for poly pr publish.', ExitCode.USAGE_ERROR);
    }

    const { manifest, manifestDir } = loadPolyManifest(manifestPath);
    const group = await this.store.getPolyGroup(feature);

    const memberPRs: Array<{
      repo_name: string;
      repo_path: string;
      worktree_path: string;
      branch: string;
      base_branch: string;
      head_sha: string;
      pr_number?: number | null;
      pr_url?: string | null;
    }> = [];

    // 1. Gather member worktree information
    for (const [name, memberConfig] of Object.entries(manifest.repos)) {
      const absRepoPath = path.resolve(manifestDir, memberConfig.path);
      const wtPath =
        group?.members[name]?.worktree_path ||
        path.join(absRepoPath, this.config.worktree_root || '.worktrees', feature);
      const branchName = group?.members[name]?.branch || feature;
      const baseBranch =
        group?.members[name]?.base_branch ||
        memberConfig.default_base_branch ||
        this.config.default_base_branch ||
        'main';

      if (!fs.existsSync(wtPath)) {
        throw new MannostreeError(
          `Cannot publish poly PR: worktree directory for '${name}' not found at '${wtPath}'.`,
          ExitCode.USAGE_ERROR
        );
      }

      const memberGit = new GitEngine(absRepoPath);
      const headSha = (await memberGit.getHeadCommit(wtPath)) || 'unknown';

      memberPRs.push({
        repo_name: name,
        repo_path: absRepoPath,
        worktree_path: wtPath,
        branch: branchName,
        base_branch: baseBranch,
        head_sha: headSha,
      });
    }

    // 2. Build Joint Release Table
    let tableMarkdown = `### 🌐 Coordinated Poly-Repository Feature: \`${feature}\`\n\n`;
    tableMarkdown += `| Repository | Branch | Base Branch | Commit SHA |\n`;
    tableMarkdown += `|---|---|---|---|\n`;
    for (const m of memberPRs) {
      tableMarkdown += `| **${m.repo_name}** | \`${m.branch}\` | \`${m.base_branch}\` | \`${m.head_sha.substring(0, 8)}\` |\n`;
    }
    tableMarkdown += `\n*Co-published via Mannostree Poly-Worktree Orchestrator at ${new Date().toISOString()}*\n`;

    if (dryRun) {
      return {
        version: 1,
        feature,
        published_at: new Date().toISOString(),
        members: memberPRs.map((m) => ({
          repo_name: m.repo_name,
          branch: m.branch,
          base_branch: m.base_branch,
          pr_number: null,
          pr_url: `https://example.com/dry-run/${m.repo_name}/pull/1`,
          head_sha: m.head_sha,
        })),
        joint_release_table_markdown: tableMarkdown,
      };
    }

    // 3. Push and publish PRs for each member repository
    for (const member of memberPRs) {
      const memberGit = new GitEngine(member.repo_path);
      if (push) {
        try {
          await memberGit.exec(['push', '-u', remote, member.branch], member.worktree_path);
        } catch (err: any) {
          throw new MannostreeError(
            `Failed to push branch '${member.branch}' in member repository '${member.repo_name}': ${err.message}`,
            ExitCode.GIT_ERROR
          );
        }
      }

      try {
        let remoteUrl = '';
        try {
          const res = await memberGit.exec(['remote', 'get-url', remote], member.worktree_path);
          remoteUrl = res.stdout.trim();
        } catch {
          remoteUrl = '';
        }

        if (remoteUrl) {
          const { adapter, hostInfo } = this.adapterRegistry.resolveAdapterForRemote(
            remoteUrl,
            undefined,
            this.config.publish?.hosts
          );

          if (adapter) {
            const prTitle = title || `feat(${feature}): coordinated poly-release for ${member.repo_name}`;
            const prBody = `${tableMarkdown}\n\n#### Changes in ${member.repo_name}\nThis pull request is part of the coordinated multi-repository feature **${feature}**.\n`;

            const result: HostPublishResult = await adapter.createPullRequest(member.worktree_path, hostInfo, {
              title: prTitle,
              body: prBody,
              source_branch: member.branch,
              target_base: member.base_branch,
              draft,
              push: push && !dryRun,
              dryRun,
            });

            member.pr_number = result.pr_number;
            member.pr_url = result.pr_url;
          }
        }
      } catch {
        // Continue publishing sibling PRs even if one host adapter call is in prepare-only mode
      }
    }

    const releaseManifest: PolyReleaseManifest = {
      version: 1,
      feature,
      published_at: new Date().toISOString(),
      members: memberPRs.map((m) => ({
        repo_name: m.repo_name,
        branch: m.branch,
        base_branch: m.base_branch,
        pr_number: m.pr_number || null,
        pr_url: m.pr_url || null,
        head_sha: m.head_sha,
      })),
      joint_release_table_markdown: tableMarkdown,
    };

    await this.store.savePolyReleaseManifest(releaseManifest);
    return releaseManifest;
  }
}
