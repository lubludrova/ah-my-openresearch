// MCP registration: obsidian-mcp-server
// Upstream: https://github.com/cyanheads/obsidian-mcp-server
// Purpose: read/write the outside literature wiki (e.g. ~/RL-Wiki) over the
// Local REST API plugin inside Obsidian. The project lab/ is written through
// host-native tools (Read/Write/Bash) + Phase 6 write-boundary hook, not
// through this MCP.
//
// Verified against upstream README on 2026-06-03 (Phase 3).

import type { LocalMcpConfig, McpMeta } from './types';

function buildEnvironment(): Record<string, string> {
  const env: Record<string, string> = {};

  if (process.env.OBSIDIAN_API_KEY) {
    env.OBSIDIAN_API_KEY = process.env.OBSIDIAN_API_KEY;
  }
  if (process.env.OBSIDIAN_BASE_URL) {
    env.OBSIDIAN_BASE_URL = process.env.OBSIDIAN_BASE_URL;
  }
  if (process.env.OBSIDIAN_VERIFY_SSL) {
    env.OBSIDIAN_VERIFY_SSL = process.env.OBSIDIAN_VERIFY_SSL;
  }
  // Optional second-layer write boundary: limit the server itself to a path
  // allowlist if the user opts in (e.g. their literature wiki only).
  if (process.env.OBSIDIAN_WRITE_PATHS) {
    env.OBSIDIAN_WRITE_PATHS = process.env.OBSIDIAN_WRITE_PATHS;
  }
  if (process.env.OBSIDIAN_READ_PATHS) {
    env.OBSIDIAN_READ_PATHS = process.env.OBSIDIAN_READ_PATHS;
  }
  if (process.env.OBSIDIAN_READ_ONLY) {
    env.OBSIDIAN_READ_ONLY = process.env.OBSIDIAN_READ_ONLY;
  }

  return env;
}

export const obsidian: LocalMcpConfig = {
  type: 'local',
  command: ['bunx', 'obsidian-mcp-server@latest'],
  environment: buildEnvironment(),
};

export const obsidianMeta: McpMeta = {
  upstream: 'https://github.com/cyanheads/obsidian-mcp-server',
  required: 'required',
  install_hint:
    'No global install required — bunx fetches obsidian-mcp-server@latest on demand. ' +
    'Prerequisites: install the "Local REST API" plugin (v4+) inside Obsidian, ' +
    'generate an API key, and export OBSIDIAN_API_KEY before launching opencode. ' +
    'Optional env: OBSIDIAN_BASE_URL (default http://127.0.0.1:27123), ' +
    'OBSIDIAN_WRITE_PATHS / OBSIDIAN_READ_PATHS (server-side path allowlists), ' +
    'OBSIDIAN_READ_ONLY=true (disable writes globally).',
};
