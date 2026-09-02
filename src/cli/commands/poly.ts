import { Command } from 'commander';
import chalk from 'chalk';
import { loadConfig } from '../../config/loader.js';
import { GitEngine } from '../../git/engine.js';
import { MannostreeOrchestrator } from '../../core/orchestrator.js';
import { GlobalOptions, PolySpawnOptions, PolyDropOptions, PolySyncOptions, PolyStatusOptions, PolyExecOptions, PolyPrOptions } from '../../types/index.js';

function printSuccess(msg: string): void {
  console.log(chalk.green(`✔ ${msg}`));
}

function printError(msg: string): void {
  console.error(chalk.red(`✖ ${msg}`));
}

async function getOrchestrator(program: Command, explicit?: MannostreeOrchestrator): Promise<MannostreeOrchestrator> {
  if (explicit) return explicit;
  const globalOpts = program.opts<GlobalOptions>();
  const cwd = globalOpts.cwd ? globalOpts.cwd : process.cwd();
  const config = loadConfig(globalOpts.config, cwd);
  const git = new GitEngine(cwd);
  let repoRoot = cwd;
  try {
    repoRoot = await git.getRepoRoot();
  } catch {
    repoRoot = cwd;
  }
  return new MannostreeOrchestrator(repoRoot, config);
}

export function registerPolyCommands(program: Command, optionalOrchestrator?: MannostreeOrchestrator): void {
  const poly = program.command('poly').description('Manage cross-repository poly-worktree clusters');

  // 1. poly spawn
  poly
    .command('spawn <feature>')
    .description('Spawn synchronized worktrees across all member repositories defined in manifest')
    .option('-b, --base <branch>', 'Base branch to branch off of across all member repositories')
    .option('-m, --manifest <path>', 'Custom path to .mannostree.poly.yml')
    .option('--no-link', 'Skip automatic local package linking')
    .option('--no-setup', 'Skip profile setup scripts')
    .option('--dry-run', 'Preview worktree creations without altering disk/git state')
    .action(async (feature: string, options: any) => {
      try {
        const orchestrator = await getOrchestrator(program, optionalOrchestrator);
        const polyOptions: PolySpawnOptions = {
          feature,
          base: options.base,
          manifest: options.manifest,
          noLink: options.link === false,
          noSetup: options.setup === false,
          dryRun: options.dryRun,
        };

        const result = await orchestrator.polyEngine.spawn(polyOptions);

        if (options.dryRun) {
          console.log(chalk.cyan(`\n[DRY RUN] Would spawn poly-worktree group '${feature}' across ${Object.keys(result.members).length} repositories:`));
          for (const [name, member] of Object.entries(result.members)) {
            console.log(`  - ${chalk.bold(name)}: branch '${member.branch}' off '${member.base_branch}' -> ${member.worktree_path}`);
          }
          return;
        }

        printSuccess(`Successfully spawned poly-worktree cluster for feature '${feature}':`);
        for (const [name, member] of Object.entries(result.members)) {
          console.log(`  - ${chalk.bold(name)}: ${chalk.green(member.worktree_path)} (${member.branch})`);
        }
        if (result.active_links.length > 0) {
          console.log(chalk.cyan(`\nActive Package Links (${result.active_links.length}):`));
          for (const link of result.active_links) {
            console.log(`  - ${link.source_repo} -> ${link.target_repo} (${link.strategy})`);
          }
        }
      } catch (err: any) {
        printError(err.message);
        process.exit(err.code || 1);
      }
    });

  // 2. poly drop
  poly
    .command('drop <feature>')
    .description('Safely drop worktrees across all member repositories in a poly group')
    .option('-m, --manifest <path>', 'Custom path to .mannostree.poly.yml')
    .option('--keep-branch', 'Retain git branches in member repositories')
    .option('--force', 'Bypass operational blockers')
    .option('--discard-uncommitted', 'Allow discarding uncommitted changes across member worktrees (requires --yes)')
    .option('-y, --yes', 'Confirm drop operation')
    .option('--dry-run', 'Preview drop operation without altering git/disk state')
    .action(async (feature: string, options: any) => {
      try {
        const orchestrator = await getOrchestrator(program, optionalOrchestrator);
        const dropOptions: PolyDropOptions = {
          feature,
          manifest: options.manifest,
          keepBranch: options.keepBranch,
          force: options.force,
          discardUncommitted: options.discardUncommitted,
          yes: options.yes,
          dryRun: options.dryRun,
        };

        const result = await orchestrator.polyEngine.drop(dropOptions);

        if (options.dryRun) {
          console.log(chalk.cyan(`\n[DRY RUN] Would drop poly-worktrees for '${feature}' in: ${result.dropped.join(', ')}`));
          return;
        }

        printSuccess(`Dropped poly-worktrees for feature '${feature}' in: ${result.dropped.join(', ')}`);
      } catch (err: any) {
        printError(err.message);
        process.exit(err.code || 1);
      }
    });

  // 3. poly link
  poly
    .command('link <feature>')
    .description('Establish local package links across member worktrees in a poly group')
    .option('-m, --manifest <path>', 'Custom path to .mannostree.poly.yml')
    .action(async (feature: string, options: any) => {
      try {
        const orchestrator = await getOrchestrator(program, optionalOrchestrator);
        const { manifest, resolvedRepos } = orchestrator.polyEngine.resolveClusterContext(options.manifest);
        const group = await orchestrator.store.getPolyGroup(feature);
        const members = group ? group.members : {};

        const links = await orchestrator.polyLinkEngine.linkGroup(feature, manifest, members);
        printSuccess(`Configured ${links.length} cross-repository package link(s) for '${feature}'.`);
        for (const link of links) {
          console.log(`  - ${link.source_repo} -> ${link.target_repo} [${link.strategy}]: ${link.status}`);
        }
      } catch (err: any) {
        printError(err.message);
        process.exit(err.code || 1);
      }
    });

  // 4. poly unlink
  poly
    .command('unlink <feature>')
    .description('Remove local package links across member worktrees in a poly group')
    .action(async (feature: string) => {
      try {
        const orchestrator = await getOrchestrator(program, optionalOrchestrator);
        await orchestrator.polyLinkEngine.unlinkGroup(feature);
        printSuccess(`Successfully unlinked package dependencies for '${feature}'.`);
      } catch (err: any) {
        printError(err.message);
        process.exit(err.code || 1);
      }
    });

  // 5. poly sync
  poly
    .command('sync <feature>')
    .description('Synchronize base branches across all member worktrees in a poly group')
    .option('-m, --manifest <path>', 'Custom path to .mannostree.poly.yml')
    .option('-s, --strategy <strategy>', 'Sync strategy: rebase, merge, or ff-only', 'rebase')
    .option('--no-fetch', 'Skip git remote fetch before sync')
    .option('--dry-run', 'Simulate synchronization without applying commits')
    .action(async (feature: string, options: any) => {
      try {
        const orchestrator = await getOrchestrator(program, optionalOrchestrator);
        const syncOptions: PolySyncOptions = {
          feature,
          manifest: options.manifest,
          strategy: options.strategy,
          fetch: options.fetch !== false,
          dryRun: options.dryRun,
        };

        const result = await orchestrator.polyEngine.sync(syncOptions);
        if (options.dryRun) {
          console.log(chalk.cyan(`\n[DRY RUN] Would sync member worktrees: ${result.synced.join(', ')}`));
          return;
        }

        printSuccess(`Synchronized base branches for '${feature}': ${result.synced.join(', ')}`);
        if (Object.keys(result.errors).length > 0) {
          console.log(chalk.yellow(`\nSync warnings/errors:`));
          for (const [name, err] of Object.entries(result.errors)) {
            console.log(`  - ${name}: ${err}`);
          }
        }
      } catch (err: any) {
        printError(err.message);
        process.exit(err.code || 1);
      }
    });

  // 6. poly status
  poly
    .command('status [feature]')
    .description('Display composite status matrix across all member repositories')
    .option('-m, --manifest <path>', 'Custom path to .mannostree.poly.yml')
    .option('--fetch', 'Fetch remote branches before status')
    .option('--json', 'Output raw JSON status matrix')
    .action(async (feature: string | undefined, options: any) => {
      try {
        const orchestrator = await getOrchestrator(program, optionalOrchestrator);
        const statusOptions: PolyStatusOptions = {
          feature,
          manifest: options.manifest,
          fetch: options.fetch,
        };

        const summary = await orchestrator.polyEngine.getStatus(statusOptions);

        if (options.json) {
          console.log(JSON.stringify(summary, null, 2));
          return;
        }

        console.log(chalk.bold(`\n🌐 Poly-Worktree Cluster: ${chalk.cyan(summary.manifest_name)} (Feature: ${summary.feature})`));
        console.log(`\n  Member Worktree Status Matrix:`);
        console.log(`  ${'Repository'.padEnd(16)} ${'Branch'.padEnd(20)} ${'Base'.padEnd(12)} ${'Ahead/Behind'.padEnd(14)} ${'Status'.padEnd(10)}`);
        console.log(`  ${'-'.repeat(74)}`);

        for (const m of summary.members) {
          const aheadBehind = `+${m.ahead}/-${m.behind}`;
          const statusColor = m.status === 'clean' ? chalk.green : m.status === 'dirty' ? chalk.yellow : chalk.red;
          console.log(
            `  ${m.repo_name.padEnd(16)} ${m.branch.padEnd(20)} ${m.base_branch.padEnd(12)} ${aheadBehind.padEnd(14)} ${statusColor(m.status)}`
          );
        }

        if (summary.active_links.length > 0) {
          console.log(chalk.bold(`\n  Active Package Links:`));
          for (const link of summary.active_links) {
            console.log(`    - ${link.source_repo} -> ${link.target_repo} [${link.strategy}]: ${chalk.green(link.status)}`);
          }
        }
        console.log('');
      } catch (err: any) {
        printError(err.message);
        process.exit(err.code || 1);
      }
    });

  // 7. poly exec
  poly
    .command('exec <feature> <command...>')
    .description('Execute command across member worktrees in a poly group')
    .option('-m, --manifest <path>', 'Custom path to .mannostree.poly.yml')
    .option('--parallel', 'Run concurrently across worktrees')
    .option('--repo <name>', 'Limit execution to specific member repository')
    .option('--sandbox <type>', 'Execute inside sandbox container (docker, podman, process)')
    .action(async (feature: string, commandParts: string[], options: any) => {
      try {
        const orchestrator = await getOrchestrator(program, optionalOrchestrator);
        const fullCmd = commandParts.join(' ');
        const execOptions: PolyExecOptions = {
          feature,
          command: fullCmd,
          manifest: options.manifest,
          parallel: options.parallel,
          repo: options.repo,
          sandbox: options.sandbox,
        };

        const results = await orchestrator.polyEngine.exec(execOptions);
        for (const [name, res] of Object.entries(results)) {
          console.log(chalk.bold(`\n=== [${name}] (Exit code: ${res.exitCode}) ===`));
          if (res.stdout) console.log(res.stdout);
          if (res.stderr) console.error(chalk.red(res.stderr));
        }
      } catch (err: any) {
        printError(err.message);
        process.exit(err.code || 1);
      }
    });

  // 8. poly pr
  poly
    .command('pr <feature>')
    .description('Publish pull requests across all member repositories with joint cross-links')
    .option('-m, --manifest <path>', 'Custom path to .mannostree.poly.yml')
    .option('--title <title>', 'Joint PR title template')
    .option('--draft', 'Create pull requests as draft (default: true)', true)
    .option('--no-draft', 'Create pull requests as ready for review')
    .option('--push', 'Push branches to remotes before creating PRs')
    .option('-r, --remote <name>', 'Remote repository name', 'origin')
    .option('--dry-run', 'Preview joint PR manifest without publishing')
    .action(async (feature: string, options: any) => {
      try {
        const orchestrator = await getOrchestrator(program, optionalOrchestrator);
        const prOptions: PolyPrOptions = {
          feature,
          manifest: options.manifest,
          title: options.title,
          draft: options.draft,
          push: options.push,
          remote: options.remote,
          dryRun: options.dryRun,
        };

        const manifest = await orchestrator.polyPublishEngine.publishPolyPR(prOptions);

        if (options.dryRun) {
          console.log(chalk.cyan(`\n[DRY RUN] Would publish joint PRs across ${manifest.members.length} repositories:`));
          console.log(manifest.joint_release_table_markdown);
          return;
        }

        printSuccess(`Successfully published joint PRs across ${manifest.members.length} repositories:`);
        for (const m of manifest.members) {
          console.log(`  - ${chalk.bold(m.repo_name)}: ${m.pr_url || '(ready to open)'}`);
        }
      } catch (err: any) {
        printError(err.message);
        process.exit(err.code || 1);
      }
    });
}
