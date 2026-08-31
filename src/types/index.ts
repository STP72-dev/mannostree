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
