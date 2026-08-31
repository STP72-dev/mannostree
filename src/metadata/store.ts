import fs from 'node:fs';
import path from 'node:path';
import { MannostreeConfig } from '../config/schema.js';
import {
  RegistryRecordSchema,
  WorktreeRecordSchema,
} from './schema.js';
import {
  ExitCode,
  MannostreeError,
  RegistryRecord,
  WorktreeRecord,
} from '../types/index.js';

export function writeAtomicJson(filePath: string, data: unknown): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const tempPath = `${filePath}.tmp.${Date.now()}.${Math.random().toString(36).substring(2, 8)}`;
  const content = JSON.stringify(data, null, 2) + '\n';

  try {
    fs.writeFileSync(tempPath, content, 'utf-8');
    fs.renameSync(tempPath, filePath);
  } catch (err: any) {
    if (fs.existsSync(tempPath)) {
      try {
        fs.unlinkSync(tempPath);
      } catch {
        // ignore unlink error
      }
    }
    throw new MannostreeError(
      `Failed to atomically write JSON to ${filePath}: ${err.message}`,
      ExitCode.GENERIC_FAILURE
    );
  }
}

export function readJson<T>(filePath: string): T {
  if (!fs.existsSync(filePath)) {
    throw new MannostreeError(
      `File not found: ${filePath}`,
      ExitCode.METADATA_INCONSISTENCY
    );
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  } catch (err: any) {
    throw new MannostreeError(
      `Failed to read/parse JSON from ${filePath}: ${err.message}`,
      ExitCode.METADATA_INCONSISTENCY
    );
  }
}

export class MetadataStore {
  private metadataRoot: string;
  private worktreesDir: string;
  private experimentsDir: string;
  private archiveDir: string;
  private registryFile: string;

  constructor(
    public repoRoot: string,
    public config: MannostreeConfig
  ) {
    this.metadataRoot = path.resolve(repoRoot, config.metadata_root);
    this.worktreesDir = path.join(this.metadataRoot, 'worktrees');
    this.experimentsDir = path.join(this.metadataRoot, 'experiments');
    this.archiveDir = path.join(this.metadataRoot, 'archive');
    this.registryFile = path.join(this.metadataRoot, 'registry.json');
  }

  public getRegistryPath(): string {
    return this.registryFile;
  }

  public getWorktreeRecordPath(id: string): string {
    return path.join(this.worktreesDir, `${id}.json`);
  }

  public getArchiveRecordPath(id: string): string {
    return path.join(this.archiveDir, `${id}.json`);
  }

  public async getRegistry(): Promise<RegistryRecord> {
    if (!fs.existsSync(this.registryFile)) {
      return this.initRegistry();
    }

    const raw = readJson<unknown>(this.registryFile);
    const parsed = RegistryRecordSchema.safeParse(raw);
    if (!parsed.success) {
      throw new MannostreeError(
        `Invalid registry schema in ${this.registryFile}:\n${parsed.error.message}`,
        ExitCode.METADATA_INCONSISTENCY
      );
    }
    return parsed.data;
  }

  public async initRegistry(): Promise<RegistryRecord> {
    const now = new Date().toISOString();
    const registry: RegistryRecord = {
      version: 1,
      repo_root: this.repoRoot,
      default_base_branch: this.config.default_base_branch,
      worktree_root: this.config.worktree_root,
      metadata_root: this.config.metadata_root,
      artifact_dir_name: this.config.artifact_dir_name,
      created_at: now,
      updated_at: now,
      worktrees: [],
      experiments: [],
    };

    writeAtomicJson(this.registryFile, registry);
    return registry;
  }

  public async saveRegistry(registry: RegistryRecord): Promise<void> {
    registry.updated_at = new Date().toISOString();
    const validated = RegistryRecordSchema.safeParse(registry);
    if (!validated.success) {
      throw new MannostreeError(
        `Registry validation failed: ${validated.error.message}`,
        ExitCode.VALIDATION_FAILURE
      );
    }
    writeAtomicJson(this.registryFile, validated.data);
  }

  public async getWorktree(id: string): Promise<WorktreeRecord | null> {
    const filePath = this.getWorktreeRecordPath(id);
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const raw = readJson<unknown>(filePath);
    const parsed = WorktreeRecordSchema.safeParse(raw);
    if (!parsed.success) {
      throw new MannostreeError(
        `Invalid worktree record schema for ${id} in ${filePath}:\n${parsed.error.message}`,
        ExitCode.METADATA_INCONSISTENCY
      );
    }
    return parsed.data as WorktreeRecord;
  }

  public async saveWorktree(record: WorktreeRecord): Promise<void> {
    record.updated_at = new Date().toISOString();
    record.last_activity_at = record.updated_at;

    const validated = WorktreeRecordSchema.safeParse(record);
    if (!validated.success) {
      throw new MannostreeError(
        `Worktree record validation failed for ${record.id}: ${validated.error.message}`,
        ExitCode.VALIDATION_FAILURE
      );
    }

    const filePath = this.getWorktreeRecordPath(record.id);
    writeAtomicJson(filePath, validated.data);

    // Update registry index
    const registry = await this.getRegistry();
    if (!registry.worktrees.includes(record.id)) {
      registry.worktrees.push(record.id);
      await this.saveRegistry(registry);
    }
  }

  public async deleteWorktree(id: string, archive: boolean = false): Promise<void> {
    const filePath = this.getWorktreeRecordPath(id);
    if (fs.existsSync(filePath)) {
      if (archive) {
        const record = await this.getWorktree(id);
        if (record) {
          record.status = 'archived';
          record.lifecycle_state = 'CLEANED';
          record.updated_at = new Date().toISOString();
          const archivePath = this.getArchiveRecordPath(id);
          writeAtomicJson(archivePath, record);
        }
      }
      fs.unlinkSync(filePath);
    }

    // Update registry index
    const registry = await this.getRegistry();
    registry.worktrees = registry.worktrees.filter((wId) => wId !== id);
    await this.saveRegistry(registry);
  }

  public async listWorktrees(): Promise<WorktreeRecord[]> {
    const registry = await this.getRegistry();
    const records: WorktreeRecord[] = [];

    for (const id of registry.worktrees) {
      const record = await this.getWorktree(id);
      if (record) {
        records.push(record);
      }
    }

    // Sort by last_activity_at desc
    records.sort((a, b) => {
      const timeA = new Date(a.last_activity_at || a.updated_at).getTime();
      const timeB = new Date(b.last_activity_at || b.updated_at).getTime();
      return timeB - timeA;
    });

    return records;
  }
}
