// Bootstrap helpers for `amore install`.
//
// The flow is broken into small async steps so `install.ts` can interleave
// section headers between them in the TTY welcome output:
//
//   1. resolveLiteratureWiki   — pick existing / create / skip
//   2. maybeReadObsidianMcp    — auto-wire MCP from the chosen wiki
//   3. writeBootstrapFiles     — idempotent seeds for .opencode/amore.json and
//                                OpenCode config
//
// Each step is pure-ish: side effects are file writes and prompts; nothing
// else logs. install.ts owns presentation.

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import pkg from '../../package.json' with { type: 'json' };
import {
  CONFIG_SCHEMA_VERSION,
  DEFAULT_ORCHESTRATION_MAX_PARALLEL,
  LEGACY_PROJECT_OPENCODE_CONFIG_PATH,
  MODEL_PRESETS,
  MODEL_PRESET_NAMES,
  type ModelPresetName,
  PROJECT_OPENCODE_CONFIG_PATH,
} from '../config/constants';
import type { PersonaName } from '../config/constants';
import type { PersonasConfig } from '../config/schema';
import { getProjectAmoreConfigPath } from '../utils/paths';

// ──────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────

export type WikiChoiceKind = 'use' | 'create' | 'skip';

export interface WikiResolution {
  /** What happened with the wiki step. */
  kind: WikiChoiceKind;
  /** Path written into amore config (or null when skipped). */
  resolvedPath: string | null;
  /** True iff the create branch actually wrote a new wiki on disk. */
  created: boolean;
  /** Soft warnings to surface. */
  warnings: string[];
}

export interface ObsidianMcpEntry {
  apiKey: string;
  baseUrl: string;
  verifySSL: boolean;
}

export interface BootstrapWriteResult {
  /** Absolute path of the file we wrote, or null when skipped. */
  labConfig: string | null;
  /** Absolute path of the amore config we wrote, or null when skipped. */
  amoreConfig: string | null;
  /** Absolute path of opencode.json when created/updated, or null when kept. */
  opencodeConfig: string | null;
  agentsFile: string | null;
  /** True iff a mcp.obsidian block was added to opencode.json. */
  obsidianMcpWired: boolean;
  /** Whether opencode.json was created, updated in place, or already correct. */
  opencodeConfigAction: 'created' | 'updated' | 'kept';
  /** Backup path written before updating an existing opencode.json. */
  opencodeConfigBackup: string | null;
  /** Soft warnings to surface. */
  warnings: string[];
}

export type ModelSeedKind = 'preset' | 'detected-pair' | 'detected-single';

export interface ModelSeed {
  kind: ModelSeedKind;
  source: string;
  preset: ModelPresetName | null;
  personas: PersonasConfig;
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
  /** Opt out of literature_wiki_path entirely (--no-wiki). */
  noWiki?: boolean;
  /** Opt-in to wiring Obsidian MCP from the chosen wiki's plugin. */
  withObsidianMcp?: boolean;
  /** Persona model preset from --models <name>. */
  models?: ModelPresetName;
  /** Whether to prompt interactively. Defaults to process.stdin.isTTY. */
  interactive?: boolean;
  /** Test seam — defaults to readline against process.stdin/stdout. */
  prompt?: (question: string) => Promise<string>;
}

// ──────────────────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────────────────

const CONTRACT_FILES = ['RULES.md', 'AGENTS.md', 'README.md'] as const;
const DEFAULT_WIKI_NAME = 'llm-wiki';
const AMORE_PLUGIN_NAME = 'ah-my-openresearch';
const AMORE_PLUGIN_SPEC = `${AMORE_PLUGIN_NAME}@${pkg.version}`;
const BOOTSTRAP_FILE = fileURLToPath(import.meta.url);
const BUNDLED_SKILLS_DIR = resolveBundledSkillsDir(BOOTSTRAP_FILE);

const STARTER_WIKI_RULES_MD = `# Wiki Rules

Personal markdown literature wiki. Compile knowledge into interlinked pages
instead of re-discovering it every session.

## Structure

\`\`\`
<wiki>/
├── RULES.md       — this file (the contract librarian reads at session start)
├── raw/           — immutable source materials (PDFs, images, downloads)
├── reports/       — agent-written reports only
└── wiki/          — all wiki pages (flat directory)
    ├── index.md   — flat catalog of pages with one-line descriptions
    └── log.md     — chronological journal of ingest / edit events
\`\`\`

## Naming

- Lowercase, hyphenated.
- Papers: \`author-year-keyword.md\` (e.g. \`schulman-2017-ppo.md\`).
  First author surname only.
- Concepts / entities: descriptive slug (\`policy-gradient.md\`).

## Frontmatter

Every page MUST start with:

\`\`\`yaml
---
created: <YYYY-MM-DD>
updated: <YYYY-MM-DD>
tags: []
---
\`\`\`

## Body

- First line after frontmatter — one-line summary (used in \`wiki/index.md\`).
- Use \`[[wikilinks]]\` for cross-references.
- Math: \`$inline$\`, \`$$display$$\`.
- Mark uncertain claims with \`[?]\`.

## Log format

\`\`\`markdown
## [YYYY-MM-DD] action | Title
Brief description.
Pages affected: [[page1]], [[page2]]
\`\`\`

Actions: \`ingest\`, \`update\`, \`create\`, \`delete\`, \`lint\`.

## Reports

All agent-written reports MUST go in \`reports/\`, never in the wiki root or
\`wiki/\`. A report is any generated audit, lint, survey, search, review,
comparison, or status document.

Filename format:

\`YYYY-MM-DD-<topic>-<kind>.md\`

Reports are concise and in English by default unless the user explicitly asks
for another language. Use this exact body shape:

\`# <Title>\`
\`Date: <YYYY-MM-DD>\`
\`Scope: <one line>\`

\`## Summary\`
- 3-5 short bullets.

\`## Findings\`
1. Numbered findings, each no more than two lines.

\`## Sources\`
- Links, paper refs, or wiki pages used.

\`## Next\`
- 0-3 concrete follow-ups.

## Read-before-write

Before writing a new page, scan \`wiki/index.md\` and search for the same topic
to avoid duplicates. Append backlinks if related pages exist.
`;

// ──────────────────────────────────────────────────────────────────────────
// Path helpers
// ──────────────────────────────────────────────────────────────────────────

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

function resolveBundledSkillsDir(moduleFile: string): string {
  const moduleDir = dirname(moduleFile);
  const candidates = [
    // Source mode: src/cli/bootstrap.ts -> src/skills.
    resolve(moduleDir, '..', 'skills'),
    // Published bundle: dist/cli/index.js -> src/skills.
    resolve(moduleDir, '..', '..', 'src', 'skills'),
  ];
  return candidates.find((path) => existsSync(path)) ?? candidates[0];
}

function absoluteWikiPath(path: string, cwd: string, home: string): string {
  if (path.startsWith('~')) {
    return expandHome(path, home);
  }
  return isAbsolute(path) ? path : resolve(cwd, path);
}

// ──────────────────────────────────────────────────────────────────────────
// Step 1 — Wiki resolution
// ──────────────────────────────────────────────────────────────────────────

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

function warnExplicitPath(
  display: string,
  absolute: string,
  warnings: string[],
): void {
  if (!existsSync(absolute)) {
    warnings.push(
      `Literature wiki path "${display}" does not exist yet — writing it into .opencode/amore.json anyway. Create the directory before invoking librarian.`,
    );
  } else if (!hasContractFile(absolute)) {
    warnings.push(
      `Literature wiki at "${display}" has no RULES.md / AGENTS.md / README.md — librarian will ask for a wiki contract before writing.`,
    );
  }
}

function parseWikiMenuChoice(choice: string): WikiChoiceKind {
  const normalized = choice.toLowerCase();

  if (
    normalized === '' ||
    normalized === '3' ||
    normalized === 's' ||
    normalized.startsWith('s') ||
    normalized === '\u044b'
  ) {
    return 'skip';
  }

  if (
    normalized === '2' ||
    normalized === 'c' ||
    normalized.startsWith('c') ||
    normalized === '\u0441'
  ) {
    return 'create';
  }

  return 'use';
}

/**
 * Creates a starter wiki on disk: `<dirAbsolute>/RULES.md`, `wiki/`, `raw/`.
 * Idempotent: if any file already exists it is left alone.
 */
export function createStarterWiki(dirAbsolute: string): {
  filesWritten: string[];
} {
  const filesWritten: string[] = [];
  mkdirSync(dirAbsolute, { recursive: true });
  mkdirSync(join(dirAbsolute, 'wiki'), { recursive: true });
  mkdirSync(join(dirAbsolute, 'raw'), { recursive: true });
  mkdirSync(join(dirAbsolute, 'reports'), { recursive: true });
  const rulesPath = join(dirAbsolute, 'RULES.md');
  if (!existsSync(rulesPath)) {
    writeFileSync(rulesPath, STARTER_WIKI_RULES_MD, 'utf8');
    filesWritten.push('RULES.md');
  }
  filesWritten.push('wiki/');
  filesWritten.push('raw/');
  filesWritten.push('reports/');
  return { filesWritten };
}

/**
 * Resolves which literature wiki path (if any) will land in .opencode/amore.json.
 * In interactive mode, prompts the user with a 3-way choice
 * (use / create / skip). Non-interactive runs honor explicit flags only —
 * install never auto-detects or silently writes a wiki path the user did
 * not choose.
 */
export async function resolveLiteratureWiki(
  options: BootstrapOptions = {},
): Promise<WikiResolution> {
  const cwd = options.cwd ?? process.cwd();
  const home = options.homeDir ?? homedir();
  const interactive = options.interactive ?? Boolean(process.stdin.isTTY);
  const prompt = options.prompt ?? defaultPrompt;
  const warnings: string[] = [];

  // Explicit opt-out wins outright.
  if (options.noWiki) {
    return { kind: 'skip', resolvedPath: null, created: false, warnings };
  }

  // Explicit --literature-wiki <path>.
  if (options.literatureWiki) {
    const display = options.literatureWiki;
    warnExplicitPath(display, absoluteWikiPath(display, cwd, home), warnings);
    return { kind: 'use', resolvedPath: display, created: false, warnings };
  }

  // Non-interactive without any flag: skip. Wiki paths are only ever
  // written when the user chose one explicitly.
  if (!interactive) {
    return { kind: 'skip', resolvedPath: null, created: false, warnings };
  }

  // Interactive: full 3-way menu.
  const choice = await prompt(
    '  [u] use an existing wiki        — I will ask for the path\n  [c] create one in this project  — at ./llm-wiki/\n  [s] skip                         — no literature wiki\n\n  > ',
  );
  const menuChoice = parseWikiMenuChoice(choice);

  if (menuChoice === 'skip') {
    return { kind: 'skip', resolvedPath: null, created: false, warnings };
  }

  if (menuChoice === 'create') {
    const nameInput = await prompt(`  Name [${DEFAULT_WIKI_NAME}]: > `);
    const name = nameInput.trim() || DEFAULT_WIKI_NAME;
    const dirAbsolute = resolve(cwd, name);
    createStarterWiki(dirAbsolute);
    return {
      kind: 'create',
      resolvedPath: `./${name}`,
      created: true,
      warnings,
    };
  }

  // 'u' or anything else → ask for path; blank answer = skip.
  const entered = (await prompt('  Path to your wiki: > ')).trim();

  if (!entered) {
    return { kind: 'skip', resolvedPath: null, created: false, warnings };
  }

  warnExplicitPath(entered, absoluteWikiPath(entered, cwd, home), warnings);
  return { kind: 'use', resolvedPath: entered, created: false, warnings };
}

// ──────────────────────────────────────────────────────────────────────────
// Step 1b — Persona model preset
// ──────────────────────────────────────────────────────────────────────────

function parseModelPresetChoice(choice: string): ModelPresetName | null {
  const normalized = choice.trim().toLowerCase();
  if (normalized === '' || normalized === '1' || normalized.startsWith('o')) {
    return 'openai';
  }
  if (normalized === '2' || normalized.startsWith('a')) {
    return 'anthropic';
  }
  if (normalized === '3' || normalized.startsWith('g')) {
    return 'google';
  }
  return null; // 's' / anything else → skip, keep code defaults.
}

function providerFromModel(model: string): string | null {
  const slash = model.indexOf('/');
  return slash > 0 ? model.slice(0, slash) : null;
}

function presetFromModel(model: string): ModelPresetName | null {
  const provider = providerFromModel(model);
  return provider &&
    (MODEL_PRESET_NAMES as readonly string[]).includes(provider)
    ? (provider as ModelPresetName)
    : null;
}

function readJsonObject(path: string): Record<string, unknown> | null {
  if (!existsSync(path)) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
    return isJsonObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function detectedOpenCodeModels(options: BootstrapOptions): {
  model: string | null;
  smallModel: string | null;
  source: string | null;
} {
  const cwd = options.cwd ?? process.cwd();
  const home = options.homeDir ?? homedir();
  const candidates = [
    join(cwd, PROJECT_OPENCODE_CONFIG_PATH),
    join(cwd, LEGACY_PROJECT_OPENCODE_CONFIG_PATH),
    join(home, '.config', 'opencode', 'opencode.json'),
  ];

  for (const path of candidates) {
    const config = readJsonObject(path);
    const model = typeof config?.model === 'string' ? config.model : null;
    const smallModel =
      typeof config?.small_model === 'string' ? config.small_model : null;
    if (model || smallModel) {
      return { model, smallModel, source: path };
    }
  }

  return { model: null, smallModel: null, source: null };
}

/**
 * Resolves which persona model block lands in .opencode/amore.json. Explicit
 * `--models <name>` wins; otherwise interactive installs get a menu, then we
 * detect an existing OpenCode model config or fall back to the openai preset.
 */
export async function resolveModelPreset(
  options: BootstrapOptions = {},
): Promise<ModelPresetName | null> {
  const seed = await resolveModelSeed(options);
  return seed.preset;
}

export async function resolveModelSeed(
  options: BootstrapOptions = {},
): Promise<ModelSeed> {
  if (options.models) {
    return {
      kind: 'preset',
      source: '--models',
      preset: options.models,
      personas: personasBlockForPreset(options.models),
    };
  }

  const interactive = options.interactive ?? Boolean(process.stdin.isTTY);
  if (interactive) {
    const prompt = options.prompt ?? defaultPrompt;
    const choice = await prompt(
      '  Which provider should the six personas use?\n' +
        '  [1] openai     gpt-5.5 + gpt-5.4-mini (default)\n' +
        '  [2] anthropic  claude-sonnet-4-6 + claude-haiku-4-5\n' +
        '  [3] google     gemini-3.1-pro-preview + gemini-3.5-flash\n' +
        '  [d] detect     use existing OpenCode model config\n\n  > ',
    );
    const chosen = parseModelPresetChoice(choice);
    if (chosen) {
      return {
        kind: 'preset',
        source: 'interactive prompt',
        preset: chosen,
        personas: personasBlockForPreset(chosen),
      };
    }
  }

  const detected = detectedOpenCodeModels(options);
  const modelPreset = detected.model ? presetFromModel(detected.model) : null;
  const smallPreset = detected.smallModel
    ? presetFromModel(detected.smallModel)
    : null;

  if (detected.model && detected.smallModel) {
    if (modelPreset && modelPreset === smallPreset) {
      return {
        kind: 'preset',
        source: detected.source ?? 'OpenCode config',
        preset: modelPreset,
        personas: personasBlockForPreset(modelPreset),
      };
    }
    return {
      kind: 'detected-pair',
      source: detected.source ?? 'OpenCode config',
      preset: null,
      personas: personasBlockForModelPair(detected.model, detected.smallModel),
    };
  }

  const detectedModel = detected.model ?? detected.smallModel;
  if (detectedModel) {
    const preset = presetFromModel(detectedModel);
    if (preset) {
      return {
        kind: 'preset',
        source: detected.source ?? 'OpenCode config',
        preset,
        personas: personasBlockForPreset(preset),
      };
    }
    return {
      kind: 'detected-single',
      source: detected.source ?? 'OpenCode config',
      preset: null,
      personas: personasBlockForSingleModel(detectedModel),
    };
  }

  return {
    kind: 'preset',
    source: 'default fallback',
    preset: 'openai',
    personas: personasBlockForPreset('openai'),
  };
}

function personasBlockForPreset(preset: ModelPresetName): PersonasConfig {
  const block: PersonasConfig = {};
  for (const [persona, model] of Object.entries(MODEL_PRESETS[preset])) {
    block[persona as PersonaName] = { model };
  }
  return block;
}

function personasBlockForSingleModel(model: string): PersonasConfig {
  const block: PersonasConfig = {};
  for (const persona of Object.keys(MODEL_PRESETS.openai) as PersonaName[]) {
    block[persona] = { model };
  }
  return block;
}

function personasBlockForModelPair(
  frontierModel: string,
  cheapModel: string,
): PersonasConfig {
  const block = personasBlockForSingleModel(frontierModel);
  block.librarian = { model: cheapModel };
  block.coder = { model: cheapModel };
  return block;
}

// ──────────────────────────────────────────────────────────────────────────
// Step 2 — Obsidian MCP auto-detect
// ──────────────────────────────────────────────────────────────────────────

interface ObsidianPluginData {
  apiKey?: unknown;
  port?: unknown;
  insecurePort?: unknown;
  enableInsecureServer?: unknown;
}

/**
 * Looks for `<wiki>/.obsidian/plugins/obsidian-local-rest-api/data.json`.
 * In interactive mode prompts to confirm; non-interactive requires
 * `withObsidianMcp: true`. Returns null when nothing should be wired.
 */
export async function maybeReadObsidianMcp(
  resolvedWikiPath: string,
  options: BootstrapOptions = {},
): Promise<{
  entry: ObsidianMcpEntry | null;
  pluginFound: boolean;
  warnings: string[];
}> {
  const cwd = options.cwd ?? process.cwd();
  const home = options.homeDir ?? homedir();
  const interactive = options.interactive ?? Boolean(process.stdin.isTTY);
  const prompt = options.prompt ?? defaultPrompt;
  const warnings: string[] = [];

  const absoluteWiki = absoluteWikiPath(resolvedWikiPath, cwd, home);
  const dataPath = join(
    absoluteWiki,
    '.obsidian',
    'plugins',
    'obsidian-local-rest-api',
    'data.json',
  );
  if (!existsSync(dataPath)) {
    return { entry: null, pluginFound: false, warnings };
  }

  let confirmed: boolean;
  if (options.withObsidianMcp === true) {
    confirmed = true;
  } else if (options.withObsidianMcp === false) {
    confirmed = false;
  } else if (interactive) {
    const answer = await prompt(
      `  Local REST API plugin found in ${resolvedWikiPath}.\n  Auto-configure the MCP entry for librarian? [Y/n] > `,
    );
    confirmed = answer === '' || answer.toLowerCase().startsWith('y');
  } else {
    confirmed = false;
  }
  if (!confirmed) {
    return { entry: null, pluginFound: true, warnings };
  }

  let raw: string;
  try {
    raw = readFileSync(dataPath, 'utf8');
  } catch {
    warnings.push(
      `Could not read ${dataPath} — skipping Obsidian MCP auto-config.`,
    );
    return { entry: null, pluginFound: true, warnings };
  }
  let data: ObsidianPluginData;
  try {
    data = JSON.parse(raw);
  } catch {
    warnings.push(
      `Could not parse ${dataPath} — skipping Obsidian MCP auto-config.`,
    );
    return { entry: null, pluginFound: true, warnings };
  }
  if (typeof data.apiKey !== 'string' || data.apiKey.length === 0) {
    warnings.push(
      `Obsidian Local REST API plugin at ${resolvedWikiPath} has no apiKey set — open the plugin's settings in Obsidian and reload before re-running.`,
    );
    return { entry: null, pluginFound: true, warnings };
  }
  const insecureEnabled = data.enableInsecureServer === true;
  const httpsPort = typeof data.port === 'number' ? data.port : 27124;
  const httpPort =
    typeof data.insecurePort === 'number' ? data.insecurePort : 27123;
  return {
    entry: {
      apiKey: data.apiKey,
      baseUrl: insecureEnabled
        ? `http://127.0.0.1:${httpPort}`
        : `https://127.0.0.1:${httpsPort}`,
      verifySSL: false,
    },
    pluginFound: true,
    warnings,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Step 3 — Write the seed config files
// ──────────────────────────────────────────────────────────────────────────

function writeAmoreConfigIfMissing(
  target: string,
  legacyPath: string,
  body: Record<string, unknown>,
): boolean {
  if (existsSync(target)) {
    return false;
  }

  const legacy = readJsonObject(legacyPath);
  const merged = legacy ? { ...body, ...legacy } : body;
  const seededPersonas = isJsonObject(body.personas) ? body.personas : {};
  const legacyPersonas = isJsonObject(legacy?.personas) ? legacy.personas : {};
  const mergedPersonas = { ...seededPersonas, ...legacyPersonas };
  merged.personas = mergedPersonas;
  if (Object.keys(mergedPersonas).length === 0) {
    merged.personas = body.personas;
  }

  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');
  return true;
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function addStringEntry(
  body: Record<string, unknown>,
  key: string,
  entry: string,
): boolean {
  const current = body[key];

  if (Array.isArray(current)) {
    if (current.includes(entry)) {
      return false;
    }
    body[key] = [...current, entry];
    return true;
  }

  if (typeof current === 'string') {
    if (current === entry) {
      body[key] = [entry];
      return true;
    }
    body[key] = [current, entry];
    return true;
  }

  body[key] = [entry];
  return true;
}

/**
 * True for skills.paths entries that older amore installers wrote: the
 * package's bundled skills directory as an absolute path. Recognized by an
 * `ah-my-openresearch` directory (optionally versioned, as in bunx/npx
 * caches) followed by `src/skills`, or by an exact match with this module's
 * own resolved bundled dir (source-mode installs on the same machine).
 */
export function isAmoreBundledSkillsPath(entry: unknown): entry is string {
  if (typeof entry !== 'string') {
    return false;
  }
  if (entry === BUNDLED_SKILLS_DIR) {
    return true;
  }
  return /ah-my-openresearch(@[^/\\]+)?[/\\]src[/\\]skills[/\\]?$/.test(entry);
}

function removeStaleAmoreSkillsPaths(body: Record<string, unknown>): boolean {
  if (!isJsonObject(body.skills) || !Array.isArray(body.skills.paths)) {
    return false;
  }
  const skills = body.skills;
  const paths = skills.paths as unknown[];
  const kept = paths.filter((entry) => !isAmoreBundledSkillsPath(entry));
  if (kept.length === paths.length) {
    return false;
  }
  if (kept.length > 0) {
    skills.paths = kept;
    return true;
  }
  // JSON.stringify drops undefined-valued keys, so the written config loses
  // the empty entries without using `delete`.
  skills.paths = undefined;
  const hasOtherKeys = Object.keys(skills).some(
    (key) => key !== 'paths' && skills[key] !== undefined,
  );
  if (!hasOtherKeys) {
    body.skills = undefined;
  }
  return true;
}

function isAmorePluginSpec(spec: unknown): spec is string {
  return (
    typeof spec === 'string' &&
    (spec === AMORE_PLUGIN_NAME || spec.startsWith(`${AMORE_PLUGIN_NAME}@`))
  );
}

function normalizePluginEntry(entry: unknown): unknown {
  if (isAmorePluginSpec(entry)) {
    return AMORE_PLUGIN_SPEC;
  }
  if (Array.isArray(entry) && isAmorePluginSpec(entry[0])) {
    return [AMORE_PLUGIN_SPEC, ...entry.slice(1)];
  }
  return entry;
}

function addVersionedAmorePluginEntry(body: Record<string, unknown>): boolean {
  const current = body.plugin;

  if (Array.isArray(current)) {
    let changed = false;
    let sawAmore = false;
    const next: unknown[] = [];

    for (const entry of current) {
      const isAmoreEntry =
        isAmorePluginSpec(entry) ||
        (Array.isArray(entry) && isAmorePluginSpec(entry[0]));
      if (isAmoreEntry) {
        if (sawAmore) {
          changed = true;
          continue;
        }
        sawAmore = true;
      }

      const normalized = normalizePluginEntry(entry);
      if (normalized !== entry) {
        changed = true;
      }
      next.push(normalized);
    }

    if (!sawAmore) {
      next.push(AMORE_PLUGIN_SPEC);
      changed = true;
    }

    if (changed) {
      body.plugin = next;
    }
    return changed;
  }

  if (current === undefined) {
    body.plugin = [AMORE_PLUGIN_SPEC];
    return true;
  }

  if (isAmorePluginSpec(current)) {
    body.plugin = [AMORE_PLUGIN_SPEC];
    return current !== AMORE_PLUGIN_SPEC;
  }

  if (typeof current === 'string') {
    body.plugin = [current, AMORE_PLUGIN_SPEC];
    return true;
  }

  body.plugin = [AMORE_PLUGIN_SPEC];
  return true;
}

function ensureAmoreOpencodeConfig(
  body: Record<string, unknown>,
  obsidianMcp: ObsidianMcpEntry | null,
): { changed: boolean; obsidianMcpWired: boolean } {
  let changed = false;
  let obsidianMcpWired = false;

  if (body.$schema === undefined) {
    body.$schema = 'https://opencode.ai/config.json';
    changed = true;
  }

  changed = addVersionedAmorePluginEntry(body) || changed;
  changed = addStringEntry(body, 'instructions', 'AGENTS.md') || changed;

  if (body.default_agent === undefined) {
    body.default_agent = 'orchestrator';
    changed = true;
  }

  const agent = isJsonObject(body.agent) ? body.agent : {};
  if (body.agent !== agent) {
    body.agent = agent;
    changed = true;
  }
  for (const name of ['build', 'plan'] as const) {
    const existing = agent[name];
    const entry = isJsonObject(existing) ? existing : {};
    if (existing !== entry) {
      agent[name] = entry;
      changed = true;
    }
    if (entry.disable !== true) {
      entry.disable = true;
      changed = true;
    }
  }

  // The plugin's config hook injects the bundled skills path at runtime,
  // resolved from wherever OpenCode installed the package. An absolute path
  // written at install time goes stale (bunx cache cleanup) and makes
  // opencode.json machine-specific, so install writes nothing here and
  // removes entries left behind by older amore versions.
  changed = removeStaleAmoreSkillsPaths(body) || changed;

  if (obsidianMcp) {
    const mcp = isJsonObject(body.mcp) ? body.mcp : {};
    if (body.mcp !== mcp) {
      body.mcp = mcp;
      changed = true;
    }
    if (!isJsonObject(mcp.obsidian)) {
      mcp.obsidian = {
        type: 'local',
        command: ['bunx', 'obsidian-mcp-server@latest'],
        environment: {
          OBSIDIAN_API_KEY: obsidianMcp.apiKey,
          OBSIDIAN_BASE_URL: obsidianMcp.baseUrl,
          OBSIDIAN_VERIFY_SSL: String(obsidianMcp.verifySSL),
        },
      };
      changed = true;
      obsidianMcpWired = true;
    }
  }

  return { changed, obsidianMcpWired };
}

function formatJson(body: unknown): string {
  return `${JSON.stringify(body, null, 2)}\n`;
}

function writeFileAtomic(target: string, content: string): void {
  mkdirSync(dirname(target), { recursive: true });
  const tmpPath = `${target}.tmp-${process.pid}-${Date.now()}`;
  try {
    writeFileSync(tmpPath, content, 'utf8');
    renameSync(tmpPath, target);
  } catch (error) {
    rmSync(tmpPath, { force: true });
    throw error;
  }
}

function nextBackupPath(target: string): string {
  const first = `${target}.bak`;
  if (!existsSync(first)) {
    return first;
  }

  for (let index = 1; index < 1000; index += 1) {
    const candidate = `${first}.${index}`;
    if (!existsSync(candidate)) {
      return candidate;
    }
  }

  return `${first}.${Date.now()}`;
}

function backupExistingFile(target: string): string {
  const backupPath = nextBackupPath(target);
  copyFileSync(target, backupPath);
  return backupPath;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function acquireConfigLock(
  target: string,
  warnings: string[],
): (() => void) | null {
  const lockPath = `${target}.lock`;
  try {
    mkdirSync(lockPath);
  } catch (error) {
    warnings.push(
      `Could not acquire OpenCode config lock at ${lockPath} (${formatError(error)}) — leaving opencode.json unchanged. If no install is running, remove the lock and re-run.`,
    );
    return null;
  }

  return () => {
    rmSync(lockPath, { recursive: true, force: true });
  };
}

function writeOrUpdateOpencodeConfig(
  target: string,
  obsidianMcp: ObsidianMcpEntry | null,
): {
  action: BootstrapWriteResult['opencodeConfigAction'];
  obsidianMcpWired: boolean;
  backupPath: string | null;
  warnings: string[];
} {
  const warnings: string[] = [];
  const releaseLock = acquireConfigLock(target, warnings);
  if (!releaseLock) {
    return {
      action: 'kept',
      obsidianMcpWired: false,
      backupPath: null,
      warnings,
    };
  }

  try {
    const body: Record<string, unknown> = {};
    const ensured = ensureAmoreOpencodeConfig(body, obsidianMcp);

    if (!existsSync(target)) {
      writeFileAtomic(target, formatJson(body));
      return {
        action: 'created',
        obsidianMcpWired: ensured.obsidianMcpWired,
        backupPath: null,
        warnings,
      };
    }

    let existing: unknown;
    try {
      existing = JSON.parse(readFileSync(target, 'utf8'));
    } catch (error) {
      warnings.push(
        `Could not parse ${target} (${formatError(error)}) — leaving opencode.json unchanged. Fix the JSON and re-run amore install.`,
      );
      return {
        action: 'kept',
        obsidianMcpWired: false,
        backupPath: null,
        warnings,
      };
    }

    if (!isJsonObject(existing)) {
      warnings.push(
        `${target} is not a JSON object — leaving opencode.json unchanged.`,
      );
      return {
        action: 'kept',
        obsidianMcpWired: false,
        backupPath: null,
        warnings,
      };
    }

    const updated = ensureAmoreOpencodeConfig(existing, obsidianMcp);
    if (!updated.changed) {
      return {
        action: 'kept',
        obsidianMcpWired: false,
        backupPath: null,
        warnings,
      };
    }

    const backupPath = backupExistingFile(target);
    writeFileAtomic(target, formatJson(existing));
    return {
      action: 'updated',
      obsidianMcpWired: updated.obsidianMcpWired,
      backupPath,
      warnings,
    };
  } finally {
    releaseLock();
  }
}

export function writeBootstrapFiles(args: {
  cwd: string;
  labDir?: string;
  resolvedWikiPath: string | null;
  obsidianMcp: ObsidianMcpEntry | null;
  modelSeed: ModelSeed;
}): BootstrapWriteResult {
  const labRoot = resolve(args.cwd, args.labDir ?? 'lab');
  const labDirDisplay = args.labDir ?? 'lab';

  const amoreConfigPath = getProjectAmoreConfigPath(args.cwd);
  const legacyLabConfigPath = join(labRoot, 'config.json');
  const amoreConfigBody: Record<string, unknown> = {
    schema_version: CONFIG_SCHEMA_VERSION,
    lab_dir: args.labDir ?? './lab',
    orchestration: {
      max_parallel: DEFAULT_ORCHESTRATION_MAX_PARALLEL,
    },
    personas: args.modelSeed.personas,
  };
  if (args.resolvedWikiPath) {
    amoreConfigBody.literature_wiki_path = args.resolvedWikiPath;
  }
  const amoreConfigWritten = writeAmoreConfigIfMissing(
    amoreConfigPath,
    legacyLabConfigPath,
    amoreConfigBody,
  );

  const opencodeConfigPath = join(args.cwd, PROJECT_OPENCODE_CONFIG_PATH);
  const opencodeConfig = writeOrUpdateOpencodeConfig(
    opencodeConfigPath,
    args.obsidianMcp,
  );
  const agentsFile = writeStarterAgentsFile(args.cwd, {
    projectName: basename(args.cwd),
    labDir: labDirDisplay,
    literatureWikiPath: args.resolvedWikiPath,
  });

  return {
    labConfig: null,
    amoreConfig: amoreConfigWritten ? amoreConfigPath : null,
    opencodeConfig:
      opencodeConfig.action === 'kept' ? null : opencodeConfigPath,
    agentsFile,
    obsidianMcpWired: opencodeConfig.obsidianMcpWired,
    opencodeConfigAction: opencodeConfig.action,
    opencodeConfigBackup: opencodeConfig.backupPath,
    warnings: opencodeConfig.warnings,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Back-compat wrapper — single-call bootstrap used by old tests
// ──────────────────────────────────────────────────────────────────────────

export interface BootstrapResult {
  labConfig: string | null;
  amoreConfig: string | null;
  opencodeConfig: string | null;
  agentsFile: string | null;
  resolvedWikiPath: string | null;
  obsidianMcpWired: boolean;
  warnings: string[];
  /** What the wiki step decided. */
  wikiKind: WikiChoiceKind;
  /** True iff a new wiki was created. */
  wikiCreated: boolean;
  /** Whether opencode.json was created, updated in place, or already correct. */
  opencodeConfigAction: BootstrapWriteResult['opencodeConfigAction'];
  /** Backup path written before updating an existing opencode.json. */
  opencodeConfigBackup: string | null;
}

/**
 * Single-call bootstrap that runs all three steps without printing anything.
 * Kept for callers that want a one-shot non-interactive helper (tests, simple
 * CI scripts). install.ts uses the granular functions directly so it can
 * interleave section headers.
 */
export async function bootstrapProjectConfig(
  options: BootstrapOptions = {},
): Promise<BootstrapResult> {
  const cwd = options.cwd ?? process.cwd();
  const wiki = await resolveLiteratureWiki(options);
  const warnings = [...wiki.warnings];
  const modelSeed = await resolveModelSeed(options);

  let mcpEntry: ObsidianMcpEntry | null = null;
  if (wiki.resolvedPath) {
    const mcp = await maybeReadObsidianMcp(wiki.resolvedPath, options);
    mcpEntry = mcp.entry;
    warnings.push(...mcp.warnings);
  }

  const written = writeBootstrapFiles({
    cwd,
    labDir: options.labDir,
    resolvedWikiPath: wiki.resolvedPath,
    obsidianMcp: mcpEntry,
    modelSeed,
  });
  warnings.push(...written.warnings);

  return {
    labConfig: written.labConfig,
    amoreConfig: written.amoreConfig,
    opencodeConfig: written.opencodeConfig,
    agentsFile: written.agentsFile,
    resolvedWikiPath: wiki.resolvedPath,
    obsidianMcpWired: written.obsidianMcpWired,
    warnings,
    wikiKind: wiki.kind,
    wikiCreated: wiki.created,
    opencodeConfigAction: written.opencodeConfigAction,
    opencodeConfigBackup: written.opencodeConfigBackup,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Starter AGENTS.md for the project (Q2)
// ──────────────────────────────────────────────────────────────────────────

const STARTER_AGENTS_MD_TEMPLATE = `# {{PROJECT_NAME}} - research project (managed by amore)

This project is set up with [ah-my-openresearch](https://github.com/lubludrova/ah-my-openresearch)
("amore"). Six research personas register at OpenCode startup, bundled
skills are exposed by the plugin, and \`{{LAB_DIR}}/\` is the project-local
research record.

## amore

\`\`\`yaml
lab_dir: {{LAB_DIR}}
literature_wiki_path: {{WIKI_PATH_YAML}}
\`\`\`

This block records the paths generated by \`amore install\`. Update it only if
the project lab or literature wiki moves.

## Where things live

- \`{{LAB_DIR}}/\` - per-project research record (claims, ideas, experiments).
  - \`{{LAB_DIR}}/drafts/\` - all agent-written research artifacts land here
    (\`claim-*\`, \`idea-*\`, \`exp-*\`).
  - \`{{LAB_DIR}}/SCHEMA.md\` - frontmatter spec and edge type catalog.
  - \`{{LAB_DIR}}/log.md\` - append-only changelog.
  - \`{{LAB_DIR}}/edges.jsonl\` - typed graph between artifacts.
  - \`{{LAB_DIR}}/index.md\` - generated catalog; manual edits are not kept.
- {{LITERATURE_WIKI_LINE}}
- \`opencode.json\` - OpenCode plugin entry. The amore plugin registers the
  personas and bundled skill path at runtime. Optional MCPs are wired only when
  you choose them during install.
- \`.opencode/amore.json\` - persona models and amore project config. Edit this
  file to change models, temperatures, councillors, or the literature wiki path.

## Personas

Six specialists register at OpenCode startup. Talk to any of them directly,
or address \`@orchestrator\` for routing.

| Persona | Owns | When to call |
|---|---|---|
| \`@orchestrator\` | Intake, routing, handoff summaries | Start of a session, or when unsure who to ask |
| \`@librarian\` | Literature wiki + claim extraction | Ingest a paper; extract atomic claims |
| \`@prospector\` | Ideation + experiment planning | "What should I try next?" / "Plan an experiment for idea X" |
| \`@coder\` | Run / monitor / analyze experiments | Launch jobs, watch logs, finalize results |
| \`@council\` | Multi-LLM adversarial critique | Pre-submission review, novelty stress-test |
| \`@writer\` | Paper plan / figure generation / audit | Approaching submission |

## Lab boundaries (enforced by a write hook)

The plugin's \`pre-write-drafts-only\` hook intercepts tool writes:

- Allowed: \`{{LAB_DIR}}/drafts/**\`, appends to \`{{LAB_DIR}}/log.md\` and
  \`{{LAB_DIR}}/edges.jsonl\`, regeneration of \`{{LAB_DIR}}/index.md\`.
- Denied: \`{{LAB_DIR}}/SCHEMA.md\` and \`{{LAB_DIR}}/README.md\`.
- Outside \`{{LAB_DIR}}/\`, agents edit project code normally.

{{WIKI_SECTION}}

## Research rules

- **Claims carry provenance.** Every \`{{LAB_DIR}}/drafts/claim-*.md\` cites
  a source: either a wiki paper note
  (\`provenance.sources: [wiki:<slug>#<section>]\`) or an experiment
  (\`provenance.experiments: [exp:<slug>-<date>]\`).
- **Confidence is enumerated**: \`low | medium | high\`. Default for fresh
  imports is \`low\`. Promotion to \`medium\` / \`high\` happens only when an
  experiment tests the claim.
- **Edges are typed and directed.** \`claim -> claim\` for supports /
  contradicts; \`idea -> claim\` for addresses_gap; \`claim -> exp\` for
  tested_by; etc. See \`{{LAB_DIR}}/SCHEMA.md\` for the full catalog.

## Validation

Run \`amore doctor\` at any point to validate:

- lab layout (missing files)
- artifact frontmatter (strict Zod schema)
- provenance refs (\`<kind>:<id>[#<locator>]\` grammar)
- \`edges.jsonl\` (line-by-line + broken refs)
- \`index.md\` staleness (auto-regen with \`--repair\`)

## Don't

- Don't write to \`{{LAB_DIR}}/SCHEMA.md\` or \`{{LAB_DIR}}/README.md\`.
- Don't invent provenance - every claim must cite either a wiki source or
  an experiment.
- Don't create new lab areas or approval flows unless the project owner asks.
- Don't translate this file or wiki pages without keeping the original.
`;

interface AgentsMdVars {
  projectName: string;
  labDir: string;
  literatureWikiPath: string | null;
}

function renderAgentsMd(vars: AgentsMdVars): string {
  const wikiPathYaml = vars.literatureWikiPath
    ? JSON.stringify(vars.literatureWikiPath)
    : 'null';
  const literatureWikiLine = vars.literatureWikiPath
    ? `\`${vars.literatureWikiPath}\` - outside literature wiki.`
    : '_No literature wiki configured for this project - set `literature_wiki_path` in `.opencode/amore.json` to enable librarian._';
  const wikiSection = vars.literatureWikiPath
    ? `## Literature wiki

The literature wiki at \`${vars.literatureWikiPath}\` follows its own
contract. Read the first file that exists, in this priority order:

1. \`${vars.literatureWikiPath}/RULES.md\`
2. \`${vars.literatureWikiPath}/AGENTS.md\`
3. \`${vars.literatureWikiPath}/README.md\`

When the librarian writes a new page, it follows the wiki's naming convention,
frontmatter schema, and log format. If no contract file exists, the librarian
asks for a contract before writing.`
    : `## Literature wiki

No literature wiki is configured for this project yet. To enable librarian,
set \`literature_wiki_path\` in \`.opencode/amore.json\`.`;
  return STARTER_AGENTS_MD_TEMPLATE.replaceAll(
    '{{PROJECT_NAME}}',
    vars.projectName,
  )
    .replaceAll('{{LAB_DIR}}', vars.labDir)
    .replaceAll('{{WIKI_PATH_YAML}}', wikiPathYaml)
    .replaceAll('{{WIKI_SECTION}}', wikiSection)
    .replaceAll('{{LITERATURE_WIKI_LINE}}', literatureWikiLine);
}

/**
 * Writes <projectRoot>/AGENTS.md when it does not already exist. Idempotent.
 * Returns the path actually written, or null when an existing file was kept.
 */
export function writeStarterAgentsFile(
  projectRoot: string,
  vars: AgentsMdVars,
): string | null {
  const target = resolve(projectRoot, 'AGENTS.md');
  if (existsSync(target)) {
    return null;
  }
  writeFileSync(target, renderAgentsMd(vars), 'utf8');
  return target;
}
