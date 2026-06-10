import { basename, relative } from 'node:path';
import type { ModelPresetName } from '../config/constants';
import { createLab, validateLabLayout } from '../lab';
import {
  type BootstrapOptions,
  type ObsidianMcpEntry,
  type WikiResolution,
  maybeReadObsidianMcp,
  resolveLiteratureWiki,
  resolveModelPreset,
  writeBootstrapFiles,
} from './bootstrap';

export interface InstallOptions {
  cwd?: string;
  labDir?: string;
  reconcile?: boolean;
  /** When false, skip lab/config.json, opencode.json, and AGENTS.md seeds. */
  bootstrap?: boolean;
  /** Explicit literature wiki path. */
  literatureWiki?: string;
  /** Opt out of literature_wiki_path. */
  noWiki?: boolean;
  /** Opt-in to wiring Obsidian MCP into opencode.json (needed in non-TTY). */
  withObsidianMcp?: boolean;
  /** Persona model preset from --models <name>. */
  models?: ModelPresetName;
}

const SECTION_WIDTH = 60;

function out(message = ''): void {
  process.stdout.write(`${message}\n`);
}

function section(title: string): void {
  const dashes = '─'.repeat(Math.max(3, SECTION_WIDTH - title.length - 5));
  out();
  out(`─── ${title} ${dashes}`);
  out();
}

function header(projectName: string, projectPath: string): void {
  out();
  out('  amore — ah-my-openresearch');
  out('  Research personas + per-project lab + literature wiki');
  out();
  out(`  Setting up:  ${projectName}`);
  out(`               ${projectPath}`);
  out();
}

function bulletOk(label: string, detail?: string): void {
  const padded = label.padEnd(18);
  out(`    ✓ ${padded} ${detail ?? ''}`);
}

function bulletWarn(message: string): void {
  out(`    ⚠ ${message}`);
}

function nextSteps(args: {
  labRelative: string;
  wiki: WikiResolution;
  agentsFileCreated: boolean;
}): void {
  out();
  out('    Created in this project:');
  out();
  out(`      ${args.labRelative}/`);
  out('        README.md      operating guide');
  out('        SCHEMA.md      artifact + edge contract');
  out('        drafts/        agent-written claim/idea/exp drafts');
  out('        log.md         append-only lab changelog');
  out('        edges.jsonl    typed graph between lab artifacts');
  out('        index.md       generated catalog');
  out('      opencode.json    plugin entry for the host CLI');
  out(
    `      AGENTS.md        project rules (${args.agentsFileCreated ? 'created' : 'already existed'})`,
  );
  out();
  out('    How to use:');
  out();
  out('      1. Open OpenCode:       opencode');
  out('      2. Choose a persona:');
  out('           @librarian     literature ingest + claim extraction');
  out('           @prospector    ideas + experiment plans');
  out('           @coder         run / monitor / analyze experiments');
  out('           @council       adversarial critique');
  out('           @writer        paper planning, figures, audit');
  out('      3. Or start with @orchestrator for routing.');
  out();
  out(`      Wiki:                 ${describeWikiOutcome(args.wiki)}`);
  out('      Validate anytime:    amore doctor');
  out();
  out('    Docs:  https://github.com/lubludrova/ah-my-openresearch');
  out();
  out('    Setup complete.');
  out();
}

function bootstrapOptionsFromInstall(
  options: InstallOptions,
): BootstrapOptions {
  return {
    cwd: options.cwd,
    labDir: options.labDir,
    literatureWiki: options.literatureWiki,
    noWiki: options.noWiki,
    withObsidianMcp: options.withObsidianMcp,
    models: options.models,
  };
}

function describeWikiOutcome(wiki: WikiResolution): string {
  switch (wiki.kind) {
    case 'use':
      return wiki.resolvedPath ?? 'no path';
    case 'create':
      return `created starter wiki at ${wiki.resolvedPath}`;
    case 'skip':
      return 'skipped';
  }
}

export async function install(options: InstallOptions = {}): Promise<void> {
  const cwd = options.cwd ?? process.cwd();
  const projectName = basename(cwd);
  const skipBootstrap = options.bootstrap === false;
  const skipWelcome = skipBootstrap;

  if (!skipWelcome) {
    header(projectName, cwd);
  }

  // ── Step A: lab scaffold ────────────────────────────────────────────
  const labDir = await createLab(cwd, {
    labDir: options.labDir,
    reconcile: options.reconcile,
  });
  const validation = await validateLabLayout(cwd, {
    labDir: options.labDir,
  });
  const labRelative = relative(cwd, labDir) || '.';

  if (!validation.ok) {
    out(`[amore:error] Lab scaffold is incomplete at ${labRelative}.`);
    out(`              Missing: ${validation.missing.join(', ')}`);
    process.exitCode = 1;
    return;
  }

  // ── Step B: bootstrap (if not skipped) ──────────────────────────────
  if (skipBootstrap) {
    out(`[amore:ok] Created/validated local research lab at ${labRelative}`);
    out(
      '[amore] Created local files: README.md, SCHEMA.md, log.md, index.md, edges.jsonl, drafts/',
    );
    out('[amore] Global OpenCode config was not modified.');
    return;
  }

  const bootstrapOpts = bootstrapOptionsFromInstall(options);

  // ── B1: Literature wiki ─────────────────────────────────────────────
  section('Literature wiki');
  out("    amore's librarian reads/writes a markdown literature wiki");
  out('    (Obsidian or any plain markdown vault).');
  out();
  const wiki = await resolveLiteratureWiki(bootstrapOpts);

  // ── B1b: Persona models ─────────────────────────────────────────────
  section('Persona models');
  const modelPreset = await resolveModelPreset(bootstrapOpts);
  if (modelPreset) {
    out(`    Using the "${modelPreset}" preset for all six personas.`);
  } else {
    out('    Skipped — personas use the code defaults (openai preset).');
    out('    Override later via personas.<name>.model in lab/config.json.');
  }

  // ── B2: Obsidian MCP (only if a wiki path was chosen) ──────────────
  let mcpEntry: ObsidianMcpEntry | null = null;
  let mcpPluginFound = false;
  const mcpWarnings: string[] = [];
  if (wiki.resolvedPath) {
    section('Obsidian MCP');
    const mcp = await maybeReadObsidianMcp(wiki.resolvedPath, bootstrapOpts);
    mcpEntry = mcp.entry;
    mcpPluginFound = mcp.pluginFound;
    mcpWarnings.push(...mcp.warnings);
    if (!mcpPluginFound) {
      out(`    No Local REST API plugin at ${wiki.resolvedPath} — skipping.`);
    } else if (mcpEntry) {
      out(
        `    Wiring mcp.obsidian from ${wiki.resolvedPath}/.obsidian/plugins/obsidian-local-rest-api/data.json`,
      );
    } else {
      out('    Plugin found but MCP auto-config was declined.');
    }
  }

  // ── B3: write files + final summary ─────────────────────────────────
  const written = writeBootstrapFiles({
    cwd,
    labDir: options.labDir,
    resolvedWikiPath: wiki.resolvedPath,
    obsidianMcp: mcpEntry,
    modelPreset,
  });

  section('Setup');
  bulletOk('Lab scaffold', `${labRelative}/`);
  if (wiki.kind === 'create' && wiki.resolvedPath) {
    bulletOk('Wiki created', wiki.resolvedPath);
  }
  if (written.labConfig) {
    const wikiPart = wiki.resolvedPath
      ? `literature_wiki_path=${wiki.resolvedPath}`
      : 'no literature_wiki_path';
    const modelPart = modelPreset ? `, models=${modelPreset}` : '';
    bulletOk(
      'Lab config',
      `${labRelative}/config.json (${wikiPart}${modelPart})`,
    );
  }
  if (written.opencodeConfig) {
    const mcpPart = written.obsidianMcpWired ? ' + mcp.obsidian' : '';
    const action =
      written.opencodeConfigAction === 'updated' ? 'updated' : 'created';
    bulletOk(
      'OpenCode config',
      `opencode.json ${action} (plugin + disabled build/plan${mcpPart})`,
    );
    if (written.opencodeConfigBackup) {
      bulletOk(
        'Config backup',
        `${relative(cwd, written.opencodeConfigBackup) || 'opencode.json.bak'}`,
      );
    }
  } else {
    const keptMessage =
      written.opencodeConfigAction === 'kept'
        ? 'opencode.json not changed (already configured or see warning)'
        : 'opencode.json already configured';
    bulletOk('OpenCode config', keptMessage);
  }
  if (written.agentsFile) {
    bulletOk('Agent guide', 'AGENTS.md');
  } else {
    bulletOk('Agent guide', 'AGENTS.md already exists (kept)');
  }

  for (const warning of [
    ...wiki.warnings,
    ...mcpWarnings,
    ...written.warnings,
  ]) {
    bulletWarn(warning);
  }

  // ── Step C: next steps ──────────────────────────────────────────────
  section('Next steps');
  nextSteps({
    labRelative,
    wiki,
    agentsFileCreated: written.agentsFile !== null,
  });
}
