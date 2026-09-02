import { HostAdapterType, RemoteHostInfo } from '../types/index.js';

/**
 * Parse a git remote URL into structured RemoteHostInfo.
 * Supports standard HTTPS, SSH, custom ports, and self-hosted domains.
 */
export function parseRemoteUrl(
  remoteUrl: string,
  remoteName = 'origin',
  customMappings?: Record<string, { domain?: string; type?: HostAdapterType }>
): RemoteHostInfo {
  const raw = (remoteUrl || '').trim();
  if (!raw) {
    return {
      host_type: 'generic',
      hostname: 'unknown',
      owner: 'unknown',
      repo: 'unknown',
      remote_name: remoteName,
      remote_url: raw,
      is_custom_domain: false,
    };
  }

  let hostname = '';
  let pathPart = '';

  // 1. Check SSH scp-like syntax: git@host:owner/repo.git
  const scpMatch = raw.match(/^(?:[a-zA-Z0-9._-]+@)?([a-zA-Z0-9.-]+):(.+)$/);
  if (scpMatch && !raw.startsWith('http://') && !raw.startsWith('https://') && !raw.startsWith('ssh://')) {
    hostname = scpMatch[1].toLowerCase();
    pathPart = scpMatch[2];
  } else {
    // 2. Standard URL syntax (https://, ssh://, git://)
    try {
      const parsed = new URL(raw);
      hostname = parsed.hostname.toLowerCase();
      pathPart = parsed.pathname;
    } catch {
      // Fallback regex for non-standard schemes
      const urlMatch = raw.match(/^[a-zA-Z0-9+.-]+:\/\/(?:[a-zA-Z0-9._-]+@)?([a-zA-Z0-9.-]+)(?::\d+)?\/(.+)$/);
      if (urlMatch) {
        hostname = urlMatch[1].toLowerCase();
        pathPart = urlMatch[2];
      } else {
        hostname = 'unknown';
        pathPart = raw;
      }
    }
  }

  // Clean pathPart
  pathPart = pathPart.replace(/^\/+/, '').replace(/\.git\/?$/, '');

  // Extract owner and repo
  const parts = pathPart.split('/').filter(Boolean);
  let owner = 'unknown';
  let repo = 'unknown';

  if (parts.length === 1) {
    owner = 'unknown';
    repo = parts[0];
  } else if (parts.length === 2) {
    owner = parts[0];
    repo = parts[1];
  } else if (parts.length > 2) {
    // Nested groups (e.g. GitLab subgroups: group/subgroup/project)
    owner = parts.slice(0, -1).join('/');
    repo = parts[parts.length - 1];
  }

  // Determine host type
  let hostType: HostAdapterType = 'generic';
  let isCustom = false;

  // Check custom configuration mapping first
  if (customMappings) {
    for (const entry of Object.values(customMappings)) {
      if (entry.domain && hostname === entry.domain.toLowerCase()) {
        hostType = entry.type || 'generic';
        isCustom = true;
        break;
      }
    }
  }

  if (hostType === 'generic') {
    if (hostname.includes('github.com')) {
      hostType = 'github';
      isCustom = false;
    } else if (hostname.includes('gitlab')) {
      hostType = 'gitlab';
      isCustom = !hostname.includes('gitlab.com');
    } else if (hostname.includes('gitea') || hostname.includes('forgejo')) {
      hostType = 'gitea';
      isCustom = true;
    } else if (hostname.includes('bitbucket')) {
      hostType = 'bitbucket';
      isCustom = !hostname.includes('bitbucket.org');
    } else {
      hostType = 'generic';
      isCustom = true;
    }
  }

  const projectEncoded = owner !== 'unknown' && repo !== 'unknown'
    ? encodeURIComponent(`${owner}/${repo}`)
    : undefined;

  return {
    host_type: hostType,
    hostname,
    owner,
    repo,
    remote_name: remoteName,
    remote_url: raw,
    is_custom_domain: isCustom,
    project_id_encoded: projectEncoded,
  };
}
