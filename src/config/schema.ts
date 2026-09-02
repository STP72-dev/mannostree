import { z } from 'zod';

export const ProfileConfigSchema = z.object({
  install_commands: z.array(z.string()).default([]),
  env_mode: z.enum(['copy', 'link', 'skip', 'generate']).default('skip'),
  env_files: z.array(z.string()).default([]),
  env_vars: z.record(z.string()).default({}),
  generate_command: z.string().optional(),
  validation_commands: z.array(z.string()).default([]),
});

export const BaseBranchResolutionSchema = z.object({
  order: z.array(z.enum(['cli', 'profile', 'config', 'repo', 'remote'])).default([
    'cli',
    'profile',
    'config',
    'repo',
    'remote',
  ]),
  forbid_current_branch_as_base: z.boolean().default(true),
});

export const CleanupConfigSchema = z.object({
  default_dry_run: z.boolean().default(true),
  stale_days: z.number().default(30),
  protect_winner: z.boolean().default(true),
  archive_on_drop: z.boolean().default(true),
});

export const ParallelEvalMatrixProbeConfigSchema = z.object({
  name: z.string(),
  command: z.string(),
  category: z.enum(['test', 'lint', 'benchmark', 'size', 'custom']).default('custom'),
  mandatory: z.boolean().default(false),
  timeout_seconds: z.number().default(120),
  weight: z.number().default(1.0),
  higher_is_better: z.boolean().default(false),
  metric_unit: z.string().optional(),
  metric_regex: z.string().optional(),
});

export const ParallelScoringWeightsConfigSchema = z.object({
  correctness: z.number().default(0.4),
  performance: z.number().default(0.3),
  maintainability_churn: z.number().default(0.2),
  size: z.number().default(0.1),
});

export const ParallelConfigSchema = z.object({
  max_variants: z.number().default(5),
  require_shared_base: z.boolean().default(true),
  require_same_profile: z.boolean().default(true),
  default_plan_mode: z.string().default('shared'),
  eval_matrix: z.array(ParallelEvalMatrixProbeConfigSchema).default([]),
  scoring_weights: ParallelScoringWeightsConfigSchema.default({
    correctness: 0.4,
    performance: 0.3,
    maintainability_churn: 0.2,
    size: 0.1,
  }),
});


export const HostConfigEntrySchema = z.object({
  domain: z.string().optional(),
  type: z.enum(['github', 'gitlab', 'gitea', 'bitbucket', 'generic']).optional(),
  base_url: z.string().url().optional(),
  token_env: z.string().optional(),
  username_env: z.string().optional(),
  default_draft: z.boolean().optional(),
});

export const PublishConfigSchema = z.object({
  default_remote: z.string().default('origin'),
  default_host: z.enum(['auto', 'github', 'gitlab', 'gitea', 'bitbucket', 'generic']).default('auto'),
  default_draft: z.boolean().default(true),
  push_on_pr_create: z.boolean().default(false),
  pr_body_source: z.enum(['artifacts', 'manual']).default('artifacts'),
  hosts: z.record(HostConfigEntrySchema).optional(),
});

export const IntegrationsConfigSchema = z.object({
  github: z
    .object({
      enabled: z.boolean().default(false),
      cli: z.string().default('gh'),
      project_board: z.string().nullable().default(null),
      label_on_open: z.array(z.string()).default(['mannostree']),
    })
    .optional(),
});

export const AgentConfigSchema = z.object({
  default_command: z.string().default(''),
  timeout_seconds: z.number().default(1800),
  env_passthrough: z.array(z.string()).default([]),
  roles: z.record(z.string()).default({
    planner: 'Analyze task contract and draft implementation plan in .task/plan.md',
    worker: 'Implement changes to satisfy all acceptance criteria in .task/task-contract.md',
    verifier: 'Run quality gates and verify checklist completion in .task/task-contract.md',
  }),
});

export const FleetPolicyConfigSchema = z.object({
  max_active_worktrees: z.number().default(10),
  idle_ttl_hours: z.number().default(48),
  auto_archive_idle: z.boolean().default(true),
  auto_archive_completed: z.boolean().default(false),
  default_lease_ttl_minutes: z.number().default(60),
  hot_threshold_hours: z.number().default(4),
  archive_dirty_policy: z.enum(['refuse', 'stash']).default('refuse'),
});

export const FleetConfigSchema = z.object({
  default_sync_strategy: z.enum(['rebase', 'merge', 'ff-only']).default('ff-only'),
  guard_dirty_worktrees: z.boolean().default(true),
  guard_active_sessions: z.boolean().default(true),
  auto_simulate_merge: z.boolean().default(true),
  policy: FleetPolicyConfigSchema.default({}),
});

export const SandboxResourceLimitsConfigSchema = z.object({
  cpus: z.number().positive().optional(),
  memory: z.string().optional(),
  disk_quota: z.string().optional(),
  timeout_seconds: z.number().int().positive().optional(),
});

export const SandboxConfigSchema = z.object({
  default_runtime: z.enum(['docker', 'podman', 'process']).default('process'),
  default_image: z.string().default('node:20-alpine'),
  default_network: z.enum(['none', 'bridge', 'host', 'egress-only']).default('bridge'),
  limits: SandboxResourceLimitsConfigSchema.default({}),
  workdir: z.string().default('/workspace'),
  auto_remove: z.boolean().default(true),
  user_namespace: z.boolean().default(true),
});

export const PolyLinkStrategySchema = z.enum(['npm', 'python', 'go', 'cargo', 'symlink']);

export const PolyLinkRuleConfigSchema = z.object({
  source_repo: z.string(),
  target_repo: z.string(),
  strategy: PolyLinkStrategySchema.default('symlink'),
  package_name: z.string().optional(),
  target_subpath: z.string().optional(),
});

export const PolyRepoMemberConfigSchema = z.object({
  path: z.string(),
  default_base_branch: z.string().optional(),
  role: z.enum(['backend', 'frontend', 'lib', 'infra', 'custom']).default('custom'),
  profile: z.string().optional(),
  depends_on: z.array(z.string()).default([]),
});

export const PolyManifestConfigSchema = z.object({
  version: z.number().default(1),
  name: z.string(),
  repos: z.record(z.string(), PolyRepoMemberConfigSchema),
  links: z.array(PolyLinkRuleConfigSchema).default([]),
});

export const PolyConfigSchema = z.object({
  default_manifest: z.string().default('.mannostree.poly.yml'),
  auto_link_on_spawn: z.boolean().default(true),
  unlink_on_drop: z.boolean().default(true),
});

export const MannostreeConfigSchema = z.object({
  version: z.number().default(1),
  default_base_branch: z.string().default('main'),
  worktree_root: z.string().default('.worktrees'),
  metadata_root: z.string().default('.mannostree'),
  artifact_dir_name: z.string().default('.task'),
  journal_dir_name: z.string().default('journal'),
  archive_dir_name: z.string().default('archives'),
  sessions_dir_name: z.string().default('sessions'),
  leases_dir_name: z.string().default('leases'),
  releases_dir_name: z.string().default('releases'),
  base_branch_resolution: BaseBranchResolutionSchema.default({}),
  profiles: z.record(ProfileConfigSchema).default({
    default: {
      install_commands: [],
      env_mode: 'skip',
      env_files: [],
      validation_commands: [],
    },
  }),
  cleanup: CleanupConfigSchema.default({}),
  parallel: ParallelConfigSchema.default({}),
  publish: PublishConfigSchema.default({}),
  agent: AgentConfigSchema.default({}),
  fleet: FleetConfigSchema.default({}),
  sandbox: SandboxConfigSchema.default({}),
  poly: PolyConfigSchema.default({}),
  issues: z
    .object({
      default_provider: z.enum(['jira', 'linear', 'github', 'generic']).default('jira'),
      auto_transition: z.boolean().default(true),
      transitions: z
        .object({
          on_spawn: z.string().default('In Progress'),
          on_pr: z.string().default('In Review'),
          on_archive: z.string().default('Done'),
          on_drop: z.string().default('Cancelled'),
        })
        .default({}),
      jira: z
        .object({
          host: z.string().optional(),
          project_key: z.string().optional(),
          api_version: z.string().default('3'),
        })
        .optional(),
      linear: z
        .object({
          team_key: z.string().optional(),
        })
        .optional(),
      github: z
        .object({
          owner: z.string().optional(),
          repo: z.string().optional(),
        })
        .optional(),
      generic: z
        .object({
          webhook_url: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
  integrations: IntegrationsConfigSchema.optional(),
  tags: z
    .object({
      defaults: z.array(z.string()).default([]),
    })
    .optional(),
});

export const IssueTrackerConfigSchema = z.object({
  default_provider: z.enum(['jira', 'linear', 'github', 'generic']).default('jira'),
  auto_transition: z.boolean().default(true),
  transitions: z
    .object({
      on_spawn: z.string().default('In Progress'),
      on_pr: z.string().default('In Review'),
      on_archive: z.string().default('Done'),
      on_drop: z.string().default('Cancelled'),
    })
    .default({}),
  jira: z
    .object({
      host: z.string().optional(),
      project_key: z.string().optional(),
      api_version: z.string().default('3'),
    })
    .optional(),
  linear: z
    .object({
      team_key: z.string().optional(),
    })
    .optional(),
  github: z
    .object({
      owner: z.string().optional(),
      repo: z.string().optional(),
    })
    .optional(),
  generic: z
    .object({
      webhook_url: z.string().optional(),
    })
    .optional(),
});

export type MannostreeConfig = z.infer<typeof MannostreeConfigSchema>;
export type ProfileConfig = z.infer<typeof ProfileConfigSchema>;
export type AgentConfig = z.infer<typeof AgentConfigSchema>;
export type FleetConfig = z.infer<typeof FleetConfigSchema>;
export type FleetPolicyConfig = z.infer<typeof FleetPolicyConfigSchema>;
export type SandboxConfig = z.infer<typeof SandboxConfigSchema>;
export type SandboxResourceLimitsConfig = z.infer<typeof SandboxResourceLimitsConfigSchema>;
export type PolyConfig = z.infer<typeof PolyConfigSchema>;
export type IssueTrackerConfig = z.infer<typeof IssueTrackerConfigSchema>;





