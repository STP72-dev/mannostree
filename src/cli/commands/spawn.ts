import { Command } from 'commander';
import chalk from 'chalk';
import { loadConfig } from '../../config/loader.js';
import { MannostreeOrchestrator } from '../../core/orchestrator.js';
import { GitEngine } from '../../git/engine.js';
import { formatOutput } from '../output.js';
import { GlobalOptions } from '../../types/index.js';

export function registerSpawnCommand(program: Command): void {
  program
    .command('spawn <name>')
    .description('Create a single isolated worktree from an explicit base branch')
    .option('-b, --base <base>', 'Explicit base branch (default: resolved from config/remote)')
    .option('--base-branch <base>', 'Explicit base branch alias')
    .option('--kind <kind>', 'Branch and worktree kind (feature, fix, docs, refactor)', 'feature')
    .option('--no-setup', 'Skip running profile setup commands')
    .option('--env <mode>', 'Env policy mode (copy, link, skip, generate)', 'skip')
    .option('-i, --issue <key>', 'Bind and ingest remote issue ticket (e.g. PROJ-101, ENG-88, #42)')
    .option('--issue-provider <provider>', 'Explicit issue tracker provider (jira, linear, github, generic)')
    .option('--no-transition', 'Do not auto-transition issue status to In Progress on spawn')
    .action(async (name: string, cmdOptions: any) => {
      const globalOpts = program.opts<GlobalOptions>();
      const cwd = globalOpts.cwd ? globalOpts.cwd : process.cwd();

      const config = loadConfig(globalOpts.config, cwd);
      const git = new GitEngine(cwd);
      const repoRoot = await git.getRepoRoot();

      const orchestrator = new MannostreeOrchestrator(repoRoot, config);

      const result = await orchestrator.spawn({
        name,
        baseBranch: cmdOptions.baseBranch || cmdOptions.base,
        kind: cmdOptions.kind,
        profile: globalOpts.profile || 'default',
        noSetup: !cmdOptions.setup,
        env: cmdOptions.env,
        issue: cmdOptions.issue,
        issueProvider: cmdOptions.issueProvider,
        noIssueTransition: !cmdOptions.transition,
        dryRun: globalOpts.dryRun,
      });

      formatOutput(result, globalOpts, (data, dryRun) => {
        const lines = [
          dryRun
            ? chalk.yellow(`Plan: would spawn worktree '${data.id}'`)
            : chalk.green(`✔ Successfully spawned worktree '${data.id}'`),
          `  ${chalk.dim('Path:')}   ${data.worktree_path}`,
          `  ${chalk.dim('Branch:')} ${data.branch}`,
          `  ${chalk.dim('Base:')}   ${data.base_branch}`,
          `  ${chalk.dim('State:')}  ${data.lifecycle_state}`,
        ];

        if ((data.task as any)?.issue_key) {
          lines.push(`  ${chalk.dim('Issue:')}  [${(data.task as any).issue_key}] (${(data.task as any).issue_provider || 'tracker'})`);
        }

        return lines.join('\n');
      });
    });
}

