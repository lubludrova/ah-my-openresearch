// ah-my-openresearch (amore) — OpenCode plugin entry.
//
// Wiring:
//   - Phase 4a: `config` hook registers six personas + builtin MCPs.
//   - Phase 6:  `tool.execute.before` enforces the lab/ write boundary.
//
// Plugin shape: `@opencode-ai/plugin@^1.15` exposes only `Hooks` from the
// Plugin function; agent/MCP registration goes through `Hooks.config`,
// which mutates `opencodeConfig` at startup. See
// `node_modules/@opencode-ai/plugin/dist/index.d.ts → Plugin/Hooks`.

import type { Plugin } from '@opencode-ai/plugin';
import { createAllAgents } from './agents';
import { loadAmoreConfig } from './config';
import { createPreWriteDraftsOnlyHook } from './hooks';
import { createBuiltinMcps } from './mcp';

// OpenCode ships two default general-purpose agent modes that amore
// considers redundant in a research-lab project: `build` (write-everything
// generalist) and `plan` (planning-only). amore is research-focused; its six
// personas (orchestrator, librarian, prospector, coder, council, writer)
// cover the relevant ground. We disable both by default. A user can re-enable
// either by setting `agent.build = {}` or `agent.plan = {}` in their
// project's opencode.json — user-supplied entries always win below.
const DISABLED_DEFAULT_AGENTS = ['build', 'plan'] as const;

const amorePlugin: Plugin = async (input) => {
  const projectRoot = input.directory;
  const userConfig = loadAmoreConfig(projectRoot);

  return {
    config: async (opencodeConfig) => {
      opencodeConfig.agent ??= {};

      // Disable OpenCode's default generalist agents when the user has not
      // touched them. If they have, leave their entry intact.
      for (const name of DISABLED_DEFAULT_AGENTS) {
        if (!opencodeConfig.agent[name]) {
          opencodeConfig.agent[name] = { disable: true };
        }
      }

      // Personas: plugin defaults first, user opencode.json overrides win.
      // User-supplied wiki path from amore config wins over the hard-coded
      // DEFAULT_LITERATURE_WIKI fallback.
      const agents = createAllAgents({
        wikiPath: userConfig?.literature_wiki_path,
      });
      for (const [name, agent] of Object.entries(agents)) {
        const existing = opencodeConfig.agent[name];
        opencodeConfig.agent[name] = existing
          ? { ...agent, ...existing }
          : { ...agent };
      }

      // MCPs: keep any user-defined entry verbatim, add ours only if missing.
      const mcps = createBuiltinMcps();
      opencodeConfig.mcp ??= {};
      for (const [name, mcp] of Object.entries(mcps)) {
        if (!opencodeConfig.mcp[name]) {
          opencodeConfig.mcp[name] = mcp;
        }
      }
    },

    'tool.execute.before': createPreWriteDraftsOnlyHook(projectRoot),
  };
};

export default amorePlugin;
