import { MannostreeConfig } from '../config/schema.js';
import { ExitCode, MannostreeError } from '../types/index.js';
import { GitEngine } from './engine.js';

export interface BaseBranchResolutionContext {
  cliBaseBranch?: string;
  profileName?: string;
  config: MannostreeConfig;
  gitEngine: GitEngine;
}

export async function resolveBaseBranch(
  context: BaseBranchResolutionContext
): Promise<string> {
  const { cliBaseBranch, profileName, config, gitEngine } = context;
  const resolutionOrder = config.base_branch_resolution?.order || [
    'cli',
    'profile',
    'config',
    'repo',
    'remote',
  ];

  for (const step of resolutionOrder) {
    if (step === 'cli' && cliBaseBranch && cliBaseBranch.trim().length > 0) {
      const exists = await gitEngine.branchOrRefExists(cliBaseBranch);
      if (!exists) {
        throw new MannostreeError(
          `Specified base branch '${cliBaseBranch}' does not exist in repository`,
          ExitCode.USAGE_ERROR
        );
      }
      return cliBaseBranch;
    }

    if (step === 'profile' && profileName && config.profiles[profileName]) {
      // If profile config has base branch (future-proof profile extension)
      const profile = config.profiles[profileName] as any;
      if (profile.base_branch) {
        const exists = await gitEngine.branchOrRefExists(profile.base_branch);
        if (exists) return profile.base_branch;
      }
    }

    if (step === 'config' && config.default_base_branch) {
      const exists = await gitEngine.branchOrRefExists(config.default_base_branch);
      if (exists) {
        return config.default_base_branch;
      }
    }

    if (step === 'remote') {
      const remoteDefault = await gitEngine.getRemoteDefaultBranch();
      if (remoteDefault) {
        const exists = await gitEngine.branchOrRefExists(remoteDefault);
        if (exists) return remoteDefault;
      }
    }

    if (step === 'repo') {
      // Check common default branch names
      for (const candidate of ['main', 'master']) {
        const exists = await gitEngine.branchOrRefExists(candidate);
        if (exists) return candidate;
      }
    }
  }

  // If forbid_current_branch_as_base is set (default true), reject implicit fallback
  if (config.base_branch_resolution?.forbid_current_branch_as_base) {
    throw new MannostreeError(
      'Could not deterministically resolve an explicit base branch. Falling back to the current checked-out branch is forbidden by safety policy. Please supply `-b <base>`.',
      ExitCode.VALIDATION_FAILURE
    );
  }

  const currentBranch = await gitEngine.getCurrentBranch();
  if (currentBranch) {
    return currentBranch;
  }

  throw new MannostreeError(
    'Unable to determine base branch for worktree.',
    ExitCode.VALIDATION_FAILURE
  );
}
