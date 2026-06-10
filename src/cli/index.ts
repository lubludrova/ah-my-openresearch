#!/usr/bin/env node
import pkg from '../../package.json' with { type: 'json' };
import { MODEL_PRESET_NAMES, type ModelPresetName } from '../config/constants';
import { doctor } from './doctor';
import { install } from './install';

// Bun inlines the JSON import at build time, so dist/cli/index.js carries
// the version baked in. No runtime read of package.json.
const VERSION = pkg.version;

function printHelp(): void {
  console.log(`amore — ah-my-openresearch

Usage:
  amore install [--lab-dir <path>]
                [--literature-wiki <path> | --no-wiki]
                [--models openai|anthropic|google]
                [--with-obsidian-mcp] [--reconcile] [--no-bootstrap]
  amore doctor [--lab-dir <path>] [--repair] [--json]
  amore --help
  amore --version

Commands:
  install      Create the local <project>/lab/ scaffold and seed
               <project>/lab/config.json + opencode.json + AGENTS.md
               (idempotent; preserves existing fields).
  doctor       Validate the local <project>/lab/ contract.

Options:
  --lab-dir          Project-local lab path. Defaults to ./lab.
  --literature-wiki  Path to your outside literature wiki (Obsidian / markdown
                     vault). Skips auto-detection and any interactive prompt.
                     Warns instead of failing if the path does not exist yet.
  --no-wiki          Skip literature_wiki_path entirely.
  --models           Persona model preset (openai | anthropic | google).
                     Writes personas.<name>.model into lab/config.json. In a
                     TTY install prompts instead; without the flag in
                     non-interactive mode personas keep the code defaults.
  --with-obsidian-mcp  Auto-wire mcp.obsidian into opencode.json from the wiki's
                     Local REST API plugin (reads its data.json). Required in
                     non-interactive mode; in a TTY install prompts instead.
  --reconcile        Write README.md.new / SCHEMA.md.new candidates if docs differ.
  --no-bootstrap     Skip lab/config.json, opencode.json, and AGENTS.md seeds.
  --repair           Repair safe lab files and regenerate index.md.
  --json             Print machine-readable doctor output.
  -h, --help         Show help.
  --version          Show version.

When no wiki flag is set, an interactive install asks whether to use,
create, or skip a literature wiki; non-interactive installs skip. A wiki
path is only ever written when you choose one explicitly.

MVP install is local-only: it does not create global config and does not mutate
OpenCode MCP config.`);
}

function readOptionValue(
  args: string[],
  index: number,
  option: string,
): string {
  const value = args[index + 1];

  if (!value || value.startsWith('-')) {
    throw new Error(`${option} requires a value.`);
  }

  return value;
}

async function main(args: string[]): Promise<void> {
  const [command, ...rest] = args;

  if (!command || command === '--help' || command === '-h') {
    printHelp();
    return;
  }

  if (command === '--version') {
    console.log(VERSION);
    return;
  }

  if (command !== 'install' && command !== 'doctor') {
    throw new Error(`Unknown command: ${command}`);
  }

  let labDir: string | undefined;
  let reconcile = false;
  let bootstrap = true;
  let literatureWiki: string | undefined;
  let noWiki = false;
  let withObsidianMcp = false;
  let models: ModelPresetName | undefined;
  let repair = false;
  let json = false;

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];

    if (arg === '--lab-dir') {
      labDir = readOptionValue(rest, index, '--lab-dir');
      index += 1;
      continue;
    }

    if (arg === '--reconcile') {
      if (command !== 'install') {
        throw new Error('--reconcile is only valid for amore install.');
      }

      reconcile = true;
      continue;
    }

    if (arg === '--no-bootstrap') {
      if (command !== 'install') {
        throw new Error('--no-bootstrap is only valid for amore install.');
      }

      bootstrap = false;
      continue;
    }

    if (arg === '--literature-wiki') {
      if (command !== 'install') {
        throw new Error('--literature-wiki is only valid for amore install.');
      }
      literatureWiki = readOptionValue(rest, index, '--literature-wiki');
      index += 1;
      continue;
    }

    if (arg === '--no-wiki') {
      if (command !== 'install') {
        throw new Error('--no-wiki is only valid for amore install.');
      }
      noWiki = true;
      continue;
    }

    if (arg === '--with-obsidian-mcp') {
      if (command !== 'install') {
        throw new Error('--with-obsidian-mcp is only valid for amore install.');
      }
      withObsidianMcp = true;
      continue;
    }

    if (arg === '--models') {
      if (command !== 'install') {
        throw new Error('--models is only valid for amore install.');
      }
      const value = readOptionValue(rest, index, '--models');
      if (!(MODEL_PRESET_NAMES as readonly string[]).includes(value)) {
        throw new Error(
          `--models must be one of: ${MODEL_PRESET_NAMES.join(', ')}.`,
        );
      }
      models = value as ModelPresetName;
      index += 1;
      continue;
    }

    if (arg === '--repair') {
      if (command !== 'doctor') {
        throw new Error('--repair is only valid for amore doctor.');
      }

      repair = true;
      continue;
    }

    if (arg === '--json') {
      if (command !== 'doctor') {
        throw new Error('--json is only valid for amore doctor.');
      }

      json = true;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      printHelp();
      return;
    }

    throw new Error(`Unknown ${command} option: ${arg}`);
  }

  if (command === 'install') {
    const wikiFlagCount =
      (literatureWiki !== undefined ? 1 : 0) + (noWiki ? 1 : 0);
    if (wikiFlagCount > 1) {
      throw new Error(
        '--literature-wiki and --no-wiki are mutually exclusive.',
      );
    }
    await install({
      labDir,
      reconcile,
      bootstrap,
      literatureWiki,
      noWiki,
      withObsidianMcp,
      models,
    });
    return;
  }

  process.exitCode = await doctor({ labDir, repair, json });
}

try {
  await main(process.argv.slice(2));
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[amore:error] ${message}`);
  process.exitCode = 1;
}
