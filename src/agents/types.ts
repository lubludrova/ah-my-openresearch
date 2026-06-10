// Shape of an agent definition as registered with OpenCode.
// Mirrors `AgentConfig` from `@opencode-ai/sdk` (see
// node_modules/@opencode-ai/sdk/dist/gen/types.gen.d.ts → AgentConfig).
//
// We re-declare the subset we actually populate today instead of re-exporting
// the SDK type directly: this keeps our factories' return shape narrow and
// our docs explicit about which fields we own.
//
// Agent name is NOT stored on the object — it is the key in the
// Record<name, AgentDefinition> map that the plugin merges into
// `opencodeConfig.agent`.

export type AgentMode = 'primary' | 'subagent' | 'all';

export type AgentPermissionAction = 'allow' | 'ask' | 'deny';

export type AgentPermission = Record<
  string,
  AgentPermissionAction | Record<string, AgentPermissionAction>
>;

export interface AgentDefinition {
  description: string;
  mode: AgentMode;
  model: string;
  temperature: number;
  prompt: string;
  /**
   * OpenCode-native off switch. Set when user config has
   * `personas.<name>.enabled: false` — the persona stays registered (so the
   * entry is visible/overridable) but the host does not offer it.
   */
  disable?: boolean;
  /**
   * OpenCode-native subagent flag: hide from the @-mention autocomplete.
   * Used for councillor subagents that only council-session should invoke.
   */
  hidden?: boolean;
  /**
   * OpenCode-native per-agent permission override. Used sparingly; most
   * personas inherit host defaults, but internal reviewer subagents should
   * be read-only.
   */
  permission?: AgentPermission;
  /**
   * Allowlist of skill names this persona may invoke. `["*"]` means any
   * skill registered with OpenCode (via `Config.skills.paths`). User entries
   * in their own `opencode.json` always win — this is just the plugin
   * default.
   */
  skills?: string[];
}

// Kept for now as a domain-level concept (used in per-persona defaults design
// later). NOT consumed by OpenCode's AgentConfig — included here so config
// loader (D16) can keep typed `tier` overrides without re-importing.
export type Tier = 'cheap' | 'midtier' | 'frontier' | 'mixed';
