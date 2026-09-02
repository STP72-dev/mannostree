import { SandboxRegistry } from './base.js';
import { ProcessRuntime } from './process.js';
import { DockerRuntime } from './docker.js';
import { PodmanRuntime } from './podman.js';

export * from './base.js';
export * from './process.js';
export * from './docker.js';
export * from './podman.js';
export * from './receipt.js';

export function createDefaultSandboxRegistry(): SandboxRegistry {
  const registry = new SandboxRegistry();
  registry.register(new ProcessRuntime());
  registry.register(new DockerRuntime());
  registry.register(new PodmanRuntime());
  return registry;
}
