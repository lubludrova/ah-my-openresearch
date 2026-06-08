// Shape mirrors alvinunreal/oh-my-opencode-slim/src/mcp/types.ts so the
// values returned by createBuiltinMcps() can be returned directly under the
// `mcp` key of the plugin export (consumed by OpenCode without translation).
//
// The amore-specific McpMeta lives next to it: it carries install hints and
// required-level for our own CLI (`amore install` / `amore doctor`), and is
// NOT part of the OpenCode contract.

export type RemoteMcpConfig = {
  type: 'remote';
  url: string;
  headers?: Record<string, string>;
  oauth?: false;
};

export type LocalMcpConfig = {
  type: 'local';
  command: string[];
  environment?: Record<string, string>;
};

export type McpConfig = RemoteMcpConfig | LocalMcpConfig;

// ────────────────────────────────────────────────────────────────────
// amore-only metadata (install hints, required-level). Not sent to OpenCode.
// ────────────────────────────────────────────────────────────────────

export type McpRequiredLevel = 'required' | 'optional';

export interface McpMeta {
  upstream: string;
  required: McpRequiredLevel;
  install_hint: string;
}
