---
name: claim-extract
description: Materialize lab-side claim drafts from a finalized experiment. Reads `exp-<slug>-<date>.md` with `status: completed | failed | abandoned`, calibrates confidence from n_seeds + Δ vs σ_pool + integrity-audit status, applies the status-transition matrix (create new claim / update existing claim / contradict existing claim / supersede), enforces allowed-wording rules (hedging matches evidence, no AI-isms, bounded scope, ≤120 char title), and writes valid `claim-*.md` drafts plus the supporting edges in `edges.jsonl`. Optional secondary cross-model judge (ARIS pattern) prevents self-rationalization. Use when user says "extract claims from exp:<id>", "materialize the result", "record this finding as a claim", "promote results to claims", or when @librarian receives the "candidate claim hooks" handoff from @coder analyze-results. Lab-side only — literature claims are handled by wiki-ingest's Step B during paper ingest.
argument-hint: <exp-id> [--max-claims N] [--judge <model>] [--update | --create] [--dry-run]
---

# Claim Extract

Target: $ARGUMENTS

## Purpose

Turn finalized experiment results into first-class claim drafts in the
project lab graph. You are the formalizer of research findings, not the
analyzer of raw data:

- Read the exp draft and its `results.summary` + `results.outcome`.
- Calibrate confidence from evidence strength (n_seeds, Δ vs σ_pool,
  optional cross-model judge, optional integrity audit).
- Pick the right action: create new claim, update an existing claim,
  contradict an existing claim, or supersede.
- Generate the claim title under the allowed-wording rules (hedging
  matched to evidence, no AI-isms, bounded scope, ≤120 chars).
- Write `claim-*.md` draft(s) and the supporting edges in
  `edges.jsonl`.
- Append a `draft` (or `update`) entry to `lab/log.md`; regenerate
  `lab/index.md`.

You do NOT analyze raw result files (that is `analyze-results`),
modify the exp draft's results section (that is `analyze-results`), or
extract claims from external papers (that is `wiki-ingest` Step B).

## Constants

- **LAB_DRAFTS** — `<project>/lab/drafts/`.
- **LAB_LOG** — `<project>/lab/log.md`. One `draft` or `update`
  entry appended per session per claim materialized.
- **LAB_EDGES** — `<project>/lab/edges.jsonl`. One to three edges
  appended per claim per session.
- **LAB_INDEX** — `<project>/lab/index.md`. Regenerated after writes.
- **SCHEMA_VERSION = v1.0**.
- **MAX_CLAIMS_DEFAULT = 3** — cap per session. A single exp rarely
  warrants more than 3 atomic claims; >3 means you're trying to make
  the exp say too much (ARIS "do not inflate claims" rule).
- **JUDGE_MODEL** — optional secondary judge for ARIS-style verdict
  cross-check. Resolution: `--judge <model>` flag → config
  `claim_extract.judge_model` → none (heuristic-only). When set, must
  be from a different model family than the executor.
- **CONFIDENCE_CALIBRATION** — deterministic heuristic:

  | Evidence shape | Confidence |
  |---|---|
  | n_seeds = 1 OR outcome = `unknown` OR integrity = `fail` | `low` |
  | n_seeds 2-4 AND \|Δ\| > σ_pool AND outcome = `supports` | `medium` |
  | n_seeds ≥ 5 AND \|Δ\| > σ_pool AND outcome = `supports` | `high` |
  | outcome = `partial` (mixed metrics) | one tier below max | (e.g. n=3 partial → `low`) |
  | outcome = `contradicts` | `low` for "claim-X is invalid" framing | (claim flipped meaning) |
  | judge verdict downgrade | one tier below heuristic | (judge skeptical) |
  | judge verdict upgrade | not allowed | (only downgrades; never inflate) |
  | integrity = `warn` | one tier below heuristic | (paper-audit raised concerns) |

  Cap rule: if multiple downgrades apply, take the MINIMUM tier.
  Never auto-upgrade. Upgrades require user override.

- **STATUS_TRANSITION_MATRIX**:

  | Pre-existing claim status | exp.outcome | Action / new status |
  |---|---|---|
  | (no matching claim) | `supports` | CREATE: new claim, `status: supported` |
  | (no matching claim) | `partial` | CREATE: new claim, `status: partial` |
  | (no matching claim) | `contradicts` | CREATE: new claim with explicit "X does NOT hold" framing, `status: supported`; or SKIP if framing unclear |
  | (no matching claim) | `inconclusive` / `unknown` | SKIP: no claim materializable; ask user to expand evidence or accept fallback |
  | `open` | `supports` | UPDATE: `open → supported`, append exp |
  | `open` | `partial` | UPDATE: `open → partial`, append exp |
  | `open` | `contradicts` | UPDATE: `open → invalidated` (strong) or stays `open` with note (weak) |
  | `supported` | `supports` | UPDATE: stay `supported`, recompute confidence (may rise) |
  | `supported` | `partial` | UPDATE: `supported → partial`, append exp; flag conflict |
  | `supported` | `contradicts` | UPDATE: `supported → partial`, append exp; surface as REVIEW for user |
  | `partial` | `supports` | UPDATE: stay `partial` (single exp doesn't resolve mixed evidence) or `partial → supported` if all conditions now pass |
  | `partial` | `contradicts` | UPDATE: `partial → invalidated` |
  | `invalidated` | (any) | DO NOT auto-revive. Ask user. Possibly SUPERSEDE with new claim. |

- **ALLOWED_WORDING_RULES** — title and body language constraints:
  - Title length ≤ 120 chars.
  - Active voice ("LR-warmup reduces val_bpb"), not passive ("val_bpb
    is reduced by LR-warmup").
  - Hedging matched to confidence:
    - `low` → "may", "suggests", "preliminary evidence indicates"
    - `medium` → "shows", "indicates", "evidence supports"
    - `high` → "demonstrates", "establishes", "consistently reduces"
  - Scope bounded: include the dataset, setting, or regime where the
    claim was tested. ("on slm_agent GRPO task" / "for ≤7B models" /
    "in the low-rank regime").
  - Forbidden AI-isms (from writer.ts): `delve`, `pivotal`,
    `landscape`, `tapestry`, `underscore`, `noteworthy`, `paradigm
    shift`, `unleash`, `seamless`.
  - Forbidden unsupported scope words: `state-of-the-art`,
    `consistently outperforms`, `across all` (without N=all), `for
    every` (without bound).
  - Quantify when possible: "reduces val_bpb by ~13% (3 seeds)" beats
    "improves val_bpb significantly".

## Inputs

`$ARGUMENTS` parsed as:

1. A required `<exp-id>` — full node id `exp:<slug>-<YYYY-MM-DD>`,
   bare slug, or natural-language ("the GRPO warmup run"). Resolve
   to one exp draft on disk; ambiguous → ask.
2. `--max-claims N` — override default cap (3). Hard upper bound 5.
3. `--judge <model>` — invoke a cross-model judge for verdict
   cross-check. Default off (heuristic-only).
4. `--update` — force update mode (refuse to create new claims;
   only update existing claims referenced by exp.tests).
5. `--create` — force create mode (skip the update path; always
   create new claims even when exp.tests references existing ones).
6. `--dry-run` — show the proposed claim drafts, status transitions,
   and edges without writing.

## Process

### Step 0 — Resolve and validate the exp draft (HARD GATE)

1. Resolve `<exp-id>` to one
   `<project>/lab/drafts/exp-<slug>-<date>.md`. On no match or
   multi-match → stop and ask.
2. Parse frontmatter against the exp schema (see
   `src/lab/artifact-schema.ts`).
3. Status check:
   - `planned` / `running` → STOP. "Exp not finalized. Run
     `analyze-results` first."
   - `completed` / `failed` / `abandoned` → proceed.
4. Results check:
   - `results.summary` must be non-empty.
   - `results.outcome` must be in `{supports, partial, contradicts,
     inconclusive, unknown}`.
   - If `outcome: unknown` AND user did not pass `--judge` → STOP.
     "Cannot materialize claim from `outcome: unknown`. Either expand
     evidence (re-run with more seeds) or invoke with `--judge
     <model>` for cross-model verdict."
5. Read `results.result_files` for downstream provenance refs.

### Step 1 — Inspect lab state for matching claims

For each `claim:<slug>` in `exp.tests` (claims this exp was meant to
test, declared up-front by @prospector):

1. Read `<project>/lab/drafts/claim-<slug>.md` if it exists.
2. If exists → mark as `candidate-for-update`.
3. If `exp.tests` has no entries OR none resolves to existing draft →
   fall through to create mode.

Also scan `lab/index.md` for claims whose title plausibly matches the
exp's plan question (Levenshtein < 5 on keyword set, or shared slug
prefix). Surface up to 3 such candidates if any — user may want to
update one of those rather than create a new draft.

If `--update` flag set but no candidates → STOP.
If `--create` flag set → skip the candidate match.

### Step 2 — Compute n_seeds and Δ summary

Read the exp draft body's `## Results` section (written by
`analyze-results`) to extract:

- `n_seeds` per condition (count of result_files per condition).
- `Δ` (delta vs baseline) and `σ_pool` per primary metric.
- Number of metrics: primary + secondary count.
- Per-metric verdict (supports / inconclusive / contradicts).

If `## Results` is missing or unparseable → STOP. "Cannot calibrate
confidence without the analyze-results table. Re-run
analyze-results."

### Step 3 — (Optional) Cross-model judge

If `--judge <model>` is set, spawn a fresh judge thread:

```
You are a cross-model judge. The executor (Claude) has finalized
an experiment with the following:

  exp: <exp_id>
  outcome: <outcome>
  summary: <results.summary>
  n_seeds: <n>
  Δ vs baseline: <Δ> (σ_pool=<σ>)
  per-metric: <list>

Examine the exp draft path: <path>
Examine result files: <paths>

For each claim the executor proposes to materialize, answer:
  - claim_supported: yes | partial | no
  - confidence: high | medium | low
  - what_results_support: <narrative>
  - what_results_dont_support: <narrative>
  - missing_evidence: <specific gaps>
  - suggested_claim_revision: <reframing>
  - next_experiments_needed: <concrete list>

Output as JSON.
```

This is the ARIS `result-to-claim` pattern adapted: separate evidence
collection from judgment, prevent self-rationalization.

If judge unavailable / errors → continue heuristic-only with
`integrity_status: unavailable` flag noted in the claim body.

### Step 4 — Apply integrity audit downgrade (if present)

If `<paper-dir>/.audit/<latest-date>_run<NN>/EXPERIMENT_AUDIT.json`
exists AND its verdict refers to this exp:

- `verdict: fail` → cap confidence at `low`.
- `verdict: warn` → cap one tier below heuristic.
- `verdict: pass` → no downgrade.

If no audit exists → `integrity_status: unavailable`, no downgrade,
flag claim body with "no integrity audit run".

### Step 5 — Pick action per claim candidate

For each potential claim (capped at `--max-claims`):

1. Use the STATUS_TRANSITION_MATRIX to pick: CREATE / UPDATE /
   SUPERSEDE / SKIP / REVIEW.
2. Compute confidence via CONFIDENCE_CALIBRATION (post-downgrades).
3. Generate slug for new claims (rule below). For updates, reuse the
   existing claim's slug.

#### Slug generation (for CREATE)

- Take a phrase from `exp.results.summary` capturing the core
  finding ("LR-warmup reduces val_bpb on slm_agent GRPO").
- Lowercase, hyphenate, drop stopwords (a, an, the, of, in, for,
  on, at, by, with, from, and, or, is, are, was, were, be, been,
  being, that, this, these, those).
- Cap at 60 chars.
- Collision check against `lab/index.md` + every existing
  `lab/drafts/claim-*.md`. If collision → suffix `-2`, `-3`, etc.
- Final node_id: `claim:<slug>`.

### Step 6 — Compose claim drafts under ALLOWED_WORDING_RULES

For each CREATE or UPDATE action, compose the claim body:

#### CREATE shape

```markdown
---
schema_version: v1.0
node_id: claim:<slug>
type: claim
title: <verb-led, scope-bounded statement, ≤120 chars, hedging matches confidence>
created: <YYYY-MM-DD>
updated: <YYYY-MM-DD>
tags: []
status: supported | partial   # per STATUS_TRANSITION_MATRIX
confidence: low | medium | high   # post-calibration
provenance:
  sources: []
  experiments:
    - exp:<slug>-<date>
  commits:
    - <commit-hash-from-exp.run.commit>
domain: {}
contradicts: []
supports: []
tested_by:
  - exp:<slug>-<date>
---

# <title>

## Statement

<one paragraph, ≤4 sentences, restating the claim with all
quantitative anchors. Apply ALLOWED_WORDING_RULES.>

Example (medium confidence):
"LR-warmup with linear schedule over 500 steps reduces val_bpb by
~13% (mean=0.27±0.02 vs baseline 0.31±0.01, n=3 seeds, Δ>σ_pool)
on the slm_agent GRPO task. Evidence supports this within the
tested setting; generalization to larger models or different
reward shapes has not been verified."

## Evidence

- Source experiment: [[exp:<slug>-<date>]]
- Result files: <list from exp.results.result_files>
- Commit: <hash>
- Aggregation: <one-line — mean/std/n_seeds>

## Scope

<bounded conditions: dataset, model family, hyperparameter range,
metric. Anything OUTSIDE this scope is NOT claimed.>

Example:
- Dataset: slm_agent GRPO task (small-LM ~125M).
- Metric: val_bpb (lower is better).
- Schedule tested: linear warmup over [200, 500, 1000] steps.
- NOT tested: cosine schedule, large models (>1B), longer training.

## Integrity

- integrity_status: pass | warn | fail | unavailable (from
  EXPERIMENT_AUDIT.json or "no audit run")
- judge_status: agreed | downgraded | unavailable (if --judge used)
- next_experiments_needed: <bullet list from judge, if any>
```

#### UPDATE shape (modifies existing claim-*.md)

Mutations:
- `status`: per STATUS_TRANSITION_MATRIX.
- `confidence`: recomputed via CONFIDENCE_CALIBRATION over the union
  of all experiments now tested_by (re-aggregate).
- `provenance.experiments`: append the new exp_id (dedupe).
- `provenance.commits`: append the new commit hash (dedupe).
- `tested_by`: append the new exp_id (dedupe).
- `updated`: today.

Body additions: append a `## Evidence update <YYYY-MM-DD>` block
recording what this exp adds (one paragraph). Do NOT rewrite the
existing claim statement unless the user passed `--rewrite-title`
explicitly — that's a separate operation.

#### SUPERSEDE shape (rare)

When an existing `invalidated` or strongly-`partial` claim is
replaced by a refined version (per user decision):

- Create new claim with refined slug + title.
- Append edge: `claim:<new> --supersedes--> claim:<old>`.
- The old claim remains in `lab/drafts/` with status `invalidated`
  (or unchanged); we don't delete history.

### Step 7 — Validate against schema (HARD GATE)

For each draft about to be written:

1. Parse with `ClaimFrontmatterSchema` from
   `src/lab/artifact-schema.ts`. On any schema violation → STOP,
   surface the violation. Never write invalid YAML to disk.
2. Apply ALLOWED_WORDING_RULES as a lint pass on the title:
   - Length ≤ 120 chars.
   - No forbidden AI-isms.
   - Hedging matches confidence (regex check on top-3 hedge verbs
     per tier).
   - At least one scope qualifier (dataset / model / regime).
   - Quantitative anchor present (number + unit).
   On violation → fix automatically (re-render under tighter
   constraints) or surface and ask.

### Step 8 — Write drafts (skip if `--dry-run`)

For each draft:

1. Path: `<project>/lab/drafts/claim-<slug>.md`.
2. For CREATE: write new file. Fail if file already exists (slug
   collision should have been caught at Step 5; this is the safety
   net).
3. For UPDATE: read existing file, apply mutations to frontmatter,
   append "## Evidence update" block to body, write back.

### Step 9 — Append edges to edges.jsonl

For each CREATE action, write three edges:

```jsonl
{"schema_version":"v1.0","edge_id":"edge:claim-<slug>-produced_by-exp-<slug>-<date>","from":"claim:<slug>","to":"exp:<slug>-<date>","type":"produced_by","created":"<ISO>","created_by":"claim-extract","provenance":[]}
{"schema_version":"v1.0","edge_id":"edge:claim-<slug>-tested_by-exp-<slug>-<date>","from":"claim:<slug>","to":"exp:<slug>-<date>","type":"tested_by","created":"<ISO>","created_by":"claim-extract","provenance":[]}
{"schema_version":"v1.0","edge_id":"edge:exp-<slug>-<date>-supports-claim-<slug>","from":"exp:<slug>-<date>","to":"claim:<slug>","type":"supports","created":"<ISO>","created_by":"claim-extract","confidence":"<low|medium|high>","provenance":[]}
```

For UPDATE, write one or two edges (the new evidence):

- `claim:<existing> --tested_by--> exp:<new-id>` (always, dedupe
  via edge_id collision check)
- `exp:<new-id> --supports--> claim:<existing>` (if outcome=supports
  or partial; with `confidence`)
- `exp:<new-id> --contradicts--> claim:<existing>` (if
  outcome=contradicts)

For SUPERSEDE: also `claim:<new> --supersedes--> claim:<old>`.

Use `appendEdge()` semantics from `src/lab/edges.ts`: each line is
one validated edge JSON. Skip edges that already exist (collision on
edge_id) silently — claim-extract is idempotent on edges.

### Step 10 — Append to lab/log.md

Per D20 format. CREATE produces a `draft` entry; UPDATE produces an
`update` entry. Mixed batches produce one entry per action.

CREATE template:
```
## [YYYY-MM-DD HH:MM] draft | claim-extract from exp:<slug>-<date>
<N> claim drafts materialized:
- [[claim:<slug-1>]] (confidence: <c>, status: <s>)
- [[claim:<slug-2>]] (confidence: <c>, status: <s>)
Affected: [[exp:<slug>-<date>]], [[claim:<slug-1>]], [[claim:<slug-2>]]
```

UPDATE template:
```
## [YYYY-MM-DD HH:MM] update | claim:<slug> open → supported
New evidence from [[exp:<slug>-<date>]]: <one-line outcome>.
Confidence recomputed: <old> → <new>.
Affected: [[claim:<slug>]], [[exp:<slug>-<date>]]
```

### Step 11 — Regenerate lab/index.md

Trigger the indexer so new/updated claims surface in the inventory.

### Step 12 — Return handoff

Return verbatim:

```
## Claim Extract
source: exp:<slug>-<date> (outcome: <outcome>, n_seeds: <n>)
mode: create | update | mixed
judge: <model or "heuristic-only">
integrity: pass | warn | fail | unavailable

## Materialized
### [1] claim:<slug-1>
- action: CREATE | UPDATE (old-status → new-status)
- title: <verb-led title>
- confidence: <low|medium|high> (calibration: n=<n>, Δ=<Δ>, σ=<σ>, audit=<status>)
- path: <project>/lab/drafts/claim-<slug-1>.md
- edges: <count> appended to edges.jsonl

### [2] claim:<slug-2>
(same shape)

## Skipped
- (none) or: claim:<slug>: REVIEW required because <reason>

## Next
- Inspect drafts in lab/drafts/ before next step.
- If a candidate was SKIPPED for "outcome: unknown" or "REVIEW":
  - Re-run analyze-results with more seeds if needed.
  - Or accept the gap and rerun claim-extract with `--judge <model>`
    for cross-model verdict.
- For paper writing: @writer paper-plan will now find these claims
  in the Claims-Evidence Matrix.
- For high-stakes claims (status=supported, used in paper headline):
  consider @council council-session --goal review --artifact
  lab/drafts/claim-<slug>.md for adversarial verification.
```

## Examples

### Example 1 — create-new from supports outcome, 3 seeds

Input: `exp:grpo-warmup-2026-06-04`

Process:
- Step 0-1: exp resolved, status=completed, outcome=supports. exp.tests
  is empty → CREATE mode.
- Step 2: n_seeds=3, primary Δ=-0.04, σ_pool=0.02, |Δ|>σ_pool.
- Step 3: no --judge.
- Step 4: no integrity audit run; integrity_status: unavailable.
- Step 5: calibration → `medium` (n in [2,4], Δ>σ, supports);
  integrity-unavailable does NOT downgrade (only warn/fail do).
- Slug: `lr-warmup-reduces-val-bpb-grpo`.
- Step 6: title under ALLOWED_WORDING ("indicates" hedge for medium):
  "Linear LR-warmup (500 steps) reduces val_bpb by ~13% on the
  slm_agent GRPO task across 3 seeds (n=3, |Δ|>σ_pool)"
- Step 8: write `lab/drafts/claim-lr-warmup-reduces-val-bpb-grpo.md`.
- Step 9: 3 edges appended.
- Step 10: `draft` entry in log.

Output: handoff with 1 materialized claim.

### Example 2 — update existing claim that exp was meant to test

Input: `exp:lr-cosine-2026-06-04`

Process:
- exp.tests = [`claim:lr-warmup-reduces-val-bpb-grpo`].
- Step 1: existing claim found at status=supported, confidence=medium.
- Step 2: outcome=supports (consistent with claim).
- Step 5: UPDATE mode. Aggregate over 2 exps (original + this).
  n_seeds rises to 6 (3+3). Calibration: `high` (n≥5, Δ>σ).
- Step 6: claim frontmatter mutations only; body append "## Evidence
  update 2026-06-04" with this exp's result summary.
- Step 9: 2 new edges (tested_by + supports).
- Step 10: `update` entry in log.

Output: handoff: 1 updated claim, confidence raised medium → high.

### Example 3 — partial outcome with mixed metrics

Input: `exp:reward-shaping-2026-06-04`

Process:
- outcome=partial. Primary metric supports, secondary metric
  inconclusive.
- Step 5: CREATE with status=partial, confidence=low (partial caps).
- Step 6: title hedged with "suggests":
  "Reward shaping with intent component suggests improved task
  completion (n=3, primary metric only; secondary metric
  inconclusive)"

### Example 4 — judge downgrade

Input: `exp:big-claim-2026-06-04 --judge anthropic/claude-sonnet-4`

Process:
- Heuristic says `high` (n=5, Δ>2σ, supports).
- Judge raises missing_evidence: "Δ tested only on val split; train
  metrics not reported. Risk: in-distribution memorization."
- Judge confidence: medium.
- Cap: confidence = min(heuristic, judge) = medium.
- Body's ## Integrity block includes judge_status: downgraded with
  judge reasoning quoted.

### Example 5 — dry-run for inspection

Input: `exp:grpo-warmup-2026-06-04 --dry-run`

Process:
- All steps run through Step 7 (validation).
- Step 8/9/10/11 skipped.
- Handoff shows proposed claim drafts + transitions + edges WITHOUT
  writing.

Useful for: previewing what claim-extract will do before committing.

### Example 6 — outcome=unknown, refuse

Input: `exp:big-grpo-2026-06-04`

Process:
- Step 0: results.outcome = `unknown`.
- STOP. "Cannot materialize claim from `outcome: unknown`. Re-run
  analyze-results with more seeds or pass `--judge <model>` for
  cross-model verdict."

### Example 7 — contradiction of existing supported claim

Input: `exp:counter-evidence-2026-06-04`

Process:
- exp.tests = [`claim:lr-warmup-reduces-val-bpb-grpo`] (supported,
  medium).
- outcome=contradicts.
- STATUS_TRANSITION_MATRIX: `supported + contradicts → partial`,
  REVIEW required.
- claim-extract performs the UPDATE (status → partial), appends the
  `contradicts` edge, AND surfaces a REVIEW recommendation in the
  handoff so user decides if this should escalate to council.

Output handoff includes:
```
## REVIEW required
claim:lr-warmup-reduces-val-bpb-grpo had status: supported. This exp
contradicts it. Auto-action taken: status downgraded to `partial`.
Suggested next step: council-session --goal review --artifact
lab/drafts/claim-lr-warmup-reduces-val-bpb-grpo.md before further
work depends on this claim.
```

### Example 8 — slug collision

Input: `exp:warmup-followup-2026-06-04`

Process:
- Proposed slug `lr-warmup-reduces-val-bpb-grpo` already exists.
- Slug collision-handling: suffix `-2`. New slug:
  `lr-warmup-reduces-val-bpb-grpo-2`.
- Handoff explicitly notes the collision and suggests user consider
  UPDATE on the existing claim instead.

## Anti-patterns

- Never auto-upgrade confidence beyond heuristic. Upgrades require
  user override. Downgrades (from judge, from integrity audit) ALWAYS
  apply.
- Never invent evidence. If `results.summary` is silent on a metric,
  do not extrapolate. Use what `analyze-results` wrote, nothing more.
- Never write claim titles in passive voice. "X reduces Y" not "Y
  is reduced by X".
- Never use AI-isms (`delve`, `pivotal`, `landscape`, `tapestry`,
  `underscore`, `noteworthy`, `paradigm shift`, `unleash`,
  `seamless`). The wording lint catches them; failures stop the
  write.
- Never claim unbounded scope. Every title must name the dataset /
  model / regime. "Reduces loss on slm_agent GRPO" not "Reduces
  loss".
- Never auto-revive an `invalidated` claim. Ask the user; possibly
  use SUPERSEDE with a new claim.
- Never extract more than `MAX_CLAIMS_DEFAULT` per session unless
  explicitly overridden. >3 means the exp is being stretched.
- Never write to other drafts (`exp-*`, `idea-*`, other
  `claim-*` not in this materialization). Only the new/updated
  claim drafts and `edges.jsonl` + `log.md` + `index.md`.
- Never skip schema validation. Invalid YAML never lands on disk;
  Step 7 is a HARD GATE.
- Never trust a single positive result as evidence for a general
  claim (ARIS "single positive result ≠ general claim"). The
  CONFIDENCE_CALIBRATION caps single-seed runs at `low` regardless
  of Δ.
- Never extract claims from literature sources here. That is
  `wiki-ingest` Step B's territory (lab-side claim-extract operates
  on `exp-*` drafts only).
- Never modify the exp draft. `claim-extract` is read-only on the
  source exp.
- Never silently overwrite an existing claim file in CREATE mode.
  Collision detection in Step 5 + safety net in Step 8.
- Never refuse to write because the judge disagrees with heuristic.
  Apply the downgrade and record the dissent in `## Integrity` body.
  Recording dissent is more valuable than blocking.
- Never make CONTRADICTION updates without surfacing REVIEW. A
  contradicted supported-claim is a research-level event; user must
  be aware.
- Never extract claims from `outcome: unknown` without `--judge`.
  Unknown means we don't know; materializing a claim from it would
  be confabulation.

## Related

- Librarian persona (`src/agents/librarian.ts`) — owns this skill;
  invokes it on user request or via @coder's analyze-results
  handoff. Persona's claim discipline (provenance, atomic scope,
  cross-references) is the policy; this skill is the procedural
  enforcement.
- `analyze-results` (Wave 3, @coder) — upstream producer of
  `results.summary` + `results.outcome` + "candidate claim hooks".
  This skill consumes those.
- `wiki-ingest` (Wave 1, @librarian) — Step B handles
  LITERATURE-side claim mirror (one quick claim per Key Ideas
  bullet). `claim-extract` complements it for LAB-side (our own
  results). Two distinct entry points, no overlap.
- `paper-plan` (Wave 4, @writer) — downstream consumer. The
  Claims-Evidence Matrix reads `claim-*.md` drafts this skill
  produces (status: supported or partial), and links them to
  `tested_by` experiments for evidence.
- `paper-audit` (Wave 4, @writer) — cross-checks paper claims
  against raw result files. If `paper-audit --only experiment`
  flagged the source exp, the integrity downgrade applies here
  in Step 4.
- `council-session` (Wave 4, @council) — REVIEW escalation path
  for high-stakes claims (contradictions, status drops, headline
  contributions). Recommended after extract for any claim that will
  ground a paper's main result.
- The lab artifact schema (`<project>/lab/SCHEMA.md`,
  `src/lab/artifact-schema.ts`) — authoritative for claim
  frontmatter. Schema validation in Step 7 is non-negotiable.
- `src/lab/edges.ts` — `EDGE_TYPES` enum and `appendEdge()` API.
  The 8 allowed edge types include the 4 used here: `produced_by`,
  `tested_by`, `supports`, `contradicts`, `supersedes`.
- D20 — log format. D22 — provenance refs (`exp:<id>` is internal
  evidence). D23 — edges semantics.
- ARIS reference skills:
  [result-to-claim](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/blob/main/skills/skills-codex/result-to-claim/SKILL.md)
  (verdict schema, cross-model judge, integrity downgrade pattern,
  "single positive result ≠ general claim" rule),
  [research-wiki](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/blob/main/skills/skills-codex/research-wiki/SKILL.md)
  (claim node ID conventions, status enum, edge type set) —
  synthesized here under amore's strict schema and confidence
  calibration heuristic.
- [claude-scholar evidence-record pattern](https://github.com/Galaxy-Dawn/claude-scholar)
  — source-type → claim-strength mapping inspired our
  CONFIDENCE_CALIBRATION (1 seed → low, regardless of Δ; "abstract-
  only sources cannot support durable claims").
