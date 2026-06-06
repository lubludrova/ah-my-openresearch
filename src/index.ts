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

const amorePlugin: Plugin = async (input) => {
  const projectRoot = input.directory;
  const userConfig = loadAmoreConfig(projectRoot);

  return {
    config: async (opencodeConfig) => {
      // Personas: plugin defaults first, user opencode.json overrides win.
      // User-supplied wiki path from amore config wins over the hard-coded
      // DEFAULT_LITERATURE_WIKI fallback.
      const agents = createAllAgents({
        wikiPath: userConfig?.literature_wiki_path,
      });
      opencodeConfig.agent ??= {};
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
