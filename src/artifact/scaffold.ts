import fs from 'node:fs';
import path from 'node:path';

export interface ArtifactScaffoldOptions {
  worktreeFullPath: string;
  artifactDirName: string;
  featureName: string;
  baseBranch: string;
  dryRun?: boolean;
}

export function scaffoldArtifacts(options: ArtifactScaffoldOptions): void {
  const { worktreeFullPath, artifactDirName, featureName, baseBranch, dryRun } = options;

  if (dryRun) return;

  const taskDir = path.join(worktreeFullPath, artifactDirName);
  if (!fs.existsSync(taskDir)) {
    fs.mkdirSync(taskDir, { recursive: true });
  }

  // 1. task-contract.md
  const taskContractContent = `# Task Contract: ${featureName}

## Problem
Describe the core problem, user value, and background context.

## Scope
- Key deliverables and functional components.

## Out-of-scope
- Explicitly excluded items or future work.

## Acceptance criteria
- [ ] Deliverable meets specifications.
- [ ] Automated tests pass.

## References
- Base branch: \`${baseBranch}\`
`;
  fs.writeFileSync(path.join(taskDir, 'task-contract.md'), taskContractContent, 'utf-8');

  // 2. solution-options.md
  const solutionOptionsContent = `# Solution Options: ${featureName}

## Options
### Option 1
- Description and architecture.

### Option 2
- Description and architecture.

### Option 3
- Description and architecture.

## Trade-offs
- Comparative trade-offs analysis across options.

## Recommended path
- Selected approach and justification.
`;
  fs.writeFileSync(path.join(taskDir, 'solution-options.md'), solutionOptionsContent, 'utf-8');

  // 3. implementation-plan.md
  const implementationPlanContent = `# Implementation Plan: ${featureName}

## Steps
1. Initial setup and incremental changes.
2. Core functionality implementation.

## Risks
- Potential failure modes and mitigations.

## Test plan
- Automated unit and integration tests.
`;
  fs.writeFileSync(path.join(taskDir, 'implementation-plan.md'), implementationPlanContent, 'utf-8');

  // 4. quality-gates.md
  const qualityGatesContent = `# Quality Gates: ${featureName}

## Commands
- Lint / static analysis command.
- Test command.

## Outcomes
- Detailed per-command execution outcomes.

## Overall status
- PENDING
`;
  fs.writeFileSync(path.join(taskDir, 'quality-gates.md'), qualityGatesContent, 'utf-8');

  // 5. review.md
  const reviewContent = `# Independent Review: ${featureName}

## Verdict
PENDING

## Critical
None

## Major
None

## Minor
None

## Suggestions
None
`;
  fs.writeFileSync(path.join(taskDir, 'review.md'), reviewContent, 'utf-8');

  // 6. RESULTS.md at worktree root
  const resultsContent = `# Execution Results: ${featureName}

## Summary
Brief summary of implementation accomplishments.

## Files changed
- List of modified and created files.

## Test evidence
- Exact test outputs and verification commands.

## Trade-offs
- Notable implementation trade-offs made.

## Risks
- Known limitations or follow-up items.
`;
  fs.writeFileSync(path.join(worktreeFullPath, 'RESULTS.md'), resultsContent, 'utf-8');
}
