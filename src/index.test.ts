// End-to-end smoke for the amore plugin entry. Calls the plugin function
// with a fake input, runs the returned `config` hook against a synthetic
// opencodeConfig, then asserts the resulting agent / MCP shape.

import { describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { mkdtemp } from 'node:fs/promises';
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
): Promise<FakeOpencodeConfig> {
  const projectRoot = await mkdtemp(join(tmpdir(), 'amore-plugin-probe-'));
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

  test('registers obsidian + basic-memory MCPs', async () => {
    const cfg = await runPluginConfigHook();
    expect(cfg.mcp).toBeDefined();
    const mcpNames = Object.keys(cfg.mcp ?? {}).sort();
    expect(mcpNames).toContain('obsidian');
    expect(mcpNames).toContain('basic-memory');
  });

  test('user-supplied MCP entry wins over plugin default', async () => {
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
