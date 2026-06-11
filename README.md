<h1 align="center">amore</h1>

<p align="center">
  <b>Turn OpenCode into a file-based research lab:</b><br>
  papers become claims, claims become experiments, and results become citable evidence.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/ah-my-openresearch"><img alt="npm version" src="https://img.shields.io/npm/v/ah-my-openresearch?style=flat-square"></a>
  <a href="https://github.com/lubludrova/ah-my-openresearch/actions/workflows/ci.yml"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/lubludrova/ah-my-openresearch/ci.yml?style=flat-square&label=CI"></a>
  <a href="https://opencode.ai/"><img alt="OpenCode plugin" src="https://img.shields.io/badge/OpenCode-plugin-111827?style=flat-square"></a>
  <img alt="personas" src="https://img.shields.io/badge/personas-6-2563eb?style=flat-square">
  <img alt="skills" src="https://img.shields.io/badge/skills-17-7c3aed?style=flat-square">
  <a href="LICENSE"><img alt="license" src="https://img.shields.io/npm/l/ah-my-openresearch?style=flat-square"></a>
</p>

`amore` is a research-lab layer for
[OpenCode](https://opencode.ai). It gives you six research personas, 17
curated skills, an optional outside literature wiki, and a typed project-local
`lab/` where agent work becomes Markdown artifacts you can inspect, edit, diff,
and commit.

It is not a one-shot report generator and not a fully autonomous AI scientist.
It is a durable research-record layer for agent-assisted ML/DL research.

## Quickstart

```bash
cd ~/dev/my-research-project
bunx ah-my-openresearch install
opencode
```

Verify the project anytime:

```bash
bunx ah-my-openresearch doctor
```

Start with `@orchestrator`, or call a specialist directly:

```text
> @orchestrator find recent papers on GRPO variance reduction, update my wiki,
  extract claims, propose experiments, and ask council to choose one

> @librarian ingest arxiv:2502.01234 and extract claims

> @prospector find gaps in my wiki around discrete diffusion LMs and draft
  three experiment ideas
```

## Why amore?

Most research-agent tools automate workflows: search, ideate, run, write.
`amore` focuses on the durable record those workflows should leave behind:

- **Not just reports.** Claims, ideas, experiments, edges, and logs become files.
- **Not hidden memory.** Everything important is Markdown or JSONL you can diff.
- **Not model lock-in.** Personas route across the providers you use in OpenCode.
- **Not full autopilot.** Agents write drafts; you review, edit, delete, or commit.

`amore` is for researchers and ML/RL engineers who want:

- paper claims extracted into reusable evidence;
- experiment plans tied back to hypotheses;
- results connected to claims, source refs, and git commits;
- a Markdown/Obsidian literature wiki that remains human-owned;
- model-agnostic research personas inside OpenCode.

It is probably not what you want if you need a SaaS dashboard, a vector-memory
product, a generic coding-agent preset, or a one-click paper generator.

## What gets installed

```text
my-research-project/
  AGENTS.md              project guide for OpenCode agents
  opencode.json          OpenCode plugin entry and disabled build/plan agents
  .opencode/
    amore.json           amore config: lab, wiki, orchestration, personas
  lab/
    README.md            operating guide
    SCHEMA.md            artifact and edge contract
    drafts/              claim-*.md, idea-*.md, exp-*.md
    edges.jsonl          typed graph between artifacts
    index.md             generated catalog
    log.md               append-only changelog
```

If you ask the installer to create a starter literature wiki, it also creates:

```text
llm-wiki/
  RULES.md               wiki contract
  raw/                   source materials
  reports/               generated reports only
  wiki/                  paper and concept pages
```

Generated wiki reports such as lint, audit, survey, comparison, or status
reports go under `reports/` only. They are concise and English by default
unless you ask otherwise.

## Core concepts

### Literature wiki

The literature wiki can be outside the project. It may be an Obsidian vault or
plain Markdown. `@librarian` reads the first contract file it finds:

```text
RULES.md -> AGENTS.md -> README.md
```

No contract means no invented schema: the librarian asks before writing. The
wiki is for long-lived paper memory that can outlive any single project.

### Project lab

The project `lab/` is the local research record. It stores typed drafts:

| Draft | Purpose |
|---|---|
| `claim-*.md` | Atomic claims with provenance, status, confidence |
| `idea-*.md` | Hypotheses, target gaps, planned experiments |
| `exp-*.md` | Experiment plan, run metadata, results, outcome |

Edges are stored as one JSON object per line in `lab/edges.jsonl`, connecting
claims, ideas, and experiments with typed relationships such as `supports`,
`contradicts`, `tested_by`, `addresses_gap`, and `supersedes`.

### Personas

All six personas are available as primary agents or subagents:

| Persona | Owns |
|---|---|
| `@orchestrator` | Intake, routing, safe multi-agent task graphs |
| `@librarian` | Paper search, wiki ingest/lint, claim extraction |
| `@prospector` | Gaps, novelty checks, ideas, experiment planning |
| `@coder` | Running, monitoring, and analyzing experiments |
| `@council` | Multi-model critique and adversarial review |
| `@writer` | Paper plans, figures, audits, drafting support |

`@council` fans questions out to hidden `councillor-*` subagents. By default it
uses an adversarial / expert / methodologist panel across three model families
and returns a deterministic PASS / WARN / FAIL verdict. Councillors never see
each other's answers; dissent is reported, not averaged.

### Skills

| Stage | Skills |
|---|---|
| Intake | `intake-dispatch-summary`, `orchestrate-task` |
| Literature | `paper-search`, `wiki-ingest`, `wiki-lint`, `claim-extract` |
| Ideas | `gap-map`, `idea-creator`, `novelty-vs-wiki`, `research-refine` |
| Experiments | `run-experiment`, `monitor-experiment`, `analyze-results` |
| Review | `council-session`, `paper-audit` |
| Writing | `paper-plan`, `paper-figure` |

Each skill is a `SKILL.md` contract with hard gates, deterministic output
formats, and explicit anti-patterns. The plugin injects bundled skills at
runtime; `opencode.json` does not need machine-local `skills.paths`.

## Smart orchestration

For broad requests, `@orchestrator` uses `orchestrate-task` before dispatching
specialists. It must produce a task graph, read/write sets, dependency edges,
conflict analysis, execution waves, and self-contained specialist prompts.

```text
you> Find recent GRPO variance-reduction papers, update my wiki,
     extract claims, propose experiments, and have council choose one.
```

Expected plan shape:

| Wave | Agent | Skills | Writes |
|---|---|---|---|
| 1 | `@librarian` | `paper-search` | none |
| 2 | `@librarian` | `wiki-ingest`, `claim-extract` | wiki pages, `lab/drafts/claim-*` |
| 3 | `@prospector` | `novelty-vs-wiki`, `idea-creator` | `lab/drafts/idea-*` |
| 4 | `@council` | `council-session` | `lab/log.md` |

`.opencode/amore.json` sets the wave cap:

```json
{
  "orchestration": {
    "max_parallel": 5
  }
}
```

The cap is not a command to parallelize blindly. Tasks with overlapping writes
or producer/consumer dependencies are serialized.

## Example artifact

After a paper ingest, the important output is not the chat. It is a file:

```text
you> @librarian ingest arxiv:2502.01234 and extract claims

@librarian
wiki: + wiki/papers/grpo-warmup-2025.md
lab:  + lab/drafts/claim-warmup-reduces-grpo-collapse.md
      + lab/drafts/claim-kl-penalty-stabilizes-updates.md
log:  + lab/log.md
```

One resulting claim draft:

```yaml
# lab/drafts/claim-warmup-reduces-grpo-collapse.md
---
schema_version: v1.0
type: claim
node_id: claim:warmup-reduces-grpo-collapse
title: LR warmup reduces early reward collapse in GRPO
status: open
confidence: low
provenance:
  sources: ["arxiv:2502.01234#sec4"]
  experiments: []
  commits: []
supports: []
contradicts: []
tested_by: []
---
```

## Safety model

Agent-written research state is visible and file-based.

Inside `lab/`, write tools are confined to:

```text
lab/drafts/**
lab/log.md
lab/edges.jsonl
lab/index.md
```

Agents cannot use the hook to modify `lab/README.md`, `lab/SCHEMA.md`, or other
non-allowlisted lab paths. The hook is a guardrail, not a sandbox: raw shell
redirects are not intercepted.

There is no hidden canon or automatic promotion flow. Agents write drafts; you
review by editing, committing, or deleting files.

## Configuration

Install auto-detects your existing OpenCode `model` / `small_model` when it can
and otherwise writes the `openai` preset. Use `--models anthropic` or `--models
google` to force a provider preset.

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

Project `.opencode/amore.json` records amore-specific config:

```json
{
  "schema_version": "v1",
  "lab_dir": "./lab",
  "literature_wiki_path": "~/literature-wiki",
  "orchestration": {
    "max_parallel": 5
  },
  "personas": {
    "orchestrator": { "model": "anthropic/claude-sonnet-4-6" },
    "librarian": { "model": "anthropic/claude-haiku-4-5" },
    "prospector": { "temperature": 0.7 },
    "coder": { "model": "anthropic/claude-haiku-4-5" },
    "council": {
      "model": "anthropic/claude-sonnet-4-6",
      "councillors": [
        { "role": "adversarial", "model": "anthropic/claude-sonnet-4-6" },
        { "role": "methodologist", "model": "openai/gpt-5.5" }
      ]
    }
  }
}
```

Precedence:

```text
persona defaults < .opencode/amore.json < opencode.json agent entries
```

Obsidian MCP wiring is optional and only added when requested:

```bash
bunx ah-my-openresearch install --with-obsidian-mcp
```

## Doctor

```bash
amore doctor [--lab-dir <path>] [--repair] [--json]
```

Doctor checks:

- lab layout and config;
- draft frontmatter and provenance grammar;
- `edges.jsonl` integrity;
- generated `lab/index.md` freshness;
- OpenCode plugin wiring;
- disabled `build` / `plan` agents;
- all 17 bundled skills;
- configured persona model providers.

Exit codes: `0` clean, `1` errors, `2` warnings only.

## Status

`amore` is early-stage software. The core install, doctor, persona wiring,
skills, lab schema, and write-boundary checks are covered by tests, but the
product is still raw and will need iteration on real projects.

Expect rough edges around long-running experiments, host task-tool behavior,
wiki conventions, and multi-agent orchestration. The goal is to keep those
edges visible in files and configs, not hidden behind opaque agent memory.

## Acknowledgements

`amore` is shaped by several open research-agent projects and workflow
patterns:

- [OpenCode](https://opencode.ai/) — the open, model-agnostic host runtime.
- [oh-my-opencode-slim](https://github.com/alvinunreal/oh-my-opencode-slim)
  and [oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent) —
  OpenCode plugin, persona, team-agent, and model-map patterns.
- [ARIS](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep),
  [claude-scholar](https://github.com/Galaxy-Dawn/claude-scholar), and
  [academic-research-skills](https://github.com/Imbad0202/academic-research-skills)
  — staged research workflows and academic writing skill design.
- [AI Scientist](https://github.com/SakanaAI/AI-Scientist) and
  [AI Scientist v2](https://github.com/SakanaAI/AI-Scientist-v2) — autonomous
  research-loop reference points.
- [AutoResearch](https://github.com/karpathy/autoresearch) and Karpathy's
  `llm-wiki` pattern — lightweight experiment loops and durable wiki memory.
  
## License

MIT.
