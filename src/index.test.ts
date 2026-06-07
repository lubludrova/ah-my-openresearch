// End-to-end smoke for the amore plugin entry. Calls the plugin function
// with a fake input, runs the returned `config` hook against a synthetic
// opencodeConfig, then asserts the resulting agent / MCP shape.

import { describe, expect, test } from 'bun:test';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import amorePlugin from './index';

interface FakeOpencodeConfig {
  agent?: Record<string, unknown>;
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
  });

  test('preserves a user-supplied `build` entry (does not force disable)', async () => {
    const cfg = await runPluginConfigHook({
      agent: { build: { model: 'openai/gpt-4o' } as Record<string, unknown> },
    });
    const agent = (cfg.agent ?? {}) as Record<string, Record<string, unknown>>;
    // user-supplied entry wins; no `disable: true` injected.
    expect(agent.build).toEqual({ model: 'openai/gpt-4o' });
  });

  test('preserves a user-supplied `plan` entry', async () => {
    const cfg = await runPluginConfigHook({
      agent: { plan: { temperature: 0.7 } as Record<string, unknown> },
    });
    const agent = (cfg.agent ?? {}) as Record<string, Record<string, unknown>>;
    expect(agent.plan).toEqual({ temperature: 0.7 });
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
    expect(agent.orchestrator.mode).toBe('primary');
    expect(typeof agent.orchestrator.model).toBe('string');
    expect(typeof agent.orchestrator.prompt).toBe('string');
    expect(agent.orchestrator.skills).toEqual(['*']);
    expect(agent.prospector.skills).toContain('claim-extract');
    expect(agent.prospector.skills).toContain('paper-search');
    expect(agent.librarian.mode).toBe('subagent');
    expect(agent.council.mode).toBe('all');
    expect(agent.writer.mode).toBe('all');
  });

  test('registers bundled skill path without replacing user paths', async () => {
    const cfg = await runPluginConfigHook({
      skills: { paths: ['/custom/skills'] },
    });
    expect(cfg.skills?.paths).toContain('/custom/skills');
    expect(cfg.skills?.paths?.some((path) => path.endsWith('src/skills'))).toBe(
      true,
    );
  });
});
