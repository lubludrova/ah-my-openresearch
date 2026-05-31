	# Skills for Product Design

Verified via `gh api` on 2026-05-28. P0 is restricted to MVP=c: `orchestrator` + `librarian`.

## Skills by persona

### `orchestrator` (intake -> dispatch -> summary) — cheap

| Skill | Что делает | Stage | Источник | Tier | Priority |
|---|---|---|---|---|---|
| `intake-dispatch-summary` | Нормализует запрос, выбирает персону/скиллы, собирает краткий итог и next actions. | intake/routing | GAP — write from scratch | cheap | P0 |

### `librarian` (literature + wiki) — midtier

#### Literature

| Skill | Что делает | Stage | Источник | Tier | Priority |
|---|---|---|---|---|---|
| `paper-search` | Multi-source поиск литературы с dedup и synthesis; основной вход для lit-node. | literature | [ARIS/research-lit](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/blob/main/skills/skills-codex/research-lit/SKILL.md) | midtier | P0 |
| `arxiv-fetch` | Точный arXiv lookup/download/summarize для найденных preprints. | literature | [ARIS/arxiv](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/blob/main/skills/skills-codex/arxiv/SKILL.md) | midtier | P1 |
| `zotero-sync` | Связывает Zotero как source of truth с Obsidian paper notes и evidence records. | literature | [claude-scholar/zotero-obsidian-bridge](https://github.com/Galaxy-Dawn/claude-scholar/blob/main/skills/zotero-obsidian-bridge/SKILL.md) | midtier | P0 |
| `pdf-parse` | Читает PDF/annotations из Zotero для full-text evidence extraction. | literature | [zotero-mcp/read_pdf](https://github.com/54yyyu/zotero-mcp/blob/main/src/zotero_mcp/tools/read_pdf.py) | midtier | P1 |
| `paper-qa` | High-accuracy RAG/QA по локальным PDF с citation-grounded answers. | literature | [PaperQA2/README](https://github.com/Future-House/paper-qa/blob/main/README.md) | midtier | P1 |
| `claim-extract` | Извлекает atomic claims в omo claim-schema с provenance и allowed wording. | literature->wiki | GAP — write from scratch | midtier | P0 |

#### Wiki

| Skill | Что делает | Stage | Источник | Tier | Priority |
|---|---|---|---|---|---|
| `wiki-ingest` | Создаёт persistent research-wiki с papers/ideas/experiments/claims и node IDs. | wiki | [ARIS/research-wiki](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/blob/main/skills/skills-codex/research-wiki/SKILL.md) | midtier | P0 |
| `wiki-enrich` | Заполняет TODO-секции paper pages после batch ingest. | wiki | [ARIS/wiki-enrich](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/blob/main/skills/skills-codex/wiki-enrich/SKILL.md) | midtier | P1 |
| `edges-update` | Ведёт typed graph edges (`supports`, `contradicts`, `tested_by`, etc.). | wiki | [ARIS/research-wiki](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/blob/main/skills/skills-codex/research-wiki/SKILL.md) | midtier | P0 |
| `schema-validate` | Lint/health-check для wiki pages, stale claims, orphan edges, contradictions. | wiki | [ARIS/research-wiki](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/blob/main/skills/skills-codex/research-wiki/SKILL.md) | midtier | P0 |
| `obsidian-draft-write` | Точечно пишет/патчит notes в Obsidian `_drafts/` через MCP transport. | wiki | [obsidian-mcp-server/write-note](https://github.com/cyanheads/obsidian-mcp-server/blob/main/src/mcp-server/tools/definitions/obsidian-write-note.tool.ts) | midtier | P0 |
| `git-stage-commit` | Human-veto gate: ревью staged wiki writes перед промоушном в canon. | wiki | [obsidian-wiki/wiki-stage-commit](https://github.com/Ar9av/obsidian-wiki/blob/main/.skills/wiki-stage-commit/SKILL.md) | cheap | P0 |
| `contradiction-check` | Ingest-time semantic contradiction flagging against supported claims. | wiki | GAP — write from scratch | midtier | P0 |
| `novelty-vs-wiki` | Сначала проверяет идею против RL-Wiki/canon claims, затем против внешней литературы. | novelty | GAP — write from scratch | midtier | P1 |

### `prospector` (ideation + plan + interpret) — frontier

| Skill | Что делает | Stage | Источник | Tier | Priority |
|---|---|---|---|---|---|
| `idea-creator` | Генерирует и ранжирует research ideas из направления и literature context. | ideation | [ARIS/idea-creator](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/blob/main/skills/skills-codex/idea-creator/SKILL.md) | frontier | P1 |
| `research-refine` | Уточняет метод до problem-anchored, implementable proposal. | ideation | [ARIS/research-refine](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/blob/main/skills/skills-codex/research-refine/SKILL.md) | frontier | P1 |
| `experiment-plan` | Превращает proposal в claim-driven roadmap: metrics, ablations, budgets. | planning | [ARIS/experiment-plan](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/blob/main/skills/skills-codex/experiment-plan/SKILL.md) | frontier | P1 |
| `result-to-claim` | Интерпретирует raw results: что supported/partial/unsupported и что делать дальше. | interpretation | [ARIS/result-to-claim](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/blob/main/skills/skills-codex/result-to-claim/SKILL.md) | frontier | P1 |
| `ablation-planner` | Планирует ablations после main result для submission-grade evidence. | planning | [ARIS/ablation-planner](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/blob/main/skills/skills-codex/ablation-planner/SKILL.md) | frontier | P2 |

### `coder` (experiment impl + run) — cheap host CLI

| Skill | Что делает | Stage | Источник | Tier | Priority |
|---|---|---|---|---|---|
| `experiment-bridge` | Берёт experiment plan -> implementation -> sanity run -> first results. | impl | [ARIS/experiment-bridge](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/blob/main/skills/skills-codex/experiment-bridge/SKILL.md) | cheap | P1 |
| `run-experiment` | Запускает эксперименты локально/remote/Vast/Modal. | run | [ARIS/run-experiment](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/blob/main/skills/skills-codex/run-experiment/SKILL.md) | cheap | P1 |
| `seed-sweep` | Multi-seed/multi-config SSH queue с retry/OOM handling. | run | [ARIS/experiment-queue](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/blob/main/skills/skills-codex/experiment-queue/SKILL.md) | cheap | P1 |
| `monitor-experiment` | Мониторит running jobs, progress, logs, output collection. | monitor | [ARIS/monitor-experiment](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/blob/main/skills/skills-codex/monitor-experiment/SKILL.md) | cheap | P1 |
| `analyze-results` | Считает статистику, comparison tables, insights из raw results. | analysis | [ARIS/analyze-results](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/blob/main/skills/skills-codex/analyze-results/SKILL.md) | cheap | P1 |
| `training-check` | Ловит NaN/divergence/idle GPU по W&B или logs. | monitor | [ARIS/training-check](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/blob/main/skills/skills-codex/training-check/SKILL.md) | cheap | P2 |

### `council` (in-flow critique) — mixed

| Skill | Что делает | Stage | Источник | Tier | Priority |
|---|---|---|---|---|---|
| `multi-llm-council` | Multi-LLM council с quorum, synthesis, veto gates и budget caps. | critique | [Octopus/skill-council](https://github.com/nyldn/claude-octopus/blob/main/skills/skill-council/SKILL.md) | mixed | P1 |
| `research-review` | Deep external review of idea/method/results before overcommitting. | critique | [ARIS/research-review](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/blob/main/skills/skills-codex/research-review/SKILL.md) | mixed | P1 |
| `kill-argument` | Две независимые нити: strongest rejection memo и defense. | critique | [ARIS/kill-argument](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/blob/main/skills/skills-codex/kill-argument/SKILL.md) | mixed | P1 |
| `claim-audit` | Проверяет numeric/scope claims against raw result files. | audit | [ARIS/paper-claim-audit](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/blob/main/skills/skills-codex/paper-claim-audit/SKILL.md) | mixed | P1 |
| `citation-audit` | Проверяет existence, metadata и context appropriateness для citations. | audit | [ARIS/citation-audit](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/blob/main/skills/skills-codex/citation-audit/SKILL.md) | mixed | P1 |
| `proof-check` | Формальная проверка proof obligations, side conditions, counterexamples. | audit | [ARIS/proof-checker](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/blob/main/skills/skills-codex/proof-checker/SKILL.md) | mixed | P2 |
| `experiment-audit` | Ищет fake ground truth, phantom results, score-normalization fraud. | audit | [ARIS/experiment-audit](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/blob/main/skills/skills-codex/experiment-audit/SKILL.md) | mixed | P1 |

### `writer` (paper + figures) — frontier

| Skill | Что делает | Stage | Источник | Tier | Priority |
|---|---|---|---|---|---|
| `paper-plan` | Строит paper outline из claims/results: evidence matrix, figures, sections. | writing | [ARIS/paper-plan](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/blob/main/skills/skills-codex/paper-plan/SKILL.md) | frontier | P1 |
| `paper-write` | Генерирует LaTeX sections с anti-hallucination citation workflow. | writing | [ARIS/paper-write](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/blob/main/skills/skills-codex/paper-write/SKILL.md) | frontier | P1 |
| `paper-review` | Multi-perspective simulated peer review with devil's advocate and revision roadmap. | review | [academic-research-skills/academic-paper-reviewer](https://github.com/Imbad0202/academic-research-skills/blob/main/academic-paper-reviewer/SKILL.md) | frontier | P1 |
| `latex-compile` | Компилирует LaTeX PDF и auto-fixes build errors. | writing | [ARIS/paper-compile](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/blob/main/skills/skills-codex/paper-compile/SKILL.md) | cheap | P1 |
| `plot-from-data` | Publication-quality plots/tables из experiment results. | figures | [ARIS/paper-figure](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/blob/main/skills/skills-codex/paper-figure/SKILL.md) | frontier | P1 |
| `figure-spec` | Deterministic JSON->SVG diagrams for architecture/workflow figures. | figures | [ARIS/figure-spec](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/blob/main/skills/skills-codex/figure-spec/SKILL.md) | frontier | P1 |
| `mermaid-diagram` | Mermaid diagrams with syntax verification for docs/slides/papers. | figures | [ARIS/mermaid-diagram](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/blob/main/skills/skills-codex/mermaid-diagram/SKILL.md) | cheap | P2 |
| `overleaf-sync` | Two-way Overleaf Git bridge for paper collaboration. | submission | [ARIS/overleaf-sync](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/blob/main/skills/skills-codex/overleaf-sync/SKILL.md) | cheap | P2 |

### Cross-cutting / Meta

| Skill | Owner | Что делает | Stage | Источник | Tier | Priority |
|---|---|---|---|---|---|---|
| `cost-route` | `orchestrator` | Native-first routing; escalates to multi-LLM only when diversity/rigor is worth cost. | routing | [Octopus/native-escalation-routing](https://github.com/nyldn/claude-octopus/blob/main/skills/skill-native-escalation-routing/SKILL.md) | cheap | P2 |
| `domain-load` | `orchestrator` | Загружает domain pack: venues, taxonomy, claim_schema extension, templates, optional skills. | routing | GAP — write from scratch | cheap | P1 |

## Recommended MVP=c bundle (P0 only)

Order by build effort:

1. `paper-search` — install/wrap ARIS `research-lit`.
2. `wiki-ingest` + `edges-update` + `schema-validate` — one ARIS `research-wiki` integration.
3. `obsidian-draft-write` — MCP wrapper that writes only into `_drafts/`.
4. `git-stage-commit` — human-veto promotion gate.
5. `zotero-sync` — bridge citations/source notes into the vault.
6. `claim-extract` — new omo claim-schema extractor.
7. `contradiction-check` — D8: new ingest-time checker over local semantic memory.
8. `intake-dispatch-summary` — thin front-door router for orchestrator.

## Gaps — write from scratch

- `intake-dispatch-summary`: Existing workflow orchestrators are too broad; omo needs a tiny front-door skill that maps user intent to persona + stage + output contract. It should stay cheap and produce a deterministic handoff summary, not run the full research loop.

- `claim-extract`: Existing evidence-record patterns are close, especially claude-scholar, but none emit omo's exact claim frontmatter with `status`, `confidence`, `provenance.sources`, `contradicts`, domain fields, and allowed wording. This should be a strict JSON/YAML extraction skill with schema validation before any Obsidian write.

- `contradiction-check`: This is D8; no public repo has turnkey claim-level contradiction checks for a human-vetoed Obsidian research wiki. Build on [basic-memory](https://github.com/basicmachines-co/basic-memory/blob/main/README.md): retrieve candidate supported claims locally, then write `potential_contradicts` with evidence into draft frontmatter.

- `novelty-vs-wiki`: ARIS `novelty-check` is literature-first, not canon-wiki-first. omo needs a wrapper that queries `research-wiki/query_pack.md` and supported claims before web/arXiv search, so personal research memory anchors novelty.

- `domain-load`: No existing skill matches omo's domain-extension surface. Implement a config loader for `config/domains/<domain>/` that merges venues, taxonomy, claim schema extensions, templates, and optional domain skills without changing core personas.

## Sources summary

| Repo | ⭐ | Last push | # skills cited |
|---|---:|---|---:|
| `wanshuiyin/Auto-claude-code-research-in-sleep` | 10886 | 2026-05-28 | 30 |
| `Imbad0202/academic-research-skills` | 23028 | 2026-05-27 | 1 |
| `Galaxy-Dawn/claude-scholar` | 4042 | 2026-05-28 | 1 |
| `Ar9av/obsidian-wiki` | 1568 | 2026-05-28 | 1 |
| `cyanheads/obsidian-mcp-server` | 562 | 2026-05-25 | 1 |
| `54yyyu/zotero-mcp` | 3441 | 2026-05-23 | 1 |
| `Future-House/paper-qa` | 8572 | 2026-03-20 | 1 |
| `nyldn/claude-octopus` | 3431 | 2026-05-28 | 2 |
| `basicmachines-co/basic-memory` | 3098 | 2026-05-28 | 0 — foundation for D8 gap |
