// omo-research `install` command (STUB)
//
// Will:
//   1. Create ~/.config/opencode/omo-research.json from defaults.
//   2. Scaffold vault layout under <vault_path>: claims/, _drafts/, papers/, edges.jsonl.
//   3. Register MCPs (obsidian-mcp-server, zotero-mcp, basic-memory) in ~/.config/opencode/mcp.json.
//
// Phase 1 blockers all resolved (D7/D10/D11/D12/D13).
// Ready to implement: create user config from src/config/schema.ts defaults,
// scaffold <project>/lab/ via src/lab/layout.ts, register MCPs.

export async function install(): Promise<void> {
  throw new Error('install command not yet implemented');
}
