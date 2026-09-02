import { AdapterRegistry } from './base.js';
import { GitHubAdapter } from './github.js';
import { GitLabAdapter } from './gitlab.js';
import { GiteaAdapter } from './gitea.js';
import { BitbucketAdapter } from './bitbucket.js';
import { GenericAdapter } from './generic.js';

export * from './base.js';
export * from './detector.js';
export * from './github.js';
export * from './gitlab.js';
export * from './gitea.js';
export * from './bitbucket.js';
export * from './generic.js';

export function createDefaultAdapterRegistry(): AdapterRegistry {
  const registry = new AdapterRegistry();
  registry.registerAdapter(new GitHubAdapter());
  registry.registerAdapter(new GitLabAdapter());
  registry.registerAdapter(new GiteaAdapter());
  registry.registerAdapter(new BitbucketAdapter());
  registry.registerAdapter(new GenericAdapter());
  return registry;
}
