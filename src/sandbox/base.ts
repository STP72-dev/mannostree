import {
  SandboxRuntimeType,
  SandboxExecutionOptions,
  SandboxExecutionResult,
  SandboxHealthStatus,
  MannostreeError,
  ExitCode,
} from '../types/index.js';

export interface SandboxRuntime {
  readonly type: SandboxRuntimeType;
  execute(
    worktreePath: string,
    options: SandboxExecutionOptions
  ): Promise<SandboxExecutionResult>;
  checkHealth(config?: any): Promise<SandboxHealthStatus>;
  buildExecutionArgs?(
    worktreePath: string,
    options: SandboxExecutionOptions
  ): { executable: string; args: string[] };
}

export class SandboxRegistry {
  private runtimes: Map<SandboxRuntimeType, SandboxRuntime> = new Map();

  public register(runtime: SandboxRuntime): void {
    this.runtimes.set(runtime.type, runtime);
  }

  public get(type: SandboxRuntimeType): SandboxRuntime | undefined {
    return this.runtimes.get(type);
  }

  public getAll(): SandboxRuntime[] {
    return Array.from(this.runtimes.values());
  }

  public resolveRuntime(
    type?: SandboxRuntimeType,
    defaultType: SandboxRuntimeType = 'process'
  ): SandboxRuntime {
    const selectedType = type || defaultType;
    const runtime = this.get(selectedType);
    if (!runtime) {
      throw new MannostreeError(
        `Sandbox runtime '${selectedType}' is not registered. Available runtimes: ${Array.from(this.runtimes.keys()).join(', ')}`,
        ExitCode.USAGE_ERROR
      );
    }
    return runtime;
  }
}
