# codemap

Architecture map for `ah-my-openresearch` (alias `amore`).

Pattern: standalone OpenCode plugin, modeled structurally on
`alvinunreal/oh-my-opencode-slim`, with a project-local research lab and an
outside literature wiki contract layered on top.

`ROADMAP.md` owns build sequence. `CHANGELOG.md` owns frozen phase history.
This file owns module dependencies and boundaries.

## Dependency Cascade

```text
package.json / tsconfig / biome
    │
    ▼
src/config/schema.ts + constants ─── src/config/loader.ts
    │
    ├───────────────┬────────────────┬───────────────────┐
    ▼               ▼                ▼                   ▼
src/utils/      scripts/         src/mcp/            domain config
paths/logger    generate-schema  registry            loader later
    │               │                │
    │               ▼                ▼
    │        schema artifact     MCP manifests
    │
    ▼
src/lab/   (layout · artifact-schema · provenance · id-generator
            edges · indexer · log)
    │
    ├────────────────────────────┐
    ▼                            ▼
src/cli/install.ts          src/cli/doctor.ts
scaffold local lab          validate/repair
    │
    ▼
src/hooks/pre-write-drafts-only/
    │
    ▼
src/skills/<P0 skills>
    │
    ▼
src/agents/<6 personas>
    │
    ▼
src/index.ts (plugin entry)
```

Post-MVP additions depend on the MVP loop:

```text
Wave 2 prospector wire-up
  → Wave 3 coder wire-up (skills already written)
  → canon/contradiction
  → Wave 4 writer/council wire-up (skills already written)
```

## Directory Map

| Path | Role |
|---|---|
| `src/index.ts` | Plugin entry. Returns `Hooks.config` (merges personas + MCPs) and `tool.execute.before` (mounts the write-boundary hook). |
| `src/agents/` | 6 persona factories returning the SDK-flat `AgentDefinition` shape; `createAllAgents({models?, wikiPath?})` aggregator. |
| `src/skills/<name>/SKILL.md` | Markdown skill bodies invoked by personas. |
| `src/mcp/` | Builtin MCP registry — `obsidian` and `basic-memory` (Zotero removed Phase 3). |
| `src/config/` | Zod schema (source of truth), constants, optional config loader. |
| `src/cli/` | `install` and `doctor` commands. |
| `src/hooks/` | OpenCode lifecycle hooks; `pre-write-drafts-only` enforces lab write boundary. |
| `src/lab/` | Per-project lab contract — layout, artifact schemas, provenance, IDs, edges, log, indexer. Main differentiator. |
| `src/utils/` | Path expansion, logger. |
| `scripts/` | Build-time helpers; `generate-schema.ts` for JSON Schema export. |
| `docs/` | User-facing docs (Phase 8 — currently empty). |
| `design/` | Canonical local-only product design (gitignored). |

## Lab Contract Boundary

MVP lab layout is fixed by D7/D18/D21–D25:

```text
<project>/lab/
├── README.md       # human operating guide; create-if-missing
├── SCHEMA.md       # local schema contract; create-if-missing
├── log.md          # append-only changelog and handoffs
├── index.md        # generated catalog; safe to overwrite
├── edges.jsonl     # machine-readable graph facts
└── drafts/         # all agent-written artifacts in MVP
    ├── claim-<slug>.md
    ├── exp-<slug>.md
    └── idea-<slug>.md
```

No `canon/` or `critique/` directory exists in MVP. They arrive post-MVP
with the approval/canon/contradiction phase.

Module → design mapping:

| Module | Design |
|---|---|
| `src/lab/layout.ts` | D7, D18, D25 |
| `src/lab/artifact-schema.ts` | D21 |
| `src/lab/provenance.ts` | D22 |
| `src/lab/edges.ts` | D23 |
| `src/lab/log.ts` | D20 |
| `src/lab/indexer.ts` | D24 |
| `src/lab/id-generator.ts` | D12 |

## Knowledge Stores

`amore` intentionally has two writable knowledge stores:

| Store | Location | Purpose | Rules |
|---|---|---|---|
| Literature wiki | outside project, e.g. `~/RL-Wiki` | Cross-project paper notes, concepts, MoCs | Wiki Contract D19 |
| Project lab | `<project>/lab/` | Project-specific claims, ideas, experiments, edges | Lab Contract D20–D25 |

`librarian` may write to both, with different schemas and logs. Literature
`ingest` writes to the wiki log. Project artifact writes append to
`lab/log.md` and may update `edges.jsonl` / regenerate `index.md`.

## Plugin Boundary

Six personas in scope from the first build: `orchestrator`, `librarian`,
`prospector`, `coder`, `council`, `writer` (D2/D6).

Plugin entry responsibilities:

- read optional `<project>/lab/config.json` and optional global config
  (`~/.config/opencode/ah-my-openresearch.json`) via `src/config/loader.ts`;
- register all six personas through `Hooks.config` against
  `opencodeConfig.agent`, preserving user-supplied entries;
- register builtin MCPs through `Hooks.config` against `opencodeConfig.mcp`;
- mount the `pre-write-drafts-only` hook under `tool.execute.before`.

## MCP Boundary

Two parallel exports in `src/mcp/index.ts` mirror omo-slim shape (verified
Phase 3):

```typescript
// Consumed directly by OpenCode under the plugin's `mcp` key.
type LocalMcpConfig = {
  type: 'local';
  command: string[];                       // single argv array, not split
  environment?: Record<string, string>;
};
type RemoteMcpConfig = {
  type: 'remote';
  url: string;
  headers?: Record<string, string>;
  oauth?: false;
};
type McpConfig = LocalMcpConfig | RemoteMcpConfig;

// amore-only metadata for `amore install` / `amore doctor` CLI hints.
type McpMeta = {
  upstream: string;
  required: 'required' | 'optional' | 'phase8+';
  install_hint: string;
};

createBuiltinMcps(disabled?): Record<string, McpConfig>
MCP_META: Record<string, McpMeta>
```

MVP required: `obsidian` (`bunx obsidian-mcp-server@latest`, env
`OBSIDIAN_API_KEY` etc.).

Phase 8+: `basic-memory` (`uvx basic-memory mcp`) — activated only when
post-MVP contradiction-check turns on.

Removed Phase 3: `zotero` — outside literature is handled through the
Obsidian wiki + raw files only.

Notes:

- Obsidian MCP covers the **outside literature wiki only**; `<project>/lab/`
  is written by host-native tools (Read/Write/Bash) + the Phase 6
  write-boundary hook. This keeps Phase 6 simple (no MCP-call interception)
  and removes the requirement that lab/ be added as an Obsidian vault.
- `OBSIDIAN_WRITE_PATHS` / `OBSIDIAN_READ_PATHS` provide a server-side
  second-layer write boundary if the user opts in.

## Domain Extension Boundary

Domain packs are declarative only (D26). They can add:

- taxonomy/tags;
- venue/source hints;
- prompt templates;
- persona/skill allowlist entries;
- fields under artifact frontmatter `domain:{}`.

They cannot mutate core artifact fields, core status enums, core edge
types, `node_id` rules, or runtime code. Runtime loader belongs in
`src/config/domain-loader.ts` post-MVP if needed for the demo.

## Differentiators

Compared with upstream slim-like plugins:

- project-local `lab/` contract;
- two-tier knowledge architecture: outside literature wiki plus project lab;
- claim/idea/experiment artifacts with strict provenance;
- `edges.jsonl` as a minimal graph index;
- human-vetoed canon deferred until it has a downstream consumer;
- declarative domain packs, RL first.

## Mapping to slim Structure

| ah-my-openresearch | slim equivalent | Notes |
|---|---|---|
| `src/agents/` | `src/agents/` | Same factory pattern; `amore` has 6 research personas |
| `src/skills/` | `src/skills/` | Same markdown skill shape |
| `src/mcp/` | `src/mcp/` | Same registry idea; different MCPs |
| `src/config/` | `src/config/` | Same config/schema layer + optional loader |
| `src/cli/` | `src/cli/` | Starts with `install` and `doctor` |
| `src/hooks/` | `src/hooks/` | Starts with write-boundary hook |
| `src/lab/` | none | Main differentiator |
| `src/utils/` | `src/utils/` | Shared helpers |
| `src/council/` | `src/council/` | Deferred until council activation |
| `src/multiplexer/` | omitted | Not needed for MVP |
| `src/tui.ts` | omitted | Not needed for MVP |
