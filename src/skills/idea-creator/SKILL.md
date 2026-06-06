---
name: idea-creator
description: Generate and rank project-grounded research idea candidates from a gap, claim, open question, or research direction. Use when user says "generate ideas", "brainstorm ideas", "idea generator", "what can we work on", "turn this gap into ideas", "find research ideas", or wants candidate hypotheses before novelty-vs-wiki, research-refine, or experiment-plan.
argument-hint: <gap-id-or-direction>
---

# Idea Creator

## Purpose

Generate 2-5 concrete research ideas grounded in the amore lab and the user's
literature wiki.

This skill is for the prospector persona. It turns a gap-map result, claim,
wiki anchor, experiment result, open question, or bounded direction into
falsifiable idea candidates. Each idea must state the target gap, hypothesis,
mechanism, cheapest decisive test, support criteria, falsification criteria,
and likely reviewer objection.

This is not a literature-search workflow and not a final novelty check. It may
read lab and wiki context, but deep paper discovery belongs to librarian-facing
skills. Use `novelty-vs-wiki` after concrete ideas survive first-pass filtering.

Default output is a report only. Write `lab/drafts/idea-<slug>.md` only after
explicit user approval.

## Constants

- `<PROJECT_ROOT>`: current project root.
- `<LAB_ROOT>`: `<PROJECT_ROOT>/lab`.
- `<LAB_INDEX>`: `<LAB_ROOT>/index.md`.
- `<LAB_LOG>`: `<LAB_ROOT>/log.md`.
- `<LAB_EDGES>`: `<LAB_ROOT>/edges.jsonl`.
- `<LAB_DRAFTS>`: `<LAB_ROOT>/drafts`.
- `<WIKI_PATH>`: user-provided literature wiki root.
- `MAX_WIKI_PAGES`: 30 unless deep mode is requested.
- `MAX_LAB_DRAFTS`: 60 unless deep mode is requested.
- `RECENT_LOG_ENTRIES`: 30.
- `BRAINSTORM_CANDIDATES`: 8-12 internal candidates.
- `OUTPUT_IDEAS`: 2-5 ranked ideas.
- `REFLECTION_ROUNDS`: 2.
- `SCHEMA_VERSION`: `v1.0`.
- `DEFAULT_MODE`: `focused`.

Use qualitative ratings unless the files contain measured evidence.

## Inputs

Accepted input shapes:

```text
<direction>
G1
G1 from the last gap-map
claim:<claim-slug>
idea:<idea-slug>
experiment:<experiment-slug>
wiki:<path-or-slug>
save selected: I1, I3
mode:quick <input>
mode:deep <input>
```

Interpretation:

- `<direction>`: generate ideas for a bounded research direction.
- `G<n>`: generate ideas from a current conversation gap-map entry.
- `claim:<claim-slug>`: generate ideas that test, narrow, or replace a claim.
- `idea:<idea-slug>`: generate variants, pivots, or successors.
- `experiment:<experiment-slug>`: generate follow-ups from results or failure.
- `wiki:<path-or-slug>`: generate ideas from one wiki anchor.
- `save selected`: write already-present report items to lab drafts.
- `quick`: narrow pass; `deep`: broader lab/wiki coverage.

If the direction is too broad, stop and ask for a narrower scope. A usable
direction should name at least two of: problem, mechanism, task/setting,
constraint, target claim, evaluation angle, source paper, or wiki area.

## Process

### Step 0. Read Contracts

Read the lab context:

1. `<LAB_INDEX>`
2. `<LAB_LOG>` last `RECENT_LOG_ENTRIES`
3. `<LAB_EDGES>`
4. `<LAB_ROOT>/SCHEMA.md`
5. relevant files under `<LAB_DRAFTS>`

If the lab exists but `<LAB_ROOT>/SCHEMA.md` is missing, proceed using the
standard amore idea schema and report the missing runtime schema.

Read the wiki contract before interpreting wiki pages. Look under `<WIKI_PATH>`
for:

1. `AGENTS.md`
2. `CLAUDE.md`
3. `README.md`
4. `ingest_prompt.md`

Use explicit wiki rules when present. If no contract exists, use a read-only
Markdown fallback and say the wiki contract was missing.

If `<LAB_ROOT>` is missing, stop. Do not invent lab state.

### Step A. Resolve The Seed

Classify the input:

- `gap_seed`: `G<n>` from `gap-map`.
- `claim_seed`: a lab claim that needs ideas.
- `idea_seed`: an existing idea that needs variants or a successor.
- `experiment_seed`: an experiment needing follow-up.
- `wiki_seed`: a wiki page or section.
- `direction_seed`: a bounded direction.
- `save_request`: request to write selected report items.

For `save_request`, do not regenerate ideas. Save only if selected items are
unambiguous and approved.

### Step B. Build Seed Context

From the lab, extract:

- relevant claims and statuses;
- open, weak, partial, contradicted, or unsupported claims;
- related ideas and whether they are open, selected, rejected, or superseded;
- related experiments and outcomes;
- known dead ends from logs and rejected ideas;
- edges connecting claims, ideas, and experiments;
- user or lab constraints.

From the wiki, extract:

- relevant paper, concept, and synthesis pages;
- limitations, future work, and open questions;
- contradictions across sources;
- baselines, datasets, metrics, and settings;
- source anchors usable in idea drafts.

Prefer pages linked from the seed and pages identified by the wiki contract.
Do not scan the whole wiki unless deep mode is requested.

### Step C. Build The Banlist

Do not regenerate:

- existing `idea:*` drafts with the same mechanism or target gap;
- rejected or superseded ideas unless revival is requested;
- ideas contradicted by completed experiments;
- routine "apply X to Y" transfers with no new mechanism or diagnostic;
- ideas requiring unavailable data, resources, or permissions;
- routine benchmark comparisons without a claim;
- ideas already covered by the wiki or lab.

Mention banlist items in the report when they affect ranking.

### Step D. Generate Candidates

Generate 8-12 internal candidates, then filter down to 2-5.

Each internal candidate must have:

- temporary ID `C1`, `C2`, ...
- title and one-sentence summary;
- target gaps and motivating anchors;
- falsifiable hypothesis;
- proposed mechanism;
- minimal decisive test;
- support and falsification criteria;
- baselines or controls;
- metrics;
- expected contribution type;
- risk, effort, and novelty-risk estimate against current lab/wiki context.

Use varied patterns:

- mechanism test;
- targeted method improvement;
- negative-result diagnostic;
- contradiction resolver;
- scope narrowing;
- bridge between two lab/wiki areas;
- follow-up to failed experiment;
- benchmark or metric correction;
- ablation-driven idea;
- theory-to-practice translation.

Do not show the raw brainstorm unless the user asks.

### Step E. Critique And Refine

Run two internal reflection passes.

Quality filter:

- Is it grounded in the seed?
- Is it falsifiable?
- Is the minimal test concrete?
- Would a negative result teach something?
- Is it distinct from existing lab ideas?
- Is it distinct from known wiki sources?
- Is the evidence realistically obtainable?
- Is the contribution more than routine transfer?

Refinement pass:

- narrow the claim scope;
- sharpen the mechanism;
- replace vague tests with decisive measurements;
- add missing baselines or controls;
- state the strongest reviewer objection;
- state the most likely failure mode;
- downgrade ratings when evidence is thin.

Kill weak candidates rather than polishing them.

### Step F. Rank Ideas

Rate surviving ideas:

- `importance`: high / medium / low
- `novelty_risk`: low / medium / high / unknown
- `feasibility`: high / medium / low
- `evidence_readiness`: high / medium / low
- `testability`: high / medium / low
- `strategic_fit`: high / medium / low
- `overall`: strong / promising / weak / reject

Ranking priorities:

1. Real lab gap or weak claim.
2. Both lab and wiki anchors.
3. Cheap decisive test.
4. Positive and negative outcomes are both informative.
5. Bounded novelty risk.
6. No broad new literature search required before useful action.

Do not call an idea novel. Say "novelty risk appears low against current
lab/wiki context" when appropriate.

### Step G. Report

Return a Markdown report. Do not write files unless Step H applies.

Each recommended idea must route to one next step:

- `novelty-vs-wiki`: concrete idea, overlap risk remains.
- `research-refine`: promising idea, method still rough.
- `experiment-plan`: accepted and already concrete.
- `save-draft`: user explicitly requested a lab draft.
- `discard`: should not continue.

### Step H. Optional Lab Drafts

Only write idea drafts when the user explicitly asks to save selected ideas.

For each selected idea:

1. Create `<LAB_DRAFTS>/idea-<slug>.md`.
2. Use `node_id: idea:<slug>`.
3. Use `status: open` unless the user says `selected`.
4. Include `hypothesis`, `target_gaps`, `motivated_by`, and
   `planned_experiments`.
5. Include provenance sources using the lab schema.
6. Append a `draft` action entry to `<LAB_LOG>`.
7. Add `addresses_gap` edges only when supported by current lab contract.
8. Do not write to the literature wiki.

Minimal draft frontmatter:

```yaml
schema_version: v1.0
type: idea
node_id: idea:<slug>
title: "<idea title>"
created: <YYYY-MM-DD>
updated: <YYYY-MM-DD>
tags: []
provenance:
  sources:
    - wiki:<paper-or-page-slug>
  experiments: []
  commits: []
domain: {}
status: open
hypothesis: "<one-sentence falsifiable hypothesis>"
target_gaps:
  - claim:<claim-slug>
motivated_by:
  - wiki:<paper-or-page-slug>
  - claim:<claim-slug>
planned_experiments: []
```

Draft body sections:

- `Summary`
- `Hypothesis`
- `Motivation`
- `Minimal Decisive Test`
- `Support Criteria`
- `Falsification Criteria`
- `Baselines Or Controls`
- `Metrics`
- `Risks`
- `Next Step`

If a selected idea has no valid lab or wiki anchor, do not write it. Ask whether
to keep it as a speculative note outside the lab or gather evidence first.

## Output Format

Use this report shape. Keep it compact unless the user asks for raw candidates
or full draft text.

```markdown
# Idea Creator Report

Scope: <input scope>
Mode: <quick|focused|deep>
Seed type: <gap_seed|claim_seed|idea_seed|experiment_seed|wiki_seed|direction_seed>
Sources read:
- Lab: <counts and key files>
- Wiki: <counts and key files>
Coverage warning: <none|limited because ...>

## Seed Context

Target:
- <gap, claim, idea, experiment, wiki page, or direction>

Banlist:
- <existing idea or dead end> - <why not repeat>

## Ranked Ideas

### I1 - <idea title>

Decision: <novelty-vs-wiki|research-refine|experiment-plan|save-draft|discard>
Overall: <strong|promising|weak|reject>

Summary:
<one compact paragraph>

Target gaps:
- <claim:<slug>|G<n>|wiki:<path-or-slug>>

Motivated by:
- <wiki:<path-or-slug>> - <reason>
- <claim:<slug>> - <reason>

Hypothesis:
<one sentence>

Mechanism:
<why this might work or what it would reveal>

Minimal decisive test:
<smallest test that gives useful signal>

Test contract:
- support: <result that supports the idea>
- falsify: <result that weakens or rejects the idea>
- baselines_or_controls: <minimum comparison set>
- metrics: <measurements>

Ratings:
- importance / novelty_risk / feasibility / evidence_readiness / testability /
  strategic_fit: <high|medium|low|unknown as applicable>

Objection and failure mode:
<strongest objection; most likely failure mode>

Next step:
<what to do next and which skill to use>

## Eliminated Ideas

| Candidate | Reason eliminated |
|---|---|
| <title> | <duplicate, infeasible, weak test, no anchor, routine application, etc.> |

## Suggested Execution Order

1. <I1> - <reason>
2. <I2> - <reason>

## Save Instructions

If drafts are wanted, ask for approval to save selected items as
`lab/drafts/idea-<slug>.md`. No files were written unless explicitly stated.
```

## Examples

- `Generate ideas from G1 and G3.` - ground ideas in those gap-map entries.
  Return a report only unless the user asks to save selected items.
- `Create ideas for claim:<claim-slug>.` - read the claim, follow lab edges,
  read motivating wiki pages, and generate ideas that support, falsify, narrow,
  or replace the claim.
- `Save I1 and I3.` - do not regenerate. Create approved idea drafts, append
  `lab/log.md`, and return created paths and node IDs.

## Anti-patterns

- Do not generate generic ideas from a broad topic label.
- Do not produce 10 weak ideas when 2 strong ideas are enough.
- Do not call an idea novel; use `novelty-vs-wiki`.
- Do not run deep literature search inside this skill.
- Do not write to the literature wiki.
- Do not write lab drafts unless explicitly requested.
- Do not create idea drafts without lab or wiki anchors.
- Do not create claim drafts or experiment drafts.
- Do not put `confidence`, `tested_by`, `supports`, or `contradicts` on idea
  frontmatter.
- Do not invent `claim:*`, `idea:*`, or `exp:*` IDs for sources that do not
  exist.
- Do not use rejected or superseded ideas as positive evidence.
- Do not hide duplicate risks.
- Do not turn a vague hypothesis into a polished draft; route to
  `research-refine`.
- Do not recommend an experiment if support and falsification criteria are
  unclear.
- Do not silently change lab files or wiki files.

## Related

- Prospector persona: `src/agents/prospector.ts`
- Previous skill: `gap-map`
- Follow-on skills:
  - `novelty-vs-wiki`
  - `research-refine`
  - `experiment-plan`
- Related wiki skills:
  - `wiki-ingest`
  - `wiki-lint`
- Product decisions: `design/Product Design.md`
  - D7: persona-scoped skill surface
  - D12: identifier rules
  - D19: lab vs wiki separation
  - D21: idea frontmatter schema
  - D23: edge records
- Upstream inspiration:
  - ARIS `idea-creator`: landscape, brainstorm, filtering, ranking
  - ARIS `idea-discovery`: pipeline placement
  - AutoResearchClaw `IdeaWorkshop`: brainstorm, evaluate, refine, select
  - AI-Scientist idea generation: archive, reflection, structured ratings
  - claude-scholar `research-ideation`: evidence gate and falsification
  - freephdlabor ideation prompt: constraints, baselines, metrics
