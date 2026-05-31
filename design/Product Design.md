# Product Design — omo-research

> Status: draft, iterating. Canonical product-design note.
> Context: [[Archived Research Sources]], [[External Solutions]], [[Skill Catalog]].

## 1. Product Brief

**One-liner:** omo-like research team for OpenCode/Codex: research personas + skills + living Obsidian wiki, with cost-aware routing and RL as the first serious domain pack.

**For whom:** a researcher who works in coding-agent CLIs, keeps knowledge in Obsidian, runs ML/RL experiments, and wants research context to compound across sessions.

**Pain:** existing systems forget personal context, overclaim weak evidence, use one expensive model everywhere, or write summaries instead of evidence-linked claim records.

**Not this:**
- Not a new research platform from scratch.
- Not a replacement for ARIS, claude-scholar, or oh-my-openagent.
- Not a fully autonomous scientist without human judgement.
- Not a generic note-taking system; the core object is the research claim with provenance.

## 2. Current Thesis

**Core idea:** build the research analogue of oh-my-openagent: a small team of named research personas on top of OpenCode/Codex, backed by reusable skills and a persistent wiki.

**Differentiators:**
- **G5 cost-routing per node:** cheap models for grounding/search/formatting/routine code; frontier models for hard judgement, review, novelty, and writing.
- **G2/G7 claim-level human-vetoed Obsidian wiki:** draft claims carry sources, experiments, commits, status, contradictions, and human approval state.
- **G6 domain packs, RL first:** generic core plus domain extensions for venues, taxonomy, claim schema, templates, and optional skills/personas.

**Product principle:** ship the smallest loop that compounds knowledge:

```text
research request -> literature grounding -> claim draft
  -> contradiction / provenance checks -> human review -> canon wiki
```

Everything else should connect to that loop rather than create parallel state.

## 3. Decisions

| ID | Question | Decision | Status |
|---|---|---|---|
| D1 | Form factor | omo-first: OpenCode/oh-my-openagent now; LangGraph only if routing/state need it. | Done |
| D2 | Current product scope | `orchestrator + librarian + literature + wiki`. | Done |
| D3 | Domain stance | Generic core with explicit domain-extension layer; RL first. | Done |
| D4 | Product name | `omo-research`, `research-os`, `wiki-research`, or other. | Open |
| D5 | Distribution | OpenCode plugin, standalone repo, or hybrid installer/template. | Open |
| D6 | Persona set | 6 front-door personas: `orchestrator`, `librarian`, `prospector`, `coder`, `council`, `writer`. | Done |
| D7 | Wiki stack | Obsidian + ARIS research-wiki ideas + Obsidian/Zotero MCP + human-veto workflow. | Provisional |
| D8 | First new build artifact | Ingest-time contradiction checker on local semantic memory. | Done |
| D9 | Skill strategy | [[Skill Catalog]] is the detailed source of truth. | Done |
| D10 | Auto-flag behavior | Flagged claims go to drafts with evidence; flags do not block human review alone. | Open |
| D11 | Inter-persona state | File conventions for drafts, critique, claims, results, handoff summaries. | Open |

## 4. Product Scope

**Current scope:** `orchestrator + librarian + literature + wiki`.

**In scope:**
- Intake and dispatch through `orchestrator`.
- Literature search/synthesis through `librarian`.
- Claim extraction into a strict schema.
- Draft writes into Obsidian-compatible storage.
- Human-veto path from draft to canon.
- Contradiction flags against existing supported claims.
- RL-aware fields through a domain pack, not hardcoded core logic.

**Out of scope for the current loop:**
- Autonomous experiment implementation and runs.
- Ideation tournaments and co-scientist-style debate.
- Full paper writing.
- Automatic cheap-to-frontier escalation.
- Long-running resumable graph execution.
- Rebuttal, slides, posters, and derivative writing workflows.

**Demo scenario:**

```text
User asks a research question
  -> orchestrator normalizes and routes
  -> librarian searches papers / Zotero / local wiki
  -> librarian extracts atomic claims
  -> system writes draft claim files
  -> system flags potential contradictions
  -> human reviews, edits, approves, or rejects
```

Success means useful structured knowledge enters the wiki without silently polluting canon.

## 5. System Architecture

**Runtime:** OpenCode/Codex/Claude Code as the host agent loop, with oh-my-openagent-style personas and markdown skills.

**State:**
- **Human-readable wiki:** paper notes, concept pages, maps of content, synthesis pages.
- **Machine-readable claim ledger:** atomic claims, evidence, status, contradictions, experiment/code provenance.
- **Draft area:** all agent-written changes land here first.
- **Canon:** human-approved wiki/claim state.

**Upgrade path:** LangGraph only if prompt-level orchestration stops being enough: conditional escalation, typed state transitions, durable interrupts, or multi-day resumability.

**Current flow:**

```text
orchestrator (intake)
  -> librarian (lit-search -> claim-extract -> draft write -> checks)
  -> human review
  -> canon wiki / claim ledger
```

**Full research-cycle flow:**

```text
orchestrator
  -> librarian (literature)
  -> prospector (idea + plan)
  -> coder (implementation + run via OpenCode/ACP)
  -> prospector (raw results -> claim drafts)
  -> librarian (claim ingest -> drafts)
  -> council (optional critique)
  -> human review
  -> writer (paper from canon claims)
```

**Pattern sources:** oh-my-openagent for persona/model-map; ARIS for research skills and audits; AutoResearchClaw for ACP routing; claude-obsidian/obsidian-wiki for Obsidian memory; basic-memory for local semantic checks; co-scientist for later ideation patterns.

## 6. Personas

**Active now:** `orchestrator`, `librarian`.

**Designed for the full cycle:** `prospector`, `coder`, `council`, `writer`.

| Persona | Role | Stage | Tier |
|---|---|---|---|
| `orchestrator` | Intake, routing, handoff summary, next actions. | Cross-cutting | cheap |
| `librarian` | Literature search, claim extraction, wiki custody, schema/edge maintenance. | Literature + wiki | midtier |
| `prospector` | Ideation, experiment planning, result interpretation. | Ideas + plans + analysis | frontier |
| `coder` | Implementation and runs through host CLI / ACP. | Experiment implementation | cheap |
| `council` | Multi-model critique, consensus, adversarial review. | Critique | mixed |
| `writer` | Paper narrative, LaTeX, figures, final review. | Writing | frontier |

**Tier convention:** cheap for routing/extraction/formatting/routine code; midtier for robust literature/ingest/synthesis; frontier for scientific taste, novelty, hard critique, and writing. One persona maps to one tier by default. Individual skills may declare a *minimum* required tier lower than their owner persona's tier (e.g., `git-stage-commit`, `latex-compile` are mechanical and need only cheap) — the persona invokes them at its own tier, which always satisfies that minimum.

## 7. Wiki / Claim Contract

This is the central product contract.

### Human-readable wiki vs machine-readable claim ledger

The Obsidian wiki should stay pleasant to read. The claim ledger should carry machine-checkable state: atomic claims, evidence, contradictions, status, and provenance.

Recommended direction:
- Keep paper/concept/MoC pages human-readable.
- Store atomic claims separately or in a clearly separated claim area.
- Link human pages to claim records when useful.
- Never let agent-generated drafts become canon silently.

### Draft -> review -> canon

```text
agent draft -> schema validation -> contradiction/provenance flags
  -> human review -> canon claim or rejected/invalidated tombstone
```

Drafts may be incomplete. Canon must be reviewed.

### Claim schema

```yaml
schema_version: v1.0
type: claim
node_id: claim:<stable_id>
title: "<short claim title>"
status: open              # open | supported | partial | invalidated
confidence: low           # low | medium | high
tags: []
provenance:
  sources: []
  experiments: []
  commits: []
contradicts: []
supports: []
tested_by: []
domain: {}
```

Domain packs extend `domain:`. RL fields can include environment, algorithm, reward components, seeds, baselines, and learning-curve evidence.

### Human-veto behavior

The human approval gate is the trust boundary. Agents may draft, flag, summarize, and recommend; they do not mark claims as canon-supported without review.

Approval surface is still open: git diff/commit, `/approve-claim <id>`, Obsidian review queue, or a hybrid.

### Contradiction flag behavior

Contradiction checks flag, not block. A flagged claim stays reviewable and gets extra metadata:

```yaml
potential_contradicts:
  - node_id: claim:<existing_claim>
    reason: "<short reason>"
    evidence: "<source/result that triggered the flag>"
```

## 8. Domain Extension

The core is domain-agnostic. A domain pack adds config, schema extensions, templates, and optional skills/personas.

| Layer | RL example | Location |
|---|---|---|
| Venues / sources | RLC, NeurIPS-RL, ICLR-RL, AAMAS, RSS, CoRL | `config/domains/rl/venues.yaml` |
| Taxonomy / tags | `rl/value-based`, `rl/policy-grad`, `rl/grpo`, `env/atari` | `config/domains/rl/taxonomy.yaml` |
| Claim-schema extension | `experiment.env`, `experiment.algo`, `experiment.reward_components`, `experiment.seeds_n` | `config/domains/rl/claim_schema.yaml` |
| Novelty/query templates | GRPO, PPO baselines, DeepSeek-R1 comparisons | `config/domains/rl/templates/` |
| Optional skills | `reward-design-critic`, `seed-variance-check`, `learning-curve-audit` | `skills/domains/rl/` |
| Optional personas | `reward-architect`, `env-critic` | `personas/domains/rl.yaml` |

Activation: global `~/.config/omo-research/domain: rl`, per-project `.omo-research/domain: rl`, or generic mode with no active domain.

## 9. Skill Strategy

Do not duplicate the full skill map here. [[Skill Catalog]] owns persona-to-skill mapping, priorities, and external sources.

**Current bundle summary:** `paper-search`, `wiki-ingest`, `edges-update`, `schema-validate`, `obsidian-draft-write`, `git-stage-commit`, `zotero-sync`, `claim-extract`, `contradiction-check`, `intake-dispatch-summary`.

**New skills to write from scratch:**
- `intake-dispatch-summary`: route user intent to persona, stage, output contract, and next actions.
- `claim-extract`: emit omo-research claim frontmatter with provenance, status, confidence, contradictions, and domain fields.
- `contradiction-check`: retrieve similar supported claims locally and write `potential_contradicts`.
- `novelty-vs-wiki`: check personal canon before external literature search.
- `seed-variance-check`: RL-specific result checker for seed sensitivity and claim strength.
- `domain-load`: load domain config without changing core personas.

## 10. Roadmap

**Design next:**
- Resolve D4 product name and D5 distribution shape.
- Resolve D10 auto-flag behavior and D11 inter-persona state.
- Finalize the wiki/claim contract against the existing `~/RL-Wiki` shape.

**Build next:**
- Product scaffold for personas, config, and draft/canon conventions.
- `claim-extract` and `intake-dispatch-summary`.
- `contradiction-check` after draft/canon state is fixed.

**Then connect the full cycle:** `prospector` for ideation/planning, `coder` for implementation/runs, `council` for critique, `writer` for papers from canon claims.

## Appendix: Decision Rationale

**D1 form factor:** start with an omo-style plugin/skill layer because the local stack already has OpenCode, oh-my-openagent, and ARIS skills. LangGraph stays as the upgrade path for typed state, conditional escalation, interrupts, and long resumable runs.

**D2 scope:** choose `orchestrator + literature + wiki` because the wiki loop is the differentiator. A full end-to-end loop would show more stages but make each shallow.

**D3 domain stance:** RL-first hardcoding is too narrow; pure generic ML loses the RL advantage. Use generic core plus domain packs.

**D6 persona set:** six front-door personas cover the lifecycle without hidden roles: `orchestrator`, `librarian`, `prospector`, `coder`, `council`, `writer`.

**Risks noted:** prospector context overload; librarian search/ingest split; council transparency; schema versioning; static cost-routing before automatic escalation; no standalone analyst/auditor until the workload justifies them.
