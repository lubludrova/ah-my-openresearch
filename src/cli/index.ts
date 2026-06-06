#!/usr/bin/env node
import { doctor } from './doctor';
import { install } from './install';

// Kept in sync with package.json `version` by hand. TODO: wire from
// package.json at build time before publish to avoid drift.
const VERSION = '0.0.1';

function printHelp(): void {
  console.log(`amore — ah-my-openresearch

Usage:
  amore install [--lab-dir <path>] [--reconcile] [--no-bootstrap]
  amore doctor [--lab-dir <path>] [--repair] [--json]
  amore --help
  amore --version

Commands:
  install      Create the local <project>/lab/ scaffold and seed
               <project>/lab/config.json + <project>/opencode.json
               (idempotent; never overwrites).
  doctor       Validate the local <project>/lab/ contract.

Options:
  --lab-dir       Project-local lab path. Defaults to ./lab.
  --reconcile     Write README.md.new / SCHEMA.md.new candidates if docs differ.
  --no-bootstrap  Skip the lab/config.json + opencode.json seed step.
  --repair        Repair safe lab files and regenerate index.md.
  --json          Print machine-readable doctor output.
  -h, --help      Show help.
  --version       Show version.

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
    await install({ labDir, reconcile, bootstrap });
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
