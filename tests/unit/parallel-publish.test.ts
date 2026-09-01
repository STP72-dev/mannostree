import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { MetadataStore } from '../../src/metadata/store.js';
import { GitEngine } from '../../src/git/engine.js';
import { PublishEngine } from '../../src/core/publish.js';
import { ParallelEngine } from '../../src/core/parallel.js';
import { ExperimentRecord, WorktreeRecord, ExperimentMatrixReport } from '../../src/types/index.js';

describe('Movement 5: Parallel Winner Publishing & Benchmark Matrix Embedding', () => {
  let tmpDir: string;
  let store: MetadataStore;
  let git: GitEngine;
  let publishEngine: PublishEngine;
  let parallelEngine: ParallelEngine;

  const sampleConfig: any = {
    version: 1,
    default_base_branch: 'main',
    worktree_root: '.worktrees',
    metadata_root: '.mannostree',
    artifact_dir_name: '.task',
    journal_dir_name: 'journal',
    archive_dir_name: 'archives',
    sessions_dir_name: 'sessions',
    leases_dir_name: 'leases',
    releases_dir_name: 'releases',
    publish: {
      default_remote: 'origin',
      default_draft: true,
      push_on_pr_create: false,
      pr_body_source: 'artifacts',
    },
    parallel: {
      max_variants: 5,
      require_shared_base: true,
      require_same_profile: true,
      default_plan_mode: 'shared',
    },
  };

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mannostree-parallel-pub-'));
    fs.mkdirSync(path.join(tmpDir, '.mannostree'), { recursive: true });

    store = new MetadataStore(tmpDir, sampleConfig);
    git = new GitEngine();
    publishEngine = new PublishEngine(tmpDir, sampleConfig, git, async () => {
      return { stdout: 'https://github.com/org/repo/pull/101', stderr: '' };
    });

    parallelEngine = new ParallelEngine(
      tmpDir,
      sampleConfig,
      git,
      store,
      async () => ({ result: {} }),
      async () => ({})
    );
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('rejects publishing when no winner has been selected', async () => {
    const experiment: ExperimentRecord = {
      version: 1,
      feature: 'auth-jwt',
      base_branch: 'main',
      profile: 'default',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      variants: ['experiment-auth-jwt-v1', 'experiment-auth-jwt-v2'],
      winner: null,
      selected_at: null,
      selection_reason: null,
      status: 'active',
      plan_mode: 'shared',
    };
    await store.saveExperiment(experiment);

    await expect(
      parallelEngine.publishWinner(
        { featureName: 'auth-jwt', preview: true },
        publishEngine
      )
    ).rejects.toThrow(/No winning variant has been selected/);
  });

  it('assembles rich PR body embedding multi-variant benchmark scorecard and task artifacts', async () => {
    const winnerWorktreePath = path.join(tmpDir, '.worktrees', 'auth-jwt-v2');
    const artifactDir = path.join(winnerWorktreePath, '.task');
    fs.mkdirSync(artifactDir, { recursive: true });

    fs.writeFileSync(
      path.join(artifactDir, 'task-contract.md'),
      '# Task Contract: JWT Auth\n- [x] Implement token issuance\n- [x] Add refresh endpoint'
    );
    fs.writeFileSync(
      path.join(winnerWorktreePath, 'RESULTS.md'),
      '# Results\nAll endpoints operational and benchmarked.'
    );

    const winnerRecord: WorktreeRecord = {
      id: 'experiment-auth-jwt-v2',
      repo_root: tmpDir,
      branch: 'experiment/auth-jwt-v2',
      base_branch: 'main',
      worktree_path: winnerWorktreePath,
      kind: 'experiment',
      status: 'active',
      lifecycle_state: 'VERIFIED',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      feature_name: 'auth-jwt',
      variant: 'v2',
      parallel: {
        experiment_name: 'auth-jwt',
        winner: true,
        selected: true,
      },
    };
    await store.saveWorktree(winnerRecord);

    const loserRecord: WorktreeRecord = {
      id: 'experiment-auth-jwt-v1',
      repo_root: tmpDir,
      branch: 'experiment/auth-jwt-v1',
      base_branch: 'main',
      worktree_path: path.join(tmpDir, '.worktrees', 'auth-jwt-v1'),
      kind: 'experiment',
      status: 'active',
      lifecycle_state: 'IMPLEMENTED',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      feature_name: 'auth-jwt',
      variant: 'v1',
      parallel: {
        experiment_name: 'auth-jwt',
        winner: false,
        selected: false,
      },
    };
    await store.saveWorktree(loserRecord);

    const evalReport: ExperimentMatrixReport = {
      feature_name: 'auth-jwt',
      evaluated_at: new Date().toISOString(),
      probes: [
        { name: 'unit_tests', command: 'npm test', category: 'test' },
        { name: 'benchmark', command: 'npm run bench', category: 'benchmark' },
      ],
      weights: { correctness: 0.4, performance: 0.3, maintainability_churn: 0.2, size: 0.1 },
      variants: [
        {
          worktree_id: 'experiment-auth-jwt-v2',
          variant_name: 'v2',
          probe_results: [],
          tests_passed: 12,
          tests_total: 12,
          lint_clean: true,
          benchmark_ops_sec: 45000,
          git_diff: { files_changed: 4, insertions: 120, deletions: 15 },
          composite_score: 94.5,
          rank: 1,
          compliant: true,
        },
        {
          worktree_id: 'experiment-auth-jwt-v1',
          variant_name: 'v1',
          probe_results: [],
          tests_passed: 10,
          tests_total: 12,
          lint_clean: true,
          benchmark_ops_sec: 32000,
          git_diff: { files_changed: 6, insertions: 200, deletions: 40 },
          composite_score: 78.0,
          rank: 2,
          compliant: false,
        },
      ],
      recommended_winner_id: 'experiment-auth-jwt-v2',
      winning_justification: 'Higher benchmark ops/sec (45,000) and 100% tests passed.',
    };

    const experiment: ExperimentRecord = {
      version: 1,
      feature: 'auth-jwt',
      base_branch: 'main',
      profile: 'default',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      variants: ['experiment-auth-jwt-v1', 'experiment-auth-jwt-v2'],
      winner: 'experiment-auth-jwt-v2',
      selected_at: new Date().toISOString(),
      selection_reason: 'Optimal performance and lowest blast radius',
      status: 'completed',
      plan_mode: 'shared',
      eval_matrix: evalReport,
    };
    await store.saveExperiment(experiment);

    const result = await parallelEngine.publishWinner(
      { featureName: 'auth-jwt', preview: true },
      publishEngine
    );

    expect(result.feature_name).toBe('auth-jwt');
    expect(result.winner_variant).toBe('experiment-auth-jwt-v2');
    expect(result.comparison_embedded).toBe(true);
    expect(result.pr_body).toContain('# Pull Request: auth-jwt (Winner: v2)');
    expect(result.pr_body).toContain('94.5');
    expect(result.pr_body).toContain('78.0');
    expect(result.pr_body).toContain('experiment/auth-jwt-v1');
    expect(result.pr_body).toContain('Implement token issuance');
  });
});
