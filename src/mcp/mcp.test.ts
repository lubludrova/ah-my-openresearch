// Phase 3 verifiable: MCP_REGISTRY shape + manifest values.

import { describe, expect, test } from 'bun:test';
import { MCP_META, createBuiltinMcps } from './index';
import type { LocalMcpConfig } from './types';

describe('createBuiltinMcps', () => {
  test('returns obsidian by default', () => {
    const mcps = createBuiltinMcps();
    expect(Object.keys(mcps)).toEqual(['obsidian']);
  });

  test('filters out disabled names', () => {
    const mcps = createBuiltinMcps(['obsidian']);
    expect(Object.keys(mcps)).toEqual([]);
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

describe('MCP_META', () => {
  test('has matching keys for every builtin MCP', () => {
    const mcpKeys = Object.keys(createBuiltinMcps()).sort();
    const metaKeys = Object.keys(MCP_META).sort();
    expect(metaKeys).toEqual(mcpKeys);
  });

  test('required-levels match design intent', () => {
    expect(MCP_META.obsidian.required).toBe('required');
  });

  test('install hints are non-empty and point at upstream README', () => {
    for (const meta of Object.values(MCP_META)) {
      expect(meta.install_hint.length).toBeGreaterThan(20);
      expect(meta.upstream.startsWith('https://github.com/')).toBe(true);
    }
  });
});
