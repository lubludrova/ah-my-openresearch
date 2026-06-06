import { relative } from 'node:path';
import { createLab, validateLabLayout } from '../lab';
import { logger } from '../utils';

export interface InstallOptions {
  cwd?: string;
  labDir?: string;
  reconcile?: boolean;
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

  logger.info(
    'Global config was not created. OpenCode MCP config was not modified.',
  );
  logger.info(
    'Optional later setup: configure Obsidian/Zotero/Basic Memory when plugin runtime is wired.',
  );
}
