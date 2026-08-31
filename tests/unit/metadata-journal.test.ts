import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { TransactionJournal } from '../../src/metadata/journal.js';

describe('Transaction Journal Engine', () => {
  let tempDir: string;
  let journal: TransactionJournal;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mannostree-journal-test-'));
    journal = new TransactionJournal(tempDir);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('begins, logs, and commits transaction', async () => {
    const targetFile = path.join(tempDir, 'file1.json');
    fs.writeFileSync(targetFile, JSON.stringify({ a: 1 }), 'utf-8');

    const tx = await journal.beginTransaction('spawn', 'worktree', 'feat-1', [
      {
        file_path: targetFile,
        action: 'update',
      },
    ]);

    expect(tx.state).toBe('in_flight');
    expect(journal.getActiveTransaction()?.transaction_id).toBe(tx.transaction_id);

    const committed = await journal.commitTransaction(tx.transaction_id);
    expect(committed.state).toBe('committed');
    expect(journal.getActiveTransaction()).toBeNull();

    const history = journal.getTransactionHistory();
    expect(history.length).toBe(2); // in_flight + committed
  });

  it('rolls back uncommitted transaction and restores file snapshot', async () => {
    const targetFile = path.join(tempDir, 'file2.json');
    fs.writeFileSync(targetFile, JSON.stringify({ version: 'original' }), 'utf-8');

    const tx = await journal.beginTransaction('drop', 'worktree', 'feat-2', [
      {
        file_path: targetFile,
        action: 'update',
      },
    ]);

    // Simulate mutation during transaction
    fs.writeFileSync(targetFile, JSON.stringify({ version: 'mutated' }), 'utf-8');

    const rolledBack = await journal.rollbackTransaction(tx.transaction_id);
    expect(rolledBack?.state).toBe('rolled_back');
    expect(journal.getActiveTransaction()).toBeNull();

    const restoredContent = JSON.parse(fs.readFileSync(targetFile, 'utf-8'));
    expect(restoredContent.version).toBe('original');
  });

  it('deletes newly created files on rollback', async () => {
    const targetFile = path.join(tempDir, 'new_file.json');

    const tx = await journal.beginTransaction('spawn', 'worktree', 'feat-3', [
      {
        file_path: targetFile,
        action: 'create',
      },
    ]);

    fs.writeFileSync(targetFile, JSON.stringify({ new: true }), 'utf-8');
    expect(fs.existsSync(targetFile)).toBe(true);

    await journal.rollbackTransaction(tx.transaction_id);
    expect(fs.existsSync(targetFile)).toBe(false);
  });
});
