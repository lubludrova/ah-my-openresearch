# External Solutions

Consolidated external-solution inventory for the research-agent product design. Source files merged: `Repos.md`, `Resources.md`, `Autonomous Research Stack.md`. `Full Guide.md` intentionally remains separate.

---

## From Repos.md

/# GitHub Repos

---

## Research & Paper Writing

### ARIS — autonomous ML research pipeline
https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep  
Local repo: `~/Tools/aris/` · Updated: `2026-05-25` · Commit: `7e3ab67` · Docs: `~/Tools/aris/AGENT_GUIDE.md`, `~/Tools/aris/docs/SKILLS_CATALOG.md`

**Codex install:** 76 Codex-native skills installed as symlinks:
`~/.codex/skills/<skill> -> ~/Tools/aris/skills/skills-codex/<skill>` plus `~/.codex/skills/shared-references`. Restart Codex after install/update so the skill registry reloads.

ARIS is a Markdown-skill research harness for ML/AI work. It chains literature search, ideation, experiment implementation, GPU runs, audit, paper writing, rebuttal, resubmission, and talks. The core invariant is adversarial cross-model review: the executor writes/runs/edits; an independent reviewer reads artifacts cold in a fresh thread and scores or blocks weak claims. In the Codex mirror, reviewer-heavy skills use Codex-native `spawn_agent` for round 1 and `send_input` for follow-ups, with `xhigh` reasoning.

**Main chain:**
```text
/research-pipeline "direction" -> W1 -> W1.5 -> W2 -> W3
```

| Workflow               | Command                                    | Use when                                                        | Main output                                                 |
| ---------------------- | ------------------------------------------ | --------------------------------------------------------------- | ----------------------------------------------------------- |
| W1 Idea Discovery      | `/idea-discovery "direction"`              | New research direction; need ideas + novelty + pilots           | `IDEA_REPORT.md`, `EXPERIMENT_PLAN.md`, `FINAL_PROPOSAL.md` |
| W1.5 Experiment Bridge | `/experiment-bridge`                       | Have `EXPERIMENT_PLAN.md`; need runnable code and first results | Code changes, `EXPERIMENT_LOG.md`                           |
| W2 Auto Review Loop    | `/auto-review-loop "scope"`                | Have paper/results; need review -> fix -> re-review loop        | Improved paper, `REVIEW_STATE.json`                         |
| W3 Paper Writing       | `/paper-writing NARRATIVE_REPORT.md`       | Have claims/results; need LaTeX + compiled PDF                  | `paper/main.tex`, `paper/main.pdf`                          |
| W4 Rebuttal            | `/rebuttal "paper/ + reviews"`             | Reviews arrived; need safe OpenReview response                  | `PASTE_READY.txt`, `REBUTTAL_DRAFT_rich.md`                 |
| W5 Resubmit            | `/resubmit-pipeline "paper/" --- venue: X` | Port finished paper to another venue, no new experiments        | New isolated venue directory, `RESUBMIT_REPORT.json`        |
| W6 Paper Talk          | `/paper-talk "paper/" --- venue: X`        | Accepted/near-final paper; need conference talk                 | Beamer/PPTX, speaker notes, Q&A prep                        |

**Common controls:**
`--- effort: lite|balanced|max|beast` controls depth/budget.  
`--- assurance: draft|polished|conference-ready|submission` controls audit strictness.  
`--- human checkpoint: true|false`, `--- AUTO_PROCEED: true|false`, `--- difficulty: medium|hard|nightmare`, `--- venue: ICLR|NeurIPS|ICML|...`, `--- sources: web,zotero,deepxiv,exa,...`, `--- gpu: local|remote|vast|modal`, `--- reviewer: codex|oracle-pro`.

**When to use what:**
- Use `/research-pipeline` for a full autonomous run from vague topic to paper draft.
- Use `/idea-discovery` when the problem is under-specified and you need literature-grounded ideas.
- Use `/experiment-plan` or `/research-refine` when you already have an idea but need a testable plan.
- Use `/experiment-bridge`, `/run-experiment`, `/experiment-queue`, `/monitor-experiment`, `/analyze-results` for implementation, GPU scheduling, and result collection.
- Use `/auto-review-loop` when a draft exists and you want autonomous adversarial improvement.
- Use `/paper-writing` when you have `NARRATIVE_REPORT.md` and want a compiled submission.
- Use `/paper-claim-audit`, `/citation-audit`, `/proof-checker`, `/experiment-audit`, `/kill-argument` before submission or when factual integrity matters.
- Use `/rebuttal`, `/resubmit-pipeline`, `/paper-talk`, `/paper-slides`, `/paper-poster` after paper submission/acceptance.
- Use `/research-wiki` early if this is a continuing project; it stores papers, ideas, experiments, failed ideas, and claim status.
- Use patent skills only for invention disclosure / patent drafting, not normal paper writing.

**All 76 Codex skills by category** (`~/Tools/aris/skills/skills-codex/<name>/SKILL.md`):

*Workflow orchestrators:* `research-pipeline`, `idea-discovery`, `idea-discovery-robot`, `experiment-bridge`, `auto-review-loop`, `auto-review-loop-llm`, `auto-review-loop-minimax`, `paper-writing`, `rebuttal`, `resubmit-pipeline`, `paper-talk`, `research-refine-pipeline`, `patent-pipeline`, `dse-loop`, `meta-optimize`

*Literature and search:* `research-lit`, `arxiv`, `semantic-scholar`, `deepxiv`, `exa-search`, `openalex`, `gemini-search`, `alphaxiv`, `comm-lit-review`, `novelty-check`

*Ideation and method design:* `idea-creator`, `research-refine`, `experiment-plan`, `ablation-planner`, `formula-derivation`

*Experiments and infrastructure:* `run-experiment`, `monitor-experiment`, `analyze-results`, `experiment-queue`, `vast-gpu`, `serverless-modal`, `qzcli`, `training-check`, `system-profile`

*Review, audit, assurance:* `research-review`, `experiment-audit`, `result-to-claim`, `paper-claim-audit`, `citation-audit`, `proof-checker`, `kill-argument`

*Paper writing and figures:* `paper-plan`, `paper-write`, `paper-figure`, `figure-spec`, `paper-illustration`, `paper-illustration-image2`, `mermaid-diagram`, `pixel-art`, `paper-compile`, `auto-paper-improvement-loop`, `proof-writer`, `writing-systems-papers`, `grant-proposal`

*Talks, posters, resubmission:* `paper-slides`, `slides-polish`, `paper-poster`

*Patents:* `invention-structuring`, `claims-drafting`, `embodiment-description`, `specification-writing`, `figure-description`, `prior-art-search`, `patent-novelty-check`, `patent-review`, `jurisdiction-format`

*Meta, utilities, integrations:* `research-wiki`, `render-html`, `overleaf-sync`, `feishu-notify`, `interview-cheatsheet`

**Dependencies to configure only when needed:**
LaTeX (`latexmk`, `pdfinfo`) for compile/paper/talk/poster; GPU access for experiment workflows; `vast-cli` for Vast.ai; `modal` for Modal; W&B for `training-check`; `deepxiv-sdk`, `exa-py + EXA_API_KEY`, `gemini-cli`, `requests` for optional literature sources; `python-pptx` for PPTX; Overleaf Premium + Git bridge for `overleaf-sync`; Feishu webhook for `feishu-notify`.

**Update / repair install:**
```bash
cd ~/Tools/aris
git pull --ff-only

# Add symlinks for any new Codex skills without touching existing non-ARIS skills.
find ~/Tools/aris/skills/skills-codex -mindepth 1 -maxdepth 1 -type d -exec sh -c 'for d do t="$HOME/.codex/skills/$(basename "$d")"; [ -e "$t" ] || ln -s "$d" "$t"; done' sh {} +
```

For project-local Codex installs instead of global skills:
```bash
bash ~/Tools/aris/tools/install_aris_codex.sh /path/to/project --aris-repo ~/Tools/aris
bash ~/Tools/aris/tools/install_aris_codex.sh /path/to/project --aris-repo ~/Tools/aris --reconcile
```

Optional overlays `skills-codex-claude-review` and `skills-codex-gemini-review` only change reviewer routing. Do not install them unless that reviewer bridge is configured.

---

### autoresearch — overnight experiment runner
https://github.com/karpathy/autoresearch

Агент модифицирует `train.py`, обучает 5 минут, оценивает val_bpb, сохраняет лучшее. ~12 экспериментов/час на одной GPU. Поведение задаётся через `program.md`.

---

### Orchestra Research AI Skills — ML skills library
https://github.com/Orchestra-Research/AI-Research-SKILLs

~50 скиллов для OpenCode/Claude Code. Установка: `npx @orchestra-research/ai-research-skills`

Key skills по категориям:
- **Post-training:** `fine-tuning-with-trl`, `grpo-rl-training`, `peft-fine-tuning`
- **Distributed:** `huggingface-accelerate`, `deepspeed`
- **Inference:** `serving-llms-vllm`, `sglang`
- **MLOps:** `weights-and-biases`, `tensorboard`
- **Paper writing:** `ml-paper-writing`, `academic-plotting`

---

### Deep Research Skills — structured web research
https://github.com/Weizhena/Deep-Research-skills

Двухфазный research workflow для Claude Code: outline generation → deep investigation. Включает `web-search-agent`.

Skills: `research`, `research-deep`, `research-report`, `research-add-items`

---

## Autonomous Research Systems

> Полные end-to-end системы «идея → эксперименты → статья». Изучать как референс-архитектуры перед сборкой своей. Ср. с [[External Solutions#Research & Paper Writing|ARIS]] (skill-based) и [[External Solutions#Autonomous Research Agents|co-scientist]].

### AutoResearchClaw — полный пайплайн с интеграцией OpenCode
https://github.com/aiming-lab/AutoResearchClaw · ⭐12.7k · pushed 2026-05

«Chat an Idea → Get a Paper», self-evolving, 23 стадии (lit review → статья). Сложные эксперименты авто-роутятся в **OpenCode**; поддержка OpenRouter / DeepSeek / openai-compatible. Самый близкий к «автономный ресёрч на дешёвых моделях». Минус: одна глобальная модель, без cost-routing по узлам (см. [[Archived Research Sources#2. Гэпы (твои 2, уточнённые реальностью + 5 сгенерированных)|гэп G5]]).

---

### claude-scholar — research-ассистент под Claude Code / OpenCode / Codex
https://github.com/Galaxy-Dawn/claude-scholar · ⭐4k · pushed 2026-05

Semi-automated research across ideation / coding / experiments / writing / publication. Явно поддерживает **OpenCode**. Полу-автономный (human-in-the-loop), полезен как референс мульти-харнесс-интеграции.

---

### AI-Scientist — Sakana, флагман автономного ресёрча
https://github.com/SakanaAI/AI-Scientist · ⭐13.8k · pushed 2025-12

Полный цикл: генерация идей → код → эксперименты → анализ → manuscript + авто-рецензирование. ~$15/статью. Первая полностью AI-сгенерированная статья, прошедшая peer-review; работа опубликована в Nature.

---

### AI-Scientist-v2 — workshop-level via agentic tree search
https://github.com/SakanaAI/AI-Scientist-v2 · ⭐6.4k · pushed 2025-12

Развитие v1: agentic tree search вместо шаблонов, меньше человеческих «лесов». Сгенерировала статью, принятую на ICLR-воркшоп.

---

### Agent Laboratory — end-to-end research workflow
https://github.com/SamuelSchmidgall/AgentLaboratory · ⭐5.6k · pushed 2025-08

Пайплайн lit review → эксперименты → отчёт, человек как со-исследователь на чекпоинтах. Включает AgentRxiv — общий «препринт-сервер» между агентами для накопления результатов.

---

### AI-Researcher — HKUDS, NeurIPS 2025
https://github.com/HKUDS/AI-Researcher · ⭐5.4k · pushed 2025-10

Автономная научная инновация: lit review → гипотезы → реализация алгоритма → статья. Есть Scientist-Bench для оценки. Прод-версия: novix.science.

---

### freephdlabor — кастомизируемый multiagent под свою область
https://github.com/ltjed/freephdlabor · ⭐0.5k · pushed 2026-05 · ⚠ новое/сырое (arXiv 2510.15624)

ManagerAgent / IdeationAgent / ExperimentationAgent, динамический workflow, память между сессиями, non-blocking human intervention. Позиционируется как конструктор: собрать свою research-команду под домен за часы. Самый близкий к задаче «собрать свою архитектуру».

---

### AIDE — ML-инженерный агент (WecoAI)
https://github.com/WecoAI/aideml · ⭐1.3k · pushed 2026-05

Agentic tree search по пространству кода: пишет/дебажит/бенчмаркает ML-код. 4× медалей на MLE-Bench против линейных агентов. Кандидат на узел «реализация экспериментов». Ср. с [[External Solutions#Research & Paper Writing|autoresearch]].

---

### TinyScientist — research-агент с budget-caps
https://github.com/ulab-uiuc/tiny-scientist · ⭐0.14k · pushed 2026-03 · EMNLP 2025 Demo

Лёгкий каркас research-агента с явными верхними границами на гиперпараметры → потолок стоимости. MCP-tool-calling. Единственный, кто принципиально ограничивает бюджет — паттерн для cost-узла.

---

### MLR-Copilot — IdeaAgent + ExperimentAgent
https://github.com/du-nlp-lab/MLR-Copilot · ⭐0.07k · pushed 2025-03 · ⚠ академический прототип (arXiv 2408.14033)

Три фазы: генерация идей из статей → реализация экспериментов из прототип-кода → выполнение с human feedback. Полезен как простая декомпозиция ролей, не как daily-driver.

---

## Deep Research / Literature Agents

> Узел «литература / веб-ресёрч»: итеративный поиск → синтез → отчёт с цитатами. Building block для grounding идей.

### gpt-researcher — популярный автономный deep-research
https://github.com/assafelovic/gpt-researcher · ⭐27.3k · pushed 2026-04

planner + execution агенты: генерит вопросы, собирает источники, агрегирует в отчёт. LLM-агностичен.

---

### open_deep_research — LangChain, MCP-native
https://github.com/langchain-ai/open_deep_research · ⭐11.5k · pushed 2026-05

Конфигурируемый deep-research под любые модели / поисковики / MCP-серверы. На уровне топовых проприетарных по Deep Research Bench. Удобно встроить как MCP в Claude Code / OpenCode.

---

### Tongyi DeepResearch — Alibaba, open-source модель + агент
https://github.com/Alibaba-NLP/DeepResearch · ⭐19k · pushed 2026-02

MoE-модель 30.5B (3.3B активных) под long-horizon information seeking + фреймворк. Лидер среди open deep-research.

---

### DeepResearchAgent — Skywork, иерархический multi-agent
https://github.com/SkyworkAI/DeepResearchAgent · ⭐3.4k · pushed 2026-05

Top-level planning агент координирует специализированных нижних агентов; авто-декомпозиция задач. Не только research, но и general task solving.

---

### OpenResearcher — TIGER-AI-Lab, синтез траекторий
https://github.com/TIGER-AI-Lab/OpenResearcher · ⭐0.8k · pushed 2026-04 · ⚠ research-прототип

Открытый пайплайн синтеза long-horizon deep-research траекторий (для обучения/оценки агентов). Лидирует на BrowseComp/GAIA/xbench. Скорее для исследования самих агентов, чем daily-driver.

---

### local-deep-researcher — полностью локальный deep-research
https://github.com/langchain-ai/local-deep-researcher · ⭐9.2k · pushed 2026-04

Веб-ресёрч + отчёт целиком на Ollama / LMStudio, без облака. Идеален для дешёвого/приватного узла литературы.

---

### hyperresearch — tier-adaptive deep-research с per-subagent model routing
https://github.com/jordan-gibbs/hyperresearch · ⭐0.4k · pushed 2026-05

16-шаговый research-pipeline с явным roster субагентов и cost-routing: Sonnet — на fetching/анализ (параллельно 8–12 штук), Opus — на синтез, drafting, adversarial critique. Два режима: `light` (4 шага, ~30 мин) и `full` (16 шагов, ~2.5 ч). Persistent SQLite-vault — каждый source сохраняется и доступен в следующих сессиях. Лидирует на DeepResearch-Bench (self-reported). **Ближайший референс для cost-router архитектуры (G5) — показывает, как разбить Sonnet/Opus по узлам внутри research-pipeline.**

---

## Claude Code Skills & Config

### ECC — harness-native operator system (Anthropic hackathon winner)
https://github.com/affaan-m/ecc · ⭐194k · pushed 2026-05

Комплексная система поверх Claude Code / OpenCode / Codex / Cursor и других харнессов: skills, hooks, instincts, memory persistence, security scanning, token optimization, continuous learning. Anthropic hackathon winner. 12+ языковых экосистем, 170+ контрибьюторов. Ключевые паттерны: token optimization (system prompt slimming, model selection per task), memory persistence через hooks (save/load контекст между сессиями), parallelization (git worktrees, cascade method), subagent orchestration (iterative retrieval pattern). **Читать как референс harness engineering — особенно разделы по token optimization и memory persistence.**

---

### claude-octopus — multi-LLM adversarial review
https://github.com/nyldn/claude-octopus · ⭐3.4k · pushed 2026-05

48 команд, 54 скилла, 32 специализированных персоны (security-auditor, backend-architect и др.) для Claude Code. Главная идея: ставить до 8 моделей (Codex, Gemini, Qwen, Ollama, Perplexity, OpenRouter, OpenCode) на каждую задачу, consensus gate 75%. Новый `/octo:council` — structured multi-LLM deliberation с goal modes (`advice/decision/plan/implement/review`) и adversarial/red-team стилями. **Релевантен как референс multi-model adversarial review** (расширение паттерна ARIS adversarial review на несколько провайдеров).

---

### awesome-claude-code — community skills index
https://github.com/hesreallyhim/awesome-claude-code

Curated-каталог скиллов, хуков, MCP-серверов, оркестраторов. Открывать первым, прежде чем писать свой скилл.

---

### academic-research-skills — research → write → review → revise
https://github.com/Imbad0202/academic-research-skills · ⭐22k · pushed 2026-05

Скиллы Claude Code под академический цикл: research → write → review → revise → finalize. Паттерны адаптированы из anthropic `automated-w2s-researcher`. Прямой кандидат поставить рядом с ARIS-скиллами.

---

### claude-octopus — multi-LLM council / consensus pattern
https://github.com/nyldn/claude-octopus · ⭐3.4k · pushed 2026-05

«Put up to 8 AI models on every research, design or coding task». ~50 скиллов под мульти-модельный режим: `skill-council`, `skill-debate`, `skill-staged-review`, `skill-thought-partner`, `skill-native-escalation-routing` и др. Канонический источник Council-паттерна и cost-route helper для [[Skill Catalog]]. Поддерживает Claude Code / OpenCode / Codex / Cursor / Factory / Gemini.

---

### gstack — virtual engineering team
https://github.com/garrytan/gstack · Garry Tan (YC CEO)

23 скилла вокруг sprint workflow: think → plan → build → review → test → ship.
Key skills: `/office-hours` (product interrogation), `/design-shotgun`, `/review`, `/qa`, `/ship`

---

### superpowers — TDD-first dev methodology
https://github.com/obra/superpowers

Методология как скиллы: агент обязан clarify → design → plan → write failing tests → make them pass. Не даёт прыгнуть сразу в код.

---

### Joel Hooks config — swarm orchestration
https://github.com/joelhooks/opencode-config

Персональный OpenCode конфиг: 25 slash-команд, 12 кастомных MCP-инструментов, swarm-оркестрация.
Key commands: `/swarm`, `/debug-plus`, `/commit`, `/worktree-task`, `/repo-dive`

---

## Agent Frameworks & Personas

### agent-teams-ai — desktop app «ты CTO, агенты — твоя команда»
https://github.com/777genius/agent-teams-ai · ⭐1k · pushed 2026-05

Electron desktop-приложение: агенты самостоятельно берут задачи, переписываются друг с другом, делают code review; ты видишь kanban-доску. Поддерживает Codex/Claude/OpenCode (200+ моделей, 75+ провайдеров). Другая парадигма по сравнению с CLI-скиллами — GUI-оркестрация. Полезен как референс team-coordination паттернов, но не CLI-native.

---

### agency-agents — 144 agent personas
https://github.com/msitarzewski/agency-agents

Специализированные персоны по 12 направлениям (Engineering, Design, Academic, Finance...). Каждый агент: personality + workflow + success metrics. Academic division → Research Analyst, Literature Reviewer.

---

### OpenAgents Control — plan-first development
https://github.com/darrenhinde/OpenAgentsControl

Plan-first workflow с approval gates. Subagents: ContextScout, TaskManager, CoderAgent, TestEngineer, CodeReviewer. MVI context principle.

---

### LangGraph — production multi-agent orchestration
https://www.langchain.com/langgraph · MIT

Stateful графы для production Python агентов: human-in-the-loop, memory, streaming. Для деплоя агентов как сервисов — не для scripts и research.

---

### Orchestration backbones — на чём собирать свою архитектуру
Ранжирование Python-бэкбонов 2026 (Alice Labs / KDnuggets):
- **Claude Agent SDK** — тот же движок, что Claude Code: tool use, hooks, MCP, skills, subagents. Самый родной для моего стека. https://github.com/anthropics/claude-agent-sdk-python · ⭐7k
- **LangGraph** (см. выше) — explicit state machines, точный контроль ветвления / ретраев / human-in-the-loop.
- **smolagents** (HF) — лёгкие code-agents: агент пишет действия как Python. https://github.com/huggingface/smolagents · ⭐27k
- **CrewAI** (role-based «команды»), **PydanticAI** (типобезопасный, под прод), **Google ADK**, **OpenAI Agents SDK**, **AG2** — прочие варианты.

Для skill-/CLI-ориентированного автономного ресёрча (мой случай) бэкбон часто не нужен — хватает Claude Code/Codex + скиллы; фреймворк берут, когда нужен деплой агента как сервиса.

---

## MCP Servers

### yet-another-google-mcp
https://github.com/artoxem-dev/yet-another-google-mcp

MCP-сервер: Google Search, Gmail, Drive, Calendar → Claude. Установка: `claude mcp add`.

---

### Perplexity Research Agent
https://github.com/d-oit/opencode-perplexity-research-agent

OpenCode агенты для Perplexity Sonar (real-time web). Варианты: `-deep`, `-pro`, `-reasoning`, `-reasoning-pro`.

---

## Awesome Lists & Meta-Indexes

> Мета-каталоги: открывать первыми при поиске нового инструмента под конкретный узел пайплайна.

### Awesome-Auto-Research-Tools
https://github.com/handsome-rich/Awesome-Auto-Research-Tools · ⭐0.8k · pushed 2026-05

Автоматизация ресёрча по стадиям: lit search, чтение статей, управление экспериментами, кодогенерация. Самый прицельный под нашу задачу.

---

### Awesome-Deep-Research
https://github.com/DavidZWZ/Awesome-Deep-Research · ⭐0.8k · pushed 2026-05

ACL 2026 KnowFM. Ресурсы по агентному deep-research.

---

### awesome-ai-for-science
https://github.com/ai-boost/awesome-ai-for-science · ⭐1.6k · pushed 2026-05

AI для научного открытия шире ML: физика, химия, биология, материалы.

---

### Awesome-LLM-Scientific-Discovery
https://github.com/HKUST-KnowComp/Awesome-LLM-Scientific-Discovery · ⭐0.3k

EMNLP 2025 survey «From Automation to Autonomy»: таксономия уровней автономии LLM в науке.

---

### awesome-agent-skills (VoltAgent)
https://github.com/VoltAgent/awesome-agent-skills · ⭐23k · pushed 2026-05

1000+ agent skills (Claude Code, Codex, Gemini CLI, Cursor). Каталог скиллов под любой узел.

---

## Open Coding-Agent Harnesses

> Дешёвые / open-model backbone'ы под узел экспериментов и как база автономной петли. Сравнение → [[Archived Research Sources#Cross-cutting: Cost-Router (G5) — ядро продукта|Cost-Router]].

### OpenCode — мой основной харнесс
https://github.com/anomalyco/opencode · ⭐166k · pushed 2026-05

«The open source coding agent». Самая большая model-agnostic экосистема, MCP-native + Registry, background subagents с бюджетами. (org переименован `sst → anomalyco` после янв-2026.) OpenCode Go — $10/мес на 12 open-моделей. Старый `opencode-ai/opencode` архивирован → стал `charmbracelet/crush`.

---

### oh-my-openagent — мой плагин-харнесс (omo)
https://github.com/code-yeongyu/oh-my-openagent · ⭐59.7k · pushed 2026-05

Бывш. oh-my-opencode. Оборачивает OpenCode/Claude Code; Kimi K2.6 / GLM-5.1 нативно, parallel subagents, Team Mode до 8 агентов, встроенный MCP (Exa, GitHub). Уже в текущем локальном сетапе — готовая база для cost-routing (per-agent model map).

---

### OpenHands — лидер SWE-bench, 100+ провайдеров
https://github.com/OpenHands/OpenHands · ⭐75k · pushed 2026-05

Ex-OpenDevin (org `All-Hands-AI → OpenHands`). Полная агентная петля, 100+ моделей через LiteLLM, Ollama нативно. Сильнее всех в long-horizon execution; тяжёлый (Docker).

---

### Goose — MCP-first, дёшев по токенам
https://github.com/aaif-goose/goose · ⭐46k · pushed 2026-05

Block → aaif-goose, Apache-2.0. MCP-first (3000+ серверов), любая LLM. ~4.5× дешевле/токен против OpenHands на OpenRouter-бенчмарках.

---

### Aider — git-native pair programming
https://github.com/Aider-AI/aider · ⭐45k · pushed 2026-05

LiteLLM (100+ провайдеров), zero-cost с Ollama, сильнейшая git-native петля. Без subagents/оркестрации ресёрча.

---

## Knowledge Base & Memory

> Блоки под узел «живая база/wiki» ([[Archived Research Sources#2. Гэпы (твои 2, уточнённые реальностью + 5 сгенерированных)|гэпы G2/G7]]). Различай: *строит и ведёт* базу vs *только читает*.

### claude-obsidian — Karpathy-wiki в Obsidian + autoresearch
https://github.com/AgriciDaniel/claude-obsidian · ⭐5.6k · pushed 2026-04

Прямая реализация паттерна Карпатого: persistent compounding vault, скиллы `/wiki` `/save` `/autoresearch`. Ближе всех к моей идее research+wiki — но human-trust без claim-level/provenance. **Строит базу.**

---

### obsidian-wiki — фреймворк «digital brain» в Obsidian
https://github.com/Ar9av/obsidian-wiki · ⭐1.5k · pushed 2026-05

Скиллы Claude Code/Codex/Cursor (35+): `wiki-ingest/research/synthesize/dedup/export(graphml,neo4j)/dashboard`, обязательный frontmatter. Более «фреймворчная» альтернатива claude-obsidian по паттерну Карпатого. **Строит базу.**

---

### basic-memory — markdown-память с локальными эмбеддингами
https://github.com/basicmachines-co/basic-memory · ⭐3.1k · pushed 2026-05

FastMCP + SQLite + sqlite-vec + fastembed (локально, дёшево); observation-теги `[category]`, typed wikilinks. Shared-filesystem с vault. Основа для дешёвого ingest-time contradiction-check (см. [[Archived Research Sources#Buildable-гэп: ingest-time contradiction checker|buildable-гэп]]). **Строит базу.**

---

### Obsidian MCP-доступ (read/write для агента)
- **cyanheads/obsidian-mcp-server** (⭐0.6k) — точечная правка frontmatter/тегов/заголовков через Local REST API. https://github.com/cyanheads/obsidian-mcp-server
- **MarkusPfundstein/mcp-obsidian** (⭐3.8k) — list/read/append/patch/search через Local REST API plugin. https://github.com/MarkusPfundstein/mcp-obsidian

Оба **читают/пишут**, но не строят базу — это транспорт для агента к vault.

---

### Cognee — memory control plane
https://github.com/topoteretes/cognee · ⭐17.5k · pushed 2026-05

ECL-пайплайн (Extract→Cognify→Load): KG + эмбеддинги из 38+ источников, feedback-loop переоценивает рёбра. Прод у Bayer в science-workflow. **Строит базу.**

---

### Letta (MemGPT) — stateful-агенты
https://github.com/letta-ai/letta · ⭐23k · pushed 2026-05

Платформа агентов с persistent memory (core/archival/recall), sleep-time refinement. Рабочая память агента, не research-схема. **Строит базу.**

---

### Zep / Graphiti — temporal knowledge graph
https://github.com/getzep/graphiti · ⭐26.6k · pushed 2026-05

Bi-temporal KG (event-time + ingestion-time), факты устаревают, а не удаляются. Под agent memory, не под документы. **Строит базу.**

---

### Microsoft GraphRAG — entity-graph retrieval
https://github.com/microsoft/graphrag · ⭐33k · pushed 2026-05

Из фиксированного корпуса → граф сущностей + community summaries. Хорош как retrieval-слой над курируемым markdown. **Строит граф один раз, потом читает.**

---

### Stanford STORM / Co-STORM — авто cited-статьи
https://github.com/stanford-oval/storm · ⭐28k · pushed 2025-09

Multi-perspective вопросы → Wikipedia-style статья с цитатами. Одноразовый генератор (не живая база) — хорош для bootstrap темы и как `wiki-draft`.

---

### llm-wiki — LLM-compiled knowledge base с provenance, Obsidian-compatible
https://github.com/nvk/llm-wiki · ⭐0.5k · pushed 2026-05

Параллельный multi-agent research → wiki-компиляция. Поддерживает Claude Code (native plugin), Codex, OpenCode, Obsidian. Команды: `/wiki:collect` (provenance-rich каталог источников с alias-ами и found-in-context), `/wiki:ingest`, `/wiki:audit`, `/wiki:research`, `/wiki:compile`. Bi-temporal lifecycle: топики можно архивировать, но не удалять. Closest existing tool к G2/G7, но без claim-level гранулярности и human-veto gate. **Строит базу.**

---

### FutureHouse PaperQA2 — high-accuracy RAG над библиотекой
https://github.com/Future-House/paper-qa · ⭐8.5k · pushed 2026-03

Точный RAG/QA над загруженными PDF с цитатами. **Только читает** корпус. Узел `paper-qa` над Zotero.

---

### Zotero MCP — библиотека Zotero ↔ Claude
https://github.com/54yyyu/zotero-mcp · ⭐3.4k · pushed 2026-05

MCP к Zotero: метаданные, семантический поиск, добавление items/тегов. **В основном читает** (лёгкая запись).

Research-KB референсы (arXiv, кода нет): **AI-Supervisor** ([2603.24402](https://arxiv.org/abs/2603.24402)) — Research World Model (KG) + consensus-before-commit; **QMatSuite** ([2603.13191](https://arxiv.org/abs/2603.13191)) — provenance + reflection-сессии, −67% reasoning.


---

## From Resources.md

# AI Tool Resources

---

## Agentic Coding

### Kiro — spec-driven agentic development
https://kiro.dev/

Agentic IDE/CLI/web tool focused on moving from prompts to structured specs, requirements, design, tasks, tests, and implementation. Useful as a reference point for spec-driven development workflows instead of pure vibe coding.

Key ideas: executable specs, EARS-style requirements, steering files, agent hooks, MCP support, autopilot mode.

---

### BytePlus Coding Plan
https://www.byteplus.com/en/activity/codingplan

BytePlus resource/activity page for AI coding plans. Keep as a reference for coding-agent/product positioning and pricing/planning comparisons.

---

## Browser Agents

### Browserbase — browser infrastructure for agents
https://www.browserbase.com/

Browser-as-a-service platform for web agents: hosted browser sessions, search/fetch APIs, authentication, observability, and scalable browser automation.

Related OSS/tools: Browser CLI, Stagehand SDK, Director.

---

### OpenAI Computer Use — API guide
https://developers.openai.com/api/docs/guides/tools-computer-use

OpenAI guide for building agents that operate software through a UI. Covers the `computer` tool loop, screenshots, action execution, Playwright/Selenium/browser harnesses, VM/container setups, and safety guidance for isolated environments.

Key implementation pattern: model requests/returns UI actions → harness executes actions → harness sends updated screenshot → repeat until task completes.

---

## Autonomous Research Agents

> Референс-системы для проектирования своей архитектуры (см. [[External Solutions#From Autonomous Research Stack.md|Autonomous Research Stack]]). Здесь — не-OSS / reading; устанавливаемый код в [[External Solutions#Autonomous Research Systems]].

### Google AI co-scientist — multi-agent генерация гипотез
https://deepmind.google/blog/co-scientist-a-multi-agent-ai-partner-to-accelerate-research/

Multi-agent система на Gemini: generate → debate → evolve гипотез (tournament-стиль с агентами-критиками и Elo-ранжированием). Опубликована в Nature (май 2026). Не open-source; доступ через Hypothesis Generation в Google Labs. Сильный референс для узла «ideation / novelty» и для дизайна review-петли.

---

### The AI Scientist в Nature — что работает и что ломается
https://sakana.ai/ai-scientist-nature/

Разбор архитектуры, результатов масштабирования и провалов полностью автономного ресёрча. Читать перед проектированием своей системы. Код: [[External Solutions#Autonomous Research Systems|AI-Scientist]].

---

### Sakana RL Conductor — RL-trained orchestrator для multi-model routing
https://sakana.ai/learning-to-orchestrate/ · arXiv: 2512.04388

7B модель, обученная через RL быть оркестратором: делит задачу на подзадачи, назначает агентов (GPT-5, Claude Sonnet 4, Gemini 2.5 Pro), определяет access list для каждого. Достигает SOTA на reasoning/coding бенчмарках при ~6× меньших затратах, чем человеко-спроектированные multi-agent pipeline. Продукт: **Sakana Fugu** (commercial, OpenAI-compatible API). **Референс для G5**: самая продвинутая реализация cost-routing — обученная, а не статическая политика. Не open-source.

---

### CASTER — cost-aware strategy routing для multi-agent orchestration
https://arxiv.org/pdf/2601.19793

Context-Aware Strategy for Task Efficient Routing. Снижает inference cost на 72.4% против strong-model baseline при сохранении success rate. Сравнивается с FrugalGPT и heuristic routing. Домены: Software Engineering, Data Analysis, Scientific Discovery, Cybersecurity. **Читать как теоретическую базу под G5** — конкретные алгоритмы выбора модели по контексту задачи. Дополняет cascade-routing papers (2602.21227, 2512.02543) уже известные по gap-анализу.


---

## From Autonomous Research Stack.md

# 🧭 Autonomous Research Stack — MOC

Карта инструментов под цель: **собрать агентную архитектуру для автономного ML/RL-ресёрча** (идея → эксперименты → статья, с минимумом человека в петле).

Три справочника под этой картой:
- [[External Solutions#From Repos.md|Repos]] — GitHub-репы и скиллы (что ставить).
- [[External Solutions#From Resources.md|Resources]] — не-GitHub ресурсы и референс-системы (что читать / иметь в виду).
- Локальный сетап — текущая конфигурация OpenCode / oh-my-openagent / MCP (бывш. `Setup.md`, удалён после консолидации).

> Закрепи (pin) этот файл в Obsidian — он точка входа.

> 💡 Полный idea-generation pass (карта покрытия, гэпы, продукт, разбор по стадиям) → [[Archived Research Sources#From Idea Generation — Autonomous Research Product.md|Idea Generation — Autonomous Research Product]].
>
> 🔬 Harness + Wiki — глубокий разбор → [[Archived Research Sources#From Harness & Wiki Research.md|Harness & Wiki Research]].

---

## Пайплайн автономного ресёрча

```text
                 ┌───────────────┐
                 │ ORCHESTRATION │  backbone: Claude Code/Codex + скиллы | Agent SDK | LangGraph
                 └───────┬───────┘
     ┌───────────┬───────┼───────────┬───────────┐
     ▼           ▼       ▼           ▼           ▼
 LITERATURE → IDEATION → EXPERIMENTS → REVIEW → WRITING
     │           │       │           │           │
     └─────── MEMORY / WIKI (состояние между стадиями) ───────┘
                     INFRA (GPU, serverless)
```

Каждая стадия — узел, который можно автоматизировать отдельным агентом/скиллом. Ниже — чем закрыть каждый узел.

### 1. Literature & grounding
Найти и синтезировать релевантные работы, проверить новизну.
- Скиллы: ARIS `research-lit / arxiv / semantic-scholar / deepxiv / exa / openalex / novelty-check` → [[External Solutions#Research & Paper Writing|ARIS]]
- Deep-research агенты → [[External Solutions#Deep Research / Literature Agents|gpt-researcher, open_deep_research, Tongyi DeepResearch]]
- MCP-поиск: `paper-search`, `fetch` → локальный сетап / MCP Servers.

### 2. Ideation & novelty
Сгенерировать и отсеять гипотезы.
- ARIS `idea-discovery / idea-creator / novelty-check`
- Референс дизайна: [[External Solutions#Autonomous Research Agents|Google co-scientist]] (generate → debate → evolve, Elo-турнир гипотез)

### 3. Experiment planning & implementation
План → код → запуск → сбор результатов.
- ARIS `experiment-plan / experiment-bridge / run-experiment / monitor-experiment / analyze-results`
- ML-инженерные агенты → [[External Solutions#Autonomous Research Systems|AIDE]], [[External Solutions#Research & Paper Writing|autoresearch (Karpathy)]]
- Post-training скиллы → [[External Solutions#Research & Paper Writing|Orchestra (grpo / peft / trl)]]
- Infra → ARIS `vast-gpu / serverless-modal`; мой кластер (`ssh sacflow`) → локальный сетап.

### 4. Review & audit
Адверсариальное рецензирование, аудит фактов и доказательств.
- ARIS `auto-review-loop / paper-claim-audit / citation-audit / proof-checker / kill-argument`
- Методология review-gates → [[External Solutions#Claude Code Skills & Config|superpowers, gstack]]

### 5. Writing & dissemination
LaTeX, фигуры, слайды, постеры, rebuttal, resubmit.
- ARIS `paper-writing / paper-figure / paper-slides / paper-poster / rebuttal / resubmit-pipeline`
- Скиллы письма → [[External Solutions#Claude Code Skills & Config|academic-research-skills]], Orchestra `ml-paper-writing`

### Cross-cutting
- **Orchestration backbone** → [[External Solutions#Agent Frameworks & Personas|Claude Agent SDK / LangGraph / smolagents]]
- **Harness + cost-routing** → [[External Solutions#Open Coding-Agent Harnesses|OpenCode / oh-my-openagent / OpenHands / Goose]]; политика tier → [[Archived Research Sources#Cross-cutting: Cost-Router (G5) — ядро продукта|Cost-Router]]
- **Memory / живая wiki** → [[External Solutions#Knowledge Base & Memory|claude-obsidian, Cognee, STORM, PaperQA2]]; ARIS `research-wiki`; MCP `memory` → локальный сетап / MCP Servers.
- **Persona-агенты** → [[External Solutions#Agent Frameworks & Personas|agency-agents, OpenAgentsControl]]

---

## Референс-архитектуры (изучить перед сборкой)
Готовые автономные системы — разобрать их декомпозицию ролей и где у них рвётся петля:
- [[External Solutions#Autonomous Research Systems|AI-Scientist (+v2), Agent Laboratory, AI-Researcher, freephdlabor, MLR-Copilot]]
- Skill-based, ближе всего к моему стеку → [[External Solutions#Research & Paper Writing|ARIS]] (76 скиллов, adversarial cross-model review).
- `freephdlabor` — единственный позиционируется как конструктор своей команды → стартовая точка, если строить с нуля.
- Что реально ломается в автономном ресёрче → [[External Solutions#Autonomous Research Agents|разбор AI-Scientist в Nature]].

## Где искать новое
- [[External Solutions#Awesome Lists & Meta-Indexes|Awesome-Auto-Research-Tools, Awesome-Deep-Research, awesome-ai-for-science]]

---

## Куда дальше (черновик плана сборки)
1. Выбрать режим: **(а)** адаптировать ARIS под мой стек RL/PyTorch; либо **(б)** собрать с нуля на `freephdlabor` / Claude Agent SDK.
2. Зафиксировать узлы, которые автоматизирую первыми (вероятно literature + experiments — мои bottleneck'и).
3. Определить human-checkpoints и critic/reward для review-петли (ср. с co-scientist debate).

> Это черновик карты, а не план к исполнению — обсудим режим (а)/(б), прежде чем что-то ставить или запускать.
