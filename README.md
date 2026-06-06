# ah-my-openresearch  ·  `amore`

> Research analogue of `oh-my-openagent`: research personas + skills + per-project lab + outside literature wiki for OpenCode/Codex/Claude Code.
>
> The name plays on `oh-my-openagent`: *ah-my-o...* → **amore** (Italian for *love*). Research with care.

**Status:** pre-MVP. The plugin caркас, all six persona prompts, the local
lab contract, the `pre-write-drafts-only` hook, and the `amore install` /
`amore doctor` CLI are implemented and exercised by 127 tests. Wave 1
literature skills (`intake-dispatch-summary`, `claim-extract`, `wiki-ingest`,
`wiki-lint`) plus Wave 3/4 (`coder` triad and `writer` + `council` quartet)
are written. Wave 2 prospector skills exist as drafts. Remaining MVP work
is an end-to-end demo on a real project and the public docs in `docs/`.
See [`ROADMAP.md`](ROADMAP.md) for forward plan and
[`CHANGELOG.md`](CHANGELOG.md) for what shipped per phase.

Canonical design lives in `design/` — **gitignored, local-only** (private design notes). If you cloned the repo, that folder is empty. The local canonical files are `design/Product Design.md` and `design/Skill Catalog.md`.

## Quickstart

Local development:

```bash
bun install
bun run build
node dist/cli/index.js install
node dist/cli/index.js doctor
```

The package is not published yet. After publish, the intended command shape is
`bunx ah-my-openresearch install` or `amore install` after global/package
installation.

## What this is

A focused OpenCode plugin that ships:

- **6 research personas** (orchestrator, librarian, prospector, coder, council, writer) — each a `src/agents/<name>.ts` factory.
- **Skill bundles** in `src/skills/<name>/SKILL.md` — curated `amore` skills inspired by proven ARIS patterns, with attribution where adapted.
- **MCP registrations** for Obsidian (`cyanheads/obsidian-mcp-server`), Zotero (`54yyyu/zotero-mcp`), and local semantic memory (`basicmachines-co/basic-memory`).
- **CLI** with admin/setup commands: `install` scaffolds the local lab;
  `doctor` validates the local lab contract and can repair safe generated
  files. Research workflows run through personas in the host CLI, not through
  MVP workflow CLI commands.
- **Per-project lab**: claim-level schema with provenance. Lives in `<project>/lab/drafts/`, separate from outside literature wiki. Canon/promote mechanic deferred to Phase 8.
- **Domain extension layer** (RL pack will be the first).

## Project layout

```text
amore/
├── design/                # canonical product design (local-only, gitignored)
│   ├── Product Design.md
│   └── Skill Catalog.md
├── docs/                  # user-facing docs (TBD)
├── src/
│   ├── index.ts           # plugin entry
│   ├── agents/            # 6 persona factories
│   ├── skills/            # bundled SKILL.md files
│   ├── mcp/               # MCP server registrations
│   ├── config/            # Zod schema + loader
│   ├── cli/               # install / doctor / etc.
│   ├── hooks/             # OpenCode lifecycle hooks
│   ├── lab/               # per-project lab contract (drafts/ + log/index/edges; canon deferred to Phase 8)
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
