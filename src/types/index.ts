export enum ExitCode {
  SUCCESS = 0,
  GENERIC_FAILURE = 1,
  USAGE_ERROR = 2,
  VALIDATION_FAILURE = 3,
  GIT_ERROR = 4,
  SETUP_ENV_ERROR = 5,
  METADATA_INCONSISTENCY = 6,
  PUBLISH_ERROR = 7,
  USER_CANCELLED = 8,
  COMPARISON_INCOMPLETE = 10,
  RECOVERABLE_BROKEN_STATE = 20,
}

export type LifecycleState =
  | 'NEW'
  | 'TASK_RESOLVED'
  | 'WORKTREE_READY'
  | 'CONTEXT_PACKED'
  | 'PLAN_READY'
  | 'IMPLEMENTED'
  | 'VERIFIED'
  | 'REVIEWED'
  | 'PR_OPEN'
  | 'WAITING_USER_APPROVAL'
  | 'CLEANED'
  | 'BROKEN';

export type WorktreeStatus =
  | 'created'
  | 'setup_pending'
  | 'setup_complete'
  | 'dirty'
  | 'planned'
  | 'implemented'
  | 'validated'
  | 'reviewed'
  | 'ready_for_pr'
  | 'pr_open'
  | 'merged'
  | 'archived'
  | 'broken';

export interface TaskMetadata {
  source_type?: 'issue' | 'file' | 'manual';
  issue_number?: number;
  issue_title?: string;
  task_contract_file?: string;
  implementation_plan_file?: string;
}

export interface ArtifactsMetadata {
  artifact_root: string;
  results_file?: string;
  quality_gates_file?: string;
  review_file?: string;
  comparison_file?: string | null;
  pr_body_file?: string | null;
}

export interface SetupMetadata {
  setup_mode?: string;
  env_mode?: 'copy' | 'link' | 'skip' | 'generate';
  install_ran?: boolean;
  install_succeeded?: boolean;
  setup_commands?: string[];
}

export interface GitStateMetadata {
  head_commit?: string;
  head_commit_message?: string;
  dirty?: boolean;
  ahead_count?: number;
  behind_count?: number;
  has_untracked_files?: boolean;
  has_conflicts?: boolean;
}

export interface ValidationCommandResult {
  command: string;
  status: 'passed' | 'failed' | 'skipped';
  exit_code?: number;
}

export interface ValidationMetadata {
  status: 'pending' | 'passed' | 'failed';
  last_run_at?: string;
  commands?: ValidationCommandResult[];
}

export interface ReviewMetadata {
  status: 'pending' | 'passed' | 'passed_with_suggestions' | 'failed';
  critical_count?: number;
  suggestion_count?: number;
  last_reviewed_at?: string;
}

export interface PublishMetadata {
  pushed: boolean;
  pr_number?: number | null;
  pr_url?: string | null;
  published_at?: string | null;
}

export interface ParallelMetadata {
  experiment_name: string;
  winner: boolean;
  selected: boolean;
}

export interface SummaryMetadata {
  files_changed?: number;
  lines_added?: number;
  lines_removed?: number;
  validation_status?: string;
  review_status?: string;
}

export interface HealthMetadata {
  exists_on_disk: boolean;
  branch_exists: boolean;
  metadata_consistent: boolean;
  last_health_check_at: string;
  health_status: 'ok' | 'degraded' | 'broken';
}

export interface WorktreeRecord {
  version: number;
  id: string;
  kind?: string;
  feature_name?: string;
  variant?: string;
  repo_root: string;
  worktree_path: string;
  metadata_path?: string;
  branch: string;
  base_branch: string;
  branch_type?: string;
  created_at: string;
  updated_at: string;
  last_activity_at?: string;
  created_by?: string;
  profile?: string;
  status: WorktreeStatus | string;
  lifecycle_state: LifecycleState;
  task?: TaskMetadata;
  artifacts?: ArtifactsMetadata;
  setup?: SetupMetadata;
  git_state?: GitStateMetadata;
  validation?: ValidationMetadata;
  review?: ReviewMetadata;
  publish?: PublishMetadata;
  parallel?: ParallelMetadata;
  summary?: SummaryMetadata;
  health?: HealthMetadata;
  tags?: string[];
}

export interface RegistryRecord {
  version: number;
  repo_root: string;
  default_base_branch: string;
  worktree_root: string;
  metadata_root: string;
  artifact_dir_name: string;
  created_at: string;
  updated_at: string;
  worktrees: string[];
  experiments: string[];
}

export interface ExperimentRecord {
  version: number;
  feature: string;
  base_branch: string;
  profile: string;
  created_at: string;
  updated_at: string;
  variants: string[];
  winner?: string | null;
  selected_at?: string | null;
  selection_reason?: string | null;
  status: 'active' | 'completed' | 'cleaned';
  plan_mode: 'shared' | 'isolated';
  eval_matrix?: ExperimentMatrixReport | null;
}



export interface GlobalOptions {
  json?: boolean;
  yaml?: boolean;
  plain?: boolean;
  verbose?: boolean;
  quiet?: boolean;
  dryRun?: boolean;
  config?: string;
  profile?: string;
  cwd?: string;
  noColor?: boolean;
}

export interface CommandOutput<T = unknown> {
  command: string;
  ok: boolean;
  dry_run: boolean;
  result?: T;
  warnings: string[];
  errors: string[];
}

export interface TransactionIntent {
  file_path: string;
  action: 'create' | 'update' | 'delete';
  previous_snapshot?: string;
  next_snapshot?: string;
}

export interface TransactionJournalEntry {
  transaction_id: string;
  operation: 'spawn' | 'drop' | 'pick' | 'archive' | 'restore' | 'recover' | 'parallel_spawn' | 'parallel_drop';
  entity_type: 'worktree' | 'experiment' | 'registry';
  entity_id: string;
  created_at: string;
  updated_at: string;
  state: 'in_flight' | 'committed' | 'rolled_back' | 'failed';
  intents: TransactionIntent[];
  error?: {
    code: string;
    message: string;
    stack?: string;
  };
}

export type HealthStatus = 'healthy' | 'degraded' | 'broken';

export interface HealthCheckResult {
  check_id: 'worktree_dir_exists' | 'git_worktree_registered' | 'git_branch_exists' | 'metadata_record_valid' | 'clean_git_status';
  passed: boolean;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  remediation?: string;
}

export interface HealthDiagnostic {
  status: HealthStatus;
  last_verified_at: string;
  checks: HealthCheckResult[];
  recommended_actions: string[];
}

export interface VariantDropOutcome {
  variant_id: string;
  worktree_path: string;
  branch: string;
  status: 'dropped' | 'failed' | 'preserved_winner' | 'preserved_dirty';
  error?: string;
  remediation?: string;
}

export interface DropStatusReport {
  feature: string;
  experiment_id: string;
  timestamp: string;
  dry_run: boolean;
  total_variants: number;
  dropped_count: number;
  surviving_count: number;
  experiment_record_retained: boolean;
  variants: VariantDropOutcome[];
  next_steps: string[];
}

export interface ArchiveRecord {
  entity_id: string;
  entity_type: 'worktree' | 'experiment';
  archived_at: string;
  base_branch: string;
  head_sha: string;
  original_worktree_path: string;
  branch_name: string;
  metadata_snapshot_path: string;
  artifacts: string[];
}

export interface VariantComparisonSummary {
  variant_id: string;
  branch: string;
  ahead: number;
  behind: number;
  files_changed: number;
  insertions: number;
  deletions: number;
  score?: number;
}

export interface ParallelHandoffPackage {
  handoff_id: string;
  feature: string;
  base_branch: string;
  created_at: string;
  winner: {
    variant_id: string;
    branch: string;
    head_sha: string;
    selection_rationale: string;
  };
  comparison_scorecard: VariantComparisonSummary[];
  preserved_losers: Array<{
    variant_id: string;
    branch: string;
    head_sha: string;
    archived_or_active: 'active' | 'archived';
  }>;
  pr_summary_markdown: string;
  artifact_path: string;
}

export interface AcceptanceCriterion {
  id: string;
  description: string;
  completed: boolean;
}

export interface TaskContract {
  title: string;
  problem_statement: string;
  scope: string[];
  out_of_scope: string[];
  acceptance_criteria: AcceptanceCriterion[];
  safety_invariants: string[];
  quality_gates_ref: string;
  created_at: string;
  updated_at: string;
}

export type AgentRole = 'planner' | 'worker' | 'verifier' | 'custom' | string;
export type AgentSessionState =
  | 'dispatched'
  | 'planning'
  | 'working'
  | 'verifying'
  | 'fulfilled'
  | 'fulfillment_rejected'
  | 'execution_failed'
  | 'timed_out'
  | 'cancelled';

export interface AgentSessionRecord {
  session_id: string;
  worktree_id: string;
  feature?: string;
  role: AgentRole;
  command: string;
  state: AgentSessionState;
  started_at: string;
  ended_at?: string;
  duration_seconds?: number;
  pid?: number;
  exit_code?: number;
  error?: string;
  contract_path: string;
  scorecard_path?: string;
}

export interface QualityGateCommand {
  name: string;
  command: string;
  mandatory: boolean;
  timeout_seconds?: number;
}

export interface QualityGateExecutionResult {
  gate_name: string;
  command: string;
  passed: boolean;
  exit_code: number;
  duration_ms: number;
  stdout: string;
  stderr: string;
}

export interface QualityGateReport {
  passed: boolean;
  total_gates: number;
  passed_gates: number;
  failed_gates: number;
  results: QualityGateExecutionResult[];
}

export interface FulfillmentVerificationReport {
  worktree_id: string;
  verified_at: string;
  status: 'fulfilled' | 'rejected';
  total_criteria: number;
  completed_criteria: number;
  unmet_criteria: AcceptanceCriterion[];
  quality_gates: QualityGateReport;
  remediation_steps: string[];
}

export interface ExecutionScorecard {
  worktree_id: string;
  feature?: string;
  session_id: string;
  agent_role: AgentRole;
  generated_at: string;
  duration_seconds: number;
  git_diff: {
    files_changed: number;
    insertions: number;
    deletions: number;
    changed_files: string[];
  };
  quality_gates: {
    passed: boolean;
    tests_passed?: number;
    tests_failed?: number;
    lint_clean: boolean;
    build_clean: boolean;
  };
  fulfillment: {
    status: 'fulfilled' | 'rejected';
    criteria_met: number;
    total_criteria: number;
  };
}

export interface AgentDispatchOptions {
  target: string;
  role?: AgentRole;
  command?: string;
  contract?: string;
  title?: string;
  problemStatement?: string;
  scope?: string[];
  criteria?: string[];
  timeoutSeconds?: number;
  parallel?: boolean;
  dryRun?: boolean;
}

export interface AgentVerifyOptions {
  target: string;
  retries?: number;
  dryRun?: boolean;
}

export interface AgentCancelOptions {
  target?: string;
  force?: boolean;
}


export interface AgentStatusOptions {
  target?: string;
}

export type MatrixProbeCategory = 'test' | 'lint' | 'benchmark' | 'size' | 'custom';

export interface MatrixProbeSpec {
  name: string;
  command: string;
  category: MatrixProbeCategory;
  mandatory?: boolean;
  timeout_seconds?: number;
  weight?: number;
  higher_is_better?: boolean;
  metric_unit?: string;
  metric_regex?: string;
}

export interface VariantProbeResult {
  probe_name: string;
  category: MatrixProbeCategory;
  command: string;
  passed: boolean;
  exit_code: number;
  duration_ms: number;
  stdout: string;
  stderr: string;
  numeric_value?: number;
  metric_unit?: string;
}

export interface VariantEvaluationSummary {
  worktree_id: string;
  variant_name: string;
  probe_results: VariantProbeResult[];
  tests_passed: number;
  tests_total: number;
  lint_clean: boolean;
  benchmark_latency_ms?: number;
  benchmark_ops_sec?: number;
  bundle_size_bytes?: number;
  git_diff: {
    files_changed: number;
    insertions: number;
    deletions: number;
  };
  composite_score: number;
  rank: number;
  compliant: boolean;
}

export interface MatrixScoringWeights {
  correctness: number;
  performance: number;
  maintainability_churn: number;
  size: number;
}

export interface ExperimentMatrixReport {
  feature_name: string;
  evaluated_at: string;
  probes: MatrixProbeSpec[];
  weights: MatrixScoringWeights;
  variants: VariantEvaluationSummary[];
  recommended_winner_id: string;
  winning_justification: string;
  baseline_comparison?: {
    base_branch: string;
    metrics: Record<string, number>;
    deltas: Record<string, { delta_pct: number; improved: boolean }>;
  };
}

export interface ParallelEvalOptions {
  feature: string;
  matrix?: string[];
  concurrency?: number;
  serial?: boolean;
  autoPick?: boolean;
  baseline?: boolean;
  timeoutSeconds?: number;
  dryRun?: boolean;
}

export class MannostreeError extends Error {
  constructor(
    message: string,
    public exitCode: ExitCode = ExitCode.GENERIC_FAILURE,
    public details?: unknown
  ) {
    super(message);
    this.name = 'MannostreeError';
  }
}


