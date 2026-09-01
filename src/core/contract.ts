import fs from 'node:fs';
import path from 'node:path';
import {
  TaskContract,
  AcceptanceCriterion,
  FulfillmentVerificationReport,
  QualityGateReport,
  ExecutionScorecard,
  AgentRole,
  ExitCode,
  MannostreeError,
} from '../types/index.js';

export function generateTaskContractMarkdown(contract: Partial<TaskContract>): string {
  const title = contract.title || 'Untitled Task';
  const problem = contract.problem_statement || 'Describe the core problem, user value, and background context.';
  const scopeItems = contract.scope && contract.scope.length > 0
    ? contract.scope.map((s) => `- ${s}`).join('\n')
    : '- Key deliverables and functional components.';
  const outOfScopeItems = contract.out_of_scope && contract.out_of_scope.length > 0
    ? contract.out_of_scope.map((o) => `- ${o}`).join('\n')
    : '- Explicitly excluded items or future work.';

  const criteriaItems = contract.acceptance_criteria && contract.acceptance_criteria.length > 0
    ? contract.acceptance_criteria
        .map((c) => `- [${c.completed ? 'x' : ' '}] ${c.id ? `${c.id}: ` : ''}${c.description}`)
        .join('\n')
    : '- [ ] AC-001: Deliverable meets specifications.\n- [ ] AC-002: Automated tests pass.';

  const safetyItems = contract.safety_invariants && contract.safety_invariants.length > 0
    ? contract.safety_invariants.map((s) => `- ${s}`).join('\n')
    : '- Never modify files outside this worktree sandbox.\n- Do not delete git branch topology.';

  const qualityGatesRef = contract.quality_gates_ref || '.task/quality-gates.md';

  return `# Task Contract: ${title}

## Problem
${problem}

## Scope
${scopeItems}

## Out-of-scope
${outOfScopeItems}

## Acceptance criteria
${criteriaItems}

## Safety invariants
${safetyItems}

## Quality gates reference
${qualityGatesRef}
`;
}

export function parseTaskContractMarkdown(filePath: string): TaskContract {
  if (!fs.existsSync(filePath)) {
    throw new MannostreeError(
      `Task contract not found at ${filePath}`,
      ExitCode.USAGE_ERROR
    );
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  let title = 'Untitled Task';
  const titleMatch = content.match(/^# Task Contract:\s*(.+)$/m);
  if (titleMatch) {
    title = titleMatch[1].trim();
  }

  let problem = '';
  const scope: string[] = [];
  const outOfScope: string[] = [];
  const criteria: AcceptanceCriterion[] = [];
  const safety: string[] = [];
  let qualityGatesRef = '.task/quality-gates.md';

  let currentSection = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('## ')) {
      currentSection = trimmed.replace(/^##\s+/, '').toLowerCase();
      continue;
    }

    if (!currentSection) continue;

    if (currentSection === 'problem') {
      if (trimmed.length > 0) {
        problem = problem ? `${problem}\n${trimmed}` : trimmed;
      }
    } else if (currentSection === 'scope') {
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        scope.push(trimmed.slice(2).trim());
      }
    } else if (currentSection === 'out-of-scope' || currentSection === 'out of scope') {
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        outOfScope.push(trimmed.slice(2).trim());
      }
    } else if (currentSection === 'acceptance criteria') {
      const checkboxMatch = trimmed.match(/^-\s*\[([ xX])\]\s*(.*)$/);
      if (checkboxMatch) {
        const completed = checkboxMatch[1].toLowerCase() === 'x';
        const rawText = checkboxMatch[2].trim();
        const idMatch = rawText.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
        let id = `AC-${String(criteria.length + 1).padStart(3, '0')}`;
        let desc = rawText;

        if (idMatch) {
          id = idMatch[1].trim();
          desc = idMatch[2].trim();
        }

        criteria.push({
          id,
          description: desc,
          completed,
        });
      }
    } else if (currentSection === 'safety invariants') {
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        safety.push(trimmed.slice(2).trim());
      }
    } else if (currentSection === 'quality gates reference' || currentSection === 'quality gates') {
      if (trimmed.length > 0) {
        qualityGatesRef = trimmed;
      }
    }
  }

  const stats = fs.statSync(filePath);

  return {
    title,
    problem_statement: problem,
    scope,
    out_of_scope: outOfScope,
    acceptance_criteria: criteria,
    safety_invariants: safety,
    quality_gates_ref: qualityGatesRef,
    created_at: stats.birthtime.toISOString(),
    updated_at: stats.mtime.toISOString(),
  };
}

export function updateTaskContractCriteria(
  filePath: string,
  updates: Record<string, boolean>
): void {
  if (!fs.existsSync(filePath)) {
    throw new MannostreeError(`Task contract file ${filePath} not found.`, ExitCode.USAGE_ERROR);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  let autoIdCounter = 1;
  const updatedLines = lines.map((line) => {
    const checkboxMatch = line.match(/^(\s*-\s*\[)([ xX])(\]\s*)(.*)$/);
    if (!checkboxMatch) {
      return line;
    }

    const prefix = checkboxMatch[1];
    const suffix = checkboxMatch[3];
    const rest = checkboxMatch[4];

    const idMatch = rest.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    let id = `AC-${String(autoIdCounter++).padStart(3, '0')}`;
    if (idMatch) {
      id = idMatch[1].trim();
    }

    if (updates[id] !== undefined) {
      const checkChar = updates[id] ? 'x' : ' ';
      return `${prefix}${checkChar}${suffix}${rest}`;
    }

    return line;
  });

  fs.writeFileSync(filePath, updatedLines.join('\n'), 'utf-8');
}

export function validateContractFulfillment(
  worktreeId: string,
  contract: TaskContract,
  qualityGates: QualityGateReport
): FulfillmentVerificationReport {
  const unmetCriteria = contract.acceptance_criteria.filter((c) => !c.completed);
  const criteriaPassed = unmetCriteria.length === 0;
  const gatesPassed = qualityGates.passed;

  const status: 'fulfilled' | 'rejected' = criteriaPassed && gatesPassed ? 'fulfilled' : 'rejected';
  const remediation: string[] = [];

  if (!criteriaPassed) {
    remediation.push(
      `Fulfill remaining ${unmetCriteria.length} acceptance criteria in task contract (${unmetCriteria.map((c) => c.id).join(', ')}).`
    );
  }

  if (!gatesPassed) {
    const failedGates = qualityGates.results.filter((r) => !r.passed);
    remediation.push(
      `Fix failing quality gates (${failedGates.map((g) => g.gate_name).join(', ')}).`
    );
  }

  return {
    worktree_id: worktreeId,
    verified_at: new Date().toISOString(),
    status,
    total_criteria: contract.acceptance_criteria.length,
    completed_criteria: contract.acceptance_criteria.length - unmetCriteria.length,
    unmet_criteria: unmetCriteria,
    quality_gates: qualityGates,
    remediation_steps: remediation,
  };
}

export function compileScorecard(options: {
  worktreeId: string;
  feature?: string;
  sessionId: string;
  agentRole: AgentRole;
  durationSeconds: number;
  gitDiff: {
    files_changed: number;
    insertions: number;
    deletions: number;
    changed_files: string[];
  };
  qualityGates: QualityGateReport;
  contract: TaskContract;
}): ExecutionScorecard {
  const {
    worktreeId,
    feature,
    sessionId,
    agentRole,
    durationSeconds,
    gitDiff,
    qualityGates,
    contract,
  } = options;

  const unmet = contract.acceptance_criteria.filter((c) => !c.completed);

  return {
    worktree_id: worktreeId,
    feature,
    session_id: sessionId,
    agent_role: agentRole,
    generated_at: new Date().toISOString(),
    duration_seconds: Math.round(durationSeconds),
    git_diff: gitDiff,
    quality_gates: {
      passed: qualityGates.passed,
      lint_clean: qualityGates.results.find((r) => r.gate_name === 'lint')?.passed ?? true,
      build_clean: qualityGates.results.find((r) => r.gate_name === 'build')?.passed ?? true,
    },
    fulfillment: {
      status: unmet.length === 0 && qualityGates.passed ? 'fulfilled' : 'rejected',
      criteria_met: contract.acceptance_criteria.length - unmet.length,
      total_criteria: contract.acceptance_criteria.length,
    },
  };
}

export function generateScorecardMarkdown(scorecard: ExecutionScorecard): string {
  return `# Execution Scorecard: ${scorecard.worktree_id}

**Generated At**: ${scorecard.generated_at}  
**Session ID**: \`${scorecard.session_id}\`  
**Agent Role**: \`${scorecard.agent_role}\`  
**Status**: **${scorecard.fulfillment.status.toUpperCase()}**

---

## 📊 Summary Metrics

| Metric | Result |
|---|---|
| **Contract Criteria Met** | ${scorecard.fulfillment.criteria_met} / ${scorecard.fulfillment.total_criteria} |
| **Quality Gates Passed** | ${scorecard.quality_gates.passed ? '✓ YES' : '✗ NO'} |
| **Execution Duration** | ${scorecard.duration_seconds}s |
| **Files Changed** | ${scorecard.git_diff.files_changed} |
| **Lines Inserted (+)** | +${scorecard.git_diff.insertions} |
| **Lines Deleted (-)** | -${scorecard.git_diff.deletions} |

---

## 📁 Modified Files

${scorecard.git_diff.changed_files.map((f) => `- \`${f}\``).join('\n') || '- None'}
`;
}
