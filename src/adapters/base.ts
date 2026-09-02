import {
  HostAdapterType,
  HostHealthStatus,
  HostPublishOptions,
  HostPublishResult,
  RemoteHostInfo,
  MannostreeError,
  ExitCode,
} from '../types/index.js';
import { parseRemoteUrl } from './detector.js';

export interface HostAdapter {
  readonly hostType: HostAdapterType;
  detect(remoteUrl: string): boolean;
  createPullRequest(
    worktreePath: string,
    hostInfo: RemoteHostInfo,
    options: HostPublishOptions
  ): Promise<HostPublishResult>;
  checkHealth(config?: any): Promise<HostHealthStatus>;
  getPrWebUrl(hostInfo: RemoteHostInfo, prNumberOrIid: number): string;
}

export class AdapterRegistry {
  private adapters: Map<HostAdapterType, HostAdapter> = new Map();

  public registerAdapter(adapter: HostAdapter): void {
    this.adapters.set(adapter.hostType, adapter);
  }

  public getAdapter(hostType: HostAdapterType): HostAdapter {
    const adapter = this.adapters.get(hostType);
    if (!adapter) {
      const generic = this.adapters.get('generic');
      if (generic) return generic;
      throw new MannostreeError(
        `No adapter registered for host type '${hostType}'.`,
        ExitCode.PUBLISH_ERROR
      );
    }
    return adapter;
  }

  public resolveAdapterForRemote(
    remoteUrl: string,
    hostOverride?: HostAdapterType,
    customMappings?: Record<string, { domain?: string; type?: HostAdapterType }>
  ): { adapter: HostAdapter; hostInfo: RemoteHostInfo } {
    const hostInfo = parseRemoteUrl(remoteUrl, 'origin', customMappings);
    const effectiveHost = hostOverride && hostOverride !== ('auto' as any)
      ? hostOverride
      : hostInfo.host_type;

    const adapter = this.getAdapter(effectiveHost);
    return { adapter, hostInfo: { ...hostInfo, host_type: effectiveHost } };
  }

  public listAdapters(): HostAdapter[] {
    return Array.from(this.adapters.values());
  }
}
