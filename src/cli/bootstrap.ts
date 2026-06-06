// Bootstrap helpers for `amore install`.
//
// Two starter files are seeded into a fresh project, both idempotent (never
// overwrite an existing file):
//
//   - <project>/lab/config.json — amore's per-project config consumed by
//     loadAmoreConfig at runtime. literature_wiki_path is auto-detected
//     from ~/RL-Wiki / ~/PM-Wiki when present.
//   - <project>/opencode.json — minimal OpenCode plugin entry that wires
//     the amore plugin. Composes with the user's ~/.config/opencode/
//     opencode.json (provider, model, etc. flow through from global).

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { CONFIG_SCHEMA_VERSION } from '../config/constants';

export interface BootstrapResult {
  /** Absolute path of the file we wrote, or null when skipped. */
  labConfig: string | null;
  opencodeConfig: string | null;
  detectedWikiPath: string | null;
}

export interface BootstrapOptions {
  /** Project root. Defaults to cwd. */
  cwd?: string;
  /** Path of the lab dir relative to cwd. Defaults to `lab`. */
  labDir?: string;
  /** Override home for tests. Defaults to os.homedir(). */
  homeDir?: string;
}

const DETECTED_WIKIS = ['RL-Wiki', 'PM-Wiki'] as const;

function detectLiteratureWiki(home: string): string | null {
  for (const name of DETECTED_WIKIS) {
    if (existsSync(join(home, name))) {
      return `~/${name}`;
    }
  }
  return null;
}

function writeJsonIfMissing(target: string, body: unknown): boolean {
  if (existsSync(target)) {
    return false;
  }
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(body, null, 2)}\n`, 'utf8');
  return true;
}

/**
 * Seed lab/config.json and opencode.json if missing. Returns paths actually
 * written (null when skipped). Detected wiki path is reported for the caller
 * to surface in CLI output.
 */
export function bootstrapProjectConfig(
  options: BootstrapOptions = {},
): BootstrapResult {
  const cwd = options.cwd ?? process.cwd();
  const home = options.homeDir ?? homedir();
  const labRoot = resolve(cwd, options.labDir ?? 'lab');
  const literatureWikiPath = detectLiteratureWiki(home);

  const labConfigPath = join(labRoot, 'config.json');
  const labConfigBody: Record<string, unknown> = {
    schema_version: CONFIG_SCHEMA_VERSION,
  };
  if (literatureWikiPath) {
    labConfigBody.literature_wiki_path = literatureWikiPath;
  }
  const labConfigWritten = writeJsonIfMissing(labConfigPath, labConfigBody);

  const opencodeConfigPath = join(cwd, 'opencode.json');
  const opencodeConfigBody = {
    $schema: 'https://opencode.ai/config.json',
    plugin: ['ah-my-openresearch'],
    instructions: ['AGENTS.md'],
  };
  const opencodeConfigWritten = writeJsonIfMissing(
    opencodeConfigPath,
    opencodeConfigBody,
  );

  return {
    labConfig: labConfigWritten ? labConfigPath : null,
    opencodeConfig: opencodeConfigWritten ? opencodeConfigPath : null,
    detectedWikiPath: literatureWikiPath,
  };
}
