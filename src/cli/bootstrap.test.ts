// Unit coverage for the install bootstrap step.

import { afterEach, describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bootstrapProjectConfig } from './bootstrap';

const tempDirs: string[] = [];

async function tempProject(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'amore-bootstrap-proj-'));
  tempDirs.push(dir);
  return dir;
}

async function tempHome(
  withWiki?: 'RL-Wiki' | 'PM-Wiki' | 'both',
): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'amore-bootstrap-home-'));
  tempDirs.push(dir);
  if (withWiki === 'RL-Wiki' || withWiki === 'both') {
    mkdirSync(join(dir, 'RL-Wiki'), { recursive: true });
  }
  if (withWiki === 'PM-Wiki' || withWiki === 'both') {
    mkdirSync(join(dir, 'PM-Wiki'), { recursive: true });
  }
  return dir;
}

afterEach(async () => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      await rm(dir, { recursive: true, force: true });
    }
  }
});

function expectString(value: string | null): string {
  if (value === null) {
    throw new Error('expected a non-null path');
  }
  return value;
}

describe('bootstrapProjectConfig', () => {
  test('writes lab/config.json with RL-Wiki when present', async () => {
    const cwd = await tempProject();
    const home = await tempHome('RL-Wiki');
    const result = bootstrapProjectConfig({ cwd, homeDir: home });
    expect(result.labConfig).toBe(join(cwd, 'lab', 'config.json'));
    expect(result.detectedWikiPath).toBe('~/RL-Wiki');
    const written = JSON.parse(
      await Bun.file(expectString(result.labConfig)).text(),
    );
    expect(written.schema_version).toBe('v1');
    expect(written.literature_wiki_path).toBe('~/RL-Wiki');
  });

  test('falls back to PM-Wiki when only PM-Wiki is present', async () => {
    const cwd = await tempProject();
    const home = await tempHome('PM-Wiki');
    const result = bootstrapProjectConfig({ cwd, homeDir: home });
    expect(result.detectedWikiPath).toBe('~/PM-Wiki');
    const written = JSON.parse(
      await Bun.file(expectString(result.labConfig)).text(),
    );
    expect(written.literature_wiki_path).toBe('~/PM-Wiki');
  });

  test('prefers RL-Wiki when both are present', async () => {
    const cwd = await tempProject();
    const home = await tempHome('both');
    const result = bootstrapProjectConfig({ cwd, homeDir: home });
    expect(result.detectedWikiPath).toBe('~/RL-Wiki');
  });

  test('omits literature_wiki_path when no wiki detected', async () => {
    const cwd = await tempProject();
    const home = await tempHome();
    const result = bootstrapProjectConfig({ cwd, homeDir: home });
    expect(result.detectedWikiPath).toBeNull();
    const written = JSON.parse(
      await Bun.file(expectString(result.labConfig)).text(),
    );
    expect(written.schema_version).toBe('v1');
    expect(written.literature_wiki_path).toBeUndefined();
  });

  test('writes minimal opencode.json with amore plugin entry', async () => {
    const cwd = await tempProject();
    const home = await tempHome();
    const result = bootstrapProjectConfig({ cwd, homeDir: home });
    expect(result.opencodeConfig).toBe(join(cwd, 'opencode.json'));
    const written = JSON.parse(
      await Bun.file(expectString(result.opencodeConfig)).text(),
    );
    expect(written.plugin).toEqual(['ah-my-openresearch']);
    expect(written.instructions).toEqual(['AGENTS.md']);
    expect(written.$schema).toBe('https://opencode.ai/config.json');
  });

  test('does not overwrite existing lab/config.json', async () => {
    const cwd = await tempProject();
    const home = await tempHome('RL-Wiki');
    mkdirSync(join(cwd, 'lab'), { recursive: true });
    writeFileSync(
      join(cwd, 'lab', 'config.json'),
      '{"schema_version":"v1","literature_wiki_path":"/custom/path"}',
      'utf8',
    );
    const result = bootstrapProjectConfig({ cwd, homeDir: home });
    expect(result.labConfig).toBeNull();
    const kept = JSON.parse(
      await Bun.file(join(cwd, 'lab', 'config.json')).text(),
    );
    expect(kept.literature_wiki_path).toBe('/custom/path');
  });

  test('does not overwrite existing opencode.json', async () => {
    const cwd = await tempProject();
    const home = await tempHome();
    writeFileSync(
      join(cwd, 'opencode.json'),
      '{"plugin":["some-other-plugin"]}',
      'utf8',
    );
    const result = bootstrapProjectConfig({ cwd, homeDir: home });
    expect(result.opencodeConfig).toBeNull();
    const kept = JSON.parse(await Bun.file(join(cwd, 'opencode.json')).text());
    expect(kept.plugin).toEqual(['some-other-plugin']);
  });

  test('respects custom labDir', async () => {
    const cwd = await tempProject();
    const home = await tempHome();
    const result = bootstrapProjectConfig({
      cwd,
      homeDir: home,
      labDir: 'research/lab',
    });
    expect(result.labConfig).toBe(join(cwd, 'research', 'lab', 'config.json'));
    expect(existsSync(expectString(result.labConfig))).toBe(true);
  });
});
