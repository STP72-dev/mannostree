import fs from 'node:fs';
import path from 'node:path';
import { TransactionJournalEntry, TransactionIntent } from '../types/index.js';
import { writeAtomicJson, readJson } from './store.js';

export class TransactionJournal {
  private journalDir: string;
  private logFile: string;
  private activeFile: string;

  constructor(
    public repoRoot: string,
    public metadataRoot: string = '.mannostree',
    public journalDirName: string = 'journal'
  ) {
    this.journalDir = path.resolve(repoRoot, metadataRoot, journalDirName);
    this.logFile = path.join(this.journalDir, 'transactions.jsonl');
    this.activeFile = path.join(this.journalDir, 'active.json');
  }

  private ensureDir(): void {
    if (!fs.existsSync(this.journalDir)) {
      fs.mkdirSync(this.journalDir, { recursive: true });
    }
  }

  public async beginTransaction(
    operation: TransactionJournalEntry['operation'],
    entityType: TransactionJournalEntry['entity_type'],
    entityId: string,
    intents: TransactionIntent[]
  ): Promise<TransactionJournalEntry> {
    this.ensureDir();
    const now = new Date().toISOString();
    const randomSuffix = Math.random().toString(36).substring(2, 6);
    const datePrefix = now.replace(/[-:T]/g, '').slice(0, 14);
    const transactionId = `tx_${datePrefix}_${randomSuffix}`;

    // Capture previous snapshot for update/delete intents
    const hydratedIntents = intents.map((intent) => {
      const fullPath = path.isAbsolute(intent.file_path)
        ? intent.file_path
        : path.resolve(this.repoRoot, intent.file_path);

      let prevSnapshot = intent.previous_snapshot;
      if (!prevSnapshot && (intent.action === 'update' || intent.action === 'delete')) {
        if (fs.existsSync(fullPath)) {
          try {
            prevSnapshot = fs.readFileSync(fullPath, 'utf-8');
          } catch {
            // ignore
          }
        }
      }

      return {
        ...intent,
        previous_snapshot: prevSnapshot,
      };
    });

    const entry: TransactionJournalEntry = {
      transaction_id: transactionId,
      operation,
      entity_type: entityType,
      entity_id: entityId,
      created_at: now,
      updated_at: now,
      state: 'in_flight',
      intents: hydratedIntents,
    };

    // Save as active transaction
    writeAtomicJson(this.activeFile, entry);
    this.appendLog(entry);

    return entry;
  }

  public async commitTransaction(transactionId: string): Promise<TransactionJournalEntry> {
    this.ensureDir();
    const active = this.getActiveTransaction();
    if (!active || active.transaction_id !== transactionId) {
      throw new Error(`Active transaction '${transactionId}' not found.`);
    }

    active.state = 'committed';
    active.updated_at = new Date().toISOString();

    if (fs.existsSync(this.activeFile)) {
      fs.unlinkSync(this.activeFile);
    }
    this.appendLog(active);

    return active;
  }

  public async rollbackTransaction(transactionId?: string): Promise<TransactionJournalEntry | null> {
    this.ensureDir();
    const active = this.getActiveTransaction();
    if (!active || (transactionId && active.transaction_id !== transactionId)) {
      return null;
    }

    // Rollback intents in reverse order
    for (let i = active.intents.length - 1; i >= 0; i--) {
      const intent = active.intents[i];
      const fullPath = path.isAbsolute(intent.file_path)
        ? intent.file_path
        : path.resolve(this.repoRoot, intent.file_path);

      if (intent.action === 'create') {
        if (fs.existsSync(fullPath)) {
          try {
            fs.unlinkSync(fullPath);
          } catch {
            // ignore
          }
        }
      } else if (intent.action === 'update' || intent.action === 'delete') {
        if (intent.previous_snapshot) {
          const dir = path.dirname(fullPath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          fs.writeFileSync(fullPath, intent.previous_snapshot, 'utf-8');
        }
      }
    }

    active.state = 'rolled_back';
    active.updated_at = new Date().toISOString();

    if (fs.existsSync(this.activeFile)) {
      fs.unlinkSync(this.activeFile);
    }
    this.appendLog(active);

    return active;
  }

  public getActiveTransaction(): TransactionJournalEntry | null {
    if (!fs.existsSync(this.activeFile)) {
      return null;
    }
    try {
      return readJson<TransactionJournalEntry>(this.activeFile);
    } catch {
      return null;
    }
  }

  public getTransactionHistory(): TransactionJournalEntry[] {
    if (!fs.existsSync(this.logFile)) {
      return [];
    }
    try {
      const content = fs.readFileSync(this.logFile, 'utf-8');
      return content
        .split('\n')
        .filter((line) => line.trim().length > 0)
        .map((line) => JSON.parse(line));
    } catch {
      return [];
    }
  }

  private appendLog(entry: TransactionJournalEntry): void {
    fs.appendFileSync(this.logFile, JSON.stringify(entry) + '\n', 'utf-8');
  }
}
