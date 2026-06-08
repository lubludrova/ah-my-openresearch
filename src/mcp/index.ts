// MCP registry for OpenCode plugin wiring.
//
// Two parallel exports:
//   - createBuiltinMcps(disabled): the OpenCode-shaped Record<name, McpConfig>
//     suitable for the plugin's `mcp` field. Mirrors the omo-slim pattern.
//   - MCP_META: amore-only install metadata for CLI hints (`amore install`,
//     `amore doctor`). Not consumed by OpenCode.

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
};

export const MCP_META: Record<string, McpMeta> = {
  obsidian: obsidianMeta,
};

export type McpName = keyof typeof MCP_META;

/**
 * Builds the OpenCode-shaped MCP map, excluding any names in `disabledMcps`.
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
