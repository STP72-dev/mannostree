import { z } from 'zod';

export const TaskMetadataSchema = z.object({
  source_type: z.enum(['issue', 'file', 'manual']).optional(),
  issue_number: z.number().optional(),
  issue_title: z.string().optional(),
  task_contract_file: z.string().optional(),
  implementation_plan_file: z.string().optional(),
});

export const ArtifactsMetadataSchema = z.object({
  artifact_root: z.string(),
  results_file: z.string().optional(),
  quality_gates_file: z.string().optional(),
  review_file: z.string().optional(),
  comparison_file: z.string().nullable().optional(),
  pr_body_file: z.string().nullable().optional(),
});

export const SetupMetadataSchema = z.object({
  setup_mode: z.string().optional(),
  env_mode: z.enum(['copy', 'link', 'skip', 'generate']).optional(),
  install_ran: z.boolean().optional(),
  install_succeeded: z.boolean().optional(),
  setup_commands: z.array(z.string()).optional(),
});

export const GitStateMetadataSchema = z.object({
  head_commit: z.string().optional(),
  head_commit_message: z.string().optional(),
  dirty: z.boolean().optional(),
  ahead_count: z.number().optional(),
  behind_count: z.number().optional(),
  has_untracked_files: z.boolean().optional(),
  has_conflicts: z.boolean().optional(),
});

export const ValidationCommandResultSchema = z.object({
  command: z.string(),
  status: z.enum(['passed', 'failed', 'skipped']),
  exit_code: z.number().optional(),
});

export const ValidationMetadataSchema = z.object({
  status: z.enum(['pending', 'passed', 'failed']),
  last_run_at: z.string().optional(),
  commands: z.array(ValidationCommandResultSchema).optional(),
});

export const ReviewMetadataSchema = z.object({
  status: z.enum(['pending', 'passed', 'passed_with_suggestions', 'failed']),
  critical_count: z.number().optional(),
  suggestion_count: z.number().optional(),
  last_reviewed_at: z.string().optional(),
});

export const PublishMetadataSchema = z.object({
  pushed: z.boolean().default(false),
  pr_number: z.number().nullable().optional(),
  pr_url: z.string().nullable().optional(),
  published_at: z.string().nullable().optional(),
});

export const ParallelMetadataSchema = z.object({
  experiment_name: z.string(),
  winner: z.boolean().default(false),
  selected: z.boolean().default(false),
});

export const SummaryMetadataSchema = z.object({
  files_changed: z.number().optional(),
  lines_added: z.number().optional(),
  lines_removed: z.number().optional(),
  validation_status: z.string().optional(),
  review_status: z.string().optional(),
});

export const HealthMetadataSchema = z.object({
  exists_on_disk: z.boolean(),
  branch_exists: z.boolean(),
  metadata_consistent: z.boolean(),
  last_health_check_at: z.string(),
  health_status: z.enum(['ok', 'degraded', 'broken']),
});

export const LifecycleStateSchema = z.enum([
  'NEW',
  'TASK_RESOLVED',
  'WORKTREE_READY',
  'CONTEXT_PACKED',
  'PLAN_READY',
  'IMPLEMENTED',
  'VERIFIED',
  'REVIEWED',
  'PR_OPEN',
  'WAITING_USER_APPROVAL',
  'CLEANED',
  'BROKEN',
]);

export const WorktreeRecordSchema = z.object({
  version: z.number().default(1),
  id: z.string(),
  kind: z.string().optional(),
  feature_name: z.string().optional(),
  variant: z.string().optional(),
  repo_root: z.string(),
  worktree_path: z.string(),
  metadata_path: z.string().optional(),
  branch: z.string(),
  base_branch: z.string(),
  branch_type: z.string().optional(),
  created_at: z.string(),
  updated_at: z.string(),
  last_activity_at: z.string().optional(),
  created_by: z.string().optional(),
  profile: z.string().optional(),
  status: z.string(),
  lifecycle_state: LifecycleStateSchema,
  task: TaskMetadataSchema.optional(),
  artifacts: ArtifactsMetadataSchema.optional(),
  setup: SetupMetadataSchema.optional(),
  git_state: GitStateMetadataSchema.optional(),
  validation: ValidationMetadataSchema.optional(),
  review: ReviewMetadataSchema.optional(),
  publish: PublishMetadataSchema.optional(),
  parallel: ParallelMetadataSchema.optional(),
  summary: SummaryMetadataSchema.optional(),
  health: HealthMetadataSchema.optional(),
  tags: z.array(z.string()).optional(),
});

export const RegistryRecordSchema = z.object({
  version: z.number().default(1),
  repo_root: z.string(),
  default_base_branch: z.string(),
  worktree_root: z.string(),
  metadata_root: z.string(),
  artifact_dir_name: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  worktrees: z.array(z.string()).default([]),
  experiments: z.array(z.string()).default([]),
});

export const ExperimentRecordSchema = z.object({
  version: z.number().default(1),
  feature: z.string(),
  base_branch: z.string(),
  profile: z.string().default('default'),
  created_at: z.string(),
  updated_at: z.string(),
  variants: z.array(z.string()),
  winner: z.string().nullable().optional(),
  selected_at: z.string().nullable().optional(),
  selection_reason: z.string().nullable().optional(),
  status: z.enum(['active', 'completed', 'cleaned']).default('active'),
  plan_mode: z.enum(['shared', 'isolated']).default('shared'),
});

export const TransactionIntentSchema = z.object({
  file_path: z.string(),
  action: z.enum(['create', 'update', 'delete']),
  previous_snapshot: z.string().optional(),
  next_snapshot: z.string().optional(),
});

export const TransactionJournalEntrySchema = z.object({
  transaction_id: z.string(),
  operation: z.enum(['spawn', 'drop', 'pick', 'archive', 'restore', 'recover', 'parallel_spawn', 'parallel_drop']),
  entity_type: z.enum(['worktree', 'experiment', 'registry']),
  entity_id: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  state: z.enum(['in_flight', 'committed', 'rolled_back', 'failed']),
  intents: z.array(TransactionIntentSchema),
  error: z
    .object({
      code: z.string(),
      message: z.string(),
      stack: z.string().optional(),
    })
    .optional(),
});

export const HealthCheckResultSchema = z.object({
  check_id: z.enum([
    'worktree_dir_exists',
    'git_worktree_registered',
    'git_branch_exists',
    'metadata_record_valid',
    'clean_git_status',
  ]),
  passed: z.boolean(),
  severity: z.enum(['critical', 'warning', 'info']),
  message: z.string(),
  remediation: z.string().optional(),
});

export const HealthDiagnosticSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'broken']),
  last_verified_at: z.string(),
  checks: z.array(HealthCheckResultSchema),
  recommended_actions: z.array(z.string()),
});

export const VariantDropOutcomeSchema = z.object({
  variant_id: z.string(),
  worktree_path: z.string(),
  branch: z.string(),
  status: z.enum(['dropped', 'failed', 'preserved_winner', 'preserved_dirty']),
  error: z.string().optional(),
  remediation: z.string().optional(),
});

export const DropStatusReportSchema = z.object({
  feature: z.string(),
  experiment_id: z.string(),
  timestamp: z.string(),
  dry_run: z.boolean(),
  total_variants: z.number(),
  dropped_count: z.number(),
  surviving_count: z.number(),
  experiment_record_retained: z.boolean(),
  variants: z.array(VariantDropOutcomeSchema),
  next_steps: z.array(z.string()),
});

export const ArchiveRecordSchema = z.object({
  entity_id: z.string(),
  entity_type: z.enum(['worktree', 'experiment']),
  archived_at: z.string(),
  base_branch: z.string(),
  head_sha: z.string(),
  original_worktree_path: z.string(),
  branch_name: z.string(),
  metadata_snapshot_path: z.string(),
  artifacts: z.array(z.string()),
});

export const VariantComparisonSummarySchema = z.object({
  variant_id: z.string(),
  branch: z.string(),
  ahead: z.number(),
  behind: z.number(),
  files_changed: z.number(),
  insertions: z.number(),
  deletions: z.number(),
  score: z.number().optional(),
});

export const ParallelHandoffPackageSchema = z.object({
  handoff_id: z.string(),
  feature: z.string(),
  base_branch: z.string(),
  created_at: z.string(),
  winner: z.object({
    variant_id: z.string(),
    branch: z.string(),
    head_sha: z.string(),
    selection_rationale: z.string(),
  }),
  comparison_scorecard: z.array(VariantComparisonSummarySchema),
  preserved_losers: z.array(
    z.object({
      variant_id: z.string(),
      branch: z.string(),
      head_sha: z.string(),
      archived_or_active: z.enum(['active', 'archived']),
    })
  ),
  pr_summary_markdown: z.string(),
  artifact_path: z.string(),
});

