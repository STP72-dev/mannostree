import fs from 'node:fs';
import path from 'node:path';
import { MannostreeConfig } from '../config/schema.js';
import {
  RegistryRecordSchema,
  WorktreeRecordSchema,
  ExperimentRecordSchema,
  AgentSessionRecordSchema,
  WorkspaceLeaseSchema,
  ReleaseManifestRecordSchema,
} from './schema.js';
import {
  ExitCode,
  MannostreeError,
  RegistryRecord,
  WorktreeRecord,
  ExperimentRecord,
  AgentSessionRecord,
  WorkspaceLease,
  ReleaseManifestRecord,
} from '../types/index.js';

import { TransactionJournal } from './journal.js';

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
  private sessionsDir: string;
  private leasesDir: string;
  private registryFile: string;
  public journal: TransactionJournal;

  constructor(
    public repoRoot: string,
    public config: MannostreeConfig
  ) {
    this.metadataRoot = path.resolve(repoRoot, config.metadata_root);
    this.worktreesDir = path.join(this.metadataRoot, 'worktrees');
    this.experimentsDir = path.join(this.metadataRoot, 'experiments');
    this.archiveDir = path.join(this.metadataRoot, config.archive_dir_name || 'archives');
    this.sessionsDir = path.join(this.metadataRoot, config.sessions_dir_name || 'sessions');
    this.leasesDir = path.join(this.metadataRoot, config.leases_dir_name || 'leases');
    this.registryFile = path.join(this.metadataRoot, 'registry.json');

    this.journal = new TransactionJournal(
      repoRoot,
      config.metadata_root,
      config.journal_dir_name || 'journal'
    );
  }

  public getJournal(): TransactionJournal {
    return this.journal;
  }

  public getRegistryPath(): string {
    return this.registryFile;
  }

  public getWorktreeRecordPath(id: string): string {
    return path.join(this.worktreesDir, `${id}.json`);
  }

  public getSessionRecordPath(sessionId: string): string {
    return path.join(this.sessionsDir, `${sessionId}.json`);
  }


  public getExperimentRecordPath(feature: string): string {
    return path.join(this.experimentsDir, `${feature}.json`);
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

  public async getExperiment(feature: string): Promise<ExperimentRecord | null> {
    const filePath = this.getExperimentRecordPath(feature);
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const raw = readJson<unknown>(filePath);
    const parsed = ExperimentRecordSchema.safeParse(raw);
    if (!parsed.success) {
      throw new MannostreeError(
        `Invalid experiment record schema for ${feature} in ${filePath}:\n${parsed.error.message}`,
        ExitCode.METADATA_INCONSISTENCY
      );
    }
    return parsed.data as ExperimentRecord;
  }

  public async saveExperiment(record: ExperimentRecord): Promise<void> {
    record.updated_at = new Date().toISOString();

    const validated = ExperimentRecordSchema.safeParse(record);
    if (!validated.success) {
      throw new MannostreeError(
        `Experiment record validation failed for ${record.feature}: ${validated.error.message}`,
        ExitCode.VALIDATION_FAILURE
      );
    }

    const filePath = this.getExperimentRecordPath(record.feature);
    writeAtomicJson(filePath, validated.data);

    // Update registry index
    const registry = await this.getRegistry();
    if (!registry.experiments.includes(record.feature)) {
      registry.experiments.push(record.feature);
      await this.saveRegistry(registry);
    }
  }

  public async deleteExperiment(feature: string): Promise<void> {
    const filePath = this.getExperimentRecordPath(feature);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    const registry = await this.getRegistry();
    registry.experiments = registry.experiments.filter((f) => f !== feature);
    await this.saveRegistry(registry);
  }

  public async listExperiments(): Promise<ExperimentRecord[]> {
    const registry = await this.getRegistry();
    const records: ExperimentRecord[] = [];

    for (const feature of registry.experiments) {
      const record = await this.getExperiment(feature);
      if (record) {
        records.push(record);
      }
    }

    return records;
  }

  public async getSession(sessionId: string): Promise<AgentSessionRecord | null> {
    const filePath = this.getSessionRecordPath(sessionId);
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const raw = readJson<unknown>(filePath);
    const parsed = AgentSessionRecordSchema.safeParse(raw);
    if (!parsed.success) {
      throw new MannostreeError(
        `Invalid session record schema for ${sessionId} in ${filePath}:\n${parsed.error.message}`,
        ExitCode.METADATA_INCONSISTENCY
      );
    }
    return parsed.data as AgentSessionRecord;
  }

  public async saveSession(record: AgentSessionRecord): Promise<void> {
    const validated = AgentSessionRecordSchema.safeParse(record);
    if (!validated.success) {
      throw new MannostreeError(
        `Session record validation failed for ${record.session_id}: ${validated.error.message}`,
        ExitCode.VALIDATION_FAILURE
      );
    }

    const filePath = this.getSessionRecordPath(record.session_id);
    writeAtomicJson(filePath, validated.data);
  }

  public async listSessions(filter?: { worktreeId?: string; feature?: string }): Promise<AgentSessionRecord[]> {
    if (!fs.existsSync(this.sessionsDir)) {
      return [];
    }

    const files = fs.readdirSync(this.sessionsDir).filter((f) => f.endsWith('.json'));
    const sessions: AgentSessionRecord[] = [];

    for (const file of files) {
      const sessionId = file.replace(/\.json$/, '');
      const session = await this.getSession(sessionId);
      if (session) {
        if (filter?.worktreeId && session.worktree_id !== filter.worktreeId) {
          continue;
        }
        if (filter?.feature && session.feature !== filter.feature) {
          continue;
        }
        sessions.push(session);
      }
    }

    return sessions.sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
  }

  public async deleteSession(sessionId: string): Promise<void> {
    const filePath = this.getSessionRecordPath(sessionId);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  public getLeaseRecordPath(worktreeId: string): string {
    return path.join(this.leasesDir, `${worktreeId}.json`);
  }

  public getReleaseManifestPath(targetBranch: string): string {
    const slug = targetBranch.replace(/\//g, '_');
    const releasesDir = path.join(this.metadataRoot, this.config.releases_dir_name || 'releases');
    return path.join(releasesDir, `${slug}.json`);
  }

  public async getReleaseManifest(targetBranch: string): Promise<ReleaseManifestRecord | null> {
    const filePath = this.getReleaseManifestPath(targetBranch);
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const data = readJson<unknown>(filePath);
    const parsed = ReleaseManifestRecordSchema.safeParse(data);
    if (!parsed.success) {
      throw new MannostreeError(
        `Invalid release manifest schema for ${targetBranch} in ${filePath}:\n${parsed.error.message}`,
        ExitCode.METADATA_INCONSISTENCY
      );
    }
    return parsed.data as ReleaseManifestRecord;
  }

  public async saveReleaseManifest(manifest: ReleaseManifestRecord): Promise<void> {
    const validated = ReleaseManifestRecordSchema.safeParse(manifest);
    if (!validated.success) {
      throw new MannostreeError(
        `Release manifest validation failed for ${manifest.target_branch}: ${validated.error.message}`,
        ExitCode.VALIDATION_FAILURE
      );
    }

    const filePath = this.getReleaseManifestPath(manifest.target_branch);
    writeAtomicJson(filePath, validated.data);
  }

  public async listReleaseManifests(): Promise<ReleaseManifestRecord[]> {
    const releasesDir = path.join(this.metadataRoot, this.config.releases_dir_name || 'releases');
    if (!fs.existsSync(releasesDir)) {
      return [];
    }

    const files = fs.readdirSync(releasesDir).filter((f) => f.endsWith('.json'));
    const manifests: ReleaseManifestRecord[] = [];

    for (const file of files) {
      const fullPath = path.join(releasesDir, file);
      try {
        const raw = readJson<unknown>(fullPath);
        const parsed = ReleaseManifestRecordSchema.safeParse(raw);
        if (parsed.success) {
          manifests.push(parsed.data as ReleaseManifestRecord);
        }
      } catch {
        // ignore unparseable
      }
    }

    return manifests.sort((a, b) => new Date(b.assembled_at).getTime() - new Date(a.assembled_at).getTime());
  }

  public async getLease(worktreeId: string): Promise<WorkspaceLease | null> {
    const filePath = this.getLeaseRecordPath(worktreeId);
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const data = readJson<unknown>(filePath);
    const parsed = WorkspaceLeaseSchema.safeParse(data);
    if (!parsed.success) {
      throw new MannostreeError(
        `Invalid lease record schema for ${worktreeId} in ${filePath}:\n${parsed.error.message}`,
        ExitCode.METADATA_INCONSISTENCY
      );
    }
    return parsed.data as WorkspaceLease;
  }

  public async saveLease(record: WorkspaceLease): Promise<void> {
    const validated = WorkspaceLeaseSchema.safeParse(record);
    if (!validated.success) {
      throw new MannostreeError(
        `Lease record validation failed for ${record.worktree_id}: ${validated.error.message}`,
        ExitCode.VALIDATION_FAILURE
      );
    }

    const filePath = this.getLeaseRecordPath(record.worktree_id);
    writeAtomicJson(filePath, validated.data);
  }

  public async listLeases(filter?: { activeOnly?: boolean }): Promise<WorkspaceLease[]> {
    if (!fs.existsSync(this.leasesDir)) {
      return [];
    }

    const files = fs.readdirSync(this.leasesDir).filter((f) => f.endsWith('.json'));
    const leases: WorkspaceLease[] = [];
    const now = new Date().getTime();

    for (const file of files) {
      const worktreeId = file.replace(/\.json$/, '');
      const lease = await this.getLease(worktreeId);
      if (lease) {
        const isExpired = new Date(lease.expires_at).getTime() <= now;
        if (filter?.activeOnly) {
          if (lease.status === 'active' && !isExpired) {
            leases.push(lease);
          }
        } else {
          leases.push(lease);
        }
      }
    }

    return leases.sort((a, b) => new Date(b.acquired_at).getTime() - new Date(a.acquired_at).getTime());
  }

  public async deleteLease(worktreeId: string): Promise<void> {
    const filePath = this.getLeaseRecordPath(worktreeId);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}



