import fs from 'node:fs';
import path from 'node:path';
import { SandboxReceipt, SandboxExecutionResult } from '../types/index.js';
import { SandboxReceiptSchema } from '../metadata/schema.js';

export interface CreateReceiptParams {
  worktreeId: string;
  worktreePath: string;
  artifactDirName?: string;
  result: SandboxExecutionResult;
  peakMemoryBytes?: number;
  cpuTimeMs?: number;
}

export function generateReceiptId(worktreeId: string): string {
  return `rcpt-${worktreeId}-${Date.now()}`;
}

export function writeSandboxReceipt(params: CreateReceiptParams): {
  receipt: SandboxReceipt;
  receiptPath: string;
} {
  const {
    worktreeId,
    worktreePath,
    artifactDirName = '.task',
    result,
    peakMemoryBytes,
    cpuTimeMs,
  } = params;

  const receipt: SandboxReceipt = {
    version: 1,
    id: generateReceiptId(worktreeId),
    worktree_id: worktreeId,
    runtime: result.runtime,
    container_id: result.container_id,
    image: result.image,
    command: result.command,
    exit_code: result.exit_code,
    duration_ms: result.duration_ms,
    peak_memory_bytes: peakMemoryBytes,
    cpu_time_ms: cpuTimeMs,
    timed_out: result.timed_out,
    oom_killed: !!result.oom_killed,
    timestamp: new Date().toISOString(),
  };

  // Validate receipt
  SandboxReceiptSchema.parse(receipt);

  const fullArtifactDir = path.join(worktreePath, artifactDirName);
  if (!fs.existsSync(fullArtifactDir)) {
    fs.mkdirSync(fullArtifactDir, { recursive: true });
  }

  const receiptFilename = 'sandbox-receipt.json';
  const fullReceiptPath = path.join(fullArtifactDir, receiptFilename);
  fs.writeFileSync(fullReceiptPath, JSON.stringify(receipt, null, 2), 'utf-8');

  const relativeReceiptPath = path.join(artifactDirName, receiptFilename);
  return {
    receipt,
    receiptPath: relativeReceiptPath,
  };
}
