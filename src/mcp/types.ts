// MCP registration types — see design/Product Design.md §5 'MCP registration & install (D15)'.

export type McpRequiredLevel = 'required' | 'optional' | 'phase8+';

export interface McpUserConfig {
  // Per-MCP user-supplied config. Keys vary by MCP; values are strings (env-var style).
  [key: string]: string | undefined;
}

export interface McpManifestEntry {
  // Shape written into ~/.config/opencode/mcp.json under this MCP's key (or registered via SDK API).
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export interface McpDefinition {
  name: string;
  upstream: string;
  required: McpRequiredLevel;
  install_hint: string;
  manifest_template: (userConfig: McpUserConfig) => McpManifestEntry;
}
