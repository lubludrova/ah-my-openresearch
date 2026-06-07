// Unit coverage for the install bootstrap step.

import { afterEach, describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
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

describe('bootstrapProjectConfig — basics', () => {
  test('writes opencode.json + lab/config.json with auto-detected RL-Wiki', async () => {
    const cwd = await tempProject();
    const home = await tempHome('RL-Wiki');
    const result = await bootstrapProjectConfig({
      cwd,
      homeDir: home,
      interactive: false,
    });
    expect(result.labConfig).toBe(join(cwd, 'lab', 'config.json'));
    expect(result.detectedWikiPath).toBe('~/RL-Wiki');
    expect(result.resolvedWikiPath).toBe('~/RL-Wiki');
    const written = JSON.parse(
      await Bun.file(expectString(result.labConfig)).text(),
    );
    expect(written.literature_wiki_path).toBe('~/RL-Wiki');
    expect(result.warnings).toEqual([]);
  });

  test('prefers RL-Wiki over PM-Wiki on auto-detect', async () => {
    const cwd = await tempProject();
    const home = await tempHome('both');
    const result = await bootstrapProjectConfig({
      cwd,
      homeDir: home,
      interactive: false,
    });
    expect(result.detectedWikiPath).toBe('~/RL-Wiki');
    expect(result.resolvedWikiPath).toBe('~/RL-Wiki');
  });

  test('falls back to PM-Wiki when only PM-Wiki exists', async () => {
    const cwd = await tempProject();
    const home = await tempHome('PM-Wiki');
    const result = await bootstrapProjectConfig({
      cwd,
      homeDir: home,
      interactive: false,
    });
    expect(result.resolvedWikiPath).toBe('~/PM-Wiki');
  });

  test('omits literature_wiki_path when no wiki found and non-interactive', async () => {
    const cwd = await tempProject();
    const home = await tempHome();
    const result = await bootstrapProjectConfig({
      cwd,
      homeDir: home,
      interactive: false,
    });
    expect(result.detectedWikiPath).toBeNull();
    expect(result.resolvedWikiPath).toBeNull();
    const written = JSON.parse(
      await Bun.file(expectString(result.labConfig)).text(),
    );
    expect(written.literature_wiki_path).toBeUndefined();
  });

  test('writes minimal opencode.json with amore plugin entry', async () => {
    const cwd = await tempProject();
    const home = await tempHome();
    const result = await bootstrapProjectConfig({
      cwd,
      homeDir: home,
      interactive: false,
    });
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
    const result = await bootstrapProjectConfig({
      cwd,
      homeDir: home,
      interactive: false,
    });
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
    const result = await bootstrapProjectConfig({
      cwd,
      homeDir: home,
      interactive: false,
    });
    expect(result.opencodeConfig).toBeNull();
    const kept = JSON.parse(await Bun.file(join(cwd, 'opencode.json')).text());
    expect(kept.plugin).toEqual(['some-other-plugin']);
  });

  test('respects custom labDir', async () => {
    const cwd = await tempProject();
    const home = await tempHome();
    const result = await bootstrapProjectConfig({
      cwd,
      homeDir: home,
      interactive: false,
      labDir: 'research/lab',
    });
    expect(result.labConfig).toBe(join(cwd, 'research', 'lab', 'config.json'));
    expect(existsSync(expectString(result.labConfig))).toBe(true);
  });
});

describe('bootstrapProjectConfig — literature wiki resolution', () => {
  test('--literature-wiki explicit path beats auto-detect', async () => {
    const cwd = await tempProject();
    const home = await tempHome('RL-Wiki');
    const customWiki = await tempProject();
    await writeFile(join(customWiki, 'CLAUDE.md'), '# my wiki\n', 'utf8');
    const result = await bootstrapProjectConfig({
      cwd,
      homeDir: home,
      interactive: false,
      literatureWiki: customWiki,
    });
    expect(result.resolvedWikiPath).toBe(customWiki);
    expect(result.warnings).toEqual([]);
  });

  test('--literature-wiki with missing dir warns but writes the path', async () => {
    const cwd = await tempProject();
    const home = await tempHome();
    const result = await bootstrapProjectConfig({
      cwd,
      homeDir: home,
      interactive: false,
      literatureWiki: '/tmp/does-not-exist-amore',
    });
    expect(result.resolvedWikiPath).toBe('/tmp/does-not-exist-amore');
    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0]).toContain('does not exist');
  });

  test('--literature-wiki with no contract file warns', async () => {
    const cwd = await tempProject();
    const home = await tempHome();
    const customWiki = await tempProject();
    const result = await bootstrapProjectConfig({
      cwd,
      homeDir: home,
      interactive: false,
      literatureWiki: customWiki,
    });
    expect(result.resolvedWikiPath).toBe(customWiki);
    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0]).toContain('no CLAUDE.md');
  });

  test('--no-wiki omits literature_wiki_path even when auto-detect would find one', async () => {
    const cwd = await tempProject();
    const home = await tempHome('RL-Wiki');
    const result = await bootstrapProjectConfig({
      cwd,
      homeDir: home,
      interactive: false,
      noWiki: true,
    });
    expect(result.resolvedWikiPath).toBeNull();
    expect(result.detectedWikiPath).toBe('~/RL-Wiki');
    const written = JSON.parse(
      await Bun.file(expectString(result.labConfig)).text(),
    );
    expect(written.literature_wiki_path).toBeUndefined();
  });

  test('interactive prompt confirms auto-detected wiki on blank/Y', async () => {
    const cwd = await tempProject();
    const home = await tempHome('RL-Wiki');
    const result = await bootstrapProjectConfig({
      cwd,
      homeDir: home,
      interactive: true,
      prompt: async () => '',
    });
    expect(result.resolvedWikiPath).toBe('~/RL-Wiki');
  });

  test('interactive prompt rejects auto-detected on N, then accepts manual path', async () => {
    const cwd = await tempProject();
    const home = await tempHome('RL-Wiki');
    const customWiki = await tempProject();
    await writeFile(join(customWiki, 'CLAUDE.md'), '#\n', 'utf8');
    let calls = 0;
    const result = await bootstrapProjectConfig({
      cwd,
      homeDir: home,
      interactive: true,
      prompt: async (q) => {
        calls += 1;
        if (calls === 1) {
          expect(q).toContain('Use detected');
          return 'n';
        }
        expect(q).toContain('blank to skip');
        return customWiki;
      },
    });
    expect(calls).toBe(2);
    expect(result.resolvedWikiPath).toBe(customWiki);
    expect(result.warnings).toEqual([]);
  });

  test('interactive prompt with blank entry skips wiki', async () => {
    const cwd = await tempProject();
    const home = await tempHome();
    const result = await bootstrapProjectConfig({
      cwd,
      homeDir: home,
      interactive: true,
      prompt: async () => '',
    });
    expect(result.resolvedWikiPath).toBeNull();
  });
});

async function makeWikiWithPlugin(
  options: {
    apiKey?: string;
    enableInsecureServer?: boolean;
    port?: number;
    insecurePort?: number;
    omitDataFile?: boolean;
    invalidJson?: boolean;
  } = {},
): Promise<string> {
  const wiki = await mkdtemp(join(tmpdir(), 'amore-bootstrap-wiki-'));
  tempDirs.push(wiki);
  await writeFile(join(wiki, 'CLAUDE.md'), '# wiki contract\n', 'utf8');
  const pluginDir = join(
    wiki,
    '.obsidian',
    'plugins',
    'obsidian-local-rest-api',
  );
  mkdirSync(pluginDir, { recursive: true });
  if (options.omitDataFile) {
    return wiki;
  }
  const dataPath = join(pluginDir, 'data.json');
  if (options.invalidJson) {
    await writeFile(dataPath, '{not valid json', 'utf8');
    return wiki;
  }
  const body: Record<string, unknown> = {
    apiKey: options.apiKey ?? 'k'.repeat(64),
    port: options.port ?? 27124,
    insecurePort: options.insecurePort ?? 27123,
    enableInsecureServer: options.enableInsecureServer ?? false,
  };
  await writeFile(dataPath, JSON.stringify(body), 'utf8');
  return wiki;
}

describe('bootstrapProjectConfig — Obsidian MCP auto-detect', () => {
  test('wires mcp.obsidian when plugin data.json found and flag set', async () => {
    const cwd = await tempProject();
    const home = await tempHome();
    const wiki = await makeWikiWithPlugin({ apiKey: 'TESTKEY' });
    const result = await bootstrapProjectConfig({
      cwd,
      homeDir: home,
      interactive: false,
      literatureWiki: wiki,
      withObsidianMcp: true,
    });
    expect(result.obsidianMcpWired).toBe(true);
    const written = JSON.parse(
      await Bun.file(expectString(result.opencodeConfig)).text(),
    );
    expect(written.mcp.obsidian.type).toBe('local');
    expect(written.mcp.obsidian.command).toEqual([
      'bunx',
      'obsidian-mcp-server@latest',
    ]);
    expect(written.mcp.obsidian.environment.OBSIDIAN_API_KEY).toBe('TESTKEY');
    expect(written.mcp.obsidian.environment.OBSIDIAN_BASE_URL).toBe(
      'https://127.0.0.1:27124',
    );
    expect(written.mcp.obsidian.environment.OBSIDIAN_VERIFY_SSL).toBe('false');
  });

  test('uses HTTP url when enableInsecureServer=true', async () => {
    const cwd = await tempProject();
    const home = await tempHome();
    const wiki = await makeWikiWithPlugin({
      enableInsecureServer: true,
      insecurePort: 27123,
    });
    const result = await bootstrapProjectConfig({
      cwd,
      homeDir: home,
      interactive: false,
      literatureWiki: wiki,
      withObsidianMcp: true,
    });
    const written = JSON.parse(
      await Bun.file(expectString(result.opencodeConfig)).text(),
    );
    expect(written.mcp.obsidian.environment.OBSIDIAN_BASE_URL).toBe(
      'http://127.0.0.1:27123',
    );
  });

  test('no mcp block when withObsidianMcp not set and non-interactive', async () => {
    const cwd = await tempProject();
    const home = await tempHome();
    const wiki = await makeWikiWithPlugin();
    const result = await bootstrapProjectConfig({
      cwd,
      homeDir: home,
      interactive: false,
      literatureWiki: wiki,
      // withObsidianMcp omitted
    });
    expect(result.obsidianMcpWired).toBe(false);
    const written = JSON.parse(
      await Bun.file(expectString(result.opencodeConfig)).text(),
    );
    expect(written.mcp).toBeUndefined();
  });

  test('interactive prompt accepts auto-config on blank/Y', async () => {
    const cwd = await tempProject();
    const home = await tempHome();
    const wiki = await makeWikiWithPlugin({ apiKey: 'PROMPTKEY' });
    let calls = 0;
    const result = await bootstrapProjectConfig({
      cwd,
      homeDir: home,
      literatureWiki: wiki,
      interactive: true,
      prompt: async () => {
        calls += 1;
        return ''; // accept default Y
      },
    });
    expect(calls).toBe(1);
    expect(result.obsidianMcpWired).toBe(true);
    const written = JSON.parse(
      await Bun.file(expectString(result.opencodeConfig)).text(),
    );
    expect(written.mcp.obsidian.environment.OBSIDIAN_API_KEY).toBe('PROMPTKEY');
  });

  test('interactive prompt rejects auto-config on N', async () => {
    const cwd = await tempProject();
    const home = await tempHome();
    const wiki = await makeWikiWithPlugin();
    const result = await bootstrapProjectConfig({
      cwd,
      homeDir: home,
      literatureWiki: wiki,
      interactive: true,
      prompt: async () => 'n',
    });
    expect(result.obsidianMcpWired).toBe(false);
  });

  test('warns when plugin found but apiKey missing', async () => {
    const cwd = await tempProject();
    const home = await tempHome();
    const wiki = await makeWikiWithPlugin({ apiKey: '' });
    const result = await bootstrapProjectConfig({
      cwd,
      homeDir: home,
      interactive: false,
      literatureWiki: wiki,
      withObsidianMcp: true,
    });
    expect(result.obsidianMcpWired).toBe(false);
    expect(result.warnings.some((w) => w.includes('no apiKey'))).toBe(true);
  });

  test('warns when data.json malformed', async () => {
    const cwd = await tempProject();
    const home = await tempHome();
    const wiki = await makeWikiWithPlugin({ invalidJson: true });
    const result = await bootstrapProjectConfig({
      cwd,
      homeDir: home,
      interactive: false,
      literatureWiki: wiki,
      withObsidianMcp: true,
    });
    expect(result.obsidianMcpWired).toBe(false);
    expect(result.warnings.some((w) => w.includes('Could not parse'))).toBe(
      true,
    );
  });

  test('skips detection silently when plugin not installed', async () => {
    const cwd = await tempProject();
    const home = await tempHome();
    const wiki = await makeWikiWithPlugin({ omitDataFile: true });
    // Remove the plugin dir entirely (omitDataFile leaves it, we want no plugin).
    await rm(join(wiki, '.obsidian'), { recursive: true, force: true });
    const result = await bootstrapProjectConfig({
      cwd,
      homeDir: home,
      interactive: false,
      literatureWiki: wiki,
      withObsidianMcp: true,
    });
    expect(result.obsidianMcpWired).toBe(false);
    expect(result.warnings).toEqual([]);
  });

  test('skips detection when opencode.json already exists', async () => {
    const cwd = await tempProject();
    const home = await tempHome();
    const wiki = await makeWikiWithPlugin();
    writeFileSync(join(cwd, 'opencode.json'), '{"plugin":["other"]}', 'utf8');
    const result = await bootstrapProjectConfig({
      cwd,
      homeDir: home,
      interactive: false,
      literatureWiki: wiki,
      withObsidianMcp: true,
    });
    expect(result.opencodeConfig).toBeNull();
    expect(result.obsidianMcpWired).toBe(false);
  });
});
