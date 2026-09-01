import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import {
  QualityGateCommand,
  QualityGateExecutionResult,
  QualityGateReport,
} from '../types/index.js';

const execAsync = promisify(exec);

export class QualityGatesRunner {
  public async executeGates(
    worktreeFullPath: string,
    gates: QualityGateCommand[] = [],
    options: { retries?: number } = {}
  ): Promise<QualityGateReport> {
    const { retries = 0 } = options;

    if (gates.length === 0) {
      return {
        passed: true,
        total_gates: 0,
        passed_gates: 0,
        failed_gates: 0,
        results: [],
      };
    }

    const results: QualityGateExecutionResult[] = [];
    let allPassed = true;

    for (const gate of gates) {
      let passed = false;
      let exitCode = 0;
      let stdout = '';
      let stderr = '';
      const startTime = Date.now();

      let attemptsLeft = 1 + retries;
      while (attemptsLeft > 0 && !passed) {
        attemptsLeft--;
        try {
          const timeoutMs = (gate.timeout_seconds || 120) * 1000;
          const res = await execAsync(gate.command, {
            cwd: worktreeFullPath,
            timeout: timeoutMs,
          });
          stdout = res.stdout;
          stderr = res.stderr;
          passed = true;
          exitCode = 0;
        } catch (err: any) {
          stdout = err.stdout || '';
          stderr = err.stderr || err.message || '';
          exitCode = typeof err.code === 'number' ? err.code : 1;
          passed = false;
        }
      }

      const durationMs = Date.now() - startTime;
      results.push({
        gate_name: gate.name,
        command: gate.command,
        passed,
        exit_code: exitCode,
        duration_ms: durationMs,
        stdout,
        stderr,
      });

      if (!passed && gate.mandatory) {
        allPassed = false;
      }
    }

    const passedCount = results.filter((r) => r.passed).length;

    return {
      passed: allPassed,
      total_gates: gates.length,
      passed_gates: passedCount,
      failed_gates: gates.length - passedCount,
      results,
    };
  }
}
