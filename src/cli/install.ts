// omo-research `install` command (STUB)
//
// Will:
//   1. Create ~/.config/opencode/omo-research.json from defaults.
//   2. Scaffold vault layout under <vault_path>: claims/, _drafts/, papers/, edges.jsonl.
//   3. Register MCPs (obsidian-mcp-server, zotero-mcp, basic-memory) in ~/.config/opencode/mcp.json.
//
// Blocking decisions before implementing (Product Design open items):
//   - D11 inter-persona file conventions
//   - §7 vault layout (where claims live)
//   - Claim ID generation rule

export async function install(): Promise<void> {
  throw new Error('install command not yet implemented');
}
