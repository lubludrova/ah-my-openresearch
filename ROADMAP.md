# Roadmap

Phase-by-phase build plan. Every step references real files in this repo.

> **Current state (post-scaffold):** `src/**` is STUBs only — no business logic written. Real content lives in: `package.json`, `tsconfig.json`, `biome.json`, `README.md`, `AGENTS.md`, `codemap.md`, `LICENSE`. Architecture map is in `codemap.md`.

> **Canonical design** lives in `design/Product Design.md` (gitignored — local only). All decision IDs below (D1–D11) reference §3 of that doc.

---

## Blocking decisions (resolve before Phase 1)

Phase 1 (config schema) cannot be written concretely without these 4 answers:

| # | Decision | What to settle |
|---|---|---|
| **D11** | Inter-persona file conventions | Where do `_drafts/`, `critique/`, `claims/`, `results/`, handoff summaries live in the vault? |
| **§7 vault layout** | Claim storage | Concretely: own `claims/` dir / inline with papers / tag-based? |
| **Claim ID rule** | Stable IDs | slug from title? hash of content? UUID? timestamp+slug? Two ingests of the same paper must produce the same ID. |
| **Contradiction threshold** | Similarity cutoff | Numeric value for flagging `potential_contradicts` (e.g. cosine > 0.85). |

---

## Phase 0 — Scaffold ✅ DONE

Commit: `77e4900` (initial) + this commit (gitignore + roadmap).

Created:
- Manifest: `package.json`, `tsconfig.json`, `biome.json`, `bunfig.toml`, `.gitignore`, `LICENSE`
- Narrative: `README.md`, `AGENTS.md`, `codemap.md`, `ROADMAP.md`
- `src/` skeleton: agents (6 factories), cli (2 stubs), config (3 files), mcp (3+index), skills (4 P0), index.ts
- `design/` (local-only, gitignored): `Product Design.md`, `Skill Catalog.md`

Verifiable: `find src -type f` matches `codemap.md` layout.

---

## Phase 1 — Config + Schema 🟥 BLOCKED on decisions above

Files to fill:
- `src/config/schema.ts` — extend Zod with `vault.layout`, `vault.claim_id_rule`, `contradiction.threshold`, real per-persona defaults
- `src/config/constants.ts` — concrete defaults for new fields
- `src/utils/paths.ts` (NEW) — path resolution helpers
- `src/utils/logger.ts` (NEW) — logger
- `scripts/generate-schema.ts` (NEW) — Zod → `omo-research.schema.json`

Verifiable: `bun run scripts/generate-schema.ts` produces a valid `omo-research.schema.json`.

---

## Phase 2 — Agent prompts (parallel with Phase 3)

For each `src/agents/<name>.ts`:
- Replace STUB prompt with final text derived from `design/Product Design.md` §6 (role, tools, expected I/O, anti-patterns).
- Add `defaultTier: Tier` per persona, exported from `src/agents/types.ts`.

Verifiable: every persona exports an agent with a non-stub prompt; smoke tests pass.

---

## Phase 3 — MCP registrations (parallel with Phase 2)

Prereq: `bun add @opencode-ai/sdk @opencode-ai/plugin @modelcontextprotocol/sdk`.

For each `src/mcp/<name>.ts`:
- Fill real manifest (`command`, `args`, `env`) per OpenCode SDK MCP convention.
- Export `MCP_REGISTRY` from `src/mcp/index.ts`.

Verifiable: a unit test imports `MCP_REGISTRY` and validates structure.

---

## Phase 4 — Plugin wire-up

`src/index.ts`:
- Implement `@opencode-ai/plugin` interface.
- On load: read config, register only `ACTIVE_MVP_PERSONAS`, register MCPs from `MCP_REGISTRY`.

`package.json scripts.build`:
- Replace TODO with real `bun build src/index.ts src/cli/index.ts --outdir dist`.

Verifiable: `bun run build` produces `dist/`; OpenCode loads the plugin without error.

---

## Phase 5 — CLI + install

- `src/cli/index.ts` — argument parsing (commands: `install`, `doctor`).
- `src/cli/install.ts` — implement the function: create user config from defaults, scaffold vault (depends on Phase 6), register MCPs in `~/.config/opencode/mcp.json`.
- `src/cli/doctor.ts` (NEW) — checks: vault dirs exist, MCPs reachable, schema valid.

Verifiable: `bunx omo-research install` on a clean machine produces a user config + vault scaffold.

---

## Phase 6 — Vault contract (our differentiator)

In `src/vault/`:
- `layout.ts` (NEW) — creates `<vault>/{papers,ideas,experiments,claims,_drafts,critique}/` + `edges.jsonl`
- `claim-schema.ts` (NEW) — Zod for claim frontmatter, matching `design/Product Design.md` §7
- `id-generator.ts` (NEW) — stable claim ID generator (depends on Claim ID rule decision)
- `edges.ts` (NEW) — append/query helpers for `edges.jsonl`
- `index.ts` (NEW)
- `codemap.md` (NEW)

Verifiable: `src/vault/layout.ts` invoked on a temp dir creates exactly the expected structure.

---

## Phase 7 — Hooks (minimum 1)

- `src/hooks/pre-write-drafts-only/{index.ts, SKILL.md}` — OpenCode hook, refuses writes outside `<vault>/_drafts/`.
- `src/hooks/index.ts` — registers hooks at plugin load.

Verifiable: a test issues a write outside drafts → hook rejects.

---

## Phase 8 — P0 skills (real loop)

Replace STUB bodies in:
- `src/skills/intake-dispatch-summary/SKILL.md` — deterministic handoff format spec
- `src/skills/wiki-ingest/SKILL.md` — depends on `src/vault/layout.ts` + obsidian MCP
- `src/skills/claim-extract/SKILL.md` — strict JSON extraction per `src/vault/claim-schema.ts`

Verifiable: `@librarian ingest arxiv:2501.12599` produces a draft claim in `<vault>/_drafts/`.

---

## Phase 9 — Contradiction-check (D8, main buildable artifact)

- `scripts/contradiction-check.py` (NEW, ~150 lines) — Python helper on `basicmachines-co/basic-memory` (fastembed + sqlite-vec).
- `src/skills/contradiction-check/SKILL.md` — replace STUB; calls the Python helper.
- Wire-up in `src/skills/wiki-ingest/` — auto-invoke `contradiction-check` on every ingest, write `potential_contradicts` to draft frontmatter.

Verifiable: ingesting a claim with a known contradiction → flag appears in draft frontmatter.

---

## Phase 10 — User docs

Fill `docs/`:
- `installation.md` · `configuration.md` · `personas.md` · `wiki-contract.md` · `skills.md`

Verifiable: a new user can install and run by following docs alone.

---

## Phase 11+ — Phase 2 features (deferred)

- Activate `prospector` / `coder` / `writer` in `ACTIVE_MVP_PERSONAS`
- `src/council/council-manager.ts` (NEW) — multi-LLM session orchestration
- Domain pack runtime loading: `src/config/domain-loader.ts` + `config/domains/<name>/`
- Additional hooks (session-summary, phase-reminder)
- LangGraph migration (if §2 sidebar triggers fire)
- Multiplexer, TUI mode, more presets, i18n READMEs, CHANGELOG, contributors meta

---

## Open decisions left to resolve (also Tier 2/3)

| Tier | Decisions |
|---|---|
| 🟥 Tier 1 (blocks Phase 1) | D11, §7 layout, Claim ID rule, Contradiction threshold |
| 🟧 Tier 2 (before real implementation) | D7 (approval surface), §5 draft path, ARIS skill consumption convention, persona config format, oh-my-openagent integration mode, Council default config, MCP install recipe |
| 🟨 Tier 3 (before public release) | D4 (name), D5 (distribution), §8 domain pack runtime, demo success metrics, Phase 11 sequencing |
