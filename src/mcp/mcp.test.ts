// Phase 3 verifiable: MCP_REGISTRY shape + manifest values.

import { describe, expect, test } from 'bun:test';
import { MCP_META, createBuiltinMcps } from './index';
import type { LocalMcpConfig } from './types';

describe('createBuiltinMcps', () => {
  test('returns obsidian and basic-memory by default', () => {
    const mcps = createBuiltinMcps();
    expect(Object.keys(mcps).sort()).toEqual(['basic-memory', 'obsidian']);
  });

  test('filters out disabled names', () => {
    const mcps = createBuiltinMcps(['basic-memory']);
    expect(Object.keys(mcps)).toEqual(['obsidian']);
  });

  test('all builtins are valid LocalMcpConfig entries', () => {
    const mcps = createBuiltinMcps();
    for (const [name, entry] of Object.entries(mcps)) {
      expect(entry.type).toBe('local');
      const local = entry as LocalMcpConfig;
      expect(Array.isArray(local.command)).toBe(true);
      expect(local.command.length).toBeGreaterThan(0);
      expect(local.command.every((part) => typeof part === 'string')).toBe(
        true,
      );
      if (local.environment !== undefined) {
        for (const value of Object.values(local.environment)) {
          expect(typeof value).toBe('string');
        }
      }
      expect(name.length).toBeGreaterThan(0);
    }
  });
});

describe('obsidian MCP', () => {
  test('command uses bunx + obsidian-mcp-server@latest (verified upstream)', () => {
    const { obsidian } = createBuiltinMcps() as { obsidian: LocalMcpConfig };
    expect(obsidian.type).toBe('local');
    expect(obsidian.command).toEqual(['bunx', 'obsidian-mcp-server@latest']);
  });

  test('environment only contains keys for which process.env is set', () => {
    const { obsidian } = createBuiltinMcps() as { obsidian: LocalMcpConfig };
    const allowed = new Set([
      'OBSIDIAN_API_KEY',
      'OBSIDIAN_BASE_URL',
      'OBSIDIAN_VERIFY_SSL',
      'OBSIDIAN_WRITE_PATHS',
      'OBSIDIAN_READ_PATHS',
      'OBSIDIAN_READ_ONLY',
    ]);
    for (const key of Object.keys(obsidian.environment ?? {})) {
      expect(allowed.has(key)).toBe(true);
    }
  });
});

describe('basic-memory MCP', () => {
  test('command uses uvx basic-memory mcp (verified upstream — no `serve` arg)', () => {
    const mcps = createBuiltinMcps();
    const bm = mcps['basic-memory'] as LocalMcpConfig;
    expect(bm.type).toBe('local');
    expect(bm.command).toEqual(['uvx', 'basic-memory', 'mcp']);
  });

  test('has no environment recipe (storage configured via CLI, not env)', () => {
    const mcps = createBuiltinMcps();
    const bm = mcps['basic-memory'] as LocalMcpConfig;
    expect(bm.environment).toBeUndefined();
  });
});

describe('MCP_META', () => {
  test('has matching keys for every builtin MCP', () => {
    const mcpKeys = Object.keys(createBuiltinMcps()).sort();
    const metaKeys = Object.keys(MCP_META).sort();
    expect(metaKeys).toEqual(mcpKeys);
  });

  test('required-levels match design intent (obsidian=required, basic-memory=phase8+)', () => {
    expect(MCP_META.obsidian.required).toBe('required');
    expect(MCP_META['basic-memory'].required).toBe('phase8+');
  });

  test('install hints are non-empty and point at upstream README', () => {
    for (const meta of Object.values(MCP_META)) {
      expect(meta.install_hint.length).toBeGreaterThan(20);
      expect(meta.upstream.startsWith('https://github.com/')).toBe(true);
    }
  });
});
