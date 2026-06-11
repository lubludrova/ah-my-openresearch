// End-to-end smoke for the amore plugin entry. Calls the plugin function
// with a fake input, runs the returned `config` hook against a synthetic
// opencodeConfig, then asserts the resulting agent / skill shape.

import { describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import amorePlugin from './index';

interface FakeOpencodeConfig {
  agent?: Record<string, unknown>;
  default_agent?: string;
  mcp?: Record<string, unknown>;
  skills?: { paths?: string[] };
}

interface PluginHooks {
  config: (cfg: FakeOpencodeConfig) => Promise<void>;
  [key: string]: unknown;
}

async function runPluginConfigHook(
  initial: FakeOpencodeConfig = {},
  existingProjectRoot?: string,
): Promise<FakeOpencodeConfig> {
  const projectRoot =
    existingProjectRoot ??
    (await mkdtemp(join(tmpdir(), 'amore-plugin-probe-')));
  const $: unknown = () => Promise.resolve('');
  // The Plugin type comes from @opencode-ai/plugin; we cast through unknown
  // to avoid pulling SDK type machinery into the test.
  // biome-ignore lint/suspicious/noExplicitAny: synthetic plugin input.
  const hooks = (await (amorePlugin as any)({
    directory: projectRoot,
    app: { path: { root: projectRoot } },
    client: {},
    $,
  })) as PluginHooks;
  await hooks.config(initial);
  return initial;
}

describe('amore plugin — config hook', () => {
  test('registers exactly six research personas', async () => {
    const cfg = await runPluginConfigHook();
    expect(cfg.agent).toBeDefined();
    const agentNames = Object.keys(cfg.agent ?? {}).sort();
    expect(agentNames).toContain('orchestrator');
    expect(agentNames).toContain('librarian');
    expect(agentNames).toContain('prospector');
    expect(agentNames).toContain('coder');
    expect(agentNames).toContain('council');
    expect(agentNames).toContain('writer');
  });

  test('disables OpenCode defaults `build` and `plan` by default', async () => {
    const cfg = await runPluginConfigHook();
    const agent = (cfg.agent ?? {}) as Record<string, { disable?: boolean }>;
    expect(agent.build).toBeDefined();
    expect(agent.build.disable).toBe(true);
    expect(agent.plan).toBeDefined();
    expect(agent.plan.disable).toBe(true);
    expect(cfg.default_agent).toBe('orchestrator');
  });

  test('forces disabled defaults even when another plugin touched them first', async () => {
    const cfg = await runPluginConfigHook({
      agent: {
        build: { model: 'openai/gpt-4o' } as Record<string, unknown>,
        plan: { temperature: 0.7 } as Record<string, unknown>,
      },
    });
    const agent = (cfg.agent ?? {}) as Record<string, Record<string, unknown>>;
    expect(agent.build).toEqual({ model: 'openai/gpt-4o', disable: true });
    expect(agent.plan).toEqual({ temperature: 0.7, disable: true });
  });

  test('does not register MCPs by default', async () => {
    const cfg = await runPluginConfigHook();
    expect(cfg.mcp).toBeUndefined();
  });

  test('preserves user-supplied MCP entries verbatim', async () => {
    const cfg = await runPluginConfigHook({
      mcp: { obsidian: { type: 'remote', url: 'http://custom' } },
    });
    expect(cfg.mcp?.obsidian).toEqual({
      type: 'remote',
      url: 'http://custom',
    });
  });

  test('persona entries get the SDK-flat agent shape', async () => {
    const cfg = await runPluginConfigHook();
    const agent = (cfg.agent ?? {}) as Record<
      string,
      { mode?: string; model?: string; prompt?: string; skills?: string[] }
    >;
    expect(agent.orchestrator.mode).toBe('all');
    expect(typeof agent.orchestrator.model).toBe('string');
    expect(typeof agent.orchestrator.prompt).toBe('string');
    expect(agent.orchestrator.skills).toEqual(['*']);
    expect(agent.prospector.skills).toContain('claim-extract');
    expect(agent.prospector.skills).toContain('paper-search');
    expect(agent.librarian.mode).toBe('all');
    expect(agent.council.mode).toBe('all');
    expect(agent.writer.mode).toBe('all');
  });

  test('registers hidden councillor subagents for council-session', async () => {
    const cfg = await runPluginConfigHook();
    const agent = (cfg.agent ?? {}) as Record<
      string,
      { mode?: string; hidden?: boolean; model?: string }
    >;
    for (const name of [
      'councillor-adversarial',
      'councillor-expert',
      'councillor-methodologist',
    ]) {
      expect(agent[name]).toBeDefined();
      expect(agent[name].mode).toBe('subagent');
      expect(agent[name].hidden).toBe(true);
    }
  });

  test('configured councillors replace the default panel', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'amore-plugin-probe-'));
    await mkdir(join(projectRoot, 'lab'), { recursive: true });
    await writeFile(
      join(projectRoot, 'lab', 'config.json'),
      JSON.stringify({
        schema_version: 'v1',
        personas: {
          council: {
            councillors: [{ model: 'provider/custom', role: 'adversarial' }],
          },
        },
      }),
      'utf8',
    );

    const cfg = await runPluginConfigHook({}, projectRoot);

    const agent = (cfg.agent ?? {}) as Record<string, { model?: string }>;
    expect(agent['councillor-adversarial'].model).toBe('provider/custom');
    expect(agent['councillor-expert']).toBeUndefined();
  });

  test('applies personas overrides from .opencode/amore.json', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'amore-plugin-probe-'));
    await mkdir(join(projectRoot, 'lab'), { recursive: true });
    await writeFile(
      join(projectRoot, 'lab', 'config.json'),
      JSON.stringify({
        schema_version: 'v1',
        personas: {
          librarian: { model: 'anthropic/claude-haiku-4-5' },
          council: { enabled: false },
        },
      }),
      'utf8',
    );

    const cfg = await runPluginConfigHook({}, projectRoot);

    const agent = (cfg.agent ?? {}) as Record<
      string,
      { model?: string; disable?: boolean }
    >;
    expect(agent.librarian.model).toBe('anthropic/claude-haiku-4-5');
    expect(agent.council.disable).toBe(true);
    expect(agent.coder.disable).toBeUndefined();
  });

  test('registers bundled skill path without replacing user paths', async () => {
    const cfg = await runPluginConfigHook({
      skills: { paths: ['/custom/skills'] },
    });
    expect(cfg.skills?.paths).toContain('/custom/skills');
    const bundledPath = cfg.skills?.paths?.find((path) =>
      path.endsWith('src/skills'),
    );
    expect(bundledPath).toBeDefined();
    expect(existsSync(expectString(bundledPath))).toBe(true);
    expect(existsSync(join(expectString(bundledPath), 'wiki-ingest'))).toBe(
      true,
    );
  });
});

function expectString(value: string | undefined): string {
  if (value === undefined) {
    throw new Error('expected a string');
  }
  return value;
}
