import fs from 'node:fs';
import path from 'node:path';
import yaml from 'yaml';
import { PolyManifestConfigSchema } from '../config/schema.js';
import { PolyManifestConfig, MannostreeError, ExitCode } from '../types/index.js';

export function findPolyManifest(searchDir: string = process.cwd()): string | null {
  let current = path.resolve(searchDir);
  while (true) {
    const candidateYml = path.join(current, '.mannostree.poly.yml');
    if (fs.existsSync(candidateYml)) {
      return candidateYml;
    }
    const candidateYaml = path.join(current, '.mannostree.poly.yaml');
    if (fs.existsSync(candidateYaml)) {
      return candidateYaml;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }
  return null;
}

export function loadPolyManifest(
  customPath?: string,
  searchDir: string = process.cwd()
): { manifest: PolyManifestConfig; manifestPath: string; manifestDir: string } {
  let fullPath: string;

  if (customPath) {
    fullPath = path.resolve(searchDir, customPath);
    if (!fs.existsSync(fullPath)) {
      throw new MannostreeError(
        `Specified poly-worktree manifest does not exist: ${fullPath}`,
        ExitCode.USAGE_ERROR
      );
    }
  } else {
    const discovered = findPolyManifest(searchDir);
    if (!discovered) {
      throw new MannostreeError(
        `No poly-worktree manifest (.mannostree.poly.yml) found in '${searchDir}' or any parent directory.`,
        ExitCode.USAGE_ERROR
      );
    }
    fullPath = discovered;
  }

  try {
    const content = fs.readFileSync(fullPath, 'utf-8');
    const parsed = yaml.parse(content);
    const validated = PolyManifestConfigSchema.parse(parsed);

    return {
      manifest: validated,
      manifestPath: fullPath,
      manifestDir: path.dirname(fullPath),
    };
  } catch (err: any) {
    throw new MannostreeError(
      `Failed to parse poly-worktree manifest at '${fullPath}': ${err.message}`,
      ExitCode.SETUP_ENV_ERROR
    );
  }
}
