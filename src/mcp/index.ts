// MCP registry — see design/Product Design.md §5 'MCP registration & install (D15)'.
//
// Two parallel exports:
//   - createBuiltinMcps(disabled): the OpenCode-shaped Record<name, McpConfig>
//     suitable for the plugin's `mcp` field. Mirrors the omo-slim pattern.
//   - MCP_META: amore-only install metadata for CLI hints (`amore install`,
//     `amore doctor`). Not consumed by OpenCode.

import { basicMemory, basicMemoryMeta } from './basic-memory';
import { obsidian, obsidianMeta } from './obsidian';
import type { McpConfig, McpMeta } from './types';

export type {
  LocalMcpConfig,
  McpConfig,
  McpMeta,
  McpRequiredLevel,
  RemoteMcpConfig,
} from './types';

const ALL_BUILTIN_MCPS: Record<string, McpConfig> = {
  obsidian,
  'basic-memory': basicMemory,
};

export const MCP_META: Record<string, McpMeta> = {
  obsidian: obsidianMeta,
  'basic-memory': basicMemoryMeta,
};

export type McpName = keyof typeof MCP_META;

/**
 * Builds the OpenCode-shaped MCP map, excluding any names in `disabledMcps`.
 * Phase 3: caller-side filtering only; user-config-driven disablement is
 * wired in later phases when plugin runtime config loader exists.
 */
export function createBuiltinMcps(
  disabledMcps: readonly string[] = [],
): Record<string, McpConfig> {
  return Object.fromEntries(
    Object.entries(ALL_BUILTIN_MCPS).filter(
      ([name]) => !disabledMcps.includes(name),
    ),
  );
}
