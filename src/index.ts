// omo-research — OpenCode plugin entry (STUB)
//
// Wires personas + MCPs + hooks once config-schema and factories are filled.
// Today: returns plugin metadata only; nothing registered yet.
//
// TODO (cascade order):
//   1. Fill src/config/schema.ts (Zod)
//   2. Fill prompts in src/agents/*.ts
//   3. Fill src/mcp/*.ts
//   4. Wire everything here

export const omoResearchPlugin = {
  name: 'omo-research',
  version: '0.0.0',
  description: 'Research personas + skills + Obsidian wiki for OpenCode/Codex.',
};

export default omoResearchPlugin;
