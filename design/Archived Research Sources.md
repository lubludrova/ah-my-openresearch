# Archived Research Sources

Archive of pre-design research notes that informed `Product Design.md`. Source files merged: `Harness & Wiki Research.md`, `Idea Generation — Autonomous Research Product.md`.

---

## From Harness & Wiki Research.md

# 🔬 Harness & Wiki Research

Два мини-исследования под продукт из [[Archived Research Sources#From Idea Generation — Autonomous Research Product.md|Idea Generation — Autonomous Research Product]]: (1) на каком харнессе построено каждое решение и какой оптимален; (2) полный разбор wiki/KB-стека. Дата: 2026-05-27. Все репозитории проверены через `gh api`; харнессы — из манифестов зависимостей. См. карту: [[External Solutions#From Autonomous Research Stack.md|Autonomous Research Stack]].

---

## 1. Harness — на чём построено каждое решение

Ground-truth из манифестов (`pyproject` / `requirements` / `environment.yml`) + README у CLI-обёрток.

| Решение | Оркестрация / backbone | Исполнение кода | Доступ к моделям | Дёшево? |
|---|---|---|---|:--:|
| AI-Scientist v1 | custom Python | **Aider** | anthropic/openai SDK | ✗ |
| AI-Scientist v2 | custom Python + tree search | встроенное | anthropic/openai SDK | ✗ |
| Agent Laboratory | custom Python multi-agent | mle-solver | anthropic/openai SDK | ✗ |
| AI-Researcher (HKUDS) | custom Python | своё | litellm | ✓ |
| freephdlabor | **smolagents** | smolagents + AI-Scientist-v2 | litellm | ✓ |
| AutoResearchClaw | plain Python (23-stage) + **ACP** | **внешние CLI: OpenCode/Claude Code/Codex/Gemini/Kimi** | openai/openrouter/deepseek/minimax | ✓ cloud |
| claude-scholar | нет своей — skills поверх host-CLI | host CLI | = CLI | ✓ |
| ARIS | нет своей — Markdown-скиллы поверх Claude Code/Codex | host CLI | = CLI | ◐ |
| AIDE | custom Python + tree search | своё | anthropic/openai SDK | ◐ |
| TinyScientist | **smolagents + OpenAI-Agents SDK** | MCP-tools | litellm | ✓ +budget caps |
| gpt-researcher | **LangGraph** (+AG2) | — | litellm + ollama | ✓✓ |
| open_deep_research | **LangGraph** | — | anthropic/openai + MCP | ✓ |
| local-deep-researcher | **LangGraph** | — | ollama | ✓✓ |
| Tongyi DeepResearch | custom + **vLLM** | — | litellm + vllm | ✓✓ |
| Skywork DeepResearchAgent | **LangGraph** | — | litellm + ollama | ✓✓ |
| STORM | **DSPy** | — | litellm | ✓ |
| PaperQA2 | **aviary + ldp** (FutureHouse) | — | litellm | ✓ |

**Выводы:**
1. **Два мира.** Python-приложения на фреймворке (LangGraph ×4 = весь deep-research-класс; smolagents ×2; DSPy; aviary; custom) vs скиллы поверх coding-CLI (ARIS, claude-scholar — **мой мир**).
2. **Дёшево ⇔ litellm/ollama.** Model-agnostic: весь LangGraph-класс, smolagents, AI-Researcher, PaperQA2, STORM. Frontier-locked (прямые SDK): семейство AI-Scientist (Sakana/Agent Lab/AIDE/MLR) — тяжело пересадить на дешёвые модели.
3. **Мост между мирами строит только AutoResearchClaw** — Python-пайплайн роутит *кодинг* во внешние CLI (OpenCode/Kimi) через **ACP**, на дешёвых cloud-провайдерах. Ближайший шаблон к цели, минус local-модели + cost-routing + wiki.

**Рекомендация по оркестрации.** Три самых трудных требования продукта (per-node cost-routing G5, human-veto G4/G7, wiki-как-состояние G2) — **граф-нативны в LangGraph** (модель на узел через litellm; `interrupt` = вето; типизированный persistent state = vault), а костыльны как CLI-скиллы.

→ **Тонкий LangGraph control-plane**, где узел экспериментов вызывает **OpenCode через ACP** (паттерн AutoResearchClaw) с ARIS-скиллами внутри. Новая логика — там, где она нативна (LangGraph); кодинг — там, где он силён (OpenCode). *Уточняет §3/§5 продуктовой заметки.*

*Альтернатива «ноль новой инфры»:* остаться чисто на скиллах OpenCode/oh-my-openagent + форкнуть пайплайн AutoResearchClaw — ценой более слабого cost-routing.

---

## 2. Wiki — стек, парадигмы, схема, гэп

Karpathy-llm-wiki — верный *принцип* (human-curated markdown = канон, LLM = драфтер), но не оптимальное *исполнение* в одиночку: bottleneck — пропускная способность ревью человеком. Оптимум — гибрид: LLM драфтит со встроенным provenance, авто-проверки до канонизации, human-veto только на промоушн draft→canon.

### Ландшафт wiki/KB-инструментов

| Инструмент | На чём построен | Строит / читает базу | Obsidian-native | ⭐ / pushed |
|---|---|---|:--:|---|
| **ARIS `research-wiki`** | markdown-скиллы (Claude Code/Codex) + stdlib `research_wiki.py` | **Строит** (papers/ideas/experiments/claims + `edges.jsonl`, claim-audit) | markdown, vault-совместимо | 10.8k / 2026-05 |
| **claude-obsidian** | Claude Code skillset, markdown vault | **Строит** (`/wiki` `/save` `/autoresearch`) | да (`.obsidian` в репо) | 5.6k / 2026-04 |
| **obsidian-wiki** | Claude Code/Codex/Cursor, 35+ скиллов | **Строит** (ingest/research/synthesize/dedup/export) | да (`OBSIDIAN_VAULT_PATH`) | 1.5k / 2026-05 |
| **basic-memory** | FastMCP + SQLite + sqlite-vec + fastembed | **Строит** (observation-теги, typed wikilinks, локальный semantic search) | да (shared FS) | 3.1k / 2026-05 |
| **cyanheads/obsidian-mcp-server** | Node MCP + Local REST API | Читает (точечная запись) | плагин | 0.6k / 2026-05 |
| **MarkusPfundstein/mcp-obsidian** | Node MCP + Local REST API | Читает (CRUD) | плагин | 3.8k / 2026-05 |
| **STORM / Co-STORM** | **DSPy** + litellm + qdrant | Строит **однократно** (статья за прогон) | нет | 28k / 2025-09 |
| **PaperQA2** | litellm + aviary/ldp | Читает (RAG/QA) | нет | 8.6k / 2026-03 |
| **GraphRAG** | Python + neo4j(opt), Leiden | Строит индекс однократно | нет | 33k / 2026-05 |
| **Letta / MemGPT** | LangGraph + REST + внешняя БД | Строит (agent memory, без claim-схемы) | нет | 23k / 2026-05 |
| **getzep/graphiti** | Neo4j/Kuzu, temporal KG | Строит (validity windows = контрадикции на уровне фактов) | нет | 26.6k / 2026-05 |
| **cognee** | litellm + LanceDB, ECL-пайплайн | Строит (KG + эмбеддинги, feedback-loop) | нет (API-first) | 17.5k / 2026-05 |
| **Zotero MCP** | Python MCP + Zotero API | Читает (метаданные/цитаты) | нет (Zotero) | 3.4k / 2026-05 |

### Сравнение парадигм

| Парадигма | Доверие | Throughput | Claim-структура | Контрадикции | Retrieval | Стоимость | Obsidian |
|---|---|---|---|---|---|---|:--:|
| Karpathy hand-curated | высшее | низкий | как задаст человек | человек ловит/упускает | отличный | очень низкая | да |
| Fully-autonomous wiki | низкое (drift) | высокий | нет, если не навязать | нет | деградирует | низкая–средняя | зависит |
| **ARIS-style structured** | средне-высокое | средне-высокий | явная (claim/exp граф) | `contradicts`-ребро + audit | хороший | низкая (stdlib) | **да** |
| GraphRAG / Graphiti | среднее | высокий (batch) | триплеты, не claim-level | temporal/community | сильный multi-hop | высокая (Neo4j) | нет |
| basic-memory | среднее | средний | observation-теги | нет | хороший (локально) | очень низкая | да |

**Вердикт:** Karpathy-паттерн — правильный принцип, но не оптимальное исполнение в одиночку. Оптимум — гибрид: ARIS-style структурный драфтинг + provenance + авто-проверки + human-veto на промоушн.

### Рекомендованный стек

| Слой                  | Инструмент                                        | Почему                                                                           |
| --------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------- |
| Канон-хранилище       | **Obsidian-vault `~/RL-Wiki`**, git-commit = вето | markdown, без lock-in, человек владеет каждым фактом                             |
| Драфтинг + provenance | **ARIS `research-wiki`**                          | типы claim/experiment, `contradicts`-рёбра, 3-стадийный claim-audit, stdlib-only |
| Запись агента         | **`cyanheads/obsidian-mcp-server`**               | точечная правка frontmatter → пишет в `_drafts/`, не трогая канон                |
| Цитаты                | **Zotero MCP**                                    | arXiv/DOI/метаданные в `ingest_paper`                                            |
| Veto-gate             | git staging                                       | `git commit` человеком = канонизация; дёшево и аудируемо                         |

Новые Obsidian-native альтернативы драфтера: [[External Solutions#Knowledge Base & Memory|obsidian-wiki, basic-memory]]. **НЕ нужно** для канона: GraphRAG (дорого, не инкрементально), Letta/Cognee (нет Obsidian, непрозрачно), STORM (одноразовый), NotebookLM (закрыто).

### Claim-узел: схема frontmatter

`status` — veto-поверхность: агент пишет `open`; человек ставит `supported` (канон) или `invalidated` (tombstone). Секция `## Connections` авто-генерится из `edges.jsonl`. Пример под slm_agent (GRPO/KL):

```markdown
---
type: claim
node_id: claim:grpo_kl_penalty_stabilizes_training
title: "KL penalty in GRPO stabilizes reward variance in early training"
status: supported          # open | supported | partial | invalidated
confidence: medium
tags: [grpo, rl-training, reward-shaping, slm_agent]
provenance:
  sources:
    - arxiv: "2501.12599"            # → paper:shao2025_deepseek_r1
      quote: "KL term β·KL(π||π_ref) prevents reward collapse..."
      section: "3.2"
    - experiment: "exp:grpo_kl_sweep_2025_11"
      result_file: "results/kl_sweep/metrics.json"
      metric: "reward_std@step100"
      value: 0.42
      baseline: 1.87                 # без KL
  commit: "a3f9c12"                  # git-коммит в slm_agent
contradicts:
  - node_id: claim:grpo_kl_free_stable_2024
    edge_evidence: "Наш sweep: std 4.4× выше без KL; прежний claim из single-seed"
tested_by: [exp:grpo_kl_sweep_2025_11, exp:grpo_ablation_beta_2026_02]
supports:  [idea:use_adaptive_kl_for_slm_agent]
---
```

Ключевое: `provenance.commit` привязывает claim к состоянию кода (reproducibility); `result_file+metric+value` машиночитаемы (ARIS `result-to-claim` заполняет из W&B/JSON); `contradicts` ведётся программно (`paper-claim-audit`).

### Buildable-гэп: ingest-time contradiction checker

То, чего нет turnkey: на каждом `wiki-ingest` локальные эмбеддинги (`basic-memory`: fastembed + sqlite-vec) сверяют новый claim с `supported`-claim'ами → пишут `potential_contradicts` во frontmatter для ревью. **Без graph-DB**, ~150–200 строк Python в ARIS-ingest, вызывается из Claude Code. Самый маленький новый артефакт с наибольшим эффектом.


---

## From Idea Generation — Autonomous Research Product.md

# 💡 Idea Generation — Autonomous Research Product

Полный idea-generation pass поверх [[External Solutions#From Autonomous Research Stack.md|Autonomous Research Stack]]: карта покрытия всех решений → гэпы → продукт → разбор по стадиям. Дата: 2026-05-27. Все репозитории проверены через `gh api`.

> TL;DR. Полные автономные пайплайны под OpenCode + дешёвые модели **уже появились** (AutoResearchClaw, claude-scholar — май 2026), и Karpathy-wiki в Obsidian тоже (`claude-obsidian`). Незанятое пересечение, которое стоит делать: **cost-routed, RL-aware research-петля, чья память = claim-level human-vetoed Obsidian-wiki.** Форм-фактор — набор скиллов + тонкий роутер поверх твоего OpenCode/oh-my-openagent, а не система с нуля.

---

## 1. Карта покрытия

`●` сильно · `◐` частично · `○` нет. Lit · Idea · Exp · Rev · Write · **KB**(живая база) · **$/Open**(дёшево/открыто) · **Cont**(накопление).

| Решение | Lit | Idea | Exp | Rev | Write | KB | $/Open | Cont |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| AI-Scientist v1/v2 | ◐ | ● | ● | ● | ● | ○ | ○ | ○ |
| Agent Laboratory (+AgentRxiv) | ● | ● | ● | ◐ | ● | ◐ | ◐ | ◐ |
| AI-Researcher (HKUDS) | ● | ● | ● | ◐ | ● | ○ | ◐ | ○ |
| freephdlabor | ◐ | ● | ● | ◐ | ● | ◐ | ◐ | ◐ |
| **AutoResearchClaw** | ● | ● | ● | ● | ● | ○ | ● | ◐ |
| **claude-scholar** | ● | ● | ● | ◐ | ● | ○ | ● | ○ |
| ARIS (skill-харнесс) | ● | ● | ● | ● | ● | ◐ | ◐ | ◐ |
| autoresearch (Karpathy) | ○ | ○ | ● | ◐ | ○ | ○ | ● | ○ |
| AIDE / TinyScientist | ○ | ◐ | ● | ◐ | ○ | ○ | ◐ | ○ |
| deep-research (gpt-researcher/ODR/local-DR/Tongyi) | ● | ○ | ○ | ○ | ◐ | ○ | ● | ○ |
| STORM / Co-STORM | ● | ◐ | ○ | ◐ | ● | ◐ | ◐ | ○ |
| PaperQA2 | ● | ○ | ○ | ◐ | ◐ | ◐ | ◐ | ◐ |
| claude-obsidian (Karpathy-wiki) | ◐ | ○ | ○ | ○ | ◐ | ● | ◐ | ● |
| Cognee / Letta / Zep | ○ | ○ | ○ | ○ | ○ | ● | ◐ | ● |
| Google co-scientist | ◐ | ● | ○ | ◐ | ○ | ○ | ○ | ○ |

**Пустые столбцы = гэпы:** KB (claude-obsidian/Cognee закрывают только память, без научного пайплайна), и cost-routing внутри $/Open (открытость ≠ маршрутизация дёшево/дорого).

---

## 2. Гэпы (твои 2, уточнённые реальностью + 5 сгенерированных)

Опора: [«Why LLMs Aren't Scientists Yet»](https://arxiv.org/pdf/2601.03315) — 6 провалов: bias к дефолтам обучения, implementation drift, деградация памяти, overexcitement (ложный успех), слабая доменная экспертиза, слабый научный вкус.

| #      | Гэп                                                | Статус после ресёрча                                                                                                                                                                                                                                                      |
| ------ | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **G1** | Автономный пайплайн под OpenCode/дешёвые модели    | **Частично занят** (AutoResearchClaw, claude-scholar, май 2026). Гипотеза устарела на ~2 недели.                                                                                                                                                                          |
| **G2** | Research пишет в живую claim-level WIKI            | **Открыт.** claude-obsidian даёт human-trust, но не claim-level/provenance. Ни одна система не берёт {авто-обновление + claim-level + human-veto} разом.                                                                                                                  |
| **G3** | Научный вкус, закреплённый на личной базе          | **Открыт.** Прямо лечит провал «weak taste»: RL-Wiki как якорь novelty-фильтра.                                                                                                                                                                                           |
| **G4** | Дешёвый калиброванный «стоп» против overexcitement | **Открыт.** Нужен дешёвый критик + escalation + evidence-linked claims до канонизации.                                                                                                                                                                                    |
| **G5** | **Cost-aware каскад/роутинг моделей по узлам**     | **Открыт, самый чистый.** Субагент A: «cascade-routing статьи есть ([2602.21227](https://arxiv.org/pdf/2602.21227), [2512.02543](https://arxiv.org/pdf/2512.02543)), но не продуктизированы ни в одной research-системе». AutoResearchClaw бьёт одной глобальной моделью. |
| **G6** | Автономный ресёрч под RL                           | **Открыт.** Всё — generic ML/NLP. RL: среды, reward, дисперсия по сидам, кривые.                                                                                                                                                                                          |
| **G7** | Provenance в базу: claim ↔ эксперимент ↔ коммит    | **Открыт.** Референсы: AI-Supervisor (Research World Model + consensus), QMatSuite (provenance + reflection, −67% reasoning).                                                                                                                                             |

**Вывод по твоим гипотезам:** (1) «нет под OpenCode» — уже неверно, появилось в мае; настоящий остаток гэпа — **cost-routing (G5)**. (2) «нет research+wiki» — верно по сути: claude-obsidian рядом, но claim-level + provenance + human-veto никто не собрал (G2/G7).

---

## 3. Продукт

Пересечение **G5 × G2/G7 × G6**, которого нет ни у кого, на базе того, что у тебя уже стоит:

> **Cost-routed RL-research loop с памятью = claim-level human-vetoed Obsidian-wiki.**
> Набор скиллов + тонкий Python-роутер поверх **OpenCode + oh-my-openagent** (твой текущий стек), переиспользуя пайплайн-каркас AutoResearchClaw/ARIS и wiki-паттерн claude-obsidian.

Три дифференциатора = три подтверждённых гэпа:
1. **Cost-router (G5):** дешёвая модель (Kimi/GLM) на грунт-узлах (fetch, парс логов, формат, правки кода через OpenCode), frontier — только на трудных (критика идеи, novelty, proof, review). Эскалация по неуверенности (self-consistency на дешёвой → escalate при расхождении).
2. **Living wiki как память (G2/G7):** research пишет claim-level записи (claim ↔ эксперимент ↔ коммит ↔ источник), флагает противоречия с каноном, требует human-veto до канонизации. Bi-temporal provenance.
3. **RL-специализация (G6):** узлы понимают env/reward/seed-variance/learning-curves; критика дизайна reward (ср. с твоим RL Project).

**Почему набор скиллов, а не система с нуля:** твой стек уже skill-based (ARIS, oh-my-openagent), а AutoResearchClaw/claude-obsidian дают 80% каркаса. Строить на freephdlabor/Agent SDK с нуля — дороже и без выигрыша. Простейшее решение, закрывающее гэп, — 3 недостающих слоя поверх готового.

---

## 4. Разбор по стадиям: сильные работы → что добавить → набор скиллов

### Cross-cutting: Cost-Router (G5) — ядро продукта
- **Сильное:** [budget-aware routing 2602.21227](https://arxiv.org/pdf/2602.21227), [self-consistency cascades 2512.02543](https://arxiv.org/pdf/2512.02543); TinyScientist (budget caps на гиперпараметры); OpenCode Go ($10/мес, 12 open-моделей); oh-my-openagent (per-agent model map, Kimi/GLM нативно).
- **Добавить:** middleware, тегующий каждый узел сложностью → tier модели; escalation-on-uncertainty.
- **Скиллы:** `cost-router` (политика tier + эскалация), model-map в oh-my-openagent.

### 1. Literature & grounding
- **Сильное:** ARIS lit-скиллы; gpt-researcher; open_deep_research (MCP-native); **local-deep-researcher** (полностью локально/дёшево); Tongyi; PaperQA2 (RAG над Zotero); Zotero MCP.
- **Добавить:** deep-research на дешёвой модели **пишет claim-level черновик в wiki** с цитатами+provenance; novelty-check спрашивает **сначала твою RL-Wiki** (якорь вкуса, G3).
- **Скиллы:** `deep-lit` (cheap) + `paper-qa` (над Zotero) + `wiki-draft` (claim-level) + `novelty-vs-wiki`.

### 2. Ideation & novelty
- **Сильное:** AI-Scientist idea-gen; co-scientist (generate→debate→evolve, Elo-турнир); ARIS `idea-creator/novelty-check`; AI-Researcher.
- **Добавить:** заземлить идеацию на RL-Wiki (G3); дешёвая модель — высокий recall идей, frontier-критик + co-scientist-дебаты — отбор.
- **Скиллы:** `idea-gen` (cheap, recall) + `idea-debate` (frontier, турнир) + `novelty-vs-wiki`.

### 3. Experiment planning & implementation
- **Сильное:** AutoResearchClaw (эксперименты через OpenCode); AIDE (agentic tree search); autoresearch Karpathy (дешёвый overnight runner); ARIS experiment-скиллы; Orchestra (grpo/peft/trl); freephdlabor.
- **Добавить:** RL-aware узел (seed-variance, кривые, reward-абляции); правки кода — OpenCode+дешёвая модель, счёт — твой кластер (`ssh sacflow`); AIDE-tree-search с budget-caps (паттерн TinyScientist).
- **Скиллы:** `rl-experiment-plan` + `run-experiment` (OpenCode + sacflow) + `aide-search` (budget-capped) + `seed-variance-check`.

### 4. Review & audit
- **Сильное:** ARIS adversarial cross-model (`auto-review-loop/paper-claim-audit/citation-audit/proof-checker/kill-argument`); co-scientist-критики.
- **Добавить:** дешёвый критик первым проходом + эскалация на frontier только по флагнутым claim'ам (G5); калиброванный стоп против overexcitement (G4) — только evidence-linked claim канонизируется.
- **Скиллы:** `cheap-critic` → `frontier-audit` (escalated) + `claim-provenance-check` (claim↔эксперимент↔коммит).

### 5. Writing & dissemination
- **Сильное:** AI-Scientist/v2; ARIS `paper-writing/figure/slides/poster`; academic-research-skills; STORM (cited-article gen); Orchestra `ml-paper-writing`.
- **Добавить:** двойной выход — (a) черновик статьи, (b) wiki-записи (STORM-черновик → human-veto → канон). Письмо тянет из claim-level wiki → claim'ы статьи provenance-backed.
- **Скиллы:** `paper-write` (переиспользовать ARIS) + `wiki-canonize` (STORM-draft + human-veto + contradiction-flag).

### Cross-cutting: Knowledge Base (G2/G7)
- **Сильное:** claude-obsidian (Karpathy + autoresearch в Obsidian); ARIS `research-wiki`; Cognee/Letta/Zep (память агента); GraphRAG (retrieval); AI-Supervisor/QMatSuite (research-KB референсы).
- **Добавить:** claim-level схема поверх claude-obsidian (provenance, bi-temporal, contradiction-flags); GraphRAG/Cognee как retrieval над курируемым markdown (не над сырыми PDF); human-veto промоушн.
- **Скиллы:** `wiki-schema` (claim-level) + `wiki-retrieve` (GraphRAG над vault) + `contradiction-flag` + `human-veto` gate.

---

## 5. Минимальный первый срез (если делать)
1. `cost-router` + model-map в oh-my-openagent (G5 — самый чистый и автономный выигрыш).
2. `wiki-draft` + `wiki-schema` + `human-veto` поверх claude-obsidian (G2/G7).
3. `novelty-vs-wiki` (G3) — связывает (1)+(2) в петлю.

Сначала автоматизируй literature + experiments (твои bottleneck'и), review оставь human-checkpoint, пока `cheap-critic` не откалиброван.

> Это карта решения, не запуск. Перед реализацией обсудить срез и budget-политику роутера.

---

## 6–7. Harness-анализ и Wiki-стек → отдельный разбор

Вынесены в **[[Archived Research Sources#From Harness & Wiki Research.md|Harness & Wiki Research]]** (мини-исследования целиком):
- **§1 Harness** — на чём построено каждое решение (манифесты зависимостей) + вывод: тонкий **LangGraph control-plane**, эксперименты через **OpenCode/ACP**. *Уточняет §3/§5 выше.*
- **§2 Wiki** — стек (**Obsidian-vault + ARIS `research-wiki` + obsidian-mcp-server + Zotero MCP**, git = вето), сравнение парадигм, claim-схема frontmatter, buildable-гэп (ingest-time contradiction checker).
