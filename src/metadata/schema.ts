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

export const FleetTierSchema = z.enum(['hot', 'warm', 'cold', 'pinned']);

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
  last_accessed_at: z.string().optional(),
  created_by: z.string().optional(),
  profile: z.string().optional(),
  status: z.string(),
  lifecycle_state: LifecycleStateSchema,
  pinned: z.boolean().optional(),
  tier: FleetTierSchema.optional(),
  active_lease_id: z.string().optional(),
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

export const MatrixProbeCategorySchema = z.enum(['test', 'lint', 'benchmark', 'size', 'custom']);

export const MatrixProbeSpecSchema = z.object({
  name: z.string(),
  command: z.string(),
  category: MatrixProbeCategorySchema,
  mandatory: z.boolean().optional(),
  timeout_seconds: z.number().int().positive().optional(),
  weight: z.number().nonnegative().optional(),
  higher_is_better: z.boolean().optional(),
  metric_unit: z.string().optional(),
  metric_regex: z.string().optional(),
});

export const VariantProbeResultSchema = z.object({
  probe_name: z.string(),
  category: MatrixProbeCategorySchema,
  command: z.string(),
  passed: z.boolean(),
  exit_code: z.number().int(),
  duration_ms: z.number().nonnegative(),
  stdout: z.string(),
  stderr: z.string(),
  numeric_value: z.number().optional(),
  metric_unit: z.string().optional(),
});

export const VariantEvaluationSummarySchema = z.object({
  worktree_id: z.string(),
  variant_name: z.string(),
  probe_results: z.array(VariantProbeResultSchema),
  tests_passed: z.number().int().nonnegative(),
  tests_total: z.number().int().nonnegative(),
  lint_clean: z.boolean(),
  benchmark_latency_ms: z.number().optional(),
  benchmark_ops_sec: z.number().optional(),
  bundle_size_bytes: z.number().optional(),
  git_diff: z.object({
    files_changed: z.number().int().nonnegative(),
    insertions: z.number().int().nonnegative(),
    deletions: z.number().int().nonnegative(),
  }),
  composite_score: z.number().min(0).max(100),
  rank: z.number().int().positive(),
  compliant: z.boolean(),
});

export const MatrixScoringWeightsSchema = z.object({
  correctness: z.number(),
  performance: z.number(),
  maintainability_churn: z.number(),
  size: z.number(),
});

export const ExperimentMatrixReportSchema = z.object({
  feature_name: z.string(),
  evaluated_at: z.string(),
  probes: z.array(MatrixProbeSpecSchema),
  weights: MatrixScoringWeightsSchema,
  variants: z.array(VariantEvaluationSummarySchema),
  recommended_winner_id: z.string(),
  winning_justification: z.string(),
  baseline_comparison: z
    .object({
      base_branch: z.string(),
      metrics: z.record(z.string(), z.number()),
      deltas: z.record(
        z.string(),
        z.object({
          delta_pct: z.number(),
          improved: z.boolean(),
        })
      ),
    })
    .optional(),
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
  eval_matrix: ExperimentMatrixReportSchema.nullable().optional(),
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

export const AcceptanceCriterionSchema = z.object({
  id: z.string(),
  description: z.string(),
  completed: z.boolean(),
});

export const TaskContractSchema = z.object({
  title: z.string(),
  problem_statement: z.string(),
  scope: z.array(z.string()),
  out_of_scope: z.array(z.string()),
  acceptance_criteria: z.array(AcceptanceCriterionSchema),
  safety_invariants: z.array(z.string()),
  quality_gates_ref: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const AgentSessionStateSchema = z.enum([
  'dispatched',
  'planning',
  'working',
  'verifying',
  'fulfilled',
  'fulfillment_rejected',
  'execution_failed',
  'timed_out',
  'cancelled',
]);

export const AgentSessionRecordSchema = z.object({
  session_id: z.string(),
  worktree_id: z.string(),
  feature: z.string().optional(),
  role: z.string(),
  command: z.string(),
  state: AgentSessionStateSchema,
  started_at: z.string(),
  ended_at: z.string().optional(),
  duration_seconds: z.number().optional(),
  pid: z.number().optional(),
  exit_code: z.number().optional(),
  error: z.string().optional(),
  contract_path: z.string(),
  scorecard_path: z.string().optional(),
});

export const QualityGateCommandSchema = z.object({
  name: z.string(),
  command: z.string(),
  mandatory: z.boolean(),
  timeout_seconds: z.number().optional(),
});

export const QualityGateExecutionResultSchema = z.object({
  gate_name: z.string(),
  command: z.string(),
  passed: z.boolean(),
  exit_code: z.number(),
  duration_ms: z.number(),
  stdout: z.string(),
  stderr: z.string(),
});

export const QualityGateReportSchema = z.object({
  passed: z.boolean(),
  total_gates: z.number(),
  passed_gates: z.number(),
  failed_gates: z.number(),
  results: z.array(QualityGateExecutionResultSchema),
});

export const FulfillmentVerificationReportSchema = z.object({
  worktree_id: z.string(),
  verified_at: z.string(),
  status: z.enum(['fulfilled', 'rejected']),
  total_criteria: z.number(),
  completed_criteria: z.number(),
  unmet_criteria: z.array(AcceptanceCriterionSchema),
  quality_gates: QualityGateReportSchema,
  remediation_steps: z.array(z.string()),
});

export const ExecutionScorecardSchema = z.object({
  worktree_id: z.string(),
  feature: z.string().optional(),
  session_id: z.string(),
  agent_role: z.string(),
  generated_at: z.string(),
  duration_seconds: z.number(),
  git_diff: z.object({
    files_changed: z.number(),
    insertions: z.number(),
    deletions: z.number(),
    changed_files: z.array(z.string()),
  }),
  quality_gates: z.object({
    passed: z.boolean(),
    tests_passed: z.number().optional(),
    tests_failed: z.number().optional(),
    lint_clean: z.boolean(),
    build_clean: z.boolean(),
  }),
  fulfillment: z.object({
    status: z.enum(['fulfilled', 'rejected']),
    criteria_met: z.number(),
    total_criteria: z.number(),
  }),
});

export const FleetSyncStatusSchema = z.object({
  worktree_id: z.string(),
  branch: z.string(),
  base_branch: z.string(),
  status: z.enum([
    'SYNCED',
    'BEHIND',
    'AHEAD',
    'DIVERGED',
    'DIRTY_SKIPPED',
    'SESSION_ACTIVE_SKIPPED',
    'FAILED_CONFLICT',
    'FAILED_ERROR',
  ]),
  ahead: z.number().int().nonnegative(),
  behind: z.number().int().nonnegative(),
  dirty: z.boolean(),
  active_session_id: z.string().optional(),
  message: z.string().optional(),
  updated_at: z.string(),
});

export const FleetSyncReportSchema = z.object({
  synced_at: z.string(),
  strategy: z.enum(['rebase', 'merge', 'ff-only']),
  dry_run: z.boolean(),
  total_worktrees: z.number().int().nonnegative(),
  synced_count: z.number().int().nonnegative(),
  skipped_count: z.number().int().nonnegative(),
  failed_count: z.number().int().nonnegative(),
  worktrees: z.array(FleetSyncStatusSchema),
});

export const ConflictMatrixCellSchema = z.object({
  source_id: z.string(),
  target_id: z.string(),
  source_branch: z.string(),
  target_branch: z.string(),
  severity: z.enum(['CLEAN', 'SHARED_FILES_CLEAN', 'CONFLICT']),
  shared_files: z.array(z.string()),
  conflicting_files: z.array(z.string()),
  conflict_details: z.array(
    z.object({
      file_path: z.string(),
      source_lines: z.string().optional(),
      target_lines: z.string().optional(),
      conflict_type: z.enum(['content', 'modify/delete', 'rename/rename']),
    })
  ),
  auto_mergeable: z.boolean(),
});

export const FleetConflictMatrixReportSchema = z.object({
  analyzed_at: z.string(),
  total_worktrees: z.number().int().nonnegative(),
  worktree_ids: z.array(z.string()),
  conflict_hazard_count: z.number().int().nonnegative(),
  shared_file_pair_count: z.number().int().nonnegative(),
  matrix: z.array(z.array(ConflictMatrixCellSchema)),
  high_risk_pairs: z.array(
    z.object({
      source_id: z.string(),
      target_id: z.string(),
      conflicting_files: z.array(z.string()),
    })
  ),
});

export const WorkspaceLeaseSchema = z.object({
  lease_id: z.string(),
  worktree_id: z.string(),
  holder: z.string(),
  purpose: z.string(),
  acquired_at: z.string(),
  expires_at: z.string(),
  ttl_seconds: z.number().int().positive(),
  status: z.enum(['active', 'expired', 'released']),
  renew_count: z.number().int().nonnegative().default(0),
});

export const FleetCapacityReportSchema = z.object({
  analyzed_at: z.string(),
  max_capacity: z.number().int().nonnegative(),
  total_worktrees: z.number().int().nonnegative(),
  active_mounted_count: z.number().int().nonnegative(),
  hot_count: z.number().int().nonnegative(),
  warm_count: z.number().int().nonnegative(),
  cold_count: z.number().int().nonnegative(),
  pinned_count: z.number().int().nonnegative(),
  active_leases: z.array(WorkspaceLeaseSchema),
  archive_candidates: z.array(
    z.object({
      id: z.string(),
      branch: z.string(),
      tier: FleetTierSchema,
      idle_hours: z.number(),
      reason: z.string(),
    })
  ),
  total_disk_bytes: z.number().int().nonnegative(),
});

export const AutoArchiveReportSchema = z.object({
  timestamp: z.string(),
  dry_run: z.boolean(),
  total_evaluated: z.number().int().nonnegative(),
  archived_count: z.number().int().nonnegative(),
  skipped_count: z.number().int().nonnegative(),
  archived_worktrees: z.array(
    z.object({
      id: z.string(),
      branch: z.string(),
      reason: z.string(),
    })
  ),
  skipped_worktrees: z.array(
    z.object({
      id: z.string(),
      reason: z.string(),
    })
  ),
});






