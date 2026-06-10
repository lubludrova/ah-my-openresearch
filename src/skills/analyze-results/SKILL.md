---
name: analyze-results
description: Finalize a finished experiment. Collect raw result files, aggregate by condition, compute mean±std across seeds, apply the Δ > seed-std heuristic to set an outcome (supports / partial / contradicts / inconclusive), fill the exp draft's results section, flip status running → completed/failed/abandoned, append a lab/log.md update entry, and return a comparison table plus candidate claim hooks for @librarian. Use when user says "analyze exp:<slug>", "what happened with the run", "did it work", "finalize <exp>", "summarize results", or when the orchestrator routes a `result-analysis` category task to @coder.
argument-hint: <exp-id> | <natural-language-ref>
---

# Analyze Results

Target: $ARGUMENTS

## Purpose

Take one finished experiment, read its raw results, fill the draft's
`results` section, set its final status, and emit a comparison table.

- Aggregate raw metric files across seeds.
- Apply the **Δ > seed-std** heuristic to call an outcome.
- Write `results.result_files`, `results.summary`, `results.outcome`.
- Flip `status: running → completed | failed | abandoned`.
- Hand back candidate claim hooks to @librarian; do NOT extract claims
  here.

You finalize the experiment record. You do not interpret it into
research claims — that is `@librarian` invoking `claim-extract` against
the draft you just updated.

## Constants

- **LAB_DRAFTS** — `<project>/lab/drafts/`.
- **LAB_LOG** — `<project>/lab/log.md`. One `update` entry appended.
- **LAB_INDEX** — `<project>/lab/index.md`. Regenerated after the write.
- **PROJECT_AGENTS** — `<project>/AGENTS.md`. Project instructions.
- **DEFAULT_OUTPUT_ROOT** — `<project>/lab/drafts/exp-<slug>-<date>-outputs/`.
- **PRIMARY_METRIC_RULE** — First entry of `plan.metrics`.
- **SUCCESS_DIRECTION_RULE** — If the draft body declares a success direction,
  use it. Else heuristic: metric name containing `loss`, `bpb`, `error`,
  `perplexity`, `nll`, `regret` → "lower is better". Anything else →
  "higher is better". Tag the chosen direction explicitly in the report.
- **HEURISTIC_OUTCOME_RULE (Δ > std):**
  For each non-baseline condition `c` and primary metric `m`:
  - `m_c, s_c = mean(c), std(c)`
  - `m_b, s_b = mean(baseline), std(baseline)`
  - `Δ = m_c − m_b`, `σ_pool = max(s_c, s_b)`
  - `supports` ⟺ `|Δ| > σ_pool` AND sign(Δ) matches success direction.
  - `contradicts` ⟺ `|Δ| > σ_pool` AND sign(Δ) opposes success direction.
  - `inconclusive` ⟺ `|Δ| ≤ σ_pool`.
  - `partial` ⟺ different conditions / metrics disagree (some supports,
    some contradicts, or supports on one metric, inconclusive on another).
- **N_SEEDS_MIN_FOR_STATS = 2** — With one seed, `std` is undefined; we
  cannot compute Δ > std. The outcome falls back to `unknown` and the
  summary flags "single-seed, no variance estimate".

## Inputs

`$ARGUMENTS` is one of:

1. A full node id: `exp:<slug>-<YYYY-MM-DD>`.
2. A bare slug: `<slug>` — resolve to the latest matching draft.
3. Natural-language: "the GRPO warmup run" — find the single matching
   draft with `status: running` and all seeds finished, or any draft
   the user explicitly names; ambiguous → ask.
4. Empty — list eligible drafts (status `running` with all seeds
   exited, or status `failed` not yet finalized).

## Process

### Step 0 — Resolve and validate the draft (HARD GATE)

1. Resolve `$ARGUMENTS` to one `<project>/lab/drafts/exp-<slug>-<date>.md`.
2. Parse frontmatter.
3. Status check:
   - `running` → proceed.
   - `planned` → "Not launched yet. Run run-experiment first."
   - `completed` → confirm "Re-analyze and overwrite the existing
     `results` section? (yes/no)". If no → stop.
   - `failed` / `abandoned` → still allowed; we may be finalizing a
     partial run. Proceed but the outcome can only be `partial`,
     `contradicts`, or `unknown` (never `supports`).
4. Read the body's `## Run` section to recover location, devices, seeds,
   screens, and output_root.

### Step 1 — Verify all seeds have exited (HARD GATE)

For each seed in the draft:

- `screen -ls | grep <screen>` → must be absent OR (present AND inner
  Python PID gone).

Any seed still running → STOP and ask:
- "Seed <N> is still running. Two options: (a) wait, (b) abandon this
  seed and finalize the rest as partial. Which?"

If user picks abandon: record the seed in a `partial_seeds` list for
the summary; do NOT kill it from here (@coder kills if needed).

### Step 2 — Collect raw result files

For each seed:

1. Locate the result file. Preferred order:
   - `<output_root>/seed-<N>/metrics.json`
   - `<output_root>/seed-<N>/metrics.csv`
   - Fallback: parse the last metric block from `<output_root>/seed-<N>/train.log`
     using regex on `plan.metrics` names. Tag values with
     `[fallback-from-log]` in the report.
2. Record the absolute path in `result_files` (sorted, deterministic).
3. If a seed has no parseable result → record it as `missing` and skip
   from aggregation. The presence of missing seeds biases the outcome
   call; reflect this in the summary.

### Step 3 — Aggregate by condition

Conditions come from the plan: `plan.baselines` and the experiment's own
method label (default the slug). If the plan has explicit `conditions`,
honor those.

For each condition:

- `seeds_used` = list of seed ids with parseable metrics.
- `n` = `len(seeds_used)`.
- For each metric in `plan.metrics`:
  - `mean`, `std` across `seeds_used`.
  - Round consistently (default 4 sig figs; never reformat numbers
    outside the report — keep raw values in the file).

If `n < N_SEEDS_MIN_FOR_STATS` for the method condition → set outcome to
`unknown` (see Step 4) regardless of Δ; flag "single-seed (no variance
estimate)" in the summary.

### Step 4 — Apply Δ > std heuristic and call outcome

Run `HEURISTIC_OUTCOME_RULE` for the primary metric. Then run it for
each non-primary metric and combine:

- All metrics agree on `supports` → outcome `supports`.
- All metrics agree on `contradicts` → outcome `contradicts`.
- All metrics `inconclusive` → outcome `inconclusive`.
- Mixed → outcome `partial`.
- One seed and / or no baseline → outcome `unknown`.

If status was `failed` / `abandoned` at Step 0, the outcome is one of
`partial`, `contradicts`, `inconclusive`, `unknown`. Never `supports`
from partial evidence.

### Step 5 — Compute the final status

| Pre-state         | Seeds exited cleanly       | Has parseable results          | Final status |
|-------------------|-----------------------------|-------------------------------|--------------|
| `running`         | all                         | ≥1                            | `completed`  |
| `running`         | all                         | 0 (all missing)               | `failed`     |
| `running`         | some abandoned by user      | ≥1                            | `completed` (partial) |
| `running`         | some abandoned by user      | 0                             | `abandoned`  |
| `failed`          | (already finalized)         | use existing                  | `failed`     |
| `abandoned`       | (already finalized)         | use existing                  | `abandoned`  |

`completed` with abandoned seeds still gets `outcome: partial` (Step 4).

### Step 6 — Write the draft

Replace these frontmatter fields:

```yaml
status: completed | failed | abandoned
run:
  ...                       # unchanged from run-experiment
  completed_at: <ISO 8601 UTC>
results:
  result_files:
    - lab/drafts/exp-<slug>-<date>-outputs/seed-42/metrics.json
    - lab/drafts/exp-<slug>-<date>-outputs/seed-7/metrics.json
    - lab/drafts/exp-<slug>-<date>-outputs/seed-1337/metrics.json
  summary: "<one paragraph: condition vs baseline, primary metric mean±std (n), Δ, decision rule>"
  outcome: supports | partial | contradicts | inconclusive | unknown
```

Replace or insert a `## Results` section in the body:

```markdown
## Results

Primary metric: <name>, success_direction: lower-is-better

| condition | n | mean | std | Δ vs baseline | |Δ| > σ_pool | per-metric verdict |
|-----------|---|------|-----|---------------|--------------|--------------------|
| baseline  | 3 | 0.31 | 0.01 | —             | —            | reference          |
| method_a  | 3 | 0.27 | 0.02 | -0.04         | yes           | supports           |

### Other metrics
<rows like the above, one block per non-primary metric>

### Notes
- single-seed flags / missing seeds / abandoned seeds / fallback-from-log
  notes go here.
```

Do NOT touch `plan`, `tests`, `idea_refs`, `claim_refs`, `provenance.*`
beyond what is specified. Specifically:

- `provenance.experiments` stays untouched (it tracks claims-supported-by,
  not self-reference).
- `provenance.commits` is appended only if you produced new commits during
  analysis (rare — typically none).
- `tests:` and `claim_refs:` are READ to compose candidate claim hooks
  for the handoff. They are NOT mutated here; @librarian mutates them.

### Step 7 — Append to lab/log.md

Append ONE entry, per D20 format:

```
## [YYYY-MM-DD HH:MM] update | exp:<slug>-<date> running → <final-status>
outcome: <outcome>. <one-line: method mean vs baseline mean, Δ, rule>.
Affected: [[exp:<slug>-<date>]]
```

For `failed` / `abandoned` with `outcome: unknown`, the description line
explains why (no parseable metrics / all seeds missing / user abandoned).

### Step 8 — Regenerate lab/index.md

Run `amore doctor --repair` so the generated catalog reflects the new
status. Do not hand-edit `lab/index.md`; it is generated.

### Step 9 — Return handoff to caller

Return this block verbatim. Hand off cleanly to @librarian if a claim
hook applies, else stop with `## Next` empty:

```
## Analysis
exp:<slug>-<date> → <final-status>, outcome: <outcome>

## Comparison
Primary metric: <name>, direction: <lower|higher>-is-better
| condition | n | mean ± std | Δ vs baseline | |Δ| > σ_pool | verdict |
|-----------|---|------------|---------------|--------------|---------|
| baseline  | 3 | 0.31 ± 0.01 | —             | —            | reference |
| method_a  | 3 | 0.27 ± 0.02 | -0.04 (-13%)  | yes (σ=0.02) | supports |

## Outcome
`<outcome>` — <one-sentence justification grounded in the rule>.

## Candidate claim hooks (for @librarian)
<for each tests: entry in the draft>
- `claim:<slug>` (currently `<status>`, confidence `<conf>`) — this run
  <strengthens / weakens / doesn't move> it. Suggested action:
  re-evaluate confidence to <level>, or extract a refined claim
  "<short statement>".

<for any new claim implied by results but not in `tests:`>
- New candidate: "<one-sentence claim statement>" — would link as
  `claim:<proposed-slug>` --tested_by→ `exp:<slug>-<date>`. Edge to add:
  `claim:<proposed-slug> tested_by exp:<slug>-<date>` (deferred to
  @librarian on confirm).

## Next
- Route to @librarian: `@librarian claim-extract exp:<slug>-<date>`
  (apply the candidate hooks above, write/update claim drafts).
- Or stop here if you want to inspect the results section first.
```

If `outcome: unknown` because of single-seed / missing results:

```
## Next
- Decide whether to relaunch with more seeds (re-run run-experiment
  with plan.seeds expanded) before claim work, or accept "unknown"
  and let @librarian record a low-confidence claim.
```

## Examples

### Example 1 — 3 seeds, clean win on primary metric

Input: `exp:grpo-warmup-2026-06-04`

- Steps 0-2: pass; 3 seeds; metrics.json present for all.
- Step 3: baseline n=3 mean 0.31 std 0.01; method n=3 mean 0.27 std 0.02.
- Step 4: |Δ|=0.04 > 0.02 = σ_pool, sign matches "lower is better" →
  outcome `supports`.
- Step 5: status `running → completed`.
- Steps 6-9: draft written, log appended, index regenerated, handoff
  returned with one candidate claim hook (refining
  `claim:lr-warmup-stabilises-grpo` from `confidence: low` → `medium`).

### Example 2 — single seed, no variance, unknown outcome

Input: `exp:cnn-baseline-2026-06-04`

- plan.seeds = [42] (single-seed).
- Step 3: `n=1`, std undefined for method.
- Step 4: `unknown` (single-seed flag).
- Step 5-6: status `running → completed`, summary calls out
  "single-seed, no variance estimate; expand seeds for evidence".
- Step 9 next-block proposes relaunch with seeds=[42, 7, 1337].

### Example 3 — partial: supports on primary, inconclusive on secondary

Input: `exp:lr-sweep-2026-06-04`

- Primary metric: `val_bpb`. method 0.27±0.02 vs baseline 0.31±0.01,
  Δ=-0.04, supports.
- Secondary metric: `throughput`. method 1200±150 vs baseline
  1250±100, Δ=-50, |Δ|=50 < 150 = σ_pool, inconclusive.
- Outcome `partial`. Summary makes the mismatch explicit. Candidate
  claim hook refers to primary metric only.

### Example 4 — all seeds crashed, no metrics

Input: `exp:big-grpo-2026-06-04`

- Step 2: all seeds `missing`.
- Step 4: `unknown`.
- Step 5: status `running → failed`.
- Handoff returns no candidate claim hooks; suggests reading
  train.log for diagnosis and surfaces tail in `## Notes`.

### Example 5 — re-analysis of an already-completed exp

Input: `exp:grpo-warmup-2026-06-04` (status already `completed`)

- Step 0: prompts "Re-analyze and overwrite results section? (yes/no)".
- User: yes (e.g. they added a metric to plan.metrics).
- Proceeds normally; final results section is replaced; log entry
  records `completed → completed` (re-analysis):

```
## [YYYY-MM-DD HH:MM] update | exp:<slug>-<date> re-analysis
outcome: <outcome>. Re-ran analyze-results after plan.metrics update.
Affected: [[exp:<slug>-<date>]]
```

## Anti-patterns

- Never normalize metrics by the model's own statistics. Compare against
  `plan.baselines` only. Raw numbers go in result_files; aggregated
  numbers go in `## Results`.
- Never construct ground truth from another model's output. If the plan
  used model-judges-model evaluation, refuse to call `supports` and
  require an explicit "proxy / synthetic" label in the summary.
- Never call `supports` on a single seed. With n<2 the outcome is
  `unknown` until more seeds exist.
- Never call `supports` from a `failed` / `abandoned` pre-state. Partial
  evidence is at most `partial`.
- Never extract claims. You return candidate hooks; @librarian writes
  claim drafts via `claim-extract`. Crossing this boundary defeats the
  audit / human-veto path.
- Never write to other drafts (`claim-*`, `idea-*`, other `exp-*`). Only
  the target exp draft + `lab/log.md` + `lab/index.md`.
- Never silently overwrite an existing `results` section. Ask first.
- Never invent edges. `tested_by` is materialised by @librarian during
  claim-extract; do not append to `lab/edges.jsonl` from here.
- Never mark `outcome: supports` because a single metric improved while
  another disagrees. Mixed → `partial`. The Δ > std rule is per-metric
  AND combined.
- Never quietly drop missing seeds. They bias the aggregation and the
  `## Notes` section must call them out explicitly.

## Related

- Coder persona (`src/agents/coder.ts`) — owns the rule "never extract
  claims from results" and the status state machine. This skill
  implements the finalize half.
- `run-experiment` — wrote `status: running` and the `## Run` section
  this skill reads.
- `monitor-experiment` — emits the "ready to finalize" hint that leads
  here.
- `@librarian` + `claim-extract` (Wave 1 / Phase 7) — downstream
  consumer of the candidate claim hooks.
- `intake-dispatch-summary` — classifies `result-analysis` requests and
  routes to @coder, which then picks this skill.
- `experiment-audit` (Wave 4, @council) — independent integrity audit
  over the structured results this skill produces.
- The lab artifact schema (`<project>/lab/SCHEMA.md`,
  `src/lab/artifact-schema.ts`) — authoritative for exp frontmatter
  (`results.result_files`, `results.summary`, `results.outcome`).
- D20 log format and D23 edges semantics — do not append edges from
  here; that contract belongs to claim-extract.
