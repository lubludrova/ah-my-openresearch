---
name: research-refine
description: Turn a vague research direction, lab idea, gap, or novelty-vs-wiki result into a problem-anchored, elegant, wiki-grounded, implementation-oriented method proposal. Use after `idea-creator` or `novelty-vs-wiki`, or when the user says "refine my approach", "decompose this problem", "sharpen this idea", "refine research plan", "make this implementable", or wants a concrete research method that stays simple, focused, and ready for claim-driven experiment planning.
argument-hint: <idea-ref-or-description>
---

# Research Refine: Problem-Anchored, Elegant, Frontier-Aware Plan Refinement

Refine and concretize: **$ARGUMENTS**

## Overview

Use this skill when the research problem is already visible but the technical route is still fuzzy. The goal is not to produce a bloated proposal or a benchmark shopping list. The goal is to turn a vague direction into a **problem -> focused method -> minimal validation** document that is concrete enough to implement, elegant enough to feel paper-worthy, and current enough to resonate in the foundation-model era.

In amore, this skill is owned by `@prospector`. It must ground the proposal in the project lab and, when useful, the user's literature wiki. It does not run experiments, write papers, or perform broad literature search; use `@coder`, `@writer`, or `@librarian` for those stages.

Four principles dominate this skill:

1. **Do not lose the original problem.** Freeze an immutable **Problem Anchor** and reuse it in every round.
2. **The smallest adequate mechanism wins.** Prefer the minimal intervention that directly fixes the bottleneck.
3. **One paper, one dominant contribution.** Prefer one sharp thesis plus at most one supporting contribution.
4. **Modern leverage is a prior, not a decoration.** When LLM / VLM / Diffusion / RL / distillation / inference-time scaling naturally fit the bottleneck, use them concretely. Do not bolt them on as buzzwords.

```
User input (PROBLEM + vague APPROACH)
  -> Phase 0 (Local step): Freeze Problem Anchor
  -> Phase 1 (Local step): Scan lab/wiki grounding -> identify technical gap -> choose the sharpest route -> write focused proposal
  -> Phase 2 (Council/reviewer): Review for fidelity, specificity, contribution quality, and frontier leverage
  -> Phase 3 (Local step): Anchor check + simplicity check -> revise method -> rewrite full proposal
  -> Phase 4 (Council/reviewer, same route when available): Re-evaluate revised proposal
  -> Repeat Phase 3-4 until OVERALL SCORE >= 9 or MAX_ROUNDS reached
  -> Phase 5: Save full history only under <project>/lab/drafts/ when explicitly requested
  -> Optional handoff: ask @prospector to create an execution-ready exp draft
```

## Constants

- **REVIEWER_MODEL = `gpt-5.5`** — Reviewer model used when delegated review is available.
- **WIKI_PATH** — outside literature wiki path, configured per project.
- **LAB_ROOT = `<project>/lab`** — amore project lab.
- **LAB_DRAFTS = `<project>/lab/drafts`** — only write destination for saved refinement artifacts.
- **MAX_ROUNDS = 5** — Maximum review-revise rounds.
- **SCORE_THRESHOLD = 9** — Minimum overall score to stop.
- **OUTPUT_DIR = `<LAB_DRAFTS>/refine-<slug>/`** — Directory for round files and final report when the user explicitly asks to save.
- **FINAL_IDEA_DRAFT = `<LAB_DRAFTS>/idea-<slug>.md`** — Clean saved proposal when the user asks to save the refined idea.
- **MAX_LOCAL_PAPERS = 15** — Maximum wiki/lab notes to scan for grounding.
- **MAX_CORE_EXPERIMENTS = 3** — Default cap for core validation blocks inside this skill.
- **MAX_PRIMARY_CLAIMS = 2** — Soft cap for paper-level claims. Prefer one dominant claim plus one supporting claim.
- **MAX_NEW_TRAINABLE_COMPONENTS = 2** — Soft cap for genuinely new trainable pieces. Exceed only if the paper breaks otherwise.

> Override via argument if needed, e.g. `research-refine "problem | approach" -- max rounds: 3, threshold: 9`.

## State Persistence (Checkpoint Recovery)

Long-running refinement sessions may fail mid-way (API timeout, context compaction, or session interruption). To avoid losing completed work, persist state to `<LAB_DRAFTS>/refine-<slug>/REFINE_STATE.json` after each phase boundary:

```json
{
  "phase": "review",
  "round": 1,
  "review_route": "council-session-or-delegated-reviewer",
  "last_score": 6.5,
  "last_verdict": "REVISE",
  "status": "in_progress",
  "timestamp": "2026-03-22T20:00:00"
}
```

Write after each completed phase. On completion, set `"status": "completed"`.

## Output Structure

```
<LAB_DRAFTS>/refine-<slug>/
├── REFINE_STATE.json
├── round-0-initial-proposal.md
├── round-1-review.md
├── round-1-refinement.md
├── round-2-review.md
├── round-2-refinement.md
├── ...
├── REVIEW_SUMMARY.md
├── FINAL_PROPOSAL.md
├── REFINEMENT_REPORT.md
└── score-history.md
```

Every `round-N-refinement.md` must contain a **full anchored proposal**, not just incremental fixes.

## Workflow

### Phase -1: Read Amore Context

Before starting any refinement phase, read:

1. `<project>/lab/index.md` — current claim/experiment/idea inventory.
2. `<project>/lab/log.md` — last 30 entries for recent decisions and dead ends.
3. `<project>/lab/SCHEMA.md` — idea and experiment draft contract.
4. `<project>/lab/edges.jsonl` if present.

If the input references an `idea:*`, `claim:*`, or `exp:*` node, read the matching draft in full.

For wiki grounding, read the user's wiki contract at `<WIKI_PATH>` before reading wiki pages. Look for `RULES.md`, `AGENTS.md`, or `README.md`. Use the contract's schema and retrieval expectations; do not hard-code the wiki layout. If no contract exists, use read-only markdown fallback and report that the wiki contract was missing.

### Initialization (Checkpoint Recovery)

Before starting any phase, check whether a previous run left a checkpoint:

1. **Check for `<LAB_DRAFTS>/refine-<slug>/REFINE_STATE.json`**:
   - If it does not exist → fresh start
   - If it exists and `status` is `"completed"` → fresh start
   - If it exists and `status` is `"in_progress"` but `timestamp` is older than 24 hours → fresh start
   - If it exists and `status` is `"in_progress"` within 24 hours → resume
2. **On resume**:
   - Read all existing `<LAB_DRAFTS>/refine-<slug>/round-*.md` files and `score-history.md`
   - Recover `review_route` for reviewer continuity when available
   - Resume from the next phase based on the saved `phase`
3. **On fresh start**, create `<LAB_DRAFTS>/refine-<slug>/` only if the user explicitly asked to save refinement history. Otherwise keep the report in chat and proceed to Phase 0.

### Phase 0: Freeze the Problem Anchor

Before proposing anything, extract the user's immutable bottom-line problem. This anchor must be copied verbatim into every proposal and every refinement round.

Write:

- **Bottom-line problem**: What technical problem must be solved?
- **Must-solve bottleneck**: What specific weakness in current methods is unacceptable?
- **Non-goals**: What is explicitly *not* the goal of this project?
- **Constraints**: Compute, data, time, tooling, venue, deployment limits.
- **Success condition**: What evidence would make the user say "yes, this method addresses the actual problem"?

If later reviewer feedback would change the problem being solved, mark that as **drift** and push back or adapt carefully.

**Checkpoint:** If saved history is enabled, write `<LAB_DRAFTS>/refine-<slug>/REFINE_STATE.json` with `{"phase": "anchor", "round": 0, "review_route": null, "last_score": null, "last_verdict": null, "status": "in_progress", "timestamp": "<now>"}`.

### Phase 1: Build the Initial Proposal

#### Step 1.1: Scan Grounding Material

Check the amore lab and the user's literature wiki first. Read only the relevant parts needed to answer:

- What mechanism do current methods use?
- Where exactly do they fail for this problem?
- Which recent LLM / VLM / Diffusion / RL era techniques are actually relevant here?
- What training objectives, representations, or interfaces are reusable?
- What details distinguish a real method from a renamed high-level idea?

Use `novelty-vs-wiki` output when available. If lab/wiki material is insufficient, hand off to `@librarian` for recent top-venue/arXiv work instead of doing broad literature search inside this skill. Focus on **method sections, training setup, and failure modes**, not just abstracts.

#### Step 1.2: Identify the Technical Gap

Do not stop at generic research questions. Make the gap operational:

1. **Current pipeline failure point**: where does the baseline break?
2. **Why naive fixes are insufficient**: larger context, more data, prompting, memory bank, or stacking more modules.
3. **Smallest adequate intervention**: what is the least additional mechanism that could plausibly fix the bottleneck?
4. **Frontier-native alternative**: is there a more current route using foundation-model-era primitives that better matches the bottleneck?
5. **Core technical claim**: what exact mechanism claim could survive top-venue scrutiny?
6. **Required evidence**: what minimum proof is needed to defend that claim?

#### Step 1.3: Choose the Sharpest Route

Before locking the method, compare two candidate routes if both are plausible:

- **Route A: Elegant minimal route** — the smallest mechanism that directly targets the bottleneck.
- **Route B: Frontier-native route** — a more modern route that uses LLM / VLM / Diffusion / RL / distillation / inference-time scaling *only if* it gives a cleaner or stronger story.

Then decide:

- Which route is more likely to become a strong paper under the stated constraints?
- Which route has the cleaner novelty story relative to the closest work?
- Which route avoids contribution sprawl?

If both routes are weak, rethink the framing instead of combining them into a larger system by default.

#### Step 1.4: Concretize the Method First

The proposal must answer "how would we actually build this?" Prefer method detail over broad experimentation and prefer reuse over invention.

Cover:

1. **One-sentence method thesis**: the single strongest mechanism claim.
2. **Contribution focus**: one dominant contribution and at most one supporting contribution.
3. **Complexity budget**: what is frozen or reused, what is new, and what tempting additions are intentionally excluded.
4. **System graph**: modules, data flow, inputs, outputs.
5. **Representation design**: what latent, embedding, plan token, reward signal, memory state, or alignment space is used?
6. **Training recipe**: data source, supervision, pseudo-labeling, negatives, curriculum, losses, weighting, stagewise vs joint training.
7. **Inference path**: how the trained components are used at test time and what signals flow where.
8. **Why the mechanism stays small**: why a larger stack is unnecessary.
9. **Exact role of any frontier primitive**: if you use an LLM / VLM / Diffusion / RL component, specify whether it acts as planner, teacher, critic, reward model, generator prior, search controller, or distillation source.
10. **Failure handling**: what could go wrong and what fallback or diagnostic exists?
11. **Novelty and elegance argument**: why this is more than naming a module and why the paper still looks focused.

If the method is still only described as "add a module" or "use a planner," it is not concrete enough.

#### Step 1.5: Design Minimal Claim-Driven Validation

Experiments exist to validate the method, not to dominate the document.

For each core claim, define the **smallest strong experiment** that can validate it:

- the claim being tested
- the necessary baseline or ablation
- the decisive metric
- the expected directional outcome

Additional rules:

- Ensure one experiment block directly supports the **Problem Anchor**.
- If complexity risk exists, include one **simplification or deletion check**.
- If a frontier primitive is central, include one **necessity check** showing why that choice matters.
- Default to **1-3 core experiment blocks** and leave the full execution roadmap to the exp draft.

#### Step 1.6: Write the Initial Proposal

Save to `<LAB_DRAFTS>/refine-<slug>/round-0-initial-proposal.md` only when the user asked to save history. Otherwise include the initial proposal in the chat report.

Use this structure:

```markdown
# Research Proposal: [Title]

## Problem Anchor
- Bottom-line problem:
- Must-solve bottleneck:
- Non-goals:
- Constraints:
- Success condition:

## Technical Gap
[Why current methods fail, why naive bigger systems are not enough, and what mechanism is missing]

## Method Thesis
- One-sentence thesis:
- Why this is the smallest adequate intervention:
- Why this route is timely in the foundation-model era:

## Contribution Focus
- Dominant contribution:
- Optional supporting contribution:
- Explicit non-contributions:

## Proposed Method
### Complexity Budget
- Frozen / reused backbone:
- New trainable components:
- Tempting additions intentionally not used:

### System Overview
[Step-by-step pipeline or ASCII graph]

### Core Mechanism
- Input / output:
- Architecture or policy:
- Training signal / loss:
- Why this is the main novelty:

### Optional Supporting Component
- Only include if truly necessary:
- Input / output:
- Training signal / loss:
- Why it does not create contribution sprawl:

### Modern Primitive Usage
- Which LLM / VLM / Diffusion / RL-era primitive is used:
- Exact role in the pipeline:
- Why it is more natural than an old-school alternative:

### Integration into Base Generator / Downstream Pipeline
[Where the new method attaches, what is frozen, what is trainable, inference order]

### Training Plan
[Stagewise or joint training, losses, data construction, pseudo-labels, schedules]

### Failure Modes and Diagnostics
- [Failure mode]:
- [How to detect]:
- [Fallback or mitigation]:

### Novelty and Elegance Argument
[Closest work, exact difference, why this is a focused mechanism-level contribution rather than a module pile-up]

## Claim-Driven Validation Sketch
### Claim 1: [Main claim]
- Minimal experiment:
- Baselines / ablations:
- Metric:
- Expected evidence:

### Claim 2: [Optional]
- Minimal experiment:
- Baselines / ablations:
- Metric:
- Expected evidence:

## Experiment Handoff Inputs
- Must-prove claims:
- Must-run ablations:
- Critical datasets / metrics:
- Highest-risk assumptions:

## Compute & Timeline Estimate
- Estimated GPU-hours:
- Data / annotation cost:
- Timeline:
```

**Checkpoint:** If saved history is enabled, update `<LAB_DRAFTS>/refine-<slug>/REFINE_STATE.json` with `{"phase": "proposal", "round": 0, ...}`.

### Phase 2: External Method Review Or Council Gate (Round 1)

Send the full proposal to a delegated reviewer or `@council` for an **elegance-first, frontier-aware, method-first** review when the user requested review/council, when the proposal is high-stakes, or when novelty risk remains medium/high. The reviewer should spend most of the critique budget on the method itself, not on expanding the experiment menu.

If delegated review is unavailable, run the same checklist locally and mark the review as `local-only`. If council is requested but cannot be invoked, return a Council Request block instead of impersonating councillors.

```
delegated reviewer or council-session:
  model: REVIEWER_MODEL
  reasoning_effort: xhigh
  message: |
    You are a senior ML reviewer for a top venue (NeurIPS/ICML/ICLR).
    This is an early-stage, method-first research proposal.

    Your job is NOT to reward extra modules, contribution sprawl, or a giant benchmark checklist.
    Your job IS to stress-test whether the proposed method:
    (1) still solves the original anchored problem,
    (2) is concrete enough to implement,
    (3) presents a focused, elegant contribution,
    (4) uses foundation-model-era techniques appropriately when they are the natural fit.

    Review principles:
    - Prefer the smallest adequate mechanism over a larger system.
    - Penalize parallel contributions that make the paper feel unfocused.
    - If a modern LLM / VLM / Diffusion / RL route would clearly produce a better paper, say so concretely.
    - If the proposal is already modern enough, do NOT force trendy components.
    - Do not ask for extra experiments unless they are needed to prove the core claims.

    Read the Problem Anchor first. If your suggested fix would change the problem being solved,
    call that out explicitly as drift instead of treating it as a normal revision request.

    === PROPOSAL ===
    [Paste the FULL proposal from Phase 1]
    === END PROPOSAL ===

    Score these 7 dimensions from 1-10:

    1. **Problem Fidelity**: Does the method still attack the original bottleneck, or has it drifted into solving something easier or different?

    2. **Method Specificity**: Are the interfaces, representations, losses, training stages, and inference path concrete enough that an engineer could start implementing?

    3. **Contribution Quality**: Is there one dominant mechanism-level contribution with real novelty, good parsimony, and no obvious contribution sprawl?

    4. **Frontier Leverage**: Does the proposal use current foundation-model-era primitives appropriately when they are the right tool, instead of defaulting to old-school module stacking?

    5. **Feasibility**: Can this method be trained and integrated with the stated resources and data assumptions?

    6. **Validation Focus**: Are the proposed experiments minimal but sufficient to validate the core claims? Is there unnecessary experimental bloat?

    7. **Venue Readiness**: If executed well, would the contribution feel sharp and timely enough for a top venue?

    **OVERALL SCORE** (1-10): Weighted toward Problem Fidelity, Method Specificity, Contribution Quality, and Frontier Leverage.
    Use this weighting: Problem Fidelity 15%, Method Specificity 25%, Contribution Quality 25%, Frontier Leverage 15%, Feasibility 10%, Validation Focus 5%, Venue Readiness 5%.

    For each dimension scoring < 7, provide:
    - The specific weakness
    - A concrete fix at the method level (interface / loss / training recipe / integration point / deletion of unnecessary parts)
    - Priority: CRITICAL / IMPORTANT / MINOR

    Then add:
    - **Simplification Opportunities**: 1-3 concrete ways to delete, merge, or reuse components while preserving the main claim. Write "NONE" if already tight.
    - **Modernization Opportunities**: 1-3 concrete ways to replace old-school pieces with more natural foundation-model-era primitives if genuinely better. Write "NONE" if already modern enough.
    - **Drift Warning**: "NONE" if the proposal still solves the anchored problem; otherwise explain the drift clearly.
    - **Verdict**: READY / REVISE / RETHINK

    Verdict rule:
    - READY: overall score >= 9, no meaningful drift, one focused dominant contribution, and no obvious complexity bloat remains
    - REVISE: the direction is promising but not yet at READY bar
    - RETHINK: the core mechanism or framing is still fundamentally off
```

**CRITICAL: Save the reviewer route or council run id** from this call for later rounds when the host provides one.

**CRITICAL: Save the FULL raw response** verbatim.

Save review to `<LAB_DRAFTS>/refine-<slug>/round-1-review.md` with the raw response in a `<details>` block only when saved history is enabled. Otherwise include a compact review summary in the chat report.

**Checkpoint:** Update `<LAB_DRAFTS>/refine-<slug>/REFINE_STATE.json` with `{"phase": "review", "round": 1, "review_route": "<saved>", "last_score": <parsed>, "last_verdict": "<parsed>", ...}` when saved history is enabled.

### Phase 3: Parse Feedback and Revise the Method

#### Step 3.1: Parse the Review

Extract:

- **Problem Fidelity**
- **Method Specificity**
- **Contribution Quality**
- **Frontier Leverage**
- **Feasibility**
- **Validation Focus**
- **Venue Readiness**
- **Overall score**
- **Verdict**
- **Drift Warning**
- **Simplification Opportunities**
- **Modernization Opportunities**
- **Action items** ranked by priority

If saved history is enabled, update `<LAB_DRAFTS>/refine-<slug>/score-history.md`:

```markdown
# Score Evolution

| Round | Problem Fidelity | Method Specificity | Contribution Quality | Frontier Leverage | Feasibility | Validation Focus | Venue Readiness | Overall | Verdict |
|-------|------------------|--------------------|----------------------|-------------------|-------------|------------------|-----------------|---------|---------|
| 1     | X                | X                  | X                    | X                 | X           | X                | X               | X       | REVISE  |
```

**STOP CONDITION**: If overall score >= SCORE_THRESHOLD, verdict is READY, and there is no unresolved drift warning, skip to Phase 5.

#### Step 3.2: Revise With an Anchor Check and a Simplicity Check

Before changing anything:

1. Copy the **Problem Anchor verbatim**.
2. Write an **Anchor Check**:
   - What is the original bottleneck?
   - Does the current method still solve it?
   - Which reviewer suggestions would cause drift if followed blindly?
3. Write a **Simplicity Check**:
   - What is the dominant contribution now?
   - What components can be removed, merged, or kept frozen?
   - Which reviewer suggestions add unnecessary complexity?
   - If a frontier primitive is central, is its role still crisp and justified?

Then process reviewer feedback:

- If **valid**: sharpen the mechanism, simplify if possible, or modernize if the paper really improves.
- If **debatable**: revise, but explain your reasoning with evidence.
- If **wrong, drifting, or over-complicating**: push back with evidence from local papers and the Problem Anchor.

Bias the revisions toward:

- a sharper central contribution
- fewer moving parts
- cleaner reuse of strong existing backbones
- more natural foundation-model-era leverage when it improves the paper
- leaner, claim-driven experiments

Do **not** add multiple parallel contributions just to chase score. If the reviewer requests another module, first ask whether the same gain can come from a better interface, distillation signal, reward model, or inference policy on top of an existing backbone.

If saved history is enabled, save to `<LAB_DRAFTS>/refine-<slug>/round-N-refinement.md`:

```markdown
# Round N Refinement

## Problem Anchor
[Copy verbatim from round 0]

## Anchor Check
- Original bottleneck:
- Why the revised method still addresses it:
- Reviewer suggestions rejected as drift:

## Simplicity Check
- Dominant contribution after revision:
- Components removed or merged:
- Reviewer suggestions rejected as unnecessary complexity:
- Why the remaining mechanism is still the smallest adequate route:

## Changes Made

### 1. [Method section changed]
- Reviewer said:
- Action:
- Reasoning:
- Impact on core method:

### 2. [Novelty / modernity / feasibility / validation change]
- Reviewer said:
- Action:
- Reasoning:
- Impact on core method:

## Revised Proposal
[Full updated proposal from Problem Anchor through Claim-Driven Validation Sketch]
```

**Checkpoint:** If saved history is enabled, update `<LAB_DRAFTS>/refine-<slug>/REFINE_STATE.json` with `{"phase": "refine", "round": N, ...}`.

### Phase 4: Re-evaluation (Round 2+)

Send the revised proposal back through the **same reviewer route** when possible:

```
reviewer follow-up:
  id: [saved route from Phase 2, if available]
  model: REVIEWER_MODEL
  reasoning_effort: xhigh
  message: |
    [Round N re-evaluation]

    I revised the proposal based on your feedback.
    First, check whether the original Problem Anchor is still preserved.
    Second, judge whether the method is now more concrete, more focused, and more current.

    Key changes:
    1. [Method change 1]
    2. [Method change 2]
    3. [Simplification / modernization / pushback if any]

    === REVISED PROPOSAL ===
    [Paste the FULL revised proposal]
    === END REVISED PROPOSAL ===

    Please:
    - Re-score the same 7 dimensions and overall
    - State whether the Problem Anchor is preserved or drifted
    - State whether the dominant contribution is now sharper or still too broad
    - State whether the method is simpler or still overbuilt
    - State whether the frontier leverage is now appropriate or still old-school / forced
    - Focus new critiques on missing mechanism, weak training signal, weak integration point, pseudo-novelty, or unnecessary complexity
    - Use the same verdict rule: READY only if overall score >= 9 and no blocking issue remains

    Same output format: 7 scores, overall score, verdict, drift warning, simplification opportunities, modernization opportunities, remaining action items.
```

Save review to `<LAB_DRAFTS>/refine-<slug>/round-N-review.md` only when saved history is enabled.

**Checkpoint:** Update `<LAB_DRAFTS>/refine-<slug>/REFINE_STATE.json` with `{"phase": "review", "round": N, "review_route": "<saved>", "last_score": <parsed>, "last_verdict": "<parsed>", ...}` when saved history is enabled.

Then return to Phase 3 until:

- **Overall score >= SCORE_THRESHOLD** and verdict is READY and no unresolved drift
- or **MAX_ROUNDS reached**

### Phase 5: Final Report and Logs

#### Step 5.1: Write `<LAB_DRAFTS>/refine-<slug>/REVIEW_SUMMARY.md`

When the user asked to save refinement history, this file is the high-level round-by-round review record. It should answer: each round was trying to solve what, what changed, what got resolved, and what remained.

```markdown
# Review Summary

**Problem**: [user's problem]
**Initial Approach**: [user's vague approach]
**Date**: [today]
**Rounds**: N / MAX_ROUNDS
**Final Score**: X / 10
**Final Verdict**: [READY / REVISE / RETHINK]

## Problem Anchor
[Verbatim anchor used across all rounds]

## Round-by-Round Resolution Log

| Round | Main Reviewer Concerns | What This Round Simplified / Modernized | Solved? | Remaining Risk |
|-------|-------------------------|------------------------------------------|---------|----------------|
| 1     | [top issues from review] | [main method changes]                    | [yes / partial / no] | [if any] |
| 2     | ...                     | ...                                      | ...     | ...            |

## Overall Evolution
- [How the method became more concrete]
- [How the dominant contribution became more focused]
- [How unnecessary complexity was removed]
- [How modern technical leverage improved or stayed intentionally minimal]
- [How drift was avoided or corrected]

## Final Status
- Anchor status: [preserved / corrected / unresolved]
- Focus status: [tight / slightly broad / still diffuse]
- Modernity status: [appropriately frontier-aware / intentionally conservative / still old-school]
- Strongest parts of final method:
- Remaining weaknesses:
```

#### Step 5.2: Write `<LAB_DRAFTS>/refine-<slug>/FINAL_PROPOSAL.md`

When saved history is enabled, this file is the clean final version document. It should contain only the final proposal itself, without review chatter, round history, or raw reviewer output.

```markdown
# Research Proposal: [Title]

[Paste the final refined proposal only]
```

If the final verdict is not READY, still write the best current final version here.

If the user asked to save the refined idea as an amore artifact, also write or update `<LAB_DRAFTS>/idea-<slug>.md` using the idea frontmatter contract from `<LAB_SCHEMA>` and append an `update` or `draft` entry to `<LAB_LOG>`.

#### Step 5.3: Write `<LAB_DRAFTS>/refine-<slug>/REFINEMENT_REPORT.md`

```markdown
# Refinement Report

**Problem**: [user's problem]
**Initial Approach**: [user's vague approach]
**Date**: [today]
**Rounds**: N / MAX_ROUNDS
**Final Score**: X / 10
**Final Verdict**: [READY / REVISE / RETHINK]

## Problem Anchor
[Verbatim anchor used across all rounds]

## Output Files
- Review summary: `<LAB_DRAFTS>/refine-<slug>/REVIEW_SUMMARY.md`
- Final proposal: `<LAB_DRAFTS>/refine-<slug>/FINAL_PROPOSAL.md`

## Score Evolution

| Round | Problem Fidelity | Method Specificity | Contribution Quality | Frontier Leverage | Feasibility | Validation Focus | Venue Readiness | Overall | Verdict |
|-------|------------------|--------------------|----------------------|-------------------|-------------|------------------|-----------------|---------|---------|
| 1     | ...              | ...                | ...                  | ...               | ...         | ...              | ...             | ...     | ...     |

## Round-by-Round Review Record

| Round | Main Reviewer Concerns | What Was Changed | Result |
|-------|-------------------------|------------------|--------|
| 1     | [top issues]            | [main fixes]     | [resolved / partial / unresolved] |
| 2     | ...                     | ...              | ...    |

## Final Proposal Snapshot
- Canonical clean version lives in `<LAB_DRAFTS>/refine-<slug>/FINAL_PROPOSAL.md`
- Summarize the final thesis in 3-5 bullets here

## Method Evolution Highlights
1. [Most important simplification or focusing move]
2. [Most important mechanism upgrade]
3. [Most important modernization or justification for staying simple]

## Pushback / Drift Log
| Round | Reviewer Said | Author Response | Outcome |
|-------|---------------|-----------------|---------|
| 1     | [criticism]   | [pushback + anchor / evidence] | [accepted / rejected] |

## Remaining Weaknesses
[Honest unresolved issues]

## Raw Reviewer Responses

<details>
<summary>Round 1 Review</summary>

[Full verbatim response from reviewer or council]

</details>

...

## Next Steps
- If READY: ask @prospector to write an exp draft, then use `run-experiment`
- If REVISE: manually address the remaining mechanism weaknesses, then re-run `research-refine`
- If RETHINK: revisit the core mechanism, possibly with `idea-creator`
```

#### Step 5.4: Finalize `score-history.md`

Ensure it contains the complete score evolution table using the new dimensions.

#### Step 5.5: Present a Brief Summary to the User

```
Refinement complete after N rounds.

Final score: X/10 (Verdict: READY / REVISE / RETHINK)

Anchor status:
- [preserved / drift corrected / unresolved concern]

Focus status:
- [tight / slightly broad / still diffuse]

Modernity status:
- [appropriately frontier-aware / intentionally conservative / still old-school]

Key method upgrades:
- [method change 1]
- [method change 2]

Remaining concerns:
- [if any]

Review summary: <LAB_DRAFTS>/refine-<slug>/REVIEW_SUMMARY.md
Full report: <LAB_DRAFTS>/refine-<slug>/REFINEMENT_REPORT.md
Final proposal: <LAB_DRAFTS>/refine-<slug>/FINAL_PROPOSAL.md
Suggested next step: ask @prospector to create an exp draft
```

**Checkpoint:** If saved history is enabled, update `<LAB_DRAFTS>/refine-<slug>/REFINE_STATE.json` with `{"phase": "done", "status": "completed", ...}`.

## Output Protocols

Use amore's lab contract for all saved files:

- Write only under `<project>/lab/drafts/`.
- Keep `<project>/lab/log.md` append-only.
- Do not write to the outside literature wiki.
- Do not silently overwrite an existing idea draft; update only with user approval.
- If the local lab schema conflicts with this prompt, the local schema wins.

## Key Rules

- **Large file handling**: If a saved artifact would be too large for one write, split it into smaller approved sections or keep the report in chat. Do not use shell write workarounds.

- **Anchor first, every round.** Always carry forward the same Problem Anchor.
- **One paper, one dominant contribution.** Avoid multiple parallel contributions unless the paper truly needs them.
- **The smallest adequate mechanism wins.** Bigger is not automatically better.
- **Prefer reuse over invention.** Start from strong existing backbones and add only what the bottleneck requires.
- **Modern techniques are a prior, not a decoration.** Use LLM / VLM / Diffusion / RL-era components when they sharpen the method, not when they only make the proposal sound trendy.
- **Minimal experiments.** Inside this skill, experiments only need to prove the core claims.
- **Review the mechanism, not the parts count.** A long module list is not novelty.
- **Pushback is encouraged.** If reviewer feedback causes drift or unnecessary complexity, argue back with evidence.
- **Use high-depth reasoning for delegated reviews** when the host supports it.
- **Save the review route from Phase 2** and reuse it for later rounds when available.
- **Do not fabricate results.** Only describe expected evidence and planned experiments.
- **Be specific about compute and data assumptions.** Vague "we'll train a model" is not enough.
- **Document everything.** Save every raw review, every anchor check, every simplicity check, and every major method change.

## Composing with Other Skills

This skill sits between idea discovery and execution:

```
idea-creator "direction"                         -> candidate ideas
novelty-vs-wiki "idea:<slug>"                    -> wiki-first novelty gate
research-refine "PROBLEM: ... | APPROACH: ..."   -> you are here
@prospector drafts `exp-*.md`                    -> detailed experiment roadmap
run-experiment "exp:<slug>"                      -> execute the chosen method
```

Typical flow:

1. `idea-creator` or local reading gives you a problem and a vague method direction
2. `novelty-vs-wiki` checks the idea against lab/wiki memory
3. `research-refine` turns it into an anchored, elegant, frontier-aware method plan
4. @prospector turns the final proposal into a detailed claim-driven exp draft
5. `run-experiment` executes the chosen runs
6. Later loops operate on results, not just ideas

This skill also works standalone if you already know the problem and just need the method to become concrete.

## Related

- `src/agents/prospector.ts` — owner persona and lab write boundary.
- `src/agents/council.ts` — council escalation contract.
- `src/skills/idea-creator/SKILL.md` — upstream candidate generation.
- `src/skills/novelty-vs-wiki/SKILL.md` — upstream wiki-first novelty gate.
- @prospector — downstream claim-driven experiment planning.
- Source: adapted closely from ARIS `research-refine`, with amore-specific
  lab/wiki/council boundaries.
