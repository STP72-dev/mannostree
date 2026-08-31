import { Command } from 'commander';
import { loadConfig } from '../../config/loader.js';
import { MannostreeOrchestrator } from '../../core/orchestrator.js';
import { GitEngine } from '../../git/engine.js';
import { formatOutput, formatRecoverResult } from '../output.js';
import { GlobalOptions } from '../../types/index.js';

export function registerRecoverCommand(program: Command): void {
  program
    .command('recover [id]')
    .description('Reattach or repair a broken worktree workspace or rollback interrupted transactions')
    .option('--rebuild-metadata', 'Reconstruct metadata record from on-disk worktree directory')
    .option('--reattach-worktree', 'Recreate worktree directory and repair git links')
    .option('--reattach-branch', 'Recreate git branch at base branch for tracked worktree')
    .option('--rollback', 'Rollback any in-flight interrupted transaction')
    .option('-y, --yes', 'Confirm execution of repair action')
    .action(async (id: string | undefined, cmdOptions: any) => {
      const globalOpts = program.opts<GlobalOptions>();
      const cwd = globalOpts.cwd ? globalOpts.cwd : process.cwd();

      const config = loadConfig(globalOpts.config, cwd);
      const git = new GitEngine(cwd);
      const repoRoot = await git.getRepoRoot();

      const orchestrator = new MannostreeOrchestrator(repoRoot, config);

      const result = await orchestrator.recover(id, {
        rebuildMetadata: cmdOptions.rebuildMetadata,
        reattachWorktree: cmdOptions.reattachWorktree,
        reattachBranch: cmdOptions.reattachBranch,
        recoverTransaction: cmdOptions.rollback,
        yes: cmdOptions.yes,
        dryRun: globalOpts.dryRun,
      });

      formatOutput(result, globalOpts, (data, dryRun) =>
        formatRecoverResult(data, dryRun)
      );
    });
}
