# Roadmap

Forward plan for `ah-my-openresearch` (alias `amore`).

Canonical product design lives in `design/Product Design.md` (local-only,
gitignored, D1–D27 closed). This file is the implementation sequence and
open-decision tracker. `codemap.md` is the dependency map. Past phase
history lives in [`CHANGELOG.md`](CHANGELOG.md).

## Status at a Glance

| Phase | Scope | Status |
|---|---|---|
| 0 | Scaffold | ✅ done |
| 1 | Config, schema, utilities | ✅ done |
| 2 | Lab contract (D21–D25) | ✅ done |
| 3 | MCP + SDK integration | ✅ done |
| 4a | Plugin caркac | ✅ done |
| 4b | Real persona prompts | ✅ done |
| 5 | CLI install + doctor | ✅ done (MVP scope) |
| 6 | Write-boundary hook | ✅ done |
| 7 | MVP skills + lit→claim loop | 🟡 P0 skills written; Wave 2 in drafts; real demo on slm_agent pending |
| 8 | MVP demo + public docs | ⛔ docs/ empty; demo not yet run |

Tests: **127/127 pass** as of 2026-06-06. Typecheck, biome, build all clean.

## MVP Success Criteria

MVP is shipped when one real literature-to-claim-draft loop works on a real
project, with valid provenance and no out-of-bounds writes.

Required:

1. **`amore install`**: creates `<project>/lab/` with `README.md`,
   `SCHEMA.md`, `log.md`, `index.md`, `edges.jsonl`, and `drafts/`. No
   global config or OpenCode MCP-config mutation by default. Prints optional
   next-step hints.
2. **`amore doctor`**: validates local lab layout, draft frontmatter,
   provenance refs, `edges.jsonl`, broken graph refs, and generated
   `index.md`. `--repair` regenerates safe layout files and `index.md`.
3. **Literature → claim-draft loop**: request reaches `orchestrator` /
   `librarian`; librarian reads outside literature wiki context; claim
   extraction creates valid `lab/drafts/claim-*.md`; `log.md` gets `draft`
   / `handoff` entries; `index.md` regenerates; agents write only to
   allowed surfaces.
4. **Real demo on `slm_agent`** (or equivalent): one known paper/query
   produces 2-3 claim drafts with provenance; drafts inspectable in
   Obsidian; `amore doctor` passes after the run.

Not required for MVP:

- `canon/` and promote flow (D18 deferred to Phase 8).
- Contradiction-check (D8/D10 deferred to Phase 8).
- Full autonomous prospector/coder/writer workflows.
- Paper writing, council automation, cheap-to-frontier escalation.
- Long-running resumable graph execution.
- npm publish or public GitHub.
- Full domain pack behavior beyond loading declarative config.

## Phase 7 — Remaining Work

P0 skill bodies (Wave 1, MVP loop) are written:
`intake-dispatch-summary`, `claim-extract`, `wiki-ingest`, `wiki-lint`.

Wave 2 prospector skills exist as drafts and need lock-in before they go
into the persona's `<Skills>` allowlist: `gap-map`, `idea-creator`,
`novelty-vs-wiki`, `research-refine` (and an `experiment-plan` to be
written).

Wave 3 (`coder` triad) and Wave 4 (`writer` + `council` quartet) skill
bodies are already written ahead of schedule — see CHANGELOG for the
skill→source mapping.

Remaining STUB: `contradiction-check` (post-MVP D8).

Follow-up naming: `wiki-ingest` may be split into `lab-ingest` and a
future `paper-ingest` before public release (the current name keeps
causing ambiguity between the literature-wiki side and the lab side).

## Phase 8 — MVP Demo and Public Docs

Files to write in `docs/`:

- `installation.md`
- `configuration.md`
- `personas.md`
- `wiki-contract.md`
- `lab-contract.md`
- `skills.md`

Demo:

- run `amore install` on `slm_agent` or an equivalent project;
- run one literature-to-claim-draft loop end-to-end through OpenCode/
  Claude Code with the plugin loaded;
- inspect outputs in Obsidian;
- run `amore doctor`;
- record remaining gaps and missing setup hints.

Public release checklist (after the demo passes):

- finalize public README;
- decide between `amore init <name>` for new-project bootstrap vs current
  install-into-cwd model;
- public GitHub;
- npm publish (with version bumped from 0.0.1 and `VERSION` constant
  wired from `package.json` at build time);
- CI/test maturity.

## Post-MVP Sequencing

Follows D27 order. Skill source attribution is in `design/Skill Catalog.md`.

1. **Deepen prospector workflows** — lock Wave 2 skill bodies
   (`gap-map`, `idea-creator`, `novelty-vs-wiki`, `research-refine`,
   `experiment-plan`); start producing `idea-*.md` and `exp-*.md` drafts
   from the prospector persona end-to-end.
2. **Experiment loop (Wave 3 wire-up)** — the three skills
   (`run-experiment`, `monitor-experiment`, `analyze-results`) are written;
   the work is wiring them into a real `coder` flow on a project that
   actually runs jobs. Backends: MVP = local + ssh only; Vast.ai / Modal
   deferred. Result → claim handoff: librarian invokes `claim-extract`
   against the finalized exp draft using the candidate hooks
   `analyze-results` returns.
3. **Canon / approval / contradiction** — add `lab/canon/`, add
   `promote`/`invalidate` actions, activate `contradiction-check` against
   `basic-memory`.
4. **Writer / council (Wave 4 wire-up)** — the four skills
   (`council-session`, `paper-plan`, `paper-figure`, `paper-audit`) are
   written. Remaining: council-session fan-out runtime; default councillor
   roster; wire the Wave-3 → Wave-4 chain
   (`analyze-results.result_files` → `paper-plan` matrix →
   `paper-figure` plots → writer drafts `.tex` and runs `latexmk` →
   `paper-audit` → `council-session` pre-submission review).
5. **Public release** — see Phase 8 checklist.

## Open Decisions

No design decision currently blocks Phase 7/8 implementation.

**Drilldowns merged from `TODOs.md`** (2026-06-06):

- **`paper-search` provider policy** — prefer API-first providers
  (arXiv, Semantic Scholar, OpenAlex) with Browserbase only as fallback
  for sites without usable APIs, dynamic conference pages, login/session
  flows, or PDF retrieval. Zotero excluded by D3.
- **Wiki Contract R1–R10 content** — exact frontmatter fields, log entry
  format examples, naming regexes, against the real `~/RL-Wiki/CLAUDE.md`
  + templates. Mechanism is closed (D19); detailed rule content is its
  own design round and will be triggered by the real Phase 7 demo.
- **Host persona invocation syntax** — exact CLI sentence for invoking
  orchestrator/librarian/etc. in OpenCode/Claude Code/Codex. Verified
  in Phase 4a (plugin registers personas), but the daily-use call shape
  needs documentation in `docs/personas.md`. Optional workflow CLI
  wrappers (`amore ingest …`, `amore extract …`) are deferred — not part
  of the MVP interaction model.
- **Council default roster** — when no user config: how many councillors,
  which model mix, what cost cap. Persona prompt and
  `buildCouncillorPrompt()` contract are done (Phase 4b); only the
  default configuration is open.
- **`council-session` fan-out runtime** — the skill body is written
  (Wave 4); the work is implementing protocol-not-transport (OpenCode
  parallel → Claude Code Task → external CLI → sequential fallback).
  Separate from the persona prompt.
- **Per-persona skill allowlists** — to be threaded through once Wave 2
  bodies are locked and any P1/P2 skill is wired.
- **Optional ARIS wrappers** — only add if a concrete user need emerges
  after MVP demo, per D17. Each must be explicit and allowlisted.
- **Contradiction-check calibration** (post-MVP) — embedding model,
  threshold, candidate pool, reviewed edge creation. Defaults locked by
  D13 (cosine 0.80, `BAAI/bge-small-en-v1.5`); calibration against real
  data deferred until canon exists.
- **RL domain pack** — taxonomy, venues, domain fields, templates,
  optional skills/personas. D26 closes the runtime mechanism; pack
  contents are their own design round.
- **`amore init <name>`** — current install applies to existing projects
  only. Decide before public release whether to add a new-project
  bootstrap command.

## Conventions

- Each commit should reference a D-ID from `design/Product Design.md`
  when it implements or changes a closed decision.
- Phase X's "Done" entry in `CHANGELOG.md` carries the verification
  criteria that passed; do not duplicate them here.
- Skill source attribution (ARIS / claude-octopus / academic-research-skills
  / GAP) lives in `design/Skill Catalog.md`, not here.
