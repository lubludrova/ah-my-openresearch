---
name: gap-map
description: Map project-grounded research gaps from the amore lab and the user's literature wiki before idea generation. Use when user says "find gaps", "gap analysis", "what should we try next", "what are the open problems", "map opportunities", "research gaps", "identify weak claims", or wants grounded inputs for idea-creator.
argument-hint: <direction-or-scope>
---

# Gap Map

## Purpose

Build a ranked map of research gaps that are grounded in the current project
state.

This skill is for the prospector persona. It reads the amore lab and the user's
literature wiki, identifies under-supported claims, unresolved contradictions,
missing evidence, failed or stalled ideas, and promising bridges between the lab
and the wiki. It returns a compact set of gap candidates that can be handed to
`idea-creator`.

This skill does not generate full research ideas, does not check final novelty,
does not write experiment plans, and does not mutate files by default.

Use this skill before `idea-creator` when the user wants idea generation to start
from evidence rather than from a broad topic.

## Constants

- `<PROJECT_ROOT>`: the current project root.
- `<LAB_ROOT>`: `<PROJECT_ROOT>/lab`.
- `<LAB_INDEX>`: `<LAB_ROOT>/index.md`.
- `<LAB_LOG>`: `<LAB_ROOT>/log.md`.
- `<LAB_EDGES>`: `<LAB_ROOT>/edges.jsonl`.
- `<LAB_DRAFTS>`: `<LAB_ROOT>/drafts`.
- `<WIKI_PATH>`: user-provided literature wiki root.
- `MAX_WIKI_PAGES`: 40 pages per run unless the user asks for a deeper pass.
- `MAX_LAB_DRAFTS`: 60 lab drafts per run unless the user asks for a deeper
  pass.
- `RECENT_LOG_ENTRIES`: 30 most recent log entries.
- `OUTPUT_GAPS`: 5 primary gaps by default.
- `GAP_ID_PREFIX`: transient report IDs `G1`, `G2`, `G3`, ...
- `DEFAULT_MODE`: `focused`.

Do not create persistent `gap:*` node IDs. Gap IDs in this report are temporary
handles for discussion and handoff.

Do not write standalone gap files into `<LAB_ROOT>/drafts`. The lab stores
claims, ideas, and experiments; gaps are analysis outputs that should become
ideas only after `idea-creator`.

## Inputs

Accept any of these input shapes:

```text
<empty>
```

Map gaps across the current lab and nearby wiki context.

```text
<direction>
```

Map gaps for a topic, problem family, method family, benchmark family, or
research direction.

```text
claim:<claim-slug>
```

Map gaps around one existing lab claim.

```text
idea:<idea-slug>
```

Map gaps around one existing lab idea.

```text
experiment:<experiment-slug>
```

Map gaps exposed by one existing lab experiment.

```text
wiki:<path-or-slug>
```

Map gaps around a specific wiki page, section, paper slug, or local wiki area.

```text
mode:quick <direction>
mode:deep <direction>
```

Use `quick` for a narrow scan and `deep` for broader source coverage.

## Process

### Step 0. Read Runtime Contracts

Before interpreting wiki pages, read the user's wiki contract at runtime.

Look for these files under `<WIKI_PATH>`:

1. `RULES.md`
2. `AGENTS.md`
3. `README.md`
4. `ingest_prompt.md`

Use the first explicit schema or workflow instructions you find. If multiple
files exist, prefer direct wiki operating rules over general repository notes. If
no contract exists, proceed with a read-only fallback and state that no wiki
contract was found.

For the lab, read:

1. `<LAB_INDEX>`
2. `<LAB_LOG>`
3. `<LAB_EDGES>`
4. relevant files under `<LAB_DRAFTS>`

If the lab is missing, stop and report that the project lab is not initialized.
Do not invent lab state.

### Step A. Build The Lab Inventory

Read enough lab state to answer:

- Which claims are open, partial, contradicted, stale, or unsupported?
- Which claims have no `tested_by` or equivalent experiment evidence?
- Which ideas are open, rejected, superseded, or blocked?
- Which experiments failed, produced inconclusive results, or left missing
  measurements?
- Which edges connect papers, claims, ideas, and experiments?
- Which expected paths are missing, such as:
  - paper evidence without a claim;
  - claim without an idea;
  - idea without an experiment;
  - experiment without a supported claim;
  - failed experiment without a follow-up idea.

Prefer existing frontmatter fields and edges over free-text inference. When
frontmatter is incomplete, quote or summarize the exact text that supports the
inference.

### Step B. Read Wiki Context

Use the wiki contract to locate relevant literature notes.

Prioritize:

- pages directly linked from lab claims, ideas, or experiments;
- pages matching the user-provided direction;
- pages with explicit open questions, limitations, future work, or critique
  sections;
- pages with contradiction markers, uncertainty markers, or unresolved
  comparisons;
- survey or synthesis pages that summarize several papers;
- method, benchmark, dataset, or metric pages connected to the direction.

When the contract does not define a schema, use a conservative Markdown fallback:

- search Markdown files under `<WIKI_PATH>`;
- avoid obvious archive, trash, private, attachment, and generated-output
  folders;
- prefer files with bibliographic metadata, paper summaries, concept notes, or
  synthesis notes;
- preserve exact paths and section names in anchors.

Extract only evidence-relevant signals:

- stated limitations;
- future work;
- negative results;
- conflicting findings;
- missing evaluations;
- narrow assumptions;
- untested settings;
- weak baselines;
- unclear mechanisms;
- repeated open questions;
- gaps between known methods and the project's claims.

### Step C. Identify Candidate Gaps

Create candidate gaps only when there is at least one concrete anchor from the
lab or wiki.

Use these gap types:

- `evidence_gap`: a claim lacks direct evidence or decisive measurement.
- `evaluation_gap`: existing work uses incomplete metrics, weak baselines,
  narrow settings, or missing comparisons.
- `method_gap`: known methods do not cover a capability needed by the project.
- `mechanism_gap`: results exist, but the explanation or causal mechanism is
  unclear.
- `contradiction_gap`: lab or wiki sources disagree in a way that could be
  resolved.
- `bridge_gap`: two bodies of evidence appear connectable but are not connected
  in the lab.
- `scope_gap`: a claim is plausible only under narrower conditions than
  currently stated.
- `failure_gap`: a failed or inconclusive experiment exposes a more precise
  question.
- `translation_gap`: a known result has not been adapted to the project setting.

Discard candidates that are merely broad topics, fashionable directions, or
unsupported speculation.

### Step D. Merge And Rank

Merge duplicate gaps that point to the same missing evidence or opportunity.

For each remaining gap, assign qualitative ratings:

- `importance`: high / medium / low
- `feasibility`: high / medium / low
- `evidence_readiness`: high / medium / low
- `wiki_support`: high / medium / low
- `risk`: high / medium / low

Use these recommendation labels:

- `seed-now`: good input for `idea-creator` now.
- `read-more`: promising, but the wiki context is too thin.
- `needs-claim`: should first become or revise a lab claim.
- `needs-result`: blocked on an experiment result or analysis.
- `defer`: real gap, but not useful for the current project.
- `discard`: not a real project gap after inspection.

Ranking rule:

1. Prefer gaps with both lab anchors and wiki anchors.
2. Prefer gaps that can become a testable idea.
3. Prefer gaps that expose a weak claim or missing experiment.
4. Prefer gaps whose risk is explicit and bounded.
5. Penalize gaps that require broad literature search before any useful action.

Do not use numeric precision unless the underlying files contain numeric
evidence.

### Step E. Prepare Handoff To Idea Creator

For each `seed-now` gap, include a short handoff block:

```text
idea-creator input:
  gap_id: G<n>
  direction: <short direction>
  target_gaps:
    - <claim-or-gap-anchor>
  motivated_by:
    - wiki:<path-or-slug>
    - claim:<claim-slug>
    - idea:<idea-slug>
    - experiment:<experiment-slug>
  constraints:
    - <known constraint>
  avoid:
    - <already-tried or contradicted approach>
```

Use real lab IDs when available. If no lab ID exists, use source anchors rather
than inventing IDs.

### Step F. Stop Conditions

Stop and report a blocker when:

- `<LAB_ROOT>` does not exist;
- the user asks for file mutation but has not approved a specific write;
- the user asks for novelty against the wider literature rather than against the
  wiki;
- the request requires ingesting new papers before gap mapping.

If the wiki is unavailable, produce a lab-only gap map and label it as limited.

If the lab has no claims, ideas, experiments, or edges, produce a wiki-first
opportunity map and clearly state that it is not project-grounded yet.

## Output Format

Return a Markdown report.

```markdown
# Gap Map Report

Scope: <scope>
Mode: <quick|focused|deep>
Sources read:
- Lab: <counts and key files>
- Wiki: <counts and key files>
Coverage warning: <none|limited because ...>

## Ranked Gaps

### G1 — <gap title>

Type: <gap type>
Recommendation: <seed-now|read-more|needs-claim|needs-result|defer|discard>

Anchors:
- claim:<claim-slug> — <why relevant>
- wiki:<paper-or-page-slug>#<section> — <why relevant>
- experiment:<experiment-slug> — <why relevant>

Why this is a gap:
<one compact paragraph grounded in anchors>

Evidence:
- <what is already known>
- <what the lab or wiki supports>

Missing evidence:
- <what is not yet tested, compared, measured, or explained>

Opportunity:
<what kind of idea this could lead to>

Risks:
- <main risk>
- <known negative evidence or uncertainty>

Ratings:
- importance: <high|medium|low>
- feasibility: <high|medium|low>
- evidence_readiness: <high|medium|low>
- wiki_support: <high|medium|low>
- risk: <high|medium|low>

idea-creator input:
  gap_id: G1
  direction: <short direction>
  target_gaps:
    - <claim-or-gap-anchor>
  motivated_by:
    - wiki:<paper-or-page-slug>
    - claim:<claim-slug>
  constraints:
    - <constraint>
  avoid:
    - <already-tried or weakly supported path>

## Notable Non-Gaps Or Duplicates

- <candidate> — rejected because <reason>.

## Next Actions

1. Run `idea-creator` on <G1/G2/...>.
2. Run `wiki-ingest` or ask librarian for more context on <area> if needed.
3. Run `novelty-vs-wiki` after a concrete idea is selected.

## Handoff Summary

Best gap to seed now: <G1>
Reason: <short reason>
Best gap to defer: <Gx>
Reason: <short reason>
```

## Example Output

```markdown
# Gap Map Report

Scope: <topic>
Mode: focused
Sources read:
- Lab: 7 claims, 4 ideas, 3 experiments, 18 edge records
- Wiki: 12 pages, including <paper-slug>, <survey-slug>, <concept-slug>
Coverage warning: none

## Ranked Gaps

### G1 — Missing causal evidence for <claim-slug>

Type: mechanism_gap
Recommendation: seed-now

Anchors:
- claim:<claim-slug> — states that <method-property> explains <observed-effect>
- experiment:<experiment-slug> — reports <metric> improvement but no mechanism
  test
- wiki:<paper-slug>#limitations — notes that similar effects may come from
  <alternative-explanation>

Why this is a gap:
The lab has a result-facing claim, but the available experiment only measures
outcome quality. The wiki contains an explicit warning that the same outcome can
arise from a different mechanism. This makes the current claim too broad unless
the mechanism is tested or the claim is narrowed.

Evidence:
- <experiment-slug> reports improvement on <metric>.
- <paper-slug> discusses an alternative explanation.
- <concept-slug> defines a measurement that could separate the two explanations.

Missing evidence:
- no ablation that isolates <mechanism>;
- no negative control for <alternative-explanation>;
- no claim revision limiting the scope.

Opportunity:
Create an idea that turns the mechanism ambiguity into a small decisive
experiment or a narrower method contribution.

Risks:
- the mechanism may be false even if the outcome result holds;
- the required measurement may be noisy or expensive.

Ratings:
- importance: high
- feasibility: medium
- evidence_readiness: high
- wiki_support: high
- risk: medium

idea-creator input:
  gap_id: G1
  direction: test the mechanism behind <claim-slug>
  target_gaps:
    - claim:<claim-slug>
  motivated_by:
    - experiment:<experiment-slug>
    - wiki:<paper-slug>
    - wiki:<concept-slug>
  constraints:
    - keep the first experiment small and diagnostic
  avoid:
    - another outcome-only comparison
```

## Examples

### Example 1: Current Project Gap Map

User asks:

```text
Find the strongest gaps in the current project.
```

Do:

1. Read lab index, log, edges, and recent drafts.
2. Read wiki contract and relevant linked wiki pages.
3. Rank gaps with lab and wiki anchors.
4. Return the gap map and `idea-creator` handoff blocks.

Do not write files.

### Example 2: Direction-Scoped Gap Map

User asks:

```text
Map gaps around <topic>.
```

Do:

1. Search lab drafts and edges for `<topic>`.
2. Search wiki pages according to the wiki contract.
3. Cluster missing evidence, contradictions, and bridge opportunities.
4. Return the top gaps that can seed ideas.

Do not broaden into unrelated literature search unless the user asks.

### Example 3: Claim-Focused Gap Map

User asks:

```text
Find gaps around claim:<claim-slug>.
```

Do:

1. Read the claim draft.
2. Follow edges to papers, ideas, and experiments.
3. Identify unsupported scope, missing controls, missing comparisons, and
   contradictory wiki notes.
4. Recommend whether the next step is `idea-creator`, `research-refine`, or more
   wiki ingestion.

### Example 4: Wiki-Only Opportunity Map

User asks:

```text
Use wiki:<paper-slug> to find project opportunities.
```

Do:

1. Read the wiki contract.
2. Read the target page and linked synthesis pages.
3. Extract limitations and open questions.
4. Check whether the lab already has related claims or ideas.
5. Return opportunities, but label them as weakly project-grounded if lab
   anchors are missing.

## Anti-patterns

- Do not invent gaps without lab or wiki anchors.
- Do not treat a broad topic as a gap.
- Do not create `gap:*` node IDs.
- Do not write `lab/drafts/gap-*.md`.
- Do not silently mutate lab files or wiki files.
- Do not run full idea generation inside this skill.
- Do not declare an idea novel; use `novelty-vs-wiki` after an idea exists.
- Do not hard-code wiki folders, frontmatter fields, or page schemas.
- Do not ignore the user's wiki contract.
- Do not use source counts as a substitute for evidence quality.
- Do not hide missing coverage. If the scan is limited, state the limit.
- Do not pad the report with generic gaps that cannot seed concrete ideas.
- Do not recommend experiments directly unless the missing evidence is already
  specific enough; otherwise hand off to `idea-creator` or `research-refine`.
- Do not write persistent outputs unless the user explicitly approves the
  destination and content.

## Related

- Prospector persona: `src/agents/prospector.ts`
- Skill catalog: `design/Skill Catalog.md`
- Product decisions: `design/Product Design.md`
  - D7: persona-scoped skill surface
  - D19: lab vs wiki separation
  - D21: lab draft schema
  - D23: edge records
- Upstream inspiration:
  - ARIS `idea-creator`: landscape survey, structural gaps, brainstorm
    filtering, validation
  - ARIS `research-lit`: paper analysis, gap synthesis, wiki update discipline
  - claude-scholar `research-ideation`: gap analysis and research-question
    formulation
  - AutoResearchClaw synthesis stages: topic clusters, research gaps, hypothesis
    generation
- Follow-on amore skills:
  - `idea-creator`
  - `novelty-vs-wiki`
  - `research-refine`
  - `experiment-plan`
- Related wiki skills:
  - `wiki-ingest`
  - `wiki-lint`
