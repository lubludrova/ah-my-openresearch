// MCP registration: zotero-mcp
// Upstream: https://github.com/54yyyu/zotero-mcp
// Purpose: read Zotero library (metadata, PDFs, citations).
// STUB: exact env-var names to be confirmed against upstream README in Phase 3.

import type { McpDefinition } from './types';

export const zoteroMcp: McpDefinition = {
  name: 'zotero',
  upstream: 'https://github.com/54yyyu/zotero-mcp',
  required: 'optional',
  install_hint: 'pip install zotero-mcp (or follow upstream README)',
  manifest_template: (cfg) => ({
    command: 'python',
    args: ['-m', 'zotero_mcp.server'],
    env: {
      // TODO Phase 3: confirm exact env-var names against upstream README.
      ZOTERO_LIBRARY_ID: cfg.library_id ?? '',
      ZOTERO_API_KEY: cfg.api_key ?? '',
    },
  }),
};
