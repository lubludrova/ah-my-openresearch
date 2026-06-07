import { relative } from 'node:path';
import { createLab, validateLabLayout } from '../lab';
import { logger } from '../utils';
import { bootstrapProjectConfig } from './bootstrap';

export interface InstallOptions {
  cwd?: string;
  labDir?: string;
  reconcile?: boolean;
  /** When false, skip the lab/config.json + opencode.json bootstrap step. */
  bootstrap?: boolean;
  /** Explicit literature wiki path. */
  literatureWiki?: string;
  /** Opt out of literature_wiki_path. */
  noWiki?: boolean;
  /** Opt-in to wiring Obsidian MCP into opencode.json (needed in non-TTY). */
  withObsidianMcp?: boolean;
}

export async function install(options: InstallOptions = {}): Promise<void> {
  const cwd = options.cwd ?? process.cwd();
  const labDir = await createLab(cwd, {
    labDir: options.labDir,
    reconcile: options.reconcile,
  });
  const validation = await validateLabLayout(cwd, {
    labDir: options.labDir,
  });
  const displayPath = relative(cwd, labDir) || '.';

  if (!validation.ok) {
    logger.error(
      `Lab scaffold is incomplete at ${displayPath}. Missing: ${validation.missing.join(', ')}`,
    );
    process.exitCode = 1;
    return;
  }

  logger.success(`Created/validated local research lab at ${displayPath}`);
  logger.info(
    'Created local files: README.md, SCHEMA.md, log.md, index.md, edges.jsonl, drafts/',
  );

  if (options.reconcile) {
    logger.info(
      'Reconcile mode writes README.md.new / SCHEMA.md.new when local docs differ.',
    );
  }

  if (options.bootstrap !== false) {
    const result = await bootstrapProjectConfig({
      cwd,
      labDir: options.labDir,
      literatureWiki: options.literatureWiki,
      noWiki: options.noWiki,
      withObsidianMcp: options.withObsidianMcp,
    });
    if (result.labConfig) {
      const wikiPart = result.resolvedWikiPath
        ? `literature_wiki_path = ${result.resolvedWikiPath}`
        : 'no literature_wiki_path set';
      logger.info(
        `Wrote ${relative(cwd, result.labConfig) || result.labConfig} (${wikiPart}).`,
      );
    }
    if (result.opencodeConfig) {
      const mcpPart = result.obsidianMcpWired
        ? ' with mcp.obsidian wired from your Local REST API plugin'
        : '';
      logger.info(
        `Wrote ${relative(cwd, result.opencodeConfig) || result.opencodeConfig} (plugin: ["ah-my-openresearch"]${mcpPart}). Composes with ~/.config/opencode/opencode.json.`,
      );
    }
    for (const warning of result.warnings) {
      logger.warn(warning);
    }
    if (!result.labConfig && !result.opencodeConfig) {
      logger.info(
        'Bootstrap skipped: lab/config.json and opencode.json already exist.',
      );
    }
  }

  logger.info(
    'Global OpenCode config was not modified. MCP setup (e.g. Obsidian) is opt-in per project.',
  );
}
