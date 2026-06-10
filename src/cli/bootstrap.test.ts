// Unit coverage for the install bootstrap step.

import { afterEach, describe, expect, test } from 'bun:test';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import pkg from '../../package.json' with { type: 'json' };
import { bootstrapProjectConfig } from './bootstrap';

const AMORE_PLUGIN_SPEC = `ah-my-openresearch@${pkg.version}`;
const tempDirs: string[] = [];

async function tempProject(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'amore-bootstrap-proj-'));
  tempDirs.push(dir);
  return dir;
}

async function tempHome(
  withWiki?: 'primary-wiki' | 'notes-wiki' | 'both',
): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'amore-bootstrap-home-'));
  tempDirs.push(dir);
  if (withWiki === 'primary-wiki' || withWiki === 'both') {
    mkdirSync(join(dir, 'primary-wiki'), { recursive: true });
  }
  if (withWiki === 'notes-wiki' || withWiki === 'both') {
    mkdirSync(join(dir, 'notes-wiki'), { recursive: true });
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

function seedWikiWithContract(home: string, name: string): void {
  mkdirSync(join(home, name), { recursive: true });
  writeFileSync(join(home, name, 'RULES.md'), '# rules\n', 'utf8');
}

describe('bootstrapProjectConfig — basics', () => {
  test('writes lab/config.json with an explicitly chosen wiki path', async () => {
    const cwd = await tempProject();
    const home = await tempHome();
    seedWikiWithContract(home, 'research-wiki');
    const result = await bootstrapProjectConfig({
      cwd,
      homeDir: home,
      interactive: false,
      literatureWiki: '~/research-wiki',
    });
    expect(result.labConfig).toBe(join(cwd, 'lab', 'config.json'));
    expect(result.resolvedWikiPath).toBe('~/research-wiki');
    const written = JSON.parse(
      await Bun.file(expectString(result.labConfig)).text(),
    );
    expect(written.literature_wiki_path).toBe('~/research-wiki');
    expect(result.warnings).toEqual([]);
  });

  test('writes starter AGENTS.md with project-specific paths', async () => {
    const cwd = await tempProject();
    const home = await tempHome();
    seedWikiWithContract(home, 'research-wiki');
    const result = await bootstrapProjectConfig({
      cwd,
      homeDir: home,
      interactive: false,
      literatureWiki: '~/research-wiki',
    });
    expect(result.agentsFile).toBe(join(cwd, 'AGENTS.md'));
    const written = await Bun.file(expectString(result.agentsFile)).text();
    expect(written).toContain(`# ${basename(cwd)}`);
    expect(written).toContain('lab_dir: lab');
    expect(written).toContain('literature_wiki_path: "~/research-wiki"');
    expect(written).toContain('~/research-wiki/RULES.md');
    expect(written).not.toContain('backend:');
    expect(written).not.toContain('runs_dir');
    expect(written).not.toContain('wandb');
    expect(written).not.toContain('ingest_prompt.md');
  });

  test('never auto-detects a wiki in non-interactive mode', async () => {
    const cwd = await tempProject();
    // Wikis named like the author's personal vaults exist under home —
    // install must NOT silently pick them up.
    const home = await tempHome('both');
    const result = await bootstrapProjectConfig({
      cwd,
      homeDir: home,
      interactive: false,
    });
    expect(result.resolvedWikiPath).toBeNull();
    expect(result.wikiKind).toBe('skip');
  });

  test('omits literature_wiki_path when non-interactive without a flag', async () => {
    const cwd = await tempProject();
    const home = await tempHome();
    const result = await bootstrapProjectConfig({
      cwd,
      homeDir: home,
      interactive: false,
    });
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
    expect(written.plugin).toEqual([AMORE_PLUGIN_SPEC]);
    expect(written.instructions).toEqual(['AGENTS.md']);
    expect(written.$schema).toBe('https://opencode.ai/config.json');
    expect(written.default_agent).toBe('orchestrator');
    expect(written.agent.build.disable).toBe(true);
    expect(written.agent.plan.disable).toBe(true);
    // The plugin injects the bundled skills path at runtime; install must
    // not write machine-local paths into opencode.json.
    expect(written.skills).toBeUndefined();
  });

  test('does not overwrite existing lab/config.json', async () => {
    const cwd = await tempProject();
    const home = await tempHome('primary-wiki');
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

  test('merges amore entries into existing opencode.json', async () => {
    const cwd = await tempProject();
    const home = await tempHome();
    const originalConfig = JSON.stringify({
      plugin: ['some-other-plugin'],
      instructions: ['CLAUDE.md'],
      agent: {
        build: { model: 'custom/build' },
        custom: { mode: 'primary' },
      },
      skills: { paths: ['/custom/skills'] },
      mcp: { custom: { type: 'remote', url: 'https://example.test/mcp' } },
      theme: 'system',
      custom_user_field: { nested: true },
    });
    writeFileSync(join(cwd, 'opencode.json'), originalConfig, 'utf8');
    const result = await bootstrapProjectConfig({
      cwd,
      homeDir: home,
      interactive: false,
    });
    expect(result.opencodeConfig).toBe(join(cwd, 'opencode.json'));
    expect(result.opencodeConfigAction).toBe('updated');
    expect(result.opencodeConfigBackup).toBe(join(cwd, 'opencode.json.bak'));
    expect(
      readFileSync(expectString(result.opencodeConfigBackup), 'utf8'),
    ).toBe(originalConfig);
    expect(
      readdirSync(cwd).filter((name) => name.startsWith('opencode.json.tmp-')),
    ).toEqual([]);
    const merged = JSON.parse(
      await Bun.file(join(cwd, 'opencode.json')).text(),
    );
    expect(merged.plugin).toEqual(['some-other-plugin', AMORE_PLUGIN_SPEC]);
    expect(merged.instructions).toEqual(['CLAUDE.md', 'AGENTS.md']);
    expect(merged.default_agent).toBe('orchestrator');
    expect(merged.agent.build).toEqual({
      model: 'custom/build',
      disable: true,
    });
    expect(merged.agent.plan.disable).toBe(true);
    expect(merged.agent.custom).toEqual({ mode: 'primary' });
    expect(merged.skills.paths).toEqual(['/custom/skills']);
    expect(merged.mcp.custom).toEqual({
      type: 'remote',
      url: 'https://example.test/mcp',
    });
    expect(merged.theme).toBe('system');
    expect(merged.custom_user_field).toEqual({ nested: true });
  });

  test('removes stale amore bundled skills paths, keeps user paths', async () => {
    const cwd = await tempProject();
    const home = await tempHome();
    writeFileSync(
      join(cwd, 'opencode.json'),
      JSON.stringify({
        skills: {
          paths: [
            '/custom/skills',
            '/home/me/.bun/install/cache/ah-my-openresearch@0.1.3/src/skills',
          ],
        },
      }),
      'utf8',
    );
    await bootstrapProjectConfig({ cwd, homeDir: home, interactive: false });
    const merged = JSON.parse(
      await Bun.file(join(cwd, 'opencode.json')).text(),
    );
    expect(merged.skills.paths).toEqual(['/custom/skills']);
  });

  test('writes the personas model preset block when models is given', async () => {
    const cwd = await tempProject();
    const home = await tempHome();
    const result = await bootstrapProjectConfig({
      cwd,
      homeDir: home,
      interactive: false,
      models: 'anthropic',
    });
    const written = JSON.parse(
      await Bun.file(expectString(result.labConfig)).text(),
    );
    expect(Object.keys(written.personas).sort()).toEqual([
      'coder',
      'council',
      'librarian',
      'orchestrator',
      'prospector',
      'writer',
    ]);
    expect(written.personas.orchestrator.model).toBe(
      'anthropic/claude-sonnet-4-6',
    );
    expect(written.personas.librarian.model).toBe('anthropic/claude-haiku-4-5');
  });

  test('omits the personas block without models in non-interactive mode', async () => {
    const cwd = await tempProject();
    const home = await tempHome();
    const result = await bootstrapProjectConfig({
      cwd,
      homeDir: home,
      interactive: false,
    });
    const written = JSON.parse(
      await Bun.file(expectString(result.labConfig)).text(),
    );
    expect(written.personas).toBeUndefined();
  });

  test('drops the skills block when only stale amore paths remain', async () => {
    const cwd = await tempProject();
    const home = await tempHome();
    writeFileSync(
      join(cwd, 'opencode.json'),
      JSON.stringify({
        skills: {
          paths: [
            '/home/me/.cache/opencode/packages/ah-my-openresearch/src/skills',
          ],
        },
      }),
      'utf8',
    );
    await bootstrapProjectConfig({ cwd, homeDir: home, interactive: false });
    const merged = JSON.parse(
      await Bun.file(join(cwd, 'opencode.json')).text(),
    );
    expect(merged.skills).toBeUndefined();
  });

  test('normalizes stale amore plugin entries to the current package version', async () => {
    const cwd = await tempProject();
    const home = await tempHome();
    writeFileSync(
      join(cwd, 'opencode.json'),
      JSON.stringify({
        plugin: [
          'ah-my-openresearch',
          'other-plugin',
          'ah-my-openresearch@0.1.0',
        ],
      }),
      'utf8',
    );
    const result = await bootstrapProjectConfig({
      cwd,
      homeDir: home,
      interactive: false,
    });
    expect(result.opencodeConfigAction).toBe('updated');
    const written = JSON.parse(
      await Bun.file(join(cwd, 'opencode.json')).text(),
    );
    expect(written.plugin).toEqual([AMORE_PLUGIN_SPEC, 'other-plugin']);
  });

  test('uses the next backup name when opencode.json.bak already exists', async () => {
    const cwd = await tempProject();
    const home = await tempHome();
    writeFileSync(join(cwd, 'opencode.json'), '{"plugin":["other"]}', 'utf8');
    writeFileSync(join(cwd, 'opencode.json.bak'), 'older backup', 'utf8');

    const result = await bootstrapProjectConfig({
      cwd,
      homeDir: home,
      interactive: false,
    });

    expect(result.opencodeConfigAction).toBe('updated');
    expect(result.opencodeConfigBackup).toBe(join(cwd, 'opencode.json.bak.1'));
    expect(readFileSync(join(cwd, 'opencode.json.bak'), 'utf8')).toBe(
      'older backup',
    );
    expect(readFileSync(join(cwd, 'opencode.json.bak.1'), 'utf8')).toBe(
      '{"plugin":["other"]}',
    );
  });

  test('warns and keeps malformed existing opencode.json unchanged', async () => {
    const cwd = await tempProject();
    const home = await tempHome();
    writeFileSync(join(cwd, 'opencode.json'), '{not valid json', 'utf8');

    const result = await bootstrapProjectConfig({
      cwd,
      homeDir: home,
      interactive: false,
    });

    expect(result.opencodeConfig).toBeNull();
    expect(result.opencodeConfigAction).toBe('kept');
    expect(result.opencodeConfigBackup).toBeNull();
    expect(result.warnings.some((w) => w.includes('Could not parse'))).toBe(
      true,
    );
    expect(readFileSync(join(cwd, 'opencode.json'), 'utf8')).toBe(
      '{not valid json',
    );
    expect(existsSync(join(cwd, 'opencode.json.bak'))).toBe(false);
  });

  test('warns and keeps non-object existing opencode.json unchanged', async () => {
    const cwd = await tempProject();
    const home = await tempHome();
    writeFileSync(join(cwd, 'opencode.json'), '[]', 'utf8');

    const result = await bootstrapProjectConfig({
      cwd,
      homeDir: home,
      interactive: false,
    });

    expect(result.opencodeConfig).toBeNull();
    expect(result.opencodeConfigAction).toBe('kept');
    expect(result.opencodeConfigBackup).toBeNull();
    expect(result.warnings.some((w) => w.includes('not a JSON object'))).toBe(
      true,
    );
    expect(readFileSync(join(cwd, 'opencode.json'), 'utf8')).toBe('[]');
  });

  test('warns and skips opencode.json when an install lock exists', async () => {
    const cwd = await tempProject();
    const home = await tempHome();
    writeFileSync(join(cwd, 'opencode.json'), '{"plugin":["other"]}', 'utf8');
    mkdirSync(join(cwd, 'opencode.json.lock'));

    const result = await bootstrapProjectConfig({
      cwd,
      homeDir: home,
      interactive: false,
    });

    expect(result.opencodeConfig).toBeNull();
    expect(result.opencodeConfigAction).toBe('kept');
    expect(result.warnings.some((w) => w.includes('config lock'))).toBe(true);
    expect(readFileSync(join(cwd, 'opencode.json'), 'utf8')).toBe(
      '{"plugin":["other"]}',
    );
  });

  test('does not overwrite existing AGENTS.md', async () => {
    const cwd = await tempProject();
    const home = await tempHome('primary-wiki');
    writeFileSync(join(cwd, 'AGENTS.md'), '# Custom rules\n', 'utf8');
    const result = await bootstrapProjectConfig({
      cwd,
      homeDir: home,
      interactive: false,
    });
    expect(result.agentsFile).toBeNull();
    const kept = await Bun.file(join(cwd, 'AGENTS.md')).text();
    expect(kept).toBe('# Custom rules\n');
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
    const agents = await Bun.file(expectString(result.agentsFile)).text();
    expect(agents).toContain('lab_dir: research/lab');
    expect(agents).toContain('research/lab/drafts/');
  });
});

describe('bootstrapProjectConfig — literature wiki resolution', () => {
  test('--literature-wiki explicit path beats auto-detect', async () => {
    const cwd = await tempProject();
    const home = await tempHome('primary-wiki');
    const customWiki = await tempProject();
    await writeFile(join(customWiki, 'RULES.md'), '# my wiki\n', 'utf8');
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
    expect(result.warnings[0]).toContain('no RULES.md');
  });

  test('--no-wiki omits literature_wiki_path', async () => {
    const cwd = await tempProject();
    const home = await tempHome('primary-wiki');
    const result = await bootstrapProjectConfig({
      cwd,
      homeDir: home,
      interactive: false,
      noWiki: true,
    });
    expect(result.resolvedWikiPath).toBeNull();
    const written = JSON.parse(
      await Bun.file(expectString(result.labConfig)).text(),
    );
    expect(written.literature_wiki_path).toBeUndefined();
  });

  test('interactive [u] offers no auto-suggestion; blank answer skips', async () => {
    const cwd = await tempProject();
    const home = await tempHome('primary-wiki');
    let calls = 0;
    const result = await bootstrapProjectConfig({
      cwd,
      homeDir: home,
      interactive: true,
      prompt: async (q) => {
        calls += 1;
        if (calls === 1) {
          expect(q).toContain('[u]');
          expect(q).toContain('[c]');
          expect(q).toContain('[s]');
          return 'u';
        }
        if (calls === 2) {
          // path prompt must not suggest any auto-detected vaults
          expect(q).not.toContain('primary-wiki');
          return '';
        }
        // third prompt: persona model preset menu
        expect(q).toContain('[s] skip');
        return 's';
      },
    });
    expect(calls).toBe(3);
    expect(result.wikiKind).toBe('skip');
    expect(result.resolvedWikiPath).toBeNull();
  });

  test('interactive [u] with an explicit custom path', async () => {
    const cwd = await tempProject();
    const home = await tempHome('primary-wiki');
    const customWiki = await tempProject();
    await writeFile(join(customWiki, 'RULES.md'), '# rules\n', 'utf8');
    let calls = 0;
    const result = await bootstrapProjectConfig({
      cwd,
      homeDir: home,
      interactive: true,
      prompt: async () => {
        calls += 1;
        return calls === 1 ? 'u' : customWiki;
      },
    });
    expect(result.wikiKind).toBe('use');
    expect(result.resolvedWikiPath).toBe(customWiki);
    expect(result.warnings).toEqual([]);
  });

  test('interactive [c] creates a new starter wiki with default name', async () => {
    const cwd = await tempProject();
    const home = await tempHome();
    let calls = 0;
    const result = await bootstrapProjectConfig({
      cwd,
      homeDir: home,
      interactive: true,
      prompt: async () => {
        calls += 1;
        return calls === 1 ? 'c' : ''; // accept default name
      },
    });
    expect(result.wikiKind).toBe('create');
    expect(result.wikiCreated).toBe(true);
    expect(result.resolvedWikiPath).toBe('./llm-wiki');
    expect(existsSync(join(cwd, 'llm-wiki', 'RULES.md'))).toBe(true);
    expect(existsSync(join(cwd, 'llm-wiki', 'wiki'))).toBe(true);
    expect(existsSync(join(cwd, 'llm-wiki', 'raw'))).toBe(true);
  });

  test('interactive Cyrillic с creates a new starter wiki', async () => {
    const cwd = await tempProject();
    const home = await tempHome('primary-wiki');
    let calls = 0;
    const result = await bootstrapProjectConfig({
      cwd,
      homeDir: home,
      interactive: true,
      prompt: async () => {
        calls += 1;
        return calls === 1 ? '\u0441' : ''; // Cyrillic small es, not Latin c.
      },
    });
    expect(calls).toBe(3); // wiki menu + wiki name + model preset menu
    expect(result.wikiKind).toBe('create');
    expect(result.resolvedWikiPath).toBe('./llm-wiki');
    expect(existsSync(join(cwd, 'llm-wiki', 'RULES.md'))).toBe(true);
  });

  test('interactive [c] honors a custom wiki name', async () => {
    const cwd = await tempProject();
    const home = await tempHome();
    let calls = 0;
    const result = await bootstrapProjectConfig({
      cwd,
      homeDir: home,
      interactive: true,
      prompt: async () => {
        calls += 1;
        return calls === 1 ? 'c' : 'rl-notes';
      },
    });
    expect(result.resolvedWikiPath).toBe('./rl-notes');
    expect(existsSync(join(cwd, 'rl-notes', 'RULES.md'))).toBe(true);
  });

  test('interactive [s] skips wiki entirely', async () => {
    const cwd = await tempProject();
    const home = await tempHome('primary-wiki');
    const result = await bootstrapProjectConfig({
      cwd,
      homeDir: home,
      interactive: true,
      prompt: async () => 's',
    });
    expect(result.wikiKind).toBe('skip');
    expect(result.resolvedWikiPath).toBeNull();
  });

  test('interactive blank choice defaults to skip', async () => {
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
  await writeFile(join(wiki, 'RULES.md'), '# wiki contract\n', 'utf8');
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
        return ''; // accept defaults (model preset menu, then MCP Y)
      },
    });
    expect(calls).toBe(2); // model preset menu + MCP confirm
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

  test('wires mcp.obsidian into existing opencode.json when missing', async () => {
    const cwd = await tempProject();
    const home = await tempHome();
    const wiki = await makeWikiWithPlugin({ apiKey: 'MERGEKEY' });
    writeFileSync(join(cwd, 'opencode.json'), '{"plugin":["other"]}', 'utf8');
    const result = await bootstrapProjectConfig({
      cwd,
      homeDir: home,
      interactive: false,
      literatureWiki: wiki,
      withObsidianMcp: true,
    });
    expect(result.opencodeConfig).toBe(join(cwd, 'opencode.json'));
    expect(result.opencodeConfigAction).toBe('updated');
    expect(result.obsidianMcpWired).toBe(true);
    const written = JSON.parse(
      await Bun.file(join(cwd, 'opencode.json')).text(),
    );
    expect(written.plugin).toEqual(['other', AMORE_PLUGIN_SPEC]);
    expect(written.mcp.obsidian.environment.OBSIDIAN_API_KEY).toBe('MERGEKEY');
  });

  test('keeps existing mcp.obsidian entry verbatim', async () => {
    const cwd = await tempProject();
    const home = await tempHome();
    const wiki = await makeWikiWithPlugin({ apiKey: 'SHOULD_NOT_WRITE' });
    writeFileSync(
      join(cwd, 'opencode.json'),
      JSON.stringify({
        plugin: ['ah-my-openresearch'],
        mcp: {
          obsidian: {
            type: 'remote',
            url: 'https://custom.example/mcp',
          },
        },
      }),
      'utf8',
    );
    const result = await bootstrapProjectConfig({
      cwd,
      homeDir: home,
      interactive: false,
      literatureWiki: wiki,
      withObsidianMcp: true,
    });
    expect(result.obsidianMcpWired).toBe(false);
    const written = JSON.parse(
      await Bun.file(join(cwd, 'opencode.json')).text(),
    );
    expect(written.mcp.obsidian).toEqual({
      type: 'remote',
      url: 'https://custom.example/mcp',
    });
  });
});
