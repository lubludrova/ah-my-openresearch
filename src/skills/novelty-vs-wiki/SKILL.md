---
name: novelty-vs-wiki
description: Check whether a proposed research idea is distinct from the existing amore lab and the user's literature wiki before refinement or experiment planning. Use when user says "novelty check", "check this idea against the wiki", "is this already covered", "is this idea new", "compare idea to lab", "does this duplicate prior work", "run council on novelty", or wants a wiki-first novelty verdict before research-refine or experiment-plan.
argument-hint: <idea-ref-or-description>
---

# Novelty Vs Wiki

Idea under check: $ARGUMENTS

## Purpose

Check whether a proposed idea is meaningfully distinct from what is
already present in the project lab and the user's literature wiki.

This skill is for the prospector persona. It is a wiki-first novelty
gate, not a broad literature-search workflow. It reads the amore lab,
reads the user's wiki contract, retrieves relevant wiki pages, compares
the idea against existing claims, ideas, experiments, and wiki canon,
then returns a verdict with evidence.

Default output is a report only. Do not write lab or wiki files. If the
idea is promising, recommend `research-refine` or `experiment-plan`. If
the check is uncertain or high-stakes, use the Council Escalation Gate.

## Constants

- `<PROJECT_ROOT>`: current project root.
- `<LAB_ROOT>`: `<PROJECT_ROOT>/lab`.
- `<LAB_INDEX>`: `<LAB_ROOT>/index.md`.
- `<LAB_LOG>`: `<LAB_ROOT>/log.md`.
- `<LAB_SCHEMA>`: `<LAB_ROOT>/SCHEMA.md`.
- `<LAB_EDGES>`: `<LAB_ROOT>/edges.jsonl`.
- `<LAB_DRAFTS>`: `<LAB_ROOT>/drafts`.
- `<WIKI_PATH>`: user-provided literature wiki root.
- `RECENT_LOG_ENTRIES`: 30.
- `MAX_WIKI_CANDIDATES`: 12.
- `MAX_WIKI_FULL_READS`: 5.
- `MAX_LINK_HOPS`: 1.
- `DEFAULT_MODE`: `standard`.

Use qualitative ratings unless the files contain measured evidence.

## Inputs

Accepted input shapes:

```text
<idea description>
idea:<idea-slug>
claim:<claim-slug>
G1 from the last gap-map
I2 from the last idea-creator report
wiki:<path-or-slug>
mode:quick <input>
mode:deep <input>
council:optional <input>
council:required <input>
```

Interpretation:

- `<idea description>`: check the pasted idea directly.
- `idea:<idea-slug>`: read the lab idea draft and check it.
- `claim:<claim-slug>`: check whether an idea implied by the claim is
  already covered.
- `G<n>`: check a candidate direction from the latest gap-map report.
- `I<n>`: check a candidate from the latest idea-creator report.
- `wiki:<path-or-slug>`: check an idea anchored to a wiki page.
- `quick`: lab index + wiki index/frontmatter pass only.
- `deep`: broader lab/wiki retrieval; still wiki-first.
- `council:optional`: run the gate if normal triggers fire.
- `council:required`: prepare or invoke council even if confidence is high.

If the idea is too vague to compare, stop and ask for a narrower idea.
A checkable idea should name at least three of: problem, mechanism,
intervention, setting, metric, expected contribution, target claim, or
source anchor.

## Process

### Step 0. Read Contracts

Read lab context first:

1. `<LAB_INDEX>`
2. `<LAB_LOG>` last `RECENT_LOG_ENTRIES`
3. `<LAB_SCHEMA>`
4. `<LAB_EDGES>` if present
5. relevant files under `<LAB_DRAFTS>`

If `<LAB_ROOT>` is missing, stop. Do not invent lab state.

Read the wiki contract before interpreting wiki pages. Look under
`<WIKI_PATH>` for:

1. `RULES.md`
2. `AGENTS.md`
3. `README.md`
4. `ingest_prompt.md`

Use explicit wiki rules when present. If no contract exists, use a
read-only Markdown fallback and say the wiki contract was missing.
Contract rules control page layout, index location, link style,
frontmatter, log conventions, and uncertain markers. Do not hard-code a
wiki schema.

### Step A. Resolve The Idea

Classify the input:

- `idea_ref`: an existing lab idea.
- `claim_ref`: a lab claim that implies a candidate idea.
- `gap_ref`: a gap-map item from conversation context.
- `report_ref`: an idea-creator item from conversation context.
- `wiki_ref`: a wiki page or section anchor.
- `freeform`: pasted idea text.

For `idea_ref`, read the full idea draft and extract title, hypothesis,
target gaps, motivating refs, planned experiments, status, and
uncertainty markers.

For `freeform`, preserve the user's wording. Do not silently strengthen
the idea before checking novelty.

### Step B. Extract Novelty Elements

Break the idea into 3-7 novelty-critical elements:

| Element | Question |
|---|---|
| Problem | What specific problem or failure mode is targeted? |
| Mechanism | What causal or technical mechanism is proposed? |
| Intervention | What method, design, or change is introduced? |
| Setting | Where is it expected to apply? |
| Measurement | What metric, test, or outcome would show value? |
| Contribution | What would be new if this worked? |
| Scope | What cases are excluded or uncertain? |

Mark missing elements as `[?]`. Missing elements lower confidence; they
do not automatically make the idea non-novel.

### Step C. Lab Overlap Pass

Search the lab before the wiki. Use `<LAB_INDEX>` and `<LAB_EDGES>` to
build candidates, then full-read only relevant drafts.

Check:

- open, selected, rejected, and superseded `idea:*` drafts;
- `claim:*` drafts matching the same problem, mechanism, setting, or
  expected result;
- `exp:*` drafts that already tested the idea or a close variant;
- graph links such as `extends`, `addresses_gap`, `inspired_by`,
  `tested_by`, `supports`, and `contradicts`;
- recent log entries for dead ends, rejected ideas, failed runs, or
  handoffs not yet reflected in the index.

Classify each lab candidate:

| Label | Meaning |
|---|---|
| `exact-duplicate` | Same mechanism and same target problem. |
| `strong-partial` | Same central mechanism or contribution, with limited delta. |
| `same-problem-different-mechanism` | Same problem, materially different idea. |
| `same-mechanism-different-setting` | Same method pattern, different setting. |
| `already-tested` | Existing experiment covers the decisive test. |
| `contradicted` | Existing evidence weakens the idea. |
| `weak-context` | Related but too vague to decide. |

### Step D. Wiki Retrieval Pass

Search the literature wiki using the contract-derived layout. Use cheap
retrieval first:

1. Read wiki index or inventory files declared by the contract.
2. Search page titles, aliases, tags, first-line summaries, and
   frontmatter.
3. Search relevant sections around matched terms.
4. Full-read only the top `MAX_WIKI_FULL_READS` pages.
5. Follow at most `MAX_LINK_HOPS` hop of relevant wikilinks when needed.

Do not scan the whole wiki unless deep mode is requested.

For each candidate wiki page, extract:

- paper/concept/page slug;
- summary or first-line claim;
- relevant section;
- open questions or gaps;
- limitations, future-work notes, and contradiction markers;
- source freshness if the wiki provides dates;
- whether the page supports, weakens, or contextualizes the idea.

If wiki coverage is thin, say so. A thin wiki does not prove novelty.

### Step E. Compare Elements

Build a compact element overlap matrix:

```markdown
| Element | Lab overlap | Wiki overlap | Delta | Risk |
|---|---|---|---|---|
| Problem | <node/page or none> | <page or none> | <what differs> | low/medium/high |
| Mechanism | <...> | <...> | <...> | <...> |
| Intervention | <...> | <...> | <...> | <...> |
```

A delta is defensible only if it changes at least one load-bearing
element: mechanism, intervention, measurement, or scope. Merely changing
wording is not a delta.

### Step F. Score And Decide

Assign qualitative ratings:

| Rating | Values |
|---|---|
| Overlap risk | low / medium / high |
| Delta clarity | clear / partial / vague / absent |
| Evidence coverage | strong / adequate / thin / missing |
| Wiki confidence | high / medium / low |
| Actionability | ready / refine-first / blocked |

Choose one verdict:

| Verdict | Meaning | Next skill |
|---|---|---|
| `distinct-enough` | No strong lab/wiki overlap; delta is clear enough to refine. | `research-refine` |
| `needs-refinement` | Potential delta exists but needs sharper mechanism/scope. | `research-refine` |
| `duplicate-risk` | Strong overlap; idea may be salvageable by narrowing. | `idea-creator` or `research-refine` |
| `already-covered` | Lab/wiki already covers the same idea. | stop or choose another idea |
| `already-tested` | Existing experiment already tested the decisive question. | `analyze-results` or stop |
| `contradicted` | Existing evidence undermines the idea. | revise or ask council |
| `insufficient-wiki-coverage` | Wiki is too thin for a confident wiki-first verdict. | `wiki-ingest` or ask librarian |
| `council-needed` | Disagreement or high-stakes uncertainty requires council. | `council-session` |
| `ask-librarian` | External literature search is needed before decision. | librarian search |

Do not report "novel" without qualification. Say "distinct enough
against current lab/wiki evidence" when that is what was checked.

### Step G. Council Escalation Gate

Council is expensive. Use it only when it changes decision quality.

Trigger council when any condition holds:

- user specified `council:required`;
- verdict would be `distinct-enough` but overlap risk is `medium` or
  `high`;
- a closest overlap is `strong-partial`;
- lab and wiki evidence point in opposite directions;
- wiki coverage is thin but the next action is expensive;
- the idea is selected or central to a paper claim;
- duplicate risk is high but the delta might be defensible;
- confidence is `low` and the next recommended step is `experiment-plan`.

If the host can hand off to the council persona and the user allowed it,
invoke council with a compact request. Include: source skill, goal mode,
question, idea, core novelty elements, closest overlaps, proposed delta,
uncertainty, and requested output.

If council cannot be invoked, do not impersonate councillors. Return the
request block and set verdict to `council-needed`.

### Step H. Optional Librarian Handoff

This skill is wiki-first. It does not replace a literature search.

Recommend `ask-librarian` when:

- wiki coverage is thin or stale;
- closest overlaps are only from summaries, not full paper notes;
- the idea depends on very recent work;
- the verdict would trigger costly experiments;
- the user asks for full external novelty, not just wiki-first novelty.

The handoff should include search anchors, closest lab/wiki overlaps,
and the exact question the librarian should answer.

## Output Format

Use this structure:

```markdown
## Novelty Vs Wiki Report

### Idea
<1-3 sentence description>

### Core Novelty Elements
| Element | Value | Confidence |
|---|---|---|
| Problem | <...> | high/medium/low |
| Mechanism | <...> | high/medium/low |
| Intervention | <...> | high/medium/low |
| Setting | <...> | high/medium/low |
| Measurement | <...> | high/medium/low |
| Contribution | <...> | high/medium/low |

### Sources Consulted
- Lab: <index/log/drafts read>
- Wiki: <contract/index/pages read>

### Closest Overlaps
| Source | Type | Status | Overlap label | Note |
|---|---|---|---|---|
| idea:<slug> | lab idea | open | strong-partial | <note> |
| <wiki-page> | wiki page | n/a | same-problem-different-mechanism | <note> |

### Element Overlap Matrix
<compact matrix from Step E>

### Verdict
- Verdict: <verdict>
- Confidence: high/medium/low
- Overlap risk: low/medium/high
- Delta clarity: clear/partial/vague/absent

### Recommendation
- Next skill: <research-refine | experiment-plan | idea-creator | wiki-ingest | council-session | ask-librarian | stop>
- Reason: <one sentence>

### Council Gate
- Status: not-triggered / triggered / required / unavailable
- Reason: <one sentence>
- Request: <include only if triggered>
```

If the idea is too vague, output only the missing elements and one
targeted clarification question.

## Examples

### Example 1. Council Triggered

Input:

```text
council:required idea:<idea-slug>
```

Output summary:

```markdown
Verdict: council-needed
Confidence: split
Overlap risk: medium
Delta clarity: partial
Next skill: council-session
Reason: The closest wiki page covers the same mechanism in a different
setting, and the idea would drive an expensive experiment plan.
```

## Anti-patterns

Hard forbids:

- Do not claim the idea is globally novel from a lab/wiki-only check.
- Do not run broad external literature search as the default path.
- Do not ignore rejected or superseded ideas; they often encode dead
  ends.
- Do not treat a missing wiki match as proof of novelty.
- Do not treat "same problem" as duplicate if the mechanism is materially
  different.
- Do not treat "same mechanism" as safe if the contribution claim is the
  same.
- Do not silently rewrite the idea to make it more novel.
- Do not write lab drafts, wiki pages, edges, or logs from this skill.
- Do not auto-fix, merge, delete, or rename anything.
- Do not impersonate the council or invent councillor responses.
- Do not hide uncertainty; use `[?]` for missing or weak elements.
- Do not continue if the idea is too vague to compare.

## Related

- `src/agents/prospector.ts` — owner persona and role boundaries.
- `src/agents/council.ts` — council escalation contract.
- `src/skills/gap-map/SKILL.md` — upstream gap discovery.
- `src/skills/idea-creator/SKILL.md` — upstream idea generation.
- `src/skills/research-refine/SKILL.md` — downstream proposal refinement.
- `src/skills/experiment-plan/SKILL.md` — downstream experiment planning.
- `src/skills/wiki-ingest/SKILL.md` — wiki/lab literature ingestion.
- `<WIKI_PATH>/RULES.md`, `<WIKI_PATH>/AGENTS.md`, `<WIKI_PATH>/README.md`,
  `<WIKI_PATH>/ingest_prompt.md` — runtime wiki contract sources.
- Source patterns: ARIS `novelty-check`, ARIS `patent-novelty-check`,
  AI-Scientist novelty loop, obsidian-wiki `wiki-query`, obsidian-wiki
  `wiki-dedup`, llm-wiki wiki manager, claude-octopus `skill-council`,
  AutoResearchClaw idea workshop, academic-research-skills verification
  protocols.
