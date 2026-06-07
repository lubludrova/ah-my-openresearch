// Bootstrap helpers for `amore install`.
//
// The flow is broken into small async steps so `install.ts` can interleave
// section headers between them in the TTY welcome output:
//
//   1. resolveLiteratureWiki   — pick existing / create / skip
//   2. maybeReadObsidianMcp    — auto-wire MCP from the chosen wiki
//   3. writeBootstrapFiles     — idempotent seeds for lab/config.json and
//                                opencode.json
//
// Each step is pure-ish: side effects are file writes and prompts; nothing
// else logs. install.ts owns presentation.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { CONFIG_SCHEMA_VERSION } from '../config/constants';

// ──────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────

export type WikiChoiceKind = 'use' | 'create' | 'skip';

export interface WikiResolution {
  /** What happened with the wiki step. */
  kind: WikiChoiceKind;
  /** Path written into lab/config.json (or null when skipped). */
  resolvedPath: string | null;
  /** Auto-detected path under ~ at the start of the flow (for logging). */
  detectedAutoPath: string | null;
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
  opencodeConfig: string | null;
  agentsFile: string | null;
  /** True iff a mcp.obsidian block was wired into the generated opencode.json. */
  obsidianMcpWired: boolean;
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
  /** Whether to prompt interactively. Defaults to process.stdin.isTTY. */
  interactive?: boolean;
  /** Test seam — defaults to readline against process.stdin/stdout. */
  prompt?: (question: string) => Promise<string>;
}

// ──────────────────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────────────────

const DETECTED_WIKIS = ['RL-Wiki', 'PM-Wiki'] as const;
const CONTRACT_FILES = [
  'RULES.md',
  'AGENTS.md',
  'README.md',
  'ingest_prompt.md',
] as const;
const DEFAULT_WIKI_NAME = 'llm-wiki';

const STARTER_WIKI_RULES_MD = `# Wiki Rules

Personal markdown literature wiki. Compile knowledge into interlinked pages
instead of re-discovering it every session.

## Structure

\`\`\`
<wiki>/
├── RULES.md       — this file (the contract librarian reads at session start)
├── raw/           — immutable source materials (PDFs, images, downloads)
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

## Read-before-write

Before writing a new page, scan \`wiki/index.md\` and search for the same topic
to avoid duplicates. Append backlinks if related pages exist.
`;

// ──────────────────────────────────────────────────────────────────────────
// Path helpers
// ──────────────────────────────────────────────────────────────────────────

function detectAutoWikiUnderHome(home: string): string | null {
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
      `Literature wiki path "${display}" does not exist yet — writing it into lab/config.json anyway. Create the directory before invoking librarian.`,
    );
  } else if (!hasContractFile(absolute)) {
    warnings.push(
      `Literature wiki at "${display}" has no RULES.md / AGENTS.md / README.md / ingest_prompt.md — librarian will fall back to internal defaults.`,
    );
  }
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
  const rulesPath = join(dirAbsolute, 'RULES.md');
  if (!existsSync(rulesPath)) {
    writeFileSync(rulesPath, STARTER_WIKI_RULES_MD, 'utf8');
    filesWritten.push('RULES.md');
  }
  filesWritten.push('wiki/');
  filesWritten.push('raw/');
  return { filesWritten };
}

/**
 * Resolves which literature wiki path (if any) will land in lab/config.json.
 * In interactive mode, prompts the user with a 3-way choice
 * (use / create / skip). Non-interactive runs honor explicit flags only.
 */
export async function resolveLiteratureWiki(
  options: BootstrapOptions = {},
): Promise<WikiResolution> {
  const cwd = options.cwd ?? process.cwd();
  const home = options.homeDir ?? homedir();
  const interactive = options.interactive ?? Boolean(process.stdin.isTTY);
  const prompt = options.prompt ?? defaultPrompt;
  const warnings: string[] = [];
  const detectedAutoPath = detectAutoWikiUnderHome(home);

  // Explicit opt-out wins outright.
  if (options.noWiki) {
    return {
      kind: 'skip',
      resolvedPath: null,
      detectedAutoPath,
      created: false,
      warnings,
    };
  }

  // Explicit --literature-wiki <path>.
  if (options.literatureWiki) {
    const display = options.literatureWiki;
    warnExplicitPath(display, absoluteWikiPath(display, cwd, home), warnings);
    return {
      kind: 'use',
      resolvedPath: display,
      detectedAutoPath,
      created: false,
      warnings,
    };
  }

  // Non-interactive without any flag: silently use auto-detect if found,
  // otherwise omit (matches existing CI behavior).
  if (!interactive) {
    return {
      kind: detectedAutoPath ? 'use' : 'skip',
      resolvedPath: detectedAutoPath,
      detectedAutoPath,
      created: false,
      warnings,
    };
  }

  // Interactive: full 3-way menu, with auto-detected path used as the default
  // suggestion for [u].
  const choice = await prompt(
    '  [u] use an existing wiki        — I will ask for the path\n  [c] create one in this project  — at ./llm-wiki/\n  [s] skip                         — no literature wiki\n\n  > ',
  );
  const normalized = choice.toLowerCase();

  if (normalized === '' || normalized === 's' || normalized.startsWith('s')) {
    return {
      kind: 'skip',
      resolvedPath: null,
      detectedAutoPath,
      created: false,
      warnings,
    };
  }

  if (normalized === 'c' || normalized.startsWith('c')) {
    const nameInput = await prompt(`  Name [${DEFAULT_WIKI_NAME}]: > `);
    const name = nameInput.trim() || DEFAULT_WIKI_NAME;
    const dirAbsolute = resolve(cwd, name);
    createStarterWiki(dirAbsolute);
    return {
      kind: 'create',
      resolvedPath: `./${name}`,
      detectedAutoPath,
      created: true,
      warnings,
    };
  }

  // 'u' or anything else → ask for path.
  const suggestion = detectedAutoPath ?? '';
  const pathPrompt = suggestion
    ? `  Path to your wiki [${suggestion}]: > `
    : '  Path to your wiki: > ';
  const entered = (await prompt(pathPrompt)).trim() || suggestion;

  if (!entered) {
    return {
      kind: 'skip',
      resolvedPath: null,
      detectedAutoPath,
      created: false,
      warnings,
    };
  }

  warnExplicitPath(entered, absoluteWikiPath(entered, cwd, home), warnings);
  return {
    kind: 'use',
    resolvedPath: entered,
    detectedAutoPath,
    created: false,
    warnings,
  };
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

function writeJsonIfMissing(target: string, body: unknown): boolean {
  if (existsSync(target)) {
    return false;
  }
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(body, null, 2)}\n`, 'utf8');
  return true;
}

export function writeBootstrapFiles(args: {
  cwd: string;
  labDir?: string;
  resolvedWikiPath: string | null;
  obsidianMcp: ObsidianMcpEntry | null;
}): BootstrapWriteResult {
  const labRoot = resolve(args.cwd, args.labDir ?? 'lab');
  const labDirDisplay = args.labDir ?? 'lab';

  const labConfigPath = join(labRoot, 'config.json');
  const labConfigBody: Record<string, unknown> = {
    schema_version: CONFIG_SCHEMA_VERSION,
  };
  if (args.resolvedWikiPath) {
    labConfigBody.literature_wiki_path = args.resolvedWikiPath;
  }
  const labConfigWritten = writeJsonIfMissing(labConfigPath, labConfigBody);

  const opencodeConfigPath = join(args.cwd, 'opencode.json');
  const opencodeExists = existsSync(opencodeConfigPath);

  const opencodeConfigBody: Record<string, unknown> = {
    $schema: 'https://opencode.ai/config.json',
    plugin: ['ah-my-openresearch'],
    instructions: ['AGENTS.md'],
  };
  if (args.obsidianMcp && !opencodeExists) {
    opencodeConfigBody.mcp = {
      obsidian: {
        type: 'local',
        command: ['bunx', 'obsidian-mcp-server@latest'],
        environment: {
          OBSIDIAN_API_KEY: args.obsidianMcp.apiKey,
          OBSIDIAN_BASE_URL: args.obsidianMcp.baseUrl,
          OBSIDIAN_VERIFY_SSL: String(args.obsidianMcp.verifySSL),
        },
      },
    };
  }
  const opencodeConfigWritten = writeJsonIfMissing(
    opencodeConfigPath,
    opencodeConfigBody,
  );
  const agentsFile = writeStarterAgentsFile(args.cwd, {
    projectName: basename(args.cwd),
    labDir: labDirDisplay,
    literatureWikiPath: args.resolvedWikiPath,
  });

  return {
    labConfig: labConfigWritten ? labConfigPath : null,
    opencodeConfig: opencodeConfigWritten ? opencodeConfigPath : null,
    agentsFile,
    obsidianMcpWired: opencodeConfigWritten && args.obsidianMcp !== null,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Back-compat wrapper — single-call bootstrap used by old tests
// ──────────────────────────────────────────────────────────────────────────

export interface BootstrapResult {
  labConfig: string | null;
  opencodeConfig: string | null;
  agentsFile: string | null;
  detectedWikiPath: string | null;
  resolvedWikiPath: string | null;
  obsidianMcpWired: boolean;
  warnings: string[];
  /** What the wiki step decided. */
  wikiKind: WikiChoiceKind;
  /** True iff a new wiki was created. */
  wikiCreated: boolean;
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
  });

  return {
    labConfig: written.labConfig,
    opencodeConfig: written.opencodeConfig,
    agentsFile: written.agentsFile,
    detectedWikiPath: wiki.detectedAutoPath,
    resolvedWikiPath: wiki.resolvedPath,
    obsidianMcpWired: written.obsidianMcpWired,
    warnings,
    wikiKind: wiki.kind,
    wikiCreated: wiki.created,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Starter AGENTS.md for the project (Q2)
// ──────────────────────────────────────────────────────────────────────────

const STARTER_AGENTS_MD_TEMPLATE = `# {{PROJECT_NAME}} - research project (managed by amore)

This project is set up with [ah-my-openresearch](https://github.com/lubludrova/ah-my-openresearch)
("amore"). Six research personas register at host-CLI startup, bundled
skills are exposed by the plugin, and \`{{LAB_DIR}}/\` is the project-local
research record.

## amore

\`\`\`yaml
lab_dir: {{LAB_DIR}}
literature_wiki_path: {{WIKI_PATH_YAML}}
backend: local
runs_dir: runs/
wandb: false
\`\`\`

Update this block when the project moves from local runs to SSH, Slurm, W&B,
or a different results directory. The experiment skills read this file first.

## Where things live

- \`{{LAB_DIR}}/\` - per-project research record (claims, ideas, experiments).
  - \`{{LAB_DIR}}/drafts/\` - all agent-written research artifacts land here
    (\`claim-*\`, \`idea-*\`, \`exp-*\`).
  - \`{{LAB_DIR}}/SCHEMA.md\` - frontmatter spec and edge type catalog.
  - \`{{LAB_DIR}}/log.md\` - append-only changelog.
  - \`{{LAB_DIR}}/edges.jsonl\` - typed graph between artifacts.
  - \`{{LAB_DIR}}/index.md\` - generated catalog; manual edits are not kept.
- {{LITERATURE_WIKI_LINE}}
- \`opencode.json\` - host CLI plugin entry. The amore plugin registers the
  personas, MCPs, and bundled skill path at runtime.

## Personas

Six specialists register at OpenCode / Codex / Claude Code startup. Talk to
any of them directly, or address \`@orchestrator\` for routing.

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
- Denied: \`{{LAB_DIR}}/SCHEMA.md\`, \`{{LAB_DIR}}/README.md\`, and any
  \`{{LAB_DIR}}/canon/**\` path. Canon is human-review territory later.
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

- Don't write to \`{{LAB_DIR}}/SCHEMA.md\`, \`{{LAB_DIR}}/README.md\`, or
  \`{{LAB_DIR}}/canon/**\`.
- Don't invent provenance - every claim must cite either a wiki source or
  an experiment.
- Don't auto-promote drafts to canon (canon is human-review-only territory).
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
    : `_No literature wiki configured for this project - set \`literature_wiki_path\` in \`${vars.labDir}/config.json\` to enable librarian._`;
  const wikiSection = vars.literatureWikiPath
    ? `## Literature wiki

The literature wiki at \`${vars.literatureWikiPath}\` follows its own
contract. Read the first file that exists, in this priority order:

1. \`${vars.literatureWikiPath}/RULES.md\`
2. \`${vars.literatureWikiPath}/AGENTS.md\`
3. \`${vars.literatureWikiPath}/README.md\`
4. \`${vars.literatureWikiPath}/ingest_prompt.md\`

When the librarian writes a new page, it follows the wiki's naming convention,
frontmatter schema, and log format. If no contract file exists, the librarian
falls back to its internal defaults.`
    : `## Literature wiki

No literature wiki is configured for this project yet. To enable librarian,
set \`literature_wiki_path\` in \`${vars.labDir}/config.json\`.`;
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
