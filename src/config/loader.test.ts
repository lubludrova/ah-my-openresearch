// Unit coverage for the config loader.
//
// `loadAmoreConfig(projectRoot, globalPath?)` looks at project config files
// first (.opencode/amore.json, amore.json, then legacy lab/config.json), then
// falls back to `globalPath` (which defaults to
// ~/.config/opencode/ah-my-openresearch.json in prod). Tests pass
// `globalPath` explicitly to avoid depending on the runtime's home-directory
// resolution (Bun caches `homedir()` at process start).

import { afterEach, describe, expect, test } from 'bun:test';
import { mkdirSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadAmoreConfig } from './loader';

const tempDirs: string[] = [];

async function tempProject(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'amore-loader-proj-'));
  tempDirs.push(dir);
  mkdirSync(join(dir, 'lab'), { recursive: true });
  mkdirSync(join(dir, '.opencode'), { recursive: true });
  return dir;
}

async function tempGlobalPath(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'amore-loader-global-'));
  tempDirs.push(dir);
  return join(dir, 'ah-my-openresearch.json');
}

afterEach(async () => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      await rm(dir, { recursive: true, force: true });
    }
  }
});

describe('loadAmoreConfig', () => {
  test('returns null when neither project-local nor global config exists', async () => {
    const project = await tempProject();
    const globalPath = await tempGlobalPath();
    expect(loadAmoreConfig(project, globalPath)).toBeNull();
  });

  test('returns null when project config is invalid JSON and no global', async () => {
    const project = await tempProject();
    const globalPath = await tempGlobalPath();
    await writeFile(
      join(project, '.opencode', 'amore.json'),
      '{not valid json',
      'utf8',
    );
    expect(loadAmoreConfig(project, globalPath)).toBeNull();
  });

  test('returns null when project config has unknown fields', async () => {
    const project = await tempProject();
    const globalPath = await tempGlobalPath();
    await writeFile(
      join(project, '.opencode', 'amore.json'),
      JSON.stringify({
        schema_version: 'v1',
        literature_wiki_path: '/tmp/wiki',
        unknown_field: 'rejected',
      }),
      'utf8',
    );
    expect(loadAmoreConfig(project, globalPath)).toBeNull();
  });

  test('returns parsed config when .opencode/amore.json is valid', async () => {
    const project = await tempProject();
    const globalPath = await tempGlobalPath();
    await writeFile(
      join(project, '.opencode', 'amore.json'),
      JSON.stringify({
        schema_version: 'v1',
        literature_wiki_path: '/tmp/my-wiki',
      }),
      'utf8',
    );
    const cfg = loadAmoreConfig(project, globalPath);
    expect(cfg).not.toBeNull();
    expect(cfg?.literature_wiki_path).toBe('/tmp/my-wiki');
    expect(cfg?.schema_version).toBe('v1');
  });

  test('falls back to root amore.json before legacy lab/config.json', async () => {
    const project = await tempProject();
    const globalPath = await tempGlobalPath();
    await writeFile(
      join(project, 'amore.json'),
      JSON.stringify({
        schema_version: 'v1',
        literature_wiki_path: '/tmp/root-wiki',
      }),
      'utf8',
    );
    await writeFile(
      join(project, 'lab', 'config.json'),
      JSON.stringify({
        schema_version: 'v1',
        literature_wiki_path: '/tmp/legacy-wiki',
      }),
      'utf8',
    );
    expect(loadAmoreConfig(project, globalPath)?.literature_wiki_path).toBe(
      '/tmp/root-wiki',
    );
  });

  test('falls back to legacy lab/config.json when new config is missing', async () => {
    const project = await tempProject();
    const globalPath = await tempGlobalPath();
    await writeFile(
      join(project, 'lab', 'config.json'),
      JSON.stringify({
        schema_version: 'v1',
        literature_wiki_path: '/tmp/legacy-wiki',
      }),
      'utf8',
    );
    expect(loadAmoreConfig(project, globalPath)?.literature_wiki_path).toBe(
      '/tmp/legacy-wiki',
    );
  });

  test('falls back to global config when project-local is missing', async () => {
    const project = await tempProject();
    const globalPath = await tempGlobalPath();
    await writeFile(
      globalPath,
      JSON.stringify({
        schema_version: 'v1',
        literature_wiki_path: '/tmp/global-wiki',
      }),
      'utf8',
    );
    const cfg = loadAmoreConfig(project, globalPath);
    expect(cfg).not.toBeNull();
    expect(cfg?.literature_wiki_path).toBe('/tmp/global-wiki');
  });

  test('project-local wins over global when both exist', async () => {
    const project = await tempProject();
    const globalPath = await tempGlobalPath();
    await writeFile(
      globalPath,
      JSON.stringify({
        schema_version: 'v1',
        literature_wiki_path: '/tmp/global-wiki',
      }),
      'utf8',
    );
    await writeFile(
      join(project, '.opencode', 'amore.json'),
      JSON.stringify({
        schema_version: 'v1',
        literature_wiki_path: '/tmp/project-wiki',
      }),
      'utf8',
    );
    const cfg = loadAmoreConfig(project, globalPath);
    expect(cfg?.literature_wiki_path).toBe('/tmp/project-wiki');
  });

  test('returns null when global config is malformed and project missing', async () => {
    const project = await tempProject();
    const globalPath = await tempGlobalPath();
    await writeFile(globalPath, '{also bad', 'utf8');
    expect(loadAmoreConfig(project, globalPath)).toBeNull();
  });
});
