// Config loader for amore.
//
// Reads optional user config from two locations, in order:
//   1. <projectRoot>/lab/config.json — per-project override
//   2. ~/.config/opencode/ah-my-openresearch.json — global default
//
// Returns the first successful parse. On missing file, JSON parse error, or
// schema mismatch, returns null (graceful: the plugin keeps working on
// hard-coded defaults).

import { readFileSync } from 'node:fs';
import { getGlobalConfigPath, getProjectLabConfigPath } from '../utils/paths';
import { type AmoreConfig, AmoreConfigSchema } from './schema';

function tryReadConfig(path: string): AmoreConfig | null {
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const result = AmoreConfigSchema.safeParse(parsed);
  return result.success ? result.data : null;
}

/**
 * Load the first available amore config. Project-local takes precedence over
 * the global file. Returns null when neither file is present or parseable.
 *
 * `globalPath` is exposed for tests so they can point at an isolated path
 * without relying on the runtime's home-directory resolution (Bun caches
 * `os.homedir()` at process start and does not pick up `HOME` mutations).
 */
export function loadAmoreConfig(
  projectRoot: string,
  globalPath: string = getGlobalConfigPath(),
): AmoreConfig | null {
  const projectCfg = tryReadConfig(getProjectLabConfigPath(projectRoot));
  if (projectCfg) {
    return projectCfg;
  }
  return tryReadConfig(globalPath);
}
