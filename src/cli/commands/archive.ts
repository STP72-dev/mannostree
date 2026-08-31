import { Command } from 'commander';
import { loadConfig } from '../../config/loader.js';
import { MannostreeOrchestrator } from '../../core/orchestrator.js';
import { GitEngine } from '../../git/engine.js';
import { formatOutput } from '../output.js';
import { GlobalOptions } from '../../types/index.js';

export function registerArchiveCommand(program: Command): void {
  program
    .command('archive <id>')
    .description('Unmount physical worktree to reclaim disk space while preserving branch and metadata')
    .option('--force', 'Force unmount even if worktree has uncommitted changes')
    .option('-y, --yes', 'Confirm unmounting of worktree directory')
    .action(async (id: string, cmdOptions: any) => {
      const globalOpts = program.opts<GlobalOptions>();
      const cwd = globalOpts.cwd ? globalOpts.cwd : process.cwd();

      const config = loadConfig(globalOpts.config, cwd);
      const git = new GitEngine(cwd);
      const repoRoot = await git.getRepoRoot();

      const orchestrator = new MannostreeOrchestrator(repoRoot, config);

      const result = await orchestrator.archive(id, {
        force: cmdOptions.force,
        yes: cmdOptions.yes,
        dryRun: globalOpts.dryRun,
      });

      formatOutput(result, globalOpts, (data, dryRun) => {
        if (dryRun) {
          return `[DRY-RUN] Would archive worktree '${data.id}' (unmount '${data.worktree_path}')`;
        }
        return `Successfully archived worktree '${data.id}' (unmounted '${data.worktree_path}')`;
      });
    });

  program
    .command('restore <id>')
    .description('Recreate physical worktree from branch and metadata')
    .option('-y, --yes', 'Confirm recreation of worktree directory')
    .action(async (id: string, cmdOptions: any) => {
      const globalOpts = program.opts<GlobalOptions>();
      const cwd = globalOpts.cwd ? globalOpts.cwd : process.cwd();

      const config = loadConfig(globalOpts.config, cwd);
      const git = new GitEngine(cwd);
      const repoRoot = await git.getRepoRoot();

      const orchestrator = new MannostreeOrchestrator(repoRoot, config);

      const result = await orchestrator.restore(id, {
        yes: cmdOptions.yes,
        dryRun: globalOpts.dryRun,
      });

      formatOutput(result, globalOpts, (data, dryRun) => {
        if (dryRun) {
          return `[DRY-RUN] Would restore worktree '${data.id}' to '${data.worktree_path}'`;
        }
        return `Successfully restored worktree '${data.id}' at '${data.worktree_path}'`;
      });
    });
}
