import { describe, it, expect } from 'vitest';
import { parseRemoteUrl } from '../../src/adapters/detector.js';

describe('Movement 7: Remote URL Parser & Host Detector', () => {
  it('parses standard GitHub SSH and HTTPS URLs', () => {
    const ssh = parseRemoteUrl('git@github.com:STP72-dev/mannostree.git');
    expect(ssh.host_type).toBe('github');
    expect(ssh.hostname).toBe('github.com');
    expect(ssh.owner).toBe('STP72-dev');
    expect(ssh.repo).toBe('mannostree');
    expect(ssh.is_custom_domain).toBe(false);

    const https = parseRemoteUrl('https://github.com/organcorp/mannostree.git');
    expect(https.host_type).toBe('github');
    expect(https.hostname).toBe('github.com');
    expect(https.owner).toBe('organcorp');
    expect(https.repo).toBe('mannostree');
  });

  it('parses GitLab SaaS and nested subgroup URLs', () => {
    const glSsh = parseRemoteUrl('git@gitlab.com:deepmind/agents/subteam/experiment.git');
    expect(glSsh.host_type).toBe('gitlab');
    expect(glSsh.hostname).toBe('gitlab.com');
    expect(glSsh.owner).toBe('deepmind/agents/subteam');
    expect(glSsh.repo).toBe('experiment');
    expect(glSsh.project_id_encoded).toBe('deepmind%2Fagents%2Fsubteam%2Fexperiment');
    expect(glSsh.is_custom_domain).toBe(false);

    const glHttps = parseRemoteUrl('https://gitlab.com/acme/project.git');
    expect(glHttps.host_type).toBe('gitlab');
    expect(glHttps.owner).toBe('acme');
    expect(glHttps.repo).toBe('project');
  });

  it('parses self-hosted GitLab, Gitea, and Bitbucket URLs', () => {
    const selfGitLab = parseRemoteUrl('ssh://git@gitlab.internal.corp:2222/platform/core.git');
    expect(selfGitLab.host_type).toBe('gitlab');
    expect(selfGitLab.hostname).toBe('gitlab.internal.corp');
    expect(selfGitLab.owner).toBe('platform');
    expect(selfGitLab.repo).toBe('core');
    expect(selfGitLab.is_custom_domain).toBe(true);

    const gitea = parseRemoteUrl('https://gitea.local/team/project.git');
    expect(gitea.host_type).toBe('gitea');
    expect(gitea.owner).toBe('team');
    expect(gitea.repo).toBe('project');

    const bitbucket = parseRemoteUrl('git@bitbucket.org:workspace/service.git');
    expect(bitbucket.host_type).toBe('bitbucket');
    expect(bitbucket.owner).toBe('workspace');
    expect(bitbucket.repo).toBe('service');
  });

  it('supports custom domain mapping overrides from configuration', () => {
    const customMappings = {
      internal_git: {
        domain: 'git.enterprise.io',
        type: 'gitlab' as const,
      },
    };
    const parsed = parseRemoteUrl('git@git.enterprise.io:eng/backend.git', 'origin', customMappings);
    expect(parsed.host_type).toBe('gitlab');
    expect(parsed.hostname).toBe('git.enterprise.io');
    expect(parsed.is_custom_domain).toBe(true);
  });
});
