// amore `install` command (STUB)
//
// Will:
//   1. Create ~/.config/opencode/amore.json from defaults (D16 schema in src/config/schema.ts).
//   2. Scaffold <project>/lab/ layout: canon/, drafts/, critique/, README.md, SCHEMA.md,
//      log.md, index.md, edges.jsonl (D7).
//   3. Register MCPs (obsidian-mcp-server, zotero-mcp, basic-memory) in
//      ~/.config/opencode/mcp.json — additive merge, install-hints printed (D15).
//   4. Symlink ARIS skills from ~/Tools/aris/skills/skills-codex/<name>/ → OpenCode
//      skills dir (additive; mirrors ARIS's default install pattern; --reconcile
//      flag for repair) — D17.
//
// Phase 1 blockers all resolved (D7/D10/D11/D12/D13).
// Ready to implement: create user config from src/config/schema.ts defaults,
// scaffold <project>/lab/ via src/lab/layout.ts, register MCPs.

export async function install(): Promise<void> {
  throw new Error('install command not yet implemented');
}
