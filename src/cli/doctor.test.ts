import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { LAB_SCHEMA_VERSION } from '../config/constants';
import { appendEdge, createLab, makeEdgeId } from '../lab';
import { bootstrapProjectConfig } from './bootstrap';
import { runDoctor } from './doctor';

const tempDirs: string[] = [];

async function tempProject(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'amore-doctor-'));
  tempDirs.push(dir);
  return dir;
}

async function writeClaim(labDir: string): Promise<void> {
  await writeFile(
    resolve(labDir, 'drafts', 'claim-kl-stabilizes-grpo.md'),
    `---
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
`,
    'utf8',
  );
}

async function createInstalledProject(projectRoot: string): Promise<string> {
  const labDir = await createLab(projectRoot);
  await bootstrapProjectConfig({
    cwd: projectRoot,
    interactive: false,
    noWiki: true,
  });
  return labDir;
}

afterEach(async () => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      await rm(dir, { force: true, recursive: true });
    }
  }
});

describe('doctor', () => {
  test('fails when lab layout is missing', async () => {
    const projectRoot = await tempProject();
    const result = await runDoctor({ cwd: projectRoot });

    expect(result.exitCode).toBe(1);
    expect(result.checks.some((check) => check.label === 'layout')).toBe(true);
  });

  test('passes on a scaffolded project with OpenCode wiring', async () => {
    const projectRoot = await tempProject();
    await createInstalledProject(projectRoot);

    const result = await runDoctor({ cwd: projectRoot });

    expect(result.exitCode).toBe(0);
    expect(
      result.checks.some(
        (check) =>
          check.label === 'opencode.json' &&
          check.status === 'ok' &&
          check.message.includes('default_agent'),
      ),
    ).toBe(true);
    expect(
      result.checks.some(
        (check) =>
          check.label === 'opencode agents' &&
          check.status === 'ok' &&
          check.message.includes('build/plan'),
      ),
    ).toBe(true);
    expect(
      result.checks.some(
        (check) =>
          check.label === 'opencode skills' &&
          check.status === 'ok' &&
          check.message.includes('17 bundled skills'),
      ),
    ).toBe(true);
  });

  test('fails when OpenCode wiring is incomplete', async () => {
    const projectRoot = await tempProject();
    await createLab(projectRoot);
    await writeFile(resolve(projectRoot, 'AGENTS.md'), '# rules\n', 'utf8');
    await writeFile(
      resolve(projectRoot, 'opencode.json'),
      JSON.stringify({
        plugin: ['ah-my-openresearch'],
        instructions: ['AGENTS.md'],
      }),
      'utf8',
    );

    const result = await runDoctor({ cwd: projectRoot });

    expect(result.exitCode).toBe(1);
    expect(
      result.checks.some(
        (check) =>
          check.label === 'opencode.json' &&
          check.status === 'error' &&
          check.message.includes('default_agent'),
      ),
    ).toBe(true);
    expect(
      result.checks.some(
        (check) =>
          check.label === 'opencode agents' &&
          check.status === 'error' &&
          check.message.includes('agent.build.disable'),
      ),
    ).toBe(true);
    expect(
      result.checks.some(
        (check) =>
          check.label === 'opencode skills' &&
          check.status === 'error' &&
          check.message.includes('skills.paths'),
      ),
    ).toBe(true);
  });

  test('warns on stale index and repairs it', async () => {
    const projectRoot = await tempProject();
    const labDir = await createInstalledProject(projectRoot);
    await writeClaim(labDir);
    await writeFile(resolve(labDir, 'index.md'), '# stale\n', 'utf8');

    const stale = await runDoctor({ cwd: projectRoot });
    expect(stale.exitCode).toBe(2);
    expect(
      stale.checks.some(
        (check) => check.label === 'index.md' && check.status === 'warn',
      ),
    ).toBe(true);

    const repaired = await runDoctor({ cwd: projectRoot, repair: true });
    expect(repaired.exitCode).toBe(0);
    expect(repaired.repaired).toBe(true);
  });

  test('fails on broken edge references', async () => {
    const projectRoot = await tempProject();
    const labDir = await createInstalledProject(projectRoot);
    await writeClaim(labDir);
    await appendEdge(labDir, {
      schema_version: LAB_SCHEMA_VERSION,
      edge_id: makeEdgeId(
        'claim:kl-stabilizes-grpo',
        'supports',
        'claim:missing',
      ),
      from: 'claim:kl-stabilizes-grpo',
      to: 'claim:missing',
      type: 'supports',
      created: '2026-06-03T12:30:00+08:00',
      created_by: 'librarian',
    });

    const result = await runDoctor({ cwd: projectRoot });

    expect(result.exitCode).toBe(1);
    expect(
      result.checks.some((check) => check.message.includes('claim:missing')),
    ).toBe(true);
  });
});
