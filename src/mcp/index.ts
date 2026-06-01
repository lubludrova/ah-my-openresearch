// MCP registry — see design/Product Design.md §5 'MCP registration & install (D15)'.

import { obsidianMcp } from './obsidian';
import { zoteroMcp } from './zotero';
import { basicMemoryMcp } from './basic-memory';

export type {
  McpDefinition,
  McpManifestEntry,
  McpRequiredLevel,
  McpUserConfig,
} from './types';

export const MCP_REGISTRY = {
  obsidian: obsidianMcp,
  zotero: zoteroMcp,
  'basic-memory': basicMemoryMcp,
} as const;

export type McpName = keyof typeof MCP_REGISTRY;
