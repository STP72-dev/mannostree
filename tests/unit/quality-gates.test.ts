import { describe, it, expect } from 'vitest';
import { QualityGatesRunner } from '../../src/core/quality-gates.js';

describe('QualityGatesRunner', () => {
  const runner = new QualityGatesRunner();

  it('passes when all commands exit with code 0', async () => {
    const report = await runner.executeGates(process.cwd(), [
      { name: 'echo_test', command: 'echo "hello gate"', mandatory: true },
      { name: 'true_check', command: 'true', mandatory: true },
    ]);

    expect(report.passed).toBe(true);
    expect(report.total_gates).toBe(2);
    expect(report.passed_gates).toBe(2);
    expect(report.failed_gates).toBe(0);
    expect(report.results[0].stdout).toContain('hello gate');
  });

  it('fails report when mandatory command exits non-zero', async () => {
    const report = await runner.executeGates(process.cwd(), [
      { name: 'failing_gate', command: 'exit 1', mandatory: true },
    ]);

    expect(report.passed).toBe(false);
    expect(report.total_gates).toBe(1);
    expect(report.passed_gates).toBe(0);
    expect(report.failed_gates).toBe(1);
    expect(report.results[0].exit_code).toBe(1);
  });
});
