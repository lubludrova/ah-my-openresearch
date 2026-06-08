import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { LAB_SCHEMA_VERSION } from '../config/constants';
import {
  appendEdge,
  appendLabLogEntry,
  buildNodeId,
  createLab,
  isValidSourceRef,
  makeEdgeId,
  parseArtifactMarkdown,
  rebuildLabIndex,
  validateLabLayout,
} from './index';

const tempDirs: string[] = [];

async function tempProject(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'amore-lab-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      await rm(dir, { force: true, recursive: true });
    }
  }
});

describe('lab contract', () => {
  test('creates the MVP lab layout locally', async () => {
    const projectRoot = await tempProject();
    const labDir = await createLab(projectRoot);
    const validation = await validateLabLayout(projectRoot);

    expect(labDir).toBe(resolve(projectRoot, 'lab'));
    expect(validation.ok).toBe(true);
    expect(validation.missing).toEqual([]);
  });

  test('generates node IDs and validates provenance refs', () => {
    expect(
      buildNodeId(
        'claim',
        'KL penalty in GRPO stabilizes reward variance in early training',
      ),
    ).toBe('claim:kl-penalty-grpo-stabilizes-reward-variance-early-training');
    expect(buildNodeId('exp', 'GRPO + KL sweep, 4 seeds', '2026-05-31')).toBe(
      'exp:grpo-kl-sweep-4-seeds-2026-05-31',
    );
    expect(isValidSourceRef('arxiv:2501.12599#sec-3.2')).toBe(true);
    expect(isValidSourceRef('experiment:bad')).toBe(false);
  });

  test('validates artifacts, appends edges/log entries, and rebuilds index', async () => {
    const projectRoot = await tempProject();
    const labDir = await createLab(projectRoot);
    const claimMarkdown = `---
schema_version: ${LAB_SCHEMA_VERSION}
type: claim
node_id: claim:kl-stabilizes-grpo
title: KL stabilizes GRPO
created: 2026-06-03
updated: 2026-06-03
tags: []
provenance:
  sources:
    - arxiv:2501.12599#sec-3.2
  experiments: []
  commits: []
domain: {}
status: open
confidence: medium
contradicts: []
supports: []
tested_by: []
---

# KL stabilizes GRPO
`;

    await writeFile(
      resolve(labDir, 'drafts', 'claim-kl-stabilizes-grpo.md'),
      claimMarkdown,
      'utf8',
    );

    const parsed = parseArtifactMarkdown(claimMarkdown);
    expect(parsed.frontmatter.node_id).toBe('claim:kl-stabilizes-grpo');

    await appendEdge(labDir, {
      schema_version: LAB_SCHEMA_VERSION,
      edge_id: makeEdgeId(
        'claim:kl-stabilizes-grpo',
        'supports',
        'claim:kl-stabilizes-grpo',
      ),
      from: 'claim:kl-stabilizes-grpo',
      to: 'claim:kl-stabilizes-grpo',
      type: 'supports',
      created: '2026-06-03T12:30:00+08:00',
      created_by: 'librarian',
      provenance: ['arxiv:2501.12599#sec-3.2'],
      confidence: 'medium',
    });
    await appendLabLogEntry(labDir, {
      action: 'draft',
      subject: 'claim-kl-stabilizes-grpo',
      description: 'Created from arxiv:2501.12599.',
      affected: ['drafts/claim-kl-stabilizes-grpo'],
      at: new Date('2026-06-03T12:30:00+08:00'),
    });
    await rebuildLabIndex(labDir);

    const index = await readFile(resolve(labDir, 'index.md'), 'utf8');
    const log = await readFile(resolve(labDir, 'log.md'), 'utf8');

    expect(index).toContain('[[drafts/claim-kl-stabilizes-grpo]]');
    expect(index).toContain('- Broken refs: 0');
    expect(log).toContain('draft | claim-kl-stabilizes-grpo');
  });
});
