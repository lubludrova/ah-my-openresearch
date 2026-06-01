// MCP registration: obsidian-mcp-server
// Upstream: https://github.com/cyanheads/obsidian-mcp-server
// Purpose: read/write Obsidian vault — both the outside literature wiki AND the project lab/.
// STUB: exact env-var names to be confirmed against upstream README in Phase 3.

import type { McpDefinition } from './types';

export const obsidianMcp: McpDefinition = {
  name: 'obsidian',
  upstream: 'https://github.com/cyanheads/obsidian-mcp-server',
  required: 'required',
  install_hint:
    'npm install -g obsidian-mcp-server (or follow upstream README for alternative install)',
  manifest_template: (cfg) => ({
    command: 'node',
    args: [
      cfg.executable ?? '~/.local/share/obsidian-mcp-server/dist/index.js',
    ],
    env: {
      // TODO Phase 3: confirm exact env-var names against upstream README.
      OBSIDIAN_API_TOKEN: cfg.api_token ?? '',
      OBSIDIAN_VAULT_PATHS: cfg.vault_paths ?? '',
    },
  }),
};
