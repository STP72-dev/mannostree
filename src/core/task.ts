import path from 'node:path';
import fs from 'node:fs';
import { MannostreeConfig } from '../config/schema.js';
import { GitEngine } from '../git/engine.js';
import {
  ExitCode,
  MannostreeError,
  WorktreeRecord,
} from '../types/index.js';

export interface ArtifactFileStatus {
  present: boolean;
  rel_path: string;
  size_bytes: number;
}

export interface TaskValidationResult {
  complete: boolean;
  score_percentage: number;
  total_required: number;
  total_present: number;
  artifacts: Record<string, ArtifactFileStatus>;
}

export interface HandoffReport {
  id: string;
  feature_name?: string;
  branch: string;
  base_branch: string;
  lifecycle_state: string;
  target_recipient?: string;
  handoff_notes?: string;
  git_summary: {
    ahead_count: number;
    behind_count: number;
    dirty: boolean;
    head_commit?: string;
    head_commit_message?: string;
  };
  artifacts_status: {
    complete: boolean;
    score_percentage: number;
  };
  next_steps: string[];
}

export class TaskEngine {
  constructor(
    public repoRoot: string,
    public config: MannostreeConfig,
    public git: GitEngine
  ) {}

  public validateArtifacts(worktreeFullPath: string): TaskValidationResult {
    if (!fs.existsSync(worktreeFullPath)) {
      throw new MannostreeError(
        `Worktree directory not found: ${worktreeFullPath}`,
        ExitCode.USAGE_ERROR
      );
    }

    const artifactDir = this.config.artifact_dir_name;
    const requiredFiles = [
      { key: 'task_contract', file: path.join(artifactDir, 'task-contract.md') },
      { key: 'implementation_plan', file: path.join(artifactDir, 'implementation-plan.md') },
      { key: 'quality_gates', file: path.join(artifactDir, 'quality-gates.md') },
      { key: 'review', file: path.join(artifactDir, 'review.md') },
      { key: 'results', file: 'RESULTS.md' },
    ];

    const artifacts: Record<string, ArtifactFileStatus> = {};
    let presentCount = 0;

    for (const req of requiredFiles) {
      const fullPath = path.join(worktreeFullPath, req.file);
      const exists = fs.existsSync(fullPath);
      let size = 0;
      if (exists) {
        size = fs.statSync(fullPath).size;
        if (size > 20) {
          presentCount++;
        }
      }

      artifacts[req.key] = {
        present: exists && size > 20,
        rel_path: req.file,
        size_bytes: size,
      };
    }

    const total = requiredFiles.length;
    const score = Math.round((presentCount / total) * 100);

    return {
      complete: presentCount === total,
      score_percentage: score,
      total_required: total,
      total_present: presentCount,
      artifacts,
    };
  }

  public async linkIssue(
    worktreeFullPath: string,
    record: WorktreeRecord,
    issueNumber: number,
    title?: string,
    dryRun: boolean = false
  ): Promise<{ issue_number: number; issue_title?: string }> {
    const issueTitle = title || `Issue #${issueNumber}`;
    const contractPath = path.join(
      worktreeFullPath,
      this.config.artifact_dir_name,
      'task-contract.md'
    );

    if (!dryRun && fs.existsSync(contractPath)) {
      let content = fs.readFileSync(contractPath, 'utf-8');
      if (!content.includes(`Issue: #${issueNumber}`)) {
        content = `# Task Contract: ${issueTitle} (Issue #${issueNumber})\n\n${content}`;
        fs.writeFileSync(contractPath, content, 'utf-8');
      }
    }

    return {
      issue_number: issueNumber,
      issue_title: issueTitle,
    };
  }

  public async generateHandoff(
    worktreeFullPath: string,
    record: WorktreeRecord,
    to?: string,
    notes?: string
  ): Promise<HandoffReport> {
    const gitState = await this.git.getGitState(
      record.worktree_path,
      record.base_branch,
      record.branch
    );
    const taskValidation = this.validateArtifacts(worktreeFullPath);

    const nextSteps: string[] = [];
    if (gitState.dirty) {
      nextSteps.push('Commit or stash uncommitted working tree changes.');
    }
    if (!taskValidation.complete) {
      nextSteps.push('Complete missing or empty .task/ artifacts before PR publication.');
    }
    if (record.lifecycle_state === 'IMPLEMENTED') {
      nextSteps.push('Execute verification tests and independent review pass.');
    } else if (record.lifecycle_state === 'REVIEWED' || record.lifecycle_state === 'VERIFIED') {
      nextSteps.push('Run `mannostree pr` to prepare or publish pull request.');
    }

    return {
      id: record.id,
      feature_name: record.feature_name,
      branch: record.branch,
      base_branch: record.base_branch,
      lifecycle_state: record.lifecycle_state,
      target_recipient: to,
      handoff_notes: notes,
      git_summary: {
        ahead_count: gitState.ahead_count || 0,
        behind_count: gitState.behind_count || 0,
        dirty: !!gitState.dirty,
        head_commit: gitState.head_commit,
        head_commit_message: gitState.head_commit_message,
      },
      artifacts_status: {
        complete: taskValidation.complete,
        score_percentage: taskValidation.score_percentage,
      },
      next_steps: nextSteps,
    };
  }
}
