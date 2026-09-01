import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  generateTaskContractMarkdown,
  parseTaskContractMarkdown,
  updateTaskContractCriteria,
} from '../../src/core/contract.js';
import { TaskContract } from '../../src/types/index.js';

describe('Task Contract Parser & Template Generator', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mannostree-contract-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('generates a valid markdown contract and parses it back into structured TaskContract', () => {
    const contractInput: Partial<TaskContract> = {
      title: 'Payment Retry Logic',
      problem_statement: 'Failed payment transactions lack exponential backoff.',
      scope: ['Implement ExponentialBackoff helper', 'Add retry loop to PaymentClient'],
      out_of_scope: ['Third-party webhook callbacks'],
      acceptance_criteria: [
        { id: 'AC-001', description: 'Retries up to 3 times on 5xx errors', completed: false },
        { id: 'AC-002', description: 'Unit tests cover timeout edge cases', completed: true },
      ],
      safety_invariants: ['Do not modify billing database schemas'],
      quality_gates_ref: '.task/quality-gates.md',
    };

    const markdown = generateTaskContractMarkdown(contractInput);
    const contractFile = path.join(tempDir, 'task-contract.md');
    fs.writeFileSync(contractFile, markdown, 'utf-8');

    const parsed = parseTaskContractMarkdown(contractFile);
    expect(parsed.title).toBe('Payment Retry Logic');
    expect(parsed.problem_statement).toContain('Failed payment transactions');
    expect(parsed.scope).toEqual(['Implement ExponentialBackoff helper', 'Add retry loop to PaymentClient']);
    expect(parsed.out_of_scope).toEqual(['Third-party webhook callbacks']);
    expect(parsed.acceptance_criteria.length).toBe(2);
    expect(parsed.acceptance_criteria[0]).toEqual({
      id: 'AC-001',
      description: 'Retries up to 3 times on 5xx errors',
      completed: false,
    });
    expect(parsed.acceptance_criteria[1]).toEqual({
      id: 'AC-002',
      description: 'Unit tests cover timeout edge cases',
      completed: true,
    });
  });

  it('updates checkboxes in existing contract file non-destructively', () => {
    const markdown = `# Task Contract: Fix Login Timeout

## Problem
Login times out on slow connections.

## Scope
- Optimize auth tokens.

## Acceptance criteria
- [ ] AC-001: Token refresh completes in < 200ms
- [ ] AC-002: Unit tests pass
`;
    const contractFile = path.join(tempDir, 'task-contract.md');
    fs.writeFileSync(contractFile, markdown, 'utf-8');

    updateTaskContractCriteria(contractFile, { 'AC-001': true });

    const parsed = parseTaskContractMarkdown(contractFile);
    expect(parsed.acceptance_criteria[0].completed).toBe(true);
    expect(parsed.acceptance_criteria[1].completed).toBe(false);
  });
});
