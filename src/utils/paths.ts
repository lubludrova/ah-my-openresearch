import { homedir } from 'node:os';
import { isAbsolute, resolve } from 'node:path';
import { DEFAULT_CONFIG_PATH, DEFAULT_LAB_DIR } from '../config/constants';
import type { AmoreConfig } from '../config/schema';

export function expandHome(inputPath: string, homeDir = homedir()): string {
  if (inputPath === '~') {
    return homeDir;
  }

  if (inputPath.startsWith('~/')) {
    return resolve(homeDir, inputPath.slice(2));
  }

  return inputPath;
}

export function resolveProjectPath(cwd: string, inputPath: string): string {
  const expanded = expandHome(inputPath);
  return isAbsolute(expanded) ? expanded : resolve(cwd, expanded);
}

export function getGlobalConfigPath(configPath = DEFAULT_CONFIG_PATH): string {
  return expandHome(configPath);
}

export function getProjectLabDir(
  cwd: string,
  config?: Pick<AmoreConfig, 'lab_dir'>,
): string {
  return resolveProjectPath(cwd, config?.lab_dir ?? DEFAULT_LAB_DIR);
}

export function getProjectLabConfigPath(
  cwd: string,
  config?: Pick<AmoreConfig, 'lab_dir'>,
): string {
  return resolve(getProjectLabDir(cwd, config), 'config.json');
}
