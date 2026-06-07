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

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from '@opencode-ai/plugin';
import { createAllAgents } from './agents';
import { loadAmoreConfig } from './config';
import { createPreWriteDraftsOnlyHook } from './hooks';
import { createBuiltinMcps } from './mcp';

/**
 * Absolute path to the package's bundled skills directory. Resolved via
 * `import.meta.url` so it works both from `dist/index.js` (the published
 * bundle) and from `src/index.ts` (source mode during dev). The package
 * layout has `dist/` and `src/skills/` as siblings at the package root,
 * so the relative `../src/skills` walk works from either entry.
 */
const PLUGIN_FILE = fileURLToPath(import.meta.url);
const PACKAGE_SKILLS_DIR = resolve(dirname(PLUGIN_FILE), '..', 'src', 'skills');

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

      // Skills: tell OpenCode to scan the package's bundled skills/ dir.
      // OpenCode walks each path for `SKILL.md` files and exposes them by
      // the `name` in their YAML frontmatter. User entries (extra paths) are
      // preserved — we only append, never replace.
      //
      // The Config shape exported by @opencode-ai/sdk v1 (currently a peer
      // of @opencode-ai/plugin) does not type `skills`; v2 does. We cast
      // through a structural type covering only the fields we touch.
      const cfgWithSkills = opencodeConfig as typeof opencodeConfig & {
        skills?: { paths?: string[]; urls?: string[] };
      };
      cfgWithSkills.skills ??= {};
      const existingPaths = cfgWithSkills.skills.paths ?? [];
      if (!existingPaths.includes(PACKAGE_SKILLS_DIR)) {
        cfgWithSkills.skills.paths = [...existingPaths, PACKAGE_SKILLS_DIR];
      }
    },

    'tool.execute.before': createPreWriteDraftsOnlyHook(projectRoot),
  };
};

export default amorePlugin;
