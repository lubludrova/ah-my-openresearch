// Bootstrap helpers for `amore install`.
//
// Two starter files are seeded into a fresh project, both idempotent (never
// overwrite an existing file):
//
//   - <project>/lab/config.json — amore's per-project config consumed by
//     loadAmoreConfig at runtime. literature_wiki_path is chosen with this
//     priority:
//       1. explicit --literature-wiki <path> from the CLI
//       2. --no-wiki opt-out → omit
//       3. interactive prompt confirming auto-detected ~/RL-Wiki or ~/PM-Wiki
//       4. interactive prompt asking for a path
//       5. non-interactive auto-detect (silent fallback)
//       6. no path → omit
//   - <project>/opencode.json — minimal OpenCode plugin entry that wires
//     the amore plugin. Composes with the user's ~/.config/opencode/
//     opencode.json (provider, model, etc. flow through from global).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { CONFIG_SCHEMA_VERSION } from '../config/constants';

export interface BootstrapResult {
  /** Absolute path of the file we wrote, or null when skipped. */
  labConfig: string | null;
  opencodeConfig: string | null;
  /** Auto-detected wiki under ~ (if any). For CLI logging. */
  detectedWikiPath: string | null;
  /** Final wiki path written into lab/config.json, or null when omitted. */
  resolvedWikiPath: string | null;
  /** True iff a mcp.obsidian block was wired into the generated opencode.json. */
  obsidianMcpWired: boolean;
  /** Soft warnings to surface in the CLI output. */
  warnings: string[];
}

export interface BootstrapOptions {
  /** Project root. Defaults to cwd. */
  cwd?: string;
  /** Path of the lab dir relative to cwd. Defaults to `lab`. */
  labDir?: string;
  /** Override home for tests. Defaults to os.homedir(). */
  homeDir?: string;
  /** Explicit literature wiki path from --literature-wiki <path>. */
  literatureWiki?: string;
  /** Opt out of literature_wiki_path entirely (`--no-wiki`). */
  noWiki?: boolean;
  /**
   * Opt-in to wiring Obsidian Local REST API plugin's MCP into opencode.json.
   * Required in non-interactive mode; in TTY mode we prompt instead.
   */
  withObsidianMcp?: boolean;
  /**
   * Whether to prompt interactively when no flag is set. Defaults to
   * `process.stdin.isTTY`. Set false in CI / tests to suppress prompts.
   */
  interactive?: boolean;
  /** Test seam — defaults to readline against process.stdin/stdout. */
  prompt?: (question: string) => Promise<string>;
}

const DETECTED_WIKIS = ['RL-Wiki', 'PM-Wiki'] as const;
const CONTRACT_FILES = [
  'CLAUDE.md',
  'AGENTS.md',
  'README.md',
  'ingest_prompt.md',
] as const;

function detectLiteratureWiki(home: string): string | null {
  for (const name of DETECTED_WIKIS) {
    if (existsSync(join(home, name))) {
      return `~/${name}`;
    }
  }
  return null;
}

function expandHome(path: string, home: string): string {
  if (path === '~') {
    return home;
  }
  if (path.startsWith('~/')) {
    return join(home, path.slice(2));
  }
  return path;
}

function hasContractFile(absolutePath: string): boolean {
  return CONTRACT_FILES.some((name) => existsSync(join(absolutePath, name)));
}

function writeJsonIfMissing(target: string, body: unknown): boolean {
  if (existsSync(target)) {
    return false;
  }
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(body, null, 2)}\n`, 'utf8');
  return true;
}

async function defaultPrompt(question: string): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    const answer = await rl.question(question);
    return answer.trim();
  } finally {
    rl.close();
  }
}

interface ObsidianMcpEntry {
  apiKey: string;
  baseUrl: string;
  verifySSL: boolean;
}

interface ObsidianPluginData {
  apiKey?: unknown;
  port?: unknown;
  insecurePort?: unknown;
  enableInsecureServer?: unknown;
}

async function maybeReadObsidianMcp(args: {
  wikiPath: string;
  homeDir: string;
  withObsidianMcp: boolean | undefined;
  interactive: boolean;
  prompt: (question: string) => Promise<string>;
  warnings: string[];
}): Promise<ObsidianMcpEntry | null> {
  const absoluteWiki = expandHome(args.wikiPath, args.homeDir);
  const dataPath = join(
    absoluteWiki,
    '.obsidian',
    'plugins',
    'obsidian-local-rest-api',
    'data.json',
  );
  if (!existsSync(dataPath)) {
    return null;
  }

  let confirmed: boolean;
  if (args.withObsidianMcp === true) {
    confirmed = true;
  } else if (args.withObsidianMcp === false) {
    confirmed = false;
  } else if (args.interactive) {
    const answer = await args.prompt(
      `Detected Obsidian Local REST API plugin at ${args.wikiPath}. Auto-configure MCP entry? [Y/n] `,
    );
    confirmed = answer === '' || answer.toLowerCase().startsWith('y');
  } else {
    // non-interactive, no flag → opt-out
    confirmed = false;
  }
  if (!confirmed) {
    return null;
  }

  let raw: string;
  try {
    raw = readFileSync(dataPath, 'utf8');
  } catch {
    args.warnings.push(
      `Could not read ${dataPath} — skipping Obsidian MCP auto-config.`,
    );
    return null;
  }

  let data: ObsidianPluginData;
  try {
    data = JSON.parse(raw);
  } catch {
    args.warnings.push(
      `Could not parse ${dataPath} — skipping Obsidian MCP auto-config.`,
    );
    return null;
  }

  if (typeof data.apiKey !== 'string' || data.apiKey.length === 0) {
    args.warnings.push(
      `Obsidian Local REST API plugin at ${args.wikiPath} has no apiKey set — open the plugin's settings in Obsidian and reload before re-running.`,
    );
    return null;
  }

  const insecureEnabled = data.enableInsecureServer === true;
  const httpsPort = typeof data.port === 'number' ? data.port : 27124;
  const httpPort =
    typeof data.insecurePort === 'number' ? data.insecurePort : 27123;

  return {
    apiKey: data.apiKey,
    baseUrl: insecureEnabled
      ? `http://127.0.0.1:${httpPort}`
      : `https://127.0.0.1:${httpsPort}`,
    // Self-signed HTTPS certificate → skip verification. Insecure HTTP → no
    // verification involved anyway, set false too.
    verifySSL: false,
  };
}

/**
 * Resolves the literature wiki path per the priority listed at the top of
 * this file. Side-effect-free except for prompting the user.
 */
async function resolveWikiPath(
  options: Required<Pick<BootstrapOptions, 'homeDir'>> & {
    literatureWiki?: string;
    noWiki?: boolean;
    interactive: boolean;
    prompt: (question: string) => Promise<string>;
    autoDetected: string | null;
  },
  warnings: string[],
): Promise<string | null> {
  if (options.noWiki) {
    return null;
  }

  if (options.literatureWiki) {
    const display = options.literatureWiki;
    const absolute = expandHome(
      isAbsolute(display) ? display : display,
      options.homeDir,
    );
    if (!existsSync(absolute)) {
      warnings.push(
        `Literature wiki path "${display}" does not exist yet — writing it into lab/config.json anyway. Create the directory before invoking librarian.`,
      );
    } else if (!hasContractFile(absolute)) {
      warnings.push(
        `Literature wiki at "${display}" has no CLAUDE.md / AGENTS.md / README.md / ingest_prompt.md — librarian will fall back to internal defaults.`,
      );
    }
    return display;
  }

  if (options.autoDetected && options.interactive) {
    const answer = await options.prompt(
      `Use detected literature wiki at ${options.autoDetected}? [Y/n] `,
    );
    if (answer === '' || answer.toLowerCase().startsWith('y')) {
      return options.autoDetected;
    }
    // fall through to ask for a path
  } else if (options.autoDetected) {
    return options.autoDetected;
  }

  if (!options.interactive) {
    return null;
  }

  const entered = await options.prompt(
    'Path to your literature wiki (blank to skip): ',
  );
  if (!entered) {
    return null;
  }
  const absolute = expandHome(entered, options.homeDir);
  if (!existsSync(absolute)) {
    warnings.push(
      `Literature wiki path "${entered}" does not exist yet — writing it into lab/config.json anyway. Create the directory before invoking librarian.`,
    );
  } else if (!hasContractFile(absolute)) {
    warnings.push(
      `Literature wiki at "${entered}" has no CLAUDE.md / AGENTS.md / README.md / ingest_prompt.md — librarian will fall back to internal defaults.`,
    );
  }
  return entered;
}

/**
 * Seed lab/config.json and opencode.json if missing. Returns paths actually
 * written (null when skipped). Detected wiki path is reported for the caller
 * to surface in CLI output. Async because it may prompt the user.
 */
export async function bootstrapProjectConfig(
  options: BootstrapOptions = {},
): Promise<BootstrapResult> {
  const cwd = options.cwd ?? process.cwd();
  const home = options.homeDir ?? homedir();
  const labRoot = resolve(cwd, options.labDir ?? 'lab');
  const detectedWikiPath = detectLiteratureWiki(home);
  const interactive = options.interactive ?? Boolean(process.stdin.isTTY);
  const prompt = options.prompt ?? defaultPrompt;
  const warnings: string[] = [];

  const resolvedWikiPath = await resolveWikiPath(
    {
      homeDir: home,
      literatureWiki: options.literatureWiki,
      noWiki: options.noWiki,
      interactive,
      prompt,
      autoDetected: detectedWikiPath,
    },
    warnings,
  );

  const labConfigPath = join(labRoot, 'config.json');
  const labConfigBody: Record<string, unknown> = {
    schema_version: CONFIG_SCHEMA_VERSION,
  };
  if (resolvedWikiPath) {
    labConfigBody.literature_wiki_path = resolvedWikiPath;
  }
  const labConfigWritten = writeJsonIfMissing(labConfigPath, labConfigBody);

  const opencodeConfigPath = join(cwd, 'opencode.json');
  const opencodeExists = existsSync(opencodeConfigPath);

  let obsidianMcp: ObsidianMcpEntry | null = null;
  if (!opencodeExists && resolvedWikiPath) {
    obsidianMcp = await maybeReadObsidianMcp({
      wikiPath: resolvedWikiPath,
      homeDir: home,
      withObsidianMcp: options.withObsidianMcp,
      interactive,
      prompt,
      warnings,
    });
  }

  const opencodeConfigBody: Record<string, unknown> = {
    $schema: 'https://opencode.ai/config.json',
    plugin: ['ah-my-openresearch'],
    instructions: ['AGENTS.md'],
  };
  if (obsidianMcp) {
    opencodeConfigBody.mcp = {
      obsidian: {
        type: 'local',
        command: ['bunx', 'obsidian-mcp-server@latest'],
        environment: {
          OBSIDIAN_API_KEY: obsidianMcp.apiKey,
          OBSIDIAN_BASE_URL: obsidianMcp.baseUrl,
          OBSIDIAN_VERIFY_SSL: String(obsidianMcp.verifySSL),
        },
      },
    };
  }
  const opencodeConfigWritten = writeJsonIfMissing(
    opencodeConfigPath,
    opencodeConfigBody,
  );

  return {
    labConfig: labConfigWritten ? labConfigPath : null,
    opencodeConfig: opencodeConfigWritten ? opencodeConfigPath : null,
    detectedWikiPath,
    resolvedWikiPath,
    obsidianMcpWired: opencodeConfigWritten && obsidianMcp !== null,
    warnings,
  };
}
