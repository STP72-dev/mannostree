import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { MannostreeConfig, MannostreeConfigSchema } from './schema.js';
import { ExitCode, MannostreeError } from '../types/index.js';

export function findConfigFile(startDir: string): string | null {
  let currentDir = path.resolve(startDir);
  while (true) {
    const ymlPath = path.join(currentDir, '.mannostree.yml');
    if (fs.existsSync(ymlPath)) return ymlPath;

    const yamlPath = path.join(currentDir, '.mannostree.yaml');
    if (fs.existsSync(yamlPath)) return yamlPath;

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) break;
    currentDir = parentDir;
  }
  return null;
}

export function loadConfig(configPath?: string, cwd: string = process.cwd()): MannostreeConfig {
  let filePath = configPath ? path.resolve(cwd, configPath) : findConfigFile(cwd);

  if (!filePath || !fs.existsSync(filePath)) {
    if (configPath) {
      throw new MannostreeError(
        `Specified config file not found: ${configPath}`,
        ExitCode.USAGE_ERROR
      );
    }
    // Return default config if no config file present in repo
    const defaultResult = MannostreeConfigSchema.safeParse({});
    if (!defaultResult.success) {
      throw new MannostreeError(
        'Failed to generate default configuration',
        ExitCode.VALIDATION_FAILURE,
        defaultResult.error.format()
      );
    }
    return defaultResult.data;
  }

  let rawContent: string;
  try {
    rawContent = fs.readFileSync(filePath, 'utf-8');
  } catch (err: any) {
    throw new MannostreeError(
      `Failed to read config file at ${filePath}: ${err.message}`,
      ExitCode.GENERIC_FAILURE
    );
  }

  let parsedYaml: unknown;
  try {
    parsedYaml = YAML.parse(rawContent);
  } catch (err: any) {
    throw new MannostreeError(
      `Failed to parse YAML in ${filePath}: ${err.message}`,
      ExitCode.VALIDATION_FAILURE
    );
  }

  const result = MannostreeConfigSchema.safeParse(parsedYaml || {});
  if (!result.success) {
    const errorDetails = result.error.errors
      .map((e) => `  - ${e.path.join('.')}: ${e.message}`)
      .join('\n');
    throw new MannostreeError(
      `Config validation failed in ${filePath}:\n${errorDetails}`,
      ExitCode.VALIDATION_FAILURE,
      result.error.format()
    );
  }

  return result.data;
}
