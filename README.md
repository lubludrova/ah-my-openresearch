# omo-research

> Research analogue of oh-my-openagent: research personas + skills + living Obsidian wiki for OpenCode/Codex/Claude Code.

**Status:** scaffold, pre-MVP. Canonical design lives in [`design/`](design/).

## Quickstart

Not buildable yet — see `design/Product Design.md` §10 "Roadmap" and `codemap.md` "Cascade".

```bash
# After Phase 0 of the cascade:
bun install
bun run build
bunx omo-research install
```

## What this is

A focused OpenCode plugin that ships:

- **6 research personas** (orchestrator, librarian, prospector, coder, council, writer) — each a `src/agents/<name>.ts` factory.
- **Skill bundles** in `src/skills/<name>/SKILL.md` (~4 new + mirrors of canonical ARIS skills).
- **MCP registrations** for Obsidian (`cyanheads/obsidian-mcp-server`), Zotero (`54yyyu/zotero-mcp`), and local semantic memory (`basicmachines-co/basic-memory`).
- **CLI** with `install` (scaffolds user config + vault layout) and `doctor`.
- **Vault contract**: claim-level schema with provenance, draft → human-veto → canon flow.
- **Domain extension layer** (RL pack will be the first).

## Project layout

```text
omo-research/
├── design/                # canonical product design (moved from Obsidian)
│   ├── Product Design.md
│   ├── Skill Catalog.md
│   ├── Archived Research Sources.md
│   └── External Solutions.md
├── docs/                  # user-facing docs (TBD)
├── src/
│   ├── index.ts           # plugin entry
│   ├── agents/            # 6 persona factories
│   ├── skills/            # bundled SKILL.md files
│   ├── mcp/               # MCP server registrations
│   ├── config/            # Zod schema + loader
│   ├── cli/               # install / doctor / etc.
│   ├── hooks/             # OpenCode lifecycle hooks
│   ├── vault/             # vault contract (drafts/claims/edges)
│   └── utils/             # shared helpers
├── scripts/               # generate-schema, verify, etc.
├── package.json
├── tsconfig.json
├── biome.json
├── codemap.md             # architecture map
└── AGENTS.md              # guidelines for AI working on this repo
```

## Pattern source

Architecture follows [`alvinunreal/oh-my-opencode-slim`](https://github.com/alvinunreal/oh-my-opencode-slim) (focused OpenCode plugin, Bun + TS, MIT). Our differentiators on top: Obsidian vault contract, claim-level schema with provenance, domain-extension layer, contradiction-check.

## License

MIT.
