import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { DEFAULT_LAB_DIR } from '../config/constants';
import { resolveProjectPath } from '../utils/paths';
import { rebuildLabIndex } from './indexer';

export interface CreateLabOptions {
  labDir?: string;
  reconcile?: boolean;
}

export interface LabValidationResult {
  ok: boolean;
  labDir: string;
  missing: string[];
}

const README_TEMPLATE = `# Research Lab

This directory is managed by ah-my-openresearch (\`amore\`) for this project.

## What lives here

- \`drafts/\` — all agent-written research artifacts: \`claim-*\`, \`exp-*\`, \`idea-*\`.
- \`edges.jsonl\` — machine-readable graph facts between lab artifacts.
- \`log.md\` — append-only changelog and persona handoffs.
- \`index.md\` — generated catalog; do not edit by hand.
- \`SCHEMA.md\` — artifact and edge schema.

## Human review

In MVP, all artifacts stay in \`drafts/\`. Review, edit, or delete drafts directly
in Obsidian or your editor. There is no \`canon/\` directory until Phase 8.

## Boundaries

Agents should only write artifacts under \`drafts/\` and append to \`log.md\` /
\`edges.jsonl\`. \`index.md\` is regenerated from source artifacts.
`;

const SCHEMA_TEMPLATE = `# Lab Schema

## Artifact Files

- \`drafts/claim-<slug>.md\`
- \`drafts/exp-<slug>.md\`
- \`drafts/idea-<slug>.md\`

## Base Frontmatter

All artifacts use \`schema_version\`, \`type\`, \`node_id\`, \`title\`, \`created\`,
\`updated\`, \`tags\`, \`provenance\`, and \`domain\`.

## Claim Frontmatter

Claims use \`status\`, \`confidence\`, \`supports\`, \`contradicts\`, and
\`tested_by\`.

## Idea Frontmatter

Ideas use \`status\`, \`hypothesis\`, \`target_gaps\`, \`motivated_by\`, and
\`planned_experiments\`.

## Experiment Frontmatter

Experiments use \`status\`, \`tests\`, \`idea_refs\`, \`claim_refs\`, \`plan\`,
\`run\`, and \`results\`.

## Provenance Source Refs

Use \`<kind>:<id>[#<locator>]\` where kind is \`arxiv\`, \`doi\`, \`url\`,
\`wiki\`, or \`zotero\`.

## edges.jsonl

One JSON object per line. Core fields: \`schema_version\`, \`edge_id\`, \`from\`,
\`to\`, \`type\`, \`created\`, and \`created_by\`.

## log.md

\`## [YYYY-MM-DD HH:MM] action | <subject>\` followed by details and
\`Affected:\` wikilinks.

## index.md

Generated. Do not edit by hand.
`;

const LOG_TEMPLATE = `# Lab Log

`;

async function writeIfMissing(path: string, content: string): Promise<void> {
  if (!existsSync(path)) {
    await writeFile(path, content, 'utf8');
  }
}

async function writeCandidateIfChanged(
  path: string,
  content: string,
): Promise<void> {
  if (!existsSync(path)) {
    await writeFile(path, content, 'utf8');
    return;
  }

  const current = await readFile(path, 'utf8');
  if (current !== content) {
    await writeFile(`${path}.new`, content, 'utf8');
  }
}

export function resolveLabDir(
  projectRoot: string,
  labDir = DEFAULT_LAB_DIR,
): string {
  return resolveProjectPath(projectRoot, labDir);
}

export async function createLab(
  projectRoot: string,
  options: CreateLabOptions = {},
): Promise<string> {
  const labDir = resolveLabDir(projectRoot, options.labDir);

  await mkdir(resolve(labDir, 'drafts'), { recursive: true });

  if (options.reconcile) {
    await writeCandidateIfChanged(
      resolve(labDir, 'README.md'),
      README_TEMPLATE,
    );
    await writeCandidateIfChanged(
      resolve(labDir, 'SCHEMA.md'),
      SCHEMA_TEMPLATE,
    );
  } else {
    await writeIfMissing(resolve(labDir, 'README.md'), README_TEMPLATE);
    await writeIfMissing(resolve(labDir, 'SCHEMA.md'), SCHEMA_TEMPLATE);
  }

  await writeIfMissing(resolve(labDir, 'log.md'), LOG_TEMPLATE);
  await writeIfMissing(resolve(labDir, 'edges.jsonl'), '');
  await rebuildLabIndex(labDir);

  return labDir;
}

export async function validateLabLayout(
  projectRoot: string,
  options: CreateLabOptions = {},
): Promise<LabValidationResult> {
  const labDir = resolveLabDir(projectRoot, options.labDir);
  const required = [
    'README.md',
    'SCHEMA.md',
    'log.md',
    'index.md',
    'edges.jsonl',
    'drafts',
  ];
  const missing = required.filter((item) => !existsSync(resolve(labDir, item)));

  return {
    ok: missing.length === 0,
    labDir,
    missing,
  };
}
