import fs from 'node:fs';
import path from 'node:path';
import { MetadataStore } from '../metadata/store.js';
import {
  PolyManifestConfig,
  PolyWorktreeMemberInstance,
  PolyLinkRecord,
  PolyLinkStrategy,
} from '../types/index.js';

export class PolyLinkEngine {
  private store: MetadataStore;

  constructor(store: MetadataStore) {
    this.store = store;
  }

  public async linkGroup(
    feature: string,
    manifest: PolyManifestConfig,
    members: Record<string, PolyWorktreeMemberInstance>
  ): Promise<PolyLinkRecord[]> {
    if (!manifest.links || manifest.links.length === 0) {
      return [];
    }

    const activeLinks: PolyLinkRecord[] = [];
    const allLinksRecord = await this.store.getPolyLinks();

    for (const rule of manifest.links) {
      const sourceMember = members[rule.source_repo];
      const targetMember = members[rule.target_repo];

      if (!sourceMember || !targetMember) {
        continue;
      }

      const sourcePath = sourceMember.worktree_path;
      const targetPath = targetMember.worktree_path;

      if (!fs.existsSync(sourcePath) || !fs.existsSync(targetPath)) {
        continue;
      }

      const linkId = `${feature}-${rule.source_repo}->${rule.target_repo}`;

      try {
        await this.applyLink(rule.strategy, sourcePath, targetPath, rule.package_name, rule.target_subpath);

        const record: PolyLinkRecord = {
          id: linkId,
          feature,
          source_repo: rule.source_repo,
          target_repo: rule.target_repo,
          strategy: rule.strategy,
          source_path: sourcePath,
          target_path: targetPath,
          package_name: rule.package_name,
          created_at: new Date().toISOString(),
          status: 'linked',
        };

        activeLinks.push(record);
      } catch (err: any) {
        activeLinks.push({
          id: linkId,
          feature,
          source_repo: rule.source_repo,
          target_repo: rule.target_repo,
          strategy: rule.strategy,
          source_path: sourcePath,
          target_path: targetPath,
          package_name: rule.package_name,
          created_at: new Date().toISOString(),
          status: 'failed',
        });
      }
    }

    allLinksRecord.links[feature] = activeLinks;
    allLinksRecord.updated_at = new Date().toISOString();
    await this.store.savePolyLinks(allLinksRecord);

    return activeLinks;
  }

  public async unlinkGroup(feature: string): Promise<void> {
    const allLinksRecord = await this.store.getPolyLinks();
    const groupLinks = allLinksRecord.links[feature] || [];

    for (const link of groupLinks) {
      if (link.status === 'linked') {
        try {
          await this.removeLink(link);
          link.status = 'unlinked';
        } catch {
          // ignore unlink failures during cleanup
        }
      }
    }

    delete allLinksRecord.links[feature];
    allLinksRecord.updated_at = new Date().toISOString();
    await this.store.savePolyLinks(allLinksRecord);
  }

  private async applyLink(
    strategy: PolyLinkStrategy,
    sourcePath: string,
    targetPath: string,
    packageName?: string,
    targetSubpath?: string
  ): Promise<void> {
    if (strategy === 'npm' || strategy === 'symlink') {
      const targetDir = targetSubpath ? path.join(targetPath, targetSubpath) : targetPath;
      const nodeModulesDir = path.join(targetDir, 'node_modules');

      if (packageName) {
        const pkgTargetDir = path.join(nodeModulesDir, packageName);
        const parentPkgDir = path.dirname(pkgTargetDir);
        if (!fs.existsSync(parentPkgDir)) {
          fs.mkdirSync(parentPkgDir, { recursive: true });
        }
        if (fs.existsSync(pkgTargetDir)) {
          fs.rmSync(pkgTargetDir, { recursive: true, force: true });
        }
        fs.symlinkSync(sourcePath, pkgTargetDir, 'junction');
      } else {
        const linkDest = path.join(targetDir, path.basename(sourcePath));
        if (fs.existsSync(linkDest)) {
          fs.rmSync(linkDest, { recursive: true, force: true });
        }
        fs.symlinkSync(sourcePath, linkDest, 'junction');
      }
    } else if (strategy === 'python') {
      const pthFile = path.join(targetPath, `.mannostree_${path.basename(sourcePath)}.pth`);
      fs.writeFileSync(pthFile, `${sourcePath}\n`, 'utf-8');
    } else if (strategy === 'go') {
      const goModPath = path.join(targetPath, 'go.mod');
      if (fs.existsSync(goModPath) && packageName) {
        fs.appendFileSync(goModPath, `\nreplace ${packageName} => ${sourcePath}\n`, 'utf-8');
      }
    } else if (strategy === 'cargo') {
      const cargoTomlPath = path.join(targetPath, 'Cargo.toml');
      if (fs.existsSync(cargoTomlPath) && packageName) {
        fs.appendFileSync(cargoTomlPath, `\n[patch.crates-io]\n${packageName} = { path = "${sourcePath}" }\n`, 'utf-8');
      }
    }
  }

  private async removeLink(link: PolyLinkRecord): Promise<void> {
    if (link.strategy === 'npm' || link.strategy === 'symlink') {
      if (link.package_name) {
        const pkgTargetDir = path.join(link.target_path, 'node_modules', link.package_name);
        if (fs.existsSync(pkgTargetDir)) {
          fs.rmSync(pkgTargetDir, { recursive: true, force: true });
        }
      } else {
        const linkDest = path.join(link.target_path, path.basename(link.source_path));
        if (fs.existsSync(linkDest)) {
          fs.rmSync(linkDest, { recursive: true, force: true });
        }
      }
    } else if (link.strategy === 'python') {
      const pthFile = path.join(link.target_path, `.mannostree_${path.basename(link.source_path)}.pth`);
      if (fs.existsSync(pthFile)) {
        fs.unlinkSync(pthFile);
      }
    }
  }
}
