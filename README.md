# ah-my-openresearch  ·  `amore`

> Research personas + skills + per-project lab + outside literature wiki for
> OpenCode / Codex CLI / Claude Code. Built so research context **compounds
> across sessions** instead of evaporating.
>
> The name plays on `oh-my-openagent`: *ah-my-o...* → **amore** (Italian for
> *love*). Research, with care.

## Quickstart

```bash
cd ~/dev/my-new-project
bunx ah-my-openresearch install
```

That single command scaffolds a per-project research lab, points the
librarian at your literature wiki, and (if you have Obsidian's Local REST
API plugin running) wires it up as an MCP. See
[`docs/installation.md`](docs/installation.md) for prerequisites and
configuration details.

```bash
amore install --help        # all flags
amore doctor                # validate the lab contract
```

## What you get

**Six research personas** loaded as OpenCode subagents the moment your host
CLI starts in the project:

| Persona | Role |
|---|---|
| `orchestrator` | Intake, routing, handoff summaries |
| `librarian` | Reads/writes your literature wiki, extracts claims with provenance |
| `prospector` | Ideation, novelty checks, experiment planning |
| `coder` | Implementation, run, monitor, finalize |
| `council` | Multi-LLM critique with deterministic verdict |
| `writer` | Paper plan, figure generation, claim/citation audits |

**Per-project research lab** at `<project>/lab/` — five root files plus
`drafts/` for `claim-*.md`, `idea-*.md`, `exp-*.md`. Every artifact carries
a typed frontmatter (`status`, `confidence`, `provenance`,
`supports`/`contradicts`/`tested_by`) and links into a minimal
`edges.jsonl` graph. `amore doctor` validates the layout, the schema, and
broken cross-references at any time.

**Two-tier knowledge architecture**:

- **Outside literature wiki** (e.g. `~/RL-Wiki`) — cross-project paper
  notes, concept pages, MoCs. The librarian reads it under the wiki's own
  contract (`<wiki>/CLAUDE.md` or `AGENTS.md`).
- **Per-project lab** (`<project>/lab/`) — atomic claims with provenance,
  ideas with target gaps, experiments with plan / run / results. Grows with
  the project, never bleeds into the literature wiki.

**Curated skill bundles** (17 markdown skills) covering literature
ingestion, claim extraction, ideation, experiment lifecycle, multi-LLM
council review, and paper-audit workflows. Inspired by proven patterns
from ARIS, claude-octopus, and academic-research-skills; sources cited per
skill in `design/Skill Catalog.md`.

**Write boundary** — a `tool.execute.before` hook stops agents from writing
outside `<project>/lab/drafts/` (plus appending to `log.md` / `edges.jsonl`
and regenerating `index.md`). Future canon/promote machinery slots in here.

## Concepts

- **Claim with provenance.** Not summaries — every claim cites the wiki
  page or experiment it came from, plus a confidence level (`low`/`medium`/
  `high`). Re-readable a year later.
- **Idea → experiment → claim cycle.** Ideas declare `target_gaps` and
  `hypothesis`. Experiments link back via `idea_refs` and `tests`. After
  the run, claims gain `tested_by` and the graph closes.
- **Strict edge directions.** `contradicts` requires `claim → claim`,
  `addresses_gap` requires `idea → claim`, etc. Wrong direction → doctor
  fails the validation.
- **Wiki contract.** Librarian reads `<wiki>/CLAUDE.md` (or `AGENTS.md`)
  at session start; the wiki's own conventions (naming, frontmatter, log
  format) win.

## Configuration

`amore install` writes a project-level `opencode.json` that declares the
plugin. Provider, model, and global MCPs continue to come from
`~/.config/opencode/opencode.json`. The two files compose at load time.

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["ah-my-openresearch"],
  "instructions": ["AGENTS.md"]
}
```

If your literature wiki has Obsidian's Local REST API plugin installed,
amore can auto-wire its MCP entry. See
[`docs/installation.md`](docs/installation.md#setting-up-the-obsidian-local-rest-api-plugin).

## Status

Pre-v1, post-MVP. Core contract, personas, skills, CLI, and write
boundary are all shipped and exercised by ~150 tests.

- **Active:** literature → claim draft loop, idea + experiment drafts,
  edge graph, doctor validation.
- **In progress:** Wave 2 prospector skills exist as drafts pending
  lock-in (`gap-map`, `idea-creator`, `novelty-vs-wiki`,
  `research-refine`).
- **Post-MVP (planned):** `canon/` promote workflow, contradiction-check
  on local semantic memory, RL domain pack.

For the forward plan see [`ROADMAP.md`](ROADMAP.md); for what shipped per
phase see [`CHANGELOG.md`](CHANGELOG.md). Canonical product decisions
(D1–D27) live in `design/Product Design.md` (gitignored).

## Pattern source

Architecture follows
[`alvinunreal/oh-my-opencode-slim`](https://github.com/alvinunreal/oh-my-opencode-slim)
(focused OpenCode plugin, Bun + TS, MIT). Differentiators: project-local
lab contract, two-tier knowledge architecture, claim-level provenance,
strict edge schema, declarative domain packs (RL first).

## License

MIT.
