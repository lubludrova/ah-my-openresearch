# codemap

Architecture map for `omo-research`. Pattern: focused OpenCode plugin modeled on `alvinunreal/oh-my-opencode-slim`, with our wiki-contract on top.

## Dependency cascade (what depends on what)

```text
package.json / tsconfig / biome              ← Phase 0 (scaffold; done)
    │
    ▼
src/config/schema.ts (Zod)                   ← Phase 1 (blocked on D11, §7 layout, claim ID rule, threshold)
    │
    ├──────────────┬──────────────────┬──────────────┐
    ▼              ▼                  ▼              ▼
src/agents/*.ts   src/mcp/*.ts   scripts/        constants
(6 factories)     (3 MCPs)       generate-schema
    │              │                  │
    └──────┬───────┘                  ▼
           ▼                  omo-research.schema.json (generated)
    src/index.ts                       │
    (plugin entry)                     │
           │                           │
           ▼                           │
    src/cli/install.ts ←───────────────┘
    (scaffolds vault, registers MCPs, writes user config)
           │
           ├──────────────────┐
           ▼                  ▼
    src/vault/         src/hooks/pre-write-drafts-only/
    (layout, edges,    (enforces _drafts/ only writes)
     claim-schema
     validators)
           │
           ▼
    src/skills/wiki-ingest/SKILL.md
    src/skills/claim-extract/SKILL.md
    src/skills/intake-dispatch-summary/SKILL.md
           │
           ▼
    src/skills/contradiction-check/SKILL.md + python helper
    (D8 — the buildable artifact)
```

## What's where (current scaffold)

| Path | What |
|---|---|
| `src/index.ts` | Plugin entry (STUB) — will wire agents + MCPs + hooks |
| `src/agents/types.ts` | `AgentDefinition` + `Tier` types |
| `src/agents/{orchestrator,librarian,prospector,coder,council,writer}.ts` | 6 persona factories (STUB prompts) |
| `src/agents/index.ts` | Aggregator |
| `src/cli/index.ts` | CLI entry (STUB) |
| `src/cli/install.ts` | Install command (STUB — blocked on D11 + §7 layout) |
| `src/config/schema.ts` | Zod schema for user config (STUB — needs full fields) |
| `src/config/constants.ts` | Defaults: `~/.config/opencode/omo-research.json`, `~/RL-Wiki`, MVP persona list |
| `src/mcp/obsidian.ts` | Registration for `cyanheads/obsidian-mcp-server` (STUB) |
| `src/mcp/zotero.ts` | Registration for `54yyyu/zotero-mcp` (STUB) |
| `src/mcp/basic-memory.ts` | Registration for `basicmachines-co/basic-memory` (STUB) |
| `src/skills/intake-dispatch-summary/SKILL.md` | Orchestrator front-door router (STUB) |
| `src/skills/claim-extract/SKILL.md` | Atomic claim extraction with schema (STUB) |
| `src/skills/wiki-ingest/SKILL.md` | Write drafts to vault via obsidian-mcp-server (STUB) |
| `src/skills/contradiction-check/SKILL.md` | D8 buildable (STUB) |
| `src/hooks/.gitkeep` | Empty — Phase 7 |
| `src/vault/.gitkeep` | Empty — Phase 6 |
| `src/utils/.gitkeep` | Empty — fill as helpers emerge |
| `scripts/.gitkeep` | Empty — Phase 1 adds `generate-schema.ts` |
| `docs/.gitkeep` | Empty — Phase 10 (user docs) |
| `design/` | Canonical design docs (moved from Obsidian) |

## Differentiators (vs upstream like slim)

- `src/vault/` and the wiki-contract — slim has no vault concept.
- Claim-level schema with provenance (`design/Product Design.md` §7).
- Draft → human-veto → canon flow.
- Domain extension layer (`design/Product Design.md` §8) — generic core + optional packs.
- Contradiction-check pipeline (D8) on `basicmachines-co/basic-memory`.

## Mapping to slim's structure

| omo-research | slim equivalent | Notes |
|---|---|---|
| `src/agents/` | `src/agents/` | Same pattern. Slim has 10 agents (orchestrator/librarian/oracle/explorer/fixer/designer/observer/council/councillor/custom); we have 6 (no oracle/explorer/fixer/designer/observer; we add prospector/writer). |
| `src/skills/` | `src/skills/` | Same shape (dir per skill with SKILL.md). |
| `src/mcp/` | `src/mcp/` | Same pattern. Slim has 3 MCPs (context7/grep-app/websearch); we have 3 (obsidian/zotero/basic-memory). |
| `src/config/` | `src/config/` | Same. |
| `src/cli/` | `src/cli/` | Same pattern. Slim's CLI has install/doctor/skills/config-manager; ours starts with install/doctor. |
| `src/hooks/` | `src/hooks/` | Slim has 11 hooks; we'll start with 1-2 (pre-write-drafts-only, session-summary). |
| `src/vault/` | _(none)_ | Our differentiator. |
| `src/utils/` | `src/utils/` | Standard. |
| `src/council/` | `src/council/` | Slim has dedicated multi-LLM manager; we defer to Phase 2 (council persona is stubbed). |
| `src/multiplexer/` | _(omitted)_ | Tmux/zellij; not needed for MVP. |
| `src/interview/` | _(omitted)_ | Slim-specific interactive setup; not needed. |
| `src/divoom/` | _(omitted)_ | LED-display hardware; not relevant. |
| `src/tools/` | _(omitted for now)_ | Custom tools beyond MCP; add when needed. |
| `src/tui.ts` | _(omitted)_ | TUI mode; not needed for MVP. |
