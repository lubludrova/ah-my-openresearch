<h1 align="center">amore: ah-my-openresearch</h1>

<p align="center">
  <a href="https://opencode.ai/"><img alt="OpenCode plugin" src="https://img.shields.io/badge/OpenCode-plugin-111827?style=flat-square"></a>
  <a href="https://www.npmjs.com/package/ah-my-openresearch"><img alt="npm version" src="https://img.shields.io/npm/v/ah-my-openresearch?style=flat-square"></a>
  <a href="LICENSE"><img alt="license" src="https://img.shields.io/npm/l/ah-my-openresearch?style=flat-square"></a>
  <a href="https://github.com/lubludrova/ah-my-openresearch/stargazers"><img alt="GitHub stars" src="https://img.shields.io/github/stars/lubludrova/ah-my-openresearch?style=flat-square"></a>
</p>

A first opencode-based research lab for ML/RL work.

Most research-agent projects still orbit a single host: Claude Code.
That is powerful, but it narrows the researcher's choice of models,
providers, tools, and long-running workflows. Moreover, we all know how 
 Anthropic's frontier models are powerful in AI research.

`amore` is built for that gap. It keeps the host lightweight and
model-flexible, while giving research work a shape that survives the
chat: papers become claims, claims motivate ideas, ideas become
experiments, and results flow back into citable evidence.

`amore` turns agent sessions into a durable research record:

```text
papers -> claims -> ideas -> experiments -> results -> citable claims
```

It is not a general coding preset. It is a thin research layer: six
personas, 16 curated skills, a project-local `lab/`, and an optional
outside literature wiki.

```text
          literature wiki                 project lab
        ──────────────────              ───────────────
        papers, notes, PDFs             claims, ideas,
                │                       experiments,
                ▼                       edges, log
            @librarian                       ▲
                │                            │
                ▼                            │
@prospector -> idea -> @coder -> result -> claim
                │                            │
                └──── @council / @writer ────┘
```

## Install

```bash
cd ~/dev/my-research-project
bunx ah-my-openresearch install
opencode
```

Use a provider preset if your OpenCode default provider is not OpenAI:

```bash
bunx ah-my-openresearch install --models anthropic
bunx ah-my-openresearch install --models google
```

Validate anytime:

```bash
bunx ah-my-openresearch doctor
```

## Use

Start with `@orchestrator`, or call the specialist directly:

```text
@librarian ingest arxiv:2403.xxxxx and extract claims
@prospector find gaps in the current lab
@coder run exp:grpo-warmup-2026-06-10
@council stress-test this claim
@writer outline the paper from supported claims
```

Everything important lands in `lab/` as files you can inspect, edit, and
commit.

## What You Get

| Layer | What amore adds |
|---|---|
| Personas | Six research roles wired into OpenCode |
| Skills | 16 `SKILL.md` playbooks for literature, ideas, experiments, review, writing |
| Lab | Typed claim / idea / experiment drafts with provenance |
| Graph | `edges.jsonl` for `supports`, `contradicts`, `tested_by`, `inspired_by`, ... |
| Guardrails | Write boundary for protected lab files |
| Doctor | Validation for lab schema, edges, index, and OpenCode wiring |

The core promise is boring on purpose: research artifacts should survive
the chat.

## Personas

| Persona | Owns |
|---|---|
| `@orchestrator` | Intake, routing, handoff summaries |
| `@librarian` | Paper ingest, literature wiki, claim extraction |
| `@prospector` | Gaps, novelty checks, ideas, experiment plans |
| `@coder` | Running, monitoring, and analyzing experiments |
| `@council` | Multi-model critique and adversarial review |
| `@writer` | Paper plans, figures, audits, drafting support |

All six personas are available as primary agents or subagents. The
installer disables OpenCode's default `build` and `plan` agents inside
the project so research work routes through the research roles.

## Skills

| Stage | Skills |
|---|---|
| Intake | `intake-dispatch-summary` |
| Literature | `paper-search`, `wiki-ingest`, `wiki-lint`, `claim-extract` |
| Ideas | `gap-map`, `idea-creator`, `novelty-vs-wiki`, `research-refine` |
| Experiments | `run-experiment`, `monitor-experiment`, `analyze-results` |
| Review | `council-session`, `paper-audit` |
| Writing | `paper-plan`, `paper-figure` |

The bundled skills are injected by the plugin at runtime. `opencode.json`
does not need machine-local `skills.paths` entries.

## Lab

`amore install` creates:

```text
lab/
  README.md       operating guide
  SCHEMA.md       artifact and edge contract
  config.json     project config
  drafts/         claim-*.md, idea-*.md, exp-*.md
  edges.jsonl     typed graph between artifacts
  index.md        generated catalog
  log.md          append-only changelog
```

Drafts use strict frontmatter. Claims carry provenance and confidence;
experiments carry plan, run metadata, and results; edges connect the
research graph.

Allowed agent writes inside `lab/` are intentionally narrow:

```text
lab/drafts/**
lab/log.md
lab/edges.jsonl
lab/index.md
```

Everything else in `lab/` is protected by the write hook.

## Literature Wiki

The literature wiki is outside the project. It can be Obsidian or plain
Markdown.

`@librarian` reads the first contract file it finds:

```text
<wiki>/RULES.md
<wiki>/AGENTS.md
<wiki>/README.md
```

No contract means no invented schema: the librarian asks before writing.
Obsidian MCP wiring is optional via `--with-obsidian-mcp`.

## Configuration

Minimal generated `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["ah-my-openresearch@<installed-version>"],
  "instructions": ["AGENTS.md"],
  "default_agent": "orchestrator",
  "agent": {
    "build": { "disable": true },
    "plan": { "disable": true }
  }
}
```

Project `lab/config.json` can override persona models and prompts:

```json
{
  "schema_version": "v1",
  "literature_wiki_path": "~/literature-wiki",
  "personas": {
    "librarian": { "model": "anthropic/claude-haiku-4-5" },
    "prospector": { "temperature": 0.7 },
    "council": { "enabled": false }
  }
}
```

Supported model presets:

```bash
amore install --models openai
amore install --models anthropic
amore install --models google
```

Precedence is simple:

```text
persona defaults < amore config < opencode.json agent entries
```

## Doctor

```bash
amore doctor [--lab-dir <path>] [--repair] [--json]
```

Checks:

- lab layout and config
- draft frontmatter
- provenance grammar
- `edges.jsonl` parse errors and broken refs
- generated `index.md` freshness
- OpenCode plugin entry, `AGENTS.md`, default agent, disabled `build`/`plan`
- all 16 bundled skills

Exit codes: `0` clean, `1` errors, `2` warnings only.

MIT licensed.
