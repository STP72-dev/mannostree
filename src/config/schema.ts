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


export const PublishConfigSchema = z.object({
  default_remote: z.string().default('origin'),
  default_draft: z.boolean().default(true),
  push_on_pr_create: z.boolean().default(false),
  pr_body_source: z.enum(['artifacts', 'manual']).default('artifacts'),
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

export const FleetConfigSchema = z.object({
  default_sync_strategy: z.enum(['rebase', 'merge', 'ff-only']).default('ff-only'),
  guard_dirty_worktrees: z.boolean().default(true),
  guard_active_sessions: z.boolean().default(true),
  auto_simulate_merge: z.boolean().default(true),
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
  integrations: IntegrationsConfigSchema.optional(),
  tags: z
    .object({
      defaults: z.array(z.string()).default([]),
    })
    .optional(),
});

export type MannostreeConfig = z.infer<typeof MannostreeConfigSchema>;
export type ProfileConfig = z.infer<typeof ProfileConfigSchema>;
export type AgentConfig = z.infer<typeof AgentConfigSchema>;
export type FleetConfig = z.infer<typeof FleetConfigSchema>;


