# ah-my-openresearch (`amore`)

[![npm](https://img.shields.io/npm/v/ah-my-openresearch?style=flat-square)](https://www.npmjs.com/package/ah-my-openresearch)
[![license](https://img.shields.io/npm/l/ah-my-openresearch?style=flat-square)](LICENSE)
[![OpenCode](https://img.shields.io/badge/OpenCode-plugin-111827?style=flat-square)](https://opencode.ai/)

OpenCode-first research workspace for ML/RL projects: six research personas,
17 bundled skills, a per-project lab contract, and an outside literature wiki.

`amore` is not a general coding-agent preset. It is a research lifecycle layer:
papers become claims, claims motivate ideas, ideas become experiments, and
experiment results flow back into citable claims.

## Quick Start

```bash
cd ~/dev/my-research-project
bunx ah-my-openresearch install
opencode
```

In OpenCode, start with `@orchestrator` or call a specialist directly:

```text
@librarian ingest this paper into my wiki and extract claims
@prospector find gaps in the current lab and propose experiments
@coder run the planned experiment
@writer outline the paper from supported claims
```

Validate the project at any time:

```bash
amore doctor
```

## What Install Creates

`amore install` is project-local. It does not modify
`~/.config/opencode/opencode.json`.

```text
my-project/
├── AGENTS.md           project-level research rules
├── opencode.json       OpenCode project config
└── lab/
    ├── README.md       lab operating notes
    ├── SCHEMA.md       artifact and edge contract
    ├── config.json     amore project config
    ├── drafts/         agent-written claim/idea/experiment drafts
    ├── edges.jsonl     typed graph between artifacts
    ├── index.md        generated catalog
    └── log.md          append-only changelog
```

If an `opencode.json` already exists, install preserves user fields and adds
only the entries `amore` needs. Before updating it, install writes an
`opencode.json.bak*` backup and then commits the new content through a
temp-file rename.

## Personas

| Persona | Mode | Role |
|---|---:|---|
| `@orchestrator` | primary/subagent | Intake, routing, handoff summaries |
| `@librarian` | primary/subagent | Literature wiki, paper ingest, claim extraction |
| `@prospector` | primary/subagent | Gaps, ideas, novelty checks, experiment plans |
| `@coder` | primary/subagent | Implement, run, monitor, analyze experiments |
| `@council` | primary/subagent | Multi-model critique and adversarial review |
| `@writer` | primary/subagent | Paper plan, figures, audits, drafting support |

The installer also disables OpenCode's default `build` and `plan` agents inside
the project. `amore` routes research work through the six personas above.

## Skills

The package ships 17 `SKILL.md` bundles. Install exposes them to OpenCode via
`skills.paths`; `amore doctor` checks that every bundled skill exists and has
valid frontmatter.

| Area | Skills |
|---|---|
| Intake | `intake-dispatch-summary` |
| Literature | `paper-search`, `wiki-ingest`, `wiki-lint`, `claim-extract` |
| Ideation | `gap-map`, `idea-creator`, `novelty-vs-wiki`, `research-refine` |
| Experiments | `run-experiment`, `monitor-experiment`, `analyze-results` |
| Review | `council-session`, `paper-audit`, `contradiction-check` |
| Writing | `paper-plan`, `paper-figure` |

Persona skill allowlists are explicit. For example, `@prospector` can use
ideation skills plus `paper-search`, `claim-extract`, and `analyze-results`;
`@orchestrator` can route to all bundled skills.

## Lab Contract

The lab is the project-local research record.

- `lab/drafts/claim-*.md`: atomic claims with provenance and confidence.
- `lab/drafts/idea-*.md`: hypotheses, target gaps, and planned experiments.
- `lab/drafts/exp-*.md`: plan, run metadata, metrics, and result summaries.
- `lab/edges.jsonl`: typed graph facts such as `supports`,
  `contradicts`, `addresses_gap`, and `tested_by`.
- `lab/index.md`: generated catalog; do not edit by hand.

A write-boundary hook protects core lab files. Agents may write research
artifacts under `lab/drafts/`, append to `lab/log.md` and `lab/edges.jsonl`,
and regenerate `lab/index.md`. Files such as `lab/SCHEMA.md` and future
`lab/canon/**` paths are protected.

## Literature Wiki

`amore` keeps literature memory outside the project. A common setup is:

```text
~/RL-Wiki/
├── RULES.md
├── raw/
└── wiki/
```

During install, choose one of:

- use an existing markdown/Obsidian wiki;
- create a starter `./llm-wiki/` inside the project;
- skip wiki setup.

The librarian reads the first wiki contract file that exists:

1. `<wiki>/RULES.md`
2. `<wiki>/AGENTS.md`
3. `<wiki>/README.md`

If no contract exists, the librarian asks for one before writing. It does not
invent a private wiki schema.

## OpenCode Config

A minimal generated `opencode.json` looks like this:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["ah-my-openresearch"],
  "instructions": ["AGENTS.md"],
  "default_agent": "orchestrator",
  "agent": {
    "build": { "disable": true },
    "plan": { "disable": true }
  },
  "skills": {
    "paths": ["/absolute/path/to/ah-my-openresearch/src/skills"]
  }
}
```

With Obsidian MCP auto-wired, install also adds:

```json
{
  "mcp": {
    "obsidian": {
      "type": "local",
      "command": ["bunx", "obsidian-mcp-server@latest"],
      "environment": {
        "OBSIDIAN_API_KEY": "...",
        "OBSIDIAN_BASE_URL": "https://127.0.0.1:27124",
        "OBSIDIAN_VERIFY_SSL": "false"
      }
    }
  }
}
```

Global provider/model settings still live in your normal OpenCode config.
Project `opencode.json` only wires `amore` into this project.

## CLI

```bash
amore install [--lab-dir <path>]
              [--literature-wiki <path> | --no-wiki]
              [--with-obsidian-mcp]
              [--reconcile]
              [--no-bootstrap]

amore doctor [--lab-dir <path>] [--repair] [--json]
```

Important flags:

| Flag | Meaning |
|---|---|
| `--literature-wiki <path>` | Use an existing wiki path and skip prompts |
| `--no-wiki` | Do not write `literature_wiki_path` |
| `--with-obsidian-mcp` | Wire `mcp.obsidian` from Obsidian Local REST API data |
| `--reconcile` | Write `.new` candidates for lab docs that differ |
| `--no-bootstrap` | Create only the lab layout |
| `doctor --repair` | Regenerate safe lab files and `index.md` |
| `doctor --json` | Emit machine-readable diagnostics |

## Doctor Checks

`amore doctor` validates both the lab and the host wiring:

- lab layout files exist;
- draft frontmatter matches the strict schema;
- `edges.jsonl` lines parse and point at existing draft nodes;
- `index.md` is generated and current;
- `opencode.json` loads `ah-my-openresearch`;
- `AGENTS.md` is referenced and present;
- `default_agent` is `orchestrator`;
- OpenCode `build` and `plan` are disabled;
- bundled `skills.paths` exists and all 17 skills parse.

Exit codes:

| Code | Meaning |
|---:|---|
| `0` | clean |
| `1` | errors |
| `2` | warnings only |

## Troubleshooting

**OpenCode still shows `Build` or `Plan`.**
Run `amore install` again, then `amore doctor`. The project `opencode.json`
must contain `agent.build.disable: true` and `agent.plan.disable: true`.

**OpenCode does not show amore skills.**
Check `amore doctor`. It verifies that `skills.paths` includes the package's
bundled skills directory and that all 17 `SKILL.md` files parse.

**Install warns that `opencode.json` could not be parsed.**
The existing file was left unchanged. Fix the JSON syntax and re-run install.

**The librarian says the wiki contract is missing.**
Add `<wiki>/RULES.md`, `<wiki>/AGENTS.md`, or `<wiki>/README.md` describing
the wiki naming convention, frontmatter, and write rules.

**Obsidian MCP does not auto-wire.**
Open the target vault in Obsidian, enable the Local REST API community plugin,
then re-run install with `--with-obsidian-mcp`.

## Development

```bash
bun install
bun run build
bun run typecheck
bun test
bun run check:ci
```

The package is TypeScript + Bun, with Zod schemas and Biome checks.

## Status

Pre-v1, OpenCode-first.

Shipped:

- six personas;
- 17 bundled skills;
- project install/bootstrap;
- `AGENTS.md` template;
- OpenCode config merge with backup/temp write;
- `amore doctor` lab and OpenCode wiring checks;
- write-boundary hook for protected lab paths.

In progress:

- council runtime hardening;
- stronger assurance/reviewer contracts;
- release smoke tests;
- one full user guide;
- optional Codex/Claude skill export.

## Pattern Sources

`amore` takes different lessons from two reference projects:

- [ARIS](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep):
  rich research workflows, Markdown skill contracts, cross-model review, and
  persistent research memory.
- [oh-my-opencode-slim](https://github.com/alvinunreal/oh-my-opencode-slim):
  OpenCode-native plugin shape, installer ergonomics, agent routing, and skill
  permissions.

The differentiator is the combination: OpenCode-native personas plus a
project-local lab and outside literature wiki with claim-level provenance.

## License

MIT.
