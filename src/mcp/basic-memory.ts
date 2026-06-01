// MCP registration: basic-memory
// Upstream: https://github.com/basicmachines-co/basic-memory
// Purpose: local semantic memory (fastembed + sqlite-vec); foundation for D8 contradiction-check.
// STUB: exact command/env to be confirmed against upstream docs in Phase 3.

import type { McpDefinition } from './types';

export const basicMemoryMcp: McpDefinition = {
  name: 'basic-memory',
  upstream: 'https://github.com/basicmachines-co/basic-memory',
  required: 'phase8+', // required only when D8 contradiction-check activates
  install_hint:
    'uvx basic-memory --help (uvx fetches on demand) or pip install basic-memory',
  manifest_template: (cfg) => ({
    command: 'uvx',
    args: ['basic-memory', 'mcp', 'serve'],
    env: {
      // TODO Phase 3: confirm exact env-var names against upstream README.
      BASIC_MEMORY_STORAGE: cfg.storage_path ?? '~/.local/share/basic-memory',
    },
  }),
};
