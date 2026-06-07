# Changelog

Frozen, per-phase implementation history for `ah-my-openresearch` (`amore`).

This file is **historical**: it records what shipped, the design decisions
captured by each phase, and the verification criteria that passed. For the
*forward* plan and currently open work, see [`ROADMAP.md`](ROADMAP.md). For
canonical design decisions D1–D27, see `design/Product Design.md`.

Phases land in the order driven by `codemap.md`'s dependency cascade. Detailed
implementation narrative lives in `git log`; this file captures only the
durable outcome.

## 0.1.0 — 2026-06-07 — First npm release

First public release on the npm registry. The shape of `amore` is locked in;
breaking changes from here roll a minor or major bump.

Highlights since the pre-publish state:

- **First-time install UX.** `amore install` learns three new flags:
  `--literature-wiki <path>` (skips auto-detect, warns instead of failing if
  the path does not exist yet), `--no-wiki` (opt-out), and
  `--with-obsidian-mcp` (auto-wires the Obsidian Local REST API plugin into
  `opencode.json` by reading the plugin's `data.json`). In an interactive
  terminal the wiki path and Obsidian MCP are also offered through prompts.
  Closes the "stranger-onboarding" gap surfaced by the researcher trip-wires.
- **Public docs.** `docs/installation.md` (~180 lines) covers prerequisites,
  install, flags, the Obsidian plugin setup with a manual curl fallback for
  when the in-Obsidian installer hangs, composition with the global OpenCode
  config, first run, and six common troubleshooting scenarios.
- **Public README.** Rewritten as an npm landing page: quickstart, persona
  table, two-tier knowledge architecture, concepts, configuration,
  honest status block.
- **Version is no longer hand-synced.** `src/cli/index.ts` imports
  `package.json` as JSON and bun build inlines the value. The CLI
  `--version` output is always what `package.json` says — no more drift.
- **Package metadata for npm.** `package.json` carries `repository`,
  `homepage`, `bugs`, and `engines: { node: ">=18" }`. `private: true` is
  removed. `.npmignore` provides defense-in-depth on top of the `files`
  whitelist.

Verifiable: 151 tests pass; typecheck, biome, and `bun run build` all clean.
The tarball (`npm pack --dry-run`) ships 59 files (340 kB) — only the
plugin bundle (`dist/`), the 17 skill bodies, `docs/installation.md`, the
JSON Schema, `README.md`, `LICENSE`, and `package.json`.

## 2026-06-06 — F-findings cleanup (post-Phase 6, pre-Phase 7 close)

End-to-end demo on an empty repo surfaced three findings; all fixed.

- **F2** — `src/skills/wiki-ingest/SKILL.md` Step B specified `confidence: 0.5`,
  incompatible with the strict `low | medium | high` enum in
  `src/lab/artifact-schema.ts`. Changed to `confidence: low` with a note
  referencing the `claim-extract` calibration matrix for promotion.
- **F1** — Plugin entry hard-coded the literature wiki at `~/RL-Wiki` via
  `DEFAULT_LITERATURE_WIKI`. Added `src/config/loader.ts` (reads
  `<project>/lab/config.json` first, then global
  `~/.config/opencode/ah-my-openresearch.json`). Plugin entry now passes
  `userConfig?.literature_wiki_path` to `createAllAgents()`. Loader signature
  `loadAmoreConfig(projectRoot, globalPath?)` exposes the global path for
  tests (Bun caches `homedir()` so HOME mutation cannot be used to redirect
  it). Seven unit tests added in `src/config/loader.test.ts`.
- **F4** — `src/cli/index.ts` `VERSION` constant drifted from
  `package.json`. Synced to `0.0.1` with a TODO to wire from `package.json`
  at build time before publish.

Verifiable:

- `bun test` → 127/127 pass (was 120, +7 from the loader test).
- `bun run typecheck`, `bun run check:ci`, `bun run build` clean.
- End-to-end smoke: fresh empty repo → `amore install` → write claim using
  the corrected `wiki-ingest` schema → `amore doctor --repair` green.

## Phase 6 — Write Boundary Hook (Done)

Goal: enforce MVP write boundaries.

Implemented:

- `src/hooks/pre-write-drafts-only/policy.ts` — pure `classifyLabWrite(projectRoot, target)`.
  Verdict union: `outside-lab | inside-allowlist | inside-lab-not-allowlisted | empty-target`.
- `src/hooks/pre-write-drafts-only/index.ts` — `createPreWriteDraftsOnlyHook(projectRoot)`
  returns a `tool.execute.before` handler. Recognizes native `write` / `edit`
  tools; extracts path from `filePath` / `file_path` / `path` arg keys.
- `src/index.ts` mounts the hook under `tool.execute.before`.

Rules verified:

- Allow writes under `<project>/lab/drafts/**`, appends to `log.md`,
  appends/repairs to `edges.jsonl`, regeneration of `index.md`.
- Deny everything else in `<project>/lab/` (including `README.md`,
  `SCHEMA.md`, the future `canon/`).
- Writes outside `<project>/lab/` are out of scope for this hook.

Known gaps (deferred): `bash` tool redirection cannot be policed via
`tool.execute.before` — relies on prompt + OpenCode permissions. MCP-tool
writes (e.g. `obsidian_*`) are policed server-side via `OBSIDIAN_WRITE_PATHS`.

Verifiable: 23 policy tests + end-to-end smoke against the built plugin.

## Phase 5 — CLI Install and Doctor (Done, MVP-scope)

Goal: satisfy install/doctor parts of D27.

Implemented:

- `amore install`: scaffolds local lab via `src/lab/layout.ts`; no global
  config creation; no OpenCode MCP config mutation; no silent overwrite of
  `README.md` / `SCHEMA.md` (`--reconcile` writes `.new` candidates).
- `amore doctor`: validates lab layout, draft artifact frontmatter,
  `edges.jsonl`, broken edge refs, stale `index.md`; `--repair` regenerates
  safe layout files and `index.md`; `--json` machine-readable output.

OpenCode/MCP/model diagnostics are intentionally deferred until plugin
runtime is wired end-to-end.

Verifiable: `node dist/cli/index.js install` + `doctor` + `doctor --repair`
on a temp project produce the D25 layout and pass; `npm pack --dry-run`
succeeds.

## Phase 4b — Real Agent Prompts (Done)

Goal: replace all six persona STUB prompts with full role-aware prompts,
informed by research over reference systems (omo-slim, ARIS, claude-octopus,
academic-research-skills, co-scientist), with per-persona settings tuned to
each role.

Final per-persona settings:

| Persona | mode | model | T | wikiPath | prompt size |
|---|---|---|---|---|---|
| orchestrator | `primary` | `openai/gpt-5.5` | 0.1 | no | 7.7 KB |
| librarian | `subagent` | `openai/gpt-5.4-mini` | 0.1 | yes | 4.7 KB |
| prospector | `subagent` | `openai/gpt-5.5` | 0.5 | yes | 4.5 KB |
| coder | `subagent` | `openai/gpt-5.4-mini` | 0.1 | no | 8.5 KB |
| council | `all` | `openai/gpt-5.5` | 0.1 | yes | 8.8 KB |
| writer | `all` | `openai/gpt-5.5` | 0.2 | yes | 9.8 KB |

Per-persona highlights:

- **orchestrator** — routing + handoff format (D20). Persona descriptions
  of all five specialists in `<Personas>`. No external tool allowlist.
- **librarian** — universal wiki-aware. Reads wiki contract at session
  start (`<WIKI_PATH>/AGENTS.md | CLAUDE.md | README.md`). Operations live
  in skills; the prompt holds role, boundaries, behavior.
- **prospector** — higher T (0.5) for divergent ideation. Writes
  `idea-*.md` and `exp-*.md` plan sections to `lab/drafts/`.
- **coder** — research-mined reproducibility rules (`--seed`,
  `CUDA_VISIBLE_DEVICES`, `tee` logs), CONTINUE/WAIT/STOP monitoring
  matrix, status state machine, 6 hard anti-patterns.
- **council** — 5-phase workflow (Frame → Parallel → Synthesis → optional
  Debate → Verdict) with deterministic PASS/WARN/FAIL × unanimous/
  majority/split. Exports `COUNCILLOR_ROLE_FRAMINGS` and
  `buildCouncillorPrompt()` for the future `council-session` skill.
- **writer** — frontier model + T=0.2. 6-phase workflow including
  Claims-Evidence Matrix and Round 2 fresh-reviewer guard. Forbidden
  AI-isms by name; `[VERIFY]` marker for citation integrity.

Implementation: `DEFAULT_PERSONA_MODELS` in `src/config/constants.ts`;
`createAllAgents({models?, wikiPath?})` in `src/agents/index.ts`; wikiPath
threaded via `<WIKI_PATH>` placeholder substituted at factory time.

Verifiable: 119/119 tests pass (was 19 after Phase 4a — +100 from
per-persona shape/content/anti-pattern/placeholder tests). Guard tests
verify no `MCP` / `MVP` strings; orchestrator prompt verified to NOT
contain user-specific paths.

Still pending (separate work items): `council-session` skill/tool
implementation, default councillor roster, per-persona skill allowlists.

## Phase 4a — Plugin caркac (Done)

Goal: OpenCode loads the plugin entry and sees six personas + builtin MCPs.

Implemented:

- `src/index.ts` rewritten as `Plugin` from `@opencode-ai/plugin@^1.15`.
  Returns a single `Hooks.config` handler that merges plugin defaults into
  `opencodeConfig.agent` and `opencodeConfig.mcp` (preserving any
  user-supplied values).
- `src/agents/types.ts` reshaped flat
  (`{description, mode, model, temperature, prompt}`) to match SDK
  `AgentConfig`. Name is the record key, not a field.
- All six persona factories updated to flat shape with STUB prompts.
  Orchestrator is `mode: 'primary'`, others are `mode: 'subagent'`.
- `src/agents/index.ts` exports `createAllAgents(model)`.

Verifiable: 19/19 tests pass; `dist/index.js` is 6.34 KB of real plugin
code (was 252 bytes of metadata).

## Phase 3 — MCP + SDK Integration (Done)

Goal: confirm runtime APIs before plugin wire-up.

Implemented:

- SDK deps added: `@opencode-ai/plugin`, `@opencode-ai/sdk`. Build-externals
  — used for types now, runtime later. `@modelcontextprotocol/sdk` deferred
  (no current consumer).
- Verified actual OpenCode plugin shape against omo-slim source: the
  plugin's `mcp` field consumes
  `Record<string, LocalMcpConfig | RemoteMcpConfig>` directly (no wrapper).
- `src/mcp/types.ts` mirrors omo-slim shape exactly: `LocalMcpConfig`,
  `RemoteMcpConfig`, `McpConfig`. A separate amore-only `McpMeta` carries
  install hints.
- `src/mcp/obsidian.ts` verified against upstream: command
  `['bunx', 'obsidian-mcp-server@latest']`; env keys
  `OBSIDIAN_API_KEY` (required), `OBSIDIAN_BASE_URL`, `OBSIDIAN_VERIFY_SSL`,
  `OBSIDIAN_WRITE_PATHS`, `OBSIDIAN_READ_PATHS`, `OBSIDIAN_READ_ONLY`.
  Prereq: Local REST API plugin v4+ in Obsidian.
- `src/mcp/basic-memory.ts` verified: command
  `['uvx', 'basic-memory', 'mcp']`. No env-based storage path; projects are
  added via `basic-memory project add <name> <path>` CLI.
- `src/mcp/zotero.ts` deleted. Outside literature is handled through the
  Obsidian wiki + raw files only (D3).
- `src/mcp/index.ts` exports `createBuiltinMcps(disabled)` and `MCP_META`.

Lab-vs-wiki access pattern decided here:

- Obsidian MCP covers the **outside literature wiki only**.
- `<project>/lab/` is written through host-native tools + the Phase 6
  write-boundary hook.

Verifiable: 16/16 tests (was 6 before).

## Phase 2 — Lab Contract (Done)

Goal: implement D21–D25 as code.

Implemented:

- `src/lab/layout.ts` creates exactly `README.md`, `SCHEMA.md`, `log.md`,
  `index.md`, `edges.jsonl`, and `drafts/`. No `canon/` or `critique/` in
  MVP. No silent overwrite of README/SCHEMA — reconcile writes `.new`
  candidates.
- `src/lab/artifact-schema.ts` — Zod schemas for base/claim/idea/experiment
  frontmatter; YAML frontmatter extraction/parsing.
- `src/lab/provenance.ts` — validates D22 source refs.
- `src/lab/id-generator.ts` — D12 slug and ID rules.
- `src/lab/edges.ts` — validates and appends D23 entries; checks MVP edge
  direction semantics.
- `src/lab/indexer.ts` — regenerates D24 `index.md`.
- `src/lab/log.ts` — appends D20 log entries.
- `src/lab/index.ts` — exports lab API.

Verifiable: lab smoke tests cover layout, IDs/provenance, edge/log/index
flow.

## Phase 1 — Config, Utilities, Schema Export (Done)

Goal: make config loading and schema export real enough for later phases.

Implemented:

- `src/config/schema.ts` — typed D16 persona config and council config; D15
  MCP user config for `obsidian`, `zotero`, `basic-memory`; D26 domain
  fields; post-MVP D13 contradiction config.
- `src/config/constants.ts` — canonical config path
  (`~/.config/opencode/ah-my-openresearch.json`), schema versions, default
  lab and literature wiki paths, all six personas enabled from the first
  build per D2.
- `src/utils/paths.ts` — `~` expansion, project-relative path resolution,
  global config and project lab config path helpers.
- `src/utils/logger.ts` — CLI-safe logger.
- `scripts/generate-schema.ts` — Zod 4 → `ah-my-openresearch.schema.json`.

Verifiable: `bun install`, `bun run typecheck`, `bun run generate:schema`,
`bun run check:ci` all clean.

## Phase 0 — Scaffold (Done)

Created: `package.json`, `tsconfig.json`, `biome.json`, `bunfig.toml`,
`.gitignore`, `LICENSE`, `README.md`, `AGENTS.md`, `codemap.md`,
`ROADMAP.md`, `src/` skeleton (agents/CLI/config/MCP/skills/plugin entry),
`design/` local-only product docs.
