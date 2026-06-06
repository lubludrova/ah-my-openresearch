// MCP registration: basic-memory
// Upstream: https://github.com/basicmachines-co/basic-memory
// Purpose: local semantic memory (fastembed + sqlite-vec) — foundation for
// post-MVP D8/D13 contradiction-check. Not used in MVP.
//
// Verified against upstream README on 2026-06-03 (Phase 3).
// Storage projects are managed via the `basic-memory project add <name> <path>`
// CLI, not via env vars — there is no BASIC_MEMORY_STORAGE env recipe.

import type { LocalMcpConfig, McpMeta } from './types';

export const basicMemory: LocalMcpConfig = {
  type: 'local',
  command: ['uvx', 'basic-memory', 'mcp'],
};

export const basicMemoryMeta: McpMeta = {
  upstream: 'https://github.com/basicmachines-co/basic-memory',
  required: 'phase8+',
  install_hint:
    'Recommended: `uv tool install basic-memory` (persistent) or rely on uvx ' +
    'for on-demand resolution. Configure storage projects via the CLI: ' +
    '`basic-memory project add <name> <path>`. Default project lives in ' +
    '~/basic-memory. Activated only when post-MVP contradiction-check turns on.',
};
