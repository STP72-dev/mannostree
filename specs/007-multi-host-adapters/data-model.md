# Data Model: Movement 7 — Multi-Host Adapters

## 1. Domain Entities & Interfaces

### `HostAdapterType`
```typescript
export type HostAdapterType =
  | 'github'
  | 'gitlab'
  | 'gitea'
  | 'bitbucket'
  | 'generic';
```

### `RemoteHostInfo`
Extracted metadata from parsed git remote URLs.
```typescript
export interface RemoteHostInfo {
  host_type: HostAdapterType;
  hostname: string;
  owner: string;
  repo: string;
  remote_name: string;
  remote_url: string;
  is_custom_domain: boolean;
  project_id_encoded?: string; // e.g. group%2Fsubgroup%2Frepo for GitLab
}
```

### `HostPublishOptions`
Input parameters supplied to host adapters.
```typescript
export interface HostPublishOptions {
  title: string;
  body: string;
  source_branch: string;
  target_base: string;
  draft?: boolean;
  push?: boolean;
  host_override?: HostAdapterType;
  remote_name?: string;
  token?: string;
  base_url?: string;
}
```

### `HostPublishResult`
Standardized result returned by all host adapters.
```typescript
export interface HostPublishResult {
  host_type: HostAdapterType;
  mode: 'published' | 'prepare-only' | 'pushed-only';
  pr_number?: number | null;
  pr_url?: string | null;
  web_url?: string | null;
  instructions?: string;
  raw_response?: Record<string, any>;
}
```

### `HostHealthStatus`
Diagnostic health report generated during `mannostree doctor`.
```typescript
export interface HostHealthStatus {
  host_type: HostAdapterType;
  available: boolean;
  cli_found: boolean;
  cli_name?: string;
  token_configured: boolean;
  token_env_var?: string;
  reachable?: boolean;
  message: string;
}
```

---

## 2. Configuration Schema Extensions

Extension to `MannostreeConfigSchema` in `src/config/schema.ts`:
```typescript
export const HostConfigEntrySchema = z.object({
  domain: z.string().optional(),
  type: z.enum(['github', 'gitlab', 'gitea', 'bitbucket', 'generic']).optional(),
  base_url: z.string().url().optional(),
  token_env: z.string().optional(),
  username_env: z.string().optional(),
  default_draft: z.boolean().optional(),
});

export const PublishConfigSchema = z.object({
  default_remote: z.string().default('origin'),
  default_host: z.enum(['auto', 'github', 'gitlab', 'gitea', 'bitbucket', 'generic']).default('auto'),
  default_draft: z.boolean().default(true),
  push_on_pr_create: z.boolean().default(false),
  pr_body_source: z.enum(['artifacts', 'template', 'commit']).default('artifacts'),
  hosts: z.record(HostConfigEntrySchema).optional(),
});
```

---

## 3. Metadata Extensions

`PublishMetadata` in `WorktreeRecord` & `ExperimentRecord`:
```typescript
export interface PublishMetadata {
  pushed: boolean;
  host_type?: HostAdapterType;
  pr_number?: number | null;
  pr_url?: string | null;
  published_at?: string | null;
  remote?: string;
}
```
