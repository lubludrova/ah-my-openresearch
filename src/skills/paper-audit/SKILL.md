---
name: paper-audit
description: >-
  Umbrella audit for a paper draft. Three independent phases: claim audit,
  citation audit, and optional experiment audit. Each phase uses a fresh,
  cross-model reviewer to prevent self-judging bias. Output JSON ledger and
  Markdown report with per-item verdicts. Advisory only; downstream personas or
  the user decide what to apply. Use when user says "audit the paper", "check
  the citations", "verify the numbers", "pre-submission audit", or when
  @writer reaches Phase 5 audit, or when @council needs an independent integrity
  check before adversarial review.
argument-hint: "[<paper-dir>] [--only claim,citation,experiment] [--soft-only] [--uncited] [--reviewer <model>]"
---

# Paper Audit

Target: $ARGUMENTS

## Purpose

Verify three integrity axes for a paper draft using a fresh cross-model
reviewer:

- **Claims** — every number in the .tex traces to a raw result file.
- **Citations** — every `\cite{key}` is real, correctly attributed,
  and used in a context the cited work actually supports.
- **Experiments** (optional) — eval code is free of fake GT,
  score-normalization fraud, phantom results, scope mismatch.

You are the auditor, not the fixer. You produce verdicts and patches;
the user / @writer / @council apply them.

Advisory rule: paper-audit **never blocks** the pipeline. A `FAIL`
verdict is loud signal, not a gate.

## Constants

- **PAPER_DIR** — `<project>/paper/` (default; override via first arg).
- **PLAN_FILE** — `<project>/paper/PAPER_PLAN.md`.
- **SECTIONS_GLOB** — `<paper-dir>/sections/*.tex`.
- **BIB_FILE** — `<paper-dir>/references.bib`.
- **LAB_DRAFTS** — `<project>/lab/drafts/`. Source of truth for raw
  result files and claim provenance.
- **LAB_LOG** — `<project>/lab/log.md`. One `audit` action entry per
  session.
- **AUDIT_DIR** — `<paper-dir>/.audit/<YYYY-MM-DD>_run<NN>/`.
  Stores per-phase JSON + Markdown reports and per-item traces.
- **REVIEWER_MODEL** — configured reviewer model, preferably from a
  different family than the executor. Resolution order:
  1. `--reviewer <model>` flag.
  2. `<project>/lab/config.json` `audit.reviewer_model`.
  3. Global config `audit.reviewer_model`.
  4. Host/persona default if no reviewer override is configured.
  This skill does not name or choose concrete models.
- **CONTEXT_POLICY = fresh** — every audit phase uses a new reviewer
  thread. No carry-over from previous runs or other phases.
- **DEFAULT_PHASES = claim,citation** — experiment-audit is opt-in
  via `--only` (heavier; reads source code, not just .tex).
- **ROUND_TOL = 0.005** — claim audit treats `84.7%` → `85%` as a
  match (rounding); `84.7%` → `85.3%` is a mismatch (fabrication).
- **SCHEMA_VERSION = v1.0**.

## Inputs

`$ARGUMENTS` parsed as:

1. Optional first positional: `<paper-dir>` (default PAPER_DIR).
2. `--only claim,citation,experiment` — comma-separated phase
   allowlist. Default: `claim,citation`. `experiment` is opt-in.
3. `--soft-only` — citation phase will NOT mutate `references.bib`;
   produces sentence-rewrite proposals instead. Inherited from ARIS
   citation-audit `--soft-only`.
4. `--uncited` — citation phase additionally lists unused bib entries
   for pruning. Set-diff only, no reviewer cost.
5. `--reviewer <model>` — override REVIEWER_MODEL.
6. Empty → default behavior on PAPER_DIR with default phases.

## Process

### Step 0 — Resolve paper and validate (HARD GATE)

1. Resolve `<paper-dir>`. If it does not exist or has no `sections/`
   subdirectory → STOP. "No paper draft found at <paper-dir>. Did you
   run paper-plan first?"
2. List `<paper-dir>/sections/*.tex`. If empty → STOP. "Paper
   scaffolded but no sections drafted yet. Run @writer first."
3. Read `PAPER_PLAN.md` if it exists; otherwise warn and proceed
   without venue context.
4. Read `references.bib`. If missing AND `--only` includes `citation`
   → STOP. "No references.bib found; citation phase needs it."
5. Pick the executor model fingerprint (from env / runtime). Resolve
   REVIEWER_MODEL such that it is a different family. If we cannot
   guarantee cross-family → warn but proceed; record `cross_model:
   degraded` in the report.

### Step 1 — Create audit directory

Create `AUDIT_DIR = <paper-dir>/.audit/<YYYY-MM-DD>_run<NN>/`.

`<NN>` is the next free 2-digit suffix for today (`01`, `02`, ...).

Sub-layout:

```
.audit/<date>_run<NN>/
├── meta.json              # configuration of this run
├── claim/                 # claim-phase artifacts
│   ├── CLAIM_AUDIT.md
│   ├── CLAIM_AUDIT.json
│   └── traces/<claim_id>.md
├── citation/              # citation-phase artifacts
│   ├── CITATION_AUDIT.md
│   ├── CITATION_AUDIT.json
│   └── traces/<bib_key>.md
├── experiment/            # experiment-phase (only if --only includes it)
│   ├── EXPERIMENT_AUDIT.md
│   └── EXPERIMENT_AUDIT.json
└── PAPER_AUDIT.md         # combined umbrella report
```

`meta.json` records flags, reviewer model, paper dir, plan venue.

### Step 2 — Claim audit phase (`claim` in --only)

#### Step 2a — Extract quantitative claims

For each `*.tex` file in `<paper-dir>/sections/`:

- Regex-extract claim candidates:
  - Numbers + units: `(\d+\.?\d*)\s*(%|×|x|pp|ms|s|min|hours?|GB|MB|MiB|points?)`
  - Comparison phrases: `outperforms`, `improves by`, `Δ`, `relative
    improvement`, `reduces by`, `better than`
  - Aggregations: `mean`, `median`, `best`, `average over`
  - Scope claims: `consistently`, `across all`, `for every`, `on N
    datasets`
- For each match, capture file, line, surrounding sentence (≥1 full).
- Save to `AUDIT_DIR/claim/extracted.jsonl`.

#### Step 2b — Resolve evidence

For each extracted claim, attempt to map to evidence:

1. If the sentence cites an experiment (`\cite{...}` mapping to a lab
   exp, or `exp:<slug>-<date>` literal), look up that exp draft.
2. From the exp draft, read `results.result_files` and
   `results.summary`.
3. If the sentence cites a figure (`Fig.~\ref{fig:X}`), find the
   figure script `paper/figures/gen_*.py` and resolve its INPUTS.
4. If no evidence can be located → record `evidence: missing` for
   this claim.

#### Step 2c — Spawn fresh reviewer

Pass to a fresh `REVIEWER_MODEL` thread (no prior audit context):

```
You are a fresh reviewer. For each extracted claim below, classify:
- MATCH      — paper number matches raw evidence within ROUND_TOL.
- MISMATCH   — numbers disagree beyond rounding.
- INFLATED   — direction of error favors the paper (likely
              cherry-picking or inflation).
- CHERRY     — multiple seeds available, paper reports only the best.
- AGGREGATION — paper says "average over N" but evidence has different N.
- SCOPE      — paper scope is broader than evidence (e.g. "across
              all datasets" with only 2 datasets tested).
- CAPTION    — figure caption number disagrees with the figure script's
              output.
- MISSING    — no traceable evidence.
- OK         — fully verified.

Output JSON per claim: {claim_id, paper_quote, paper_value,
evidence_value, evidence_source, verdict, severity:
critical|major|minor}.
```

Save per-claim trace to `AUDIT_DIR/claim/traces/<claim_id>.md` with
the reviewer's full reasoning.

#### Step 2d — Aggregate

Compose `AUDIT_DIR/claim/CLAIM_AUDIT.json`:

```json
{
  "audit_skill": "paper-audit:claim",
  "verdict": "PASS | WARN | FAIL | NOT_APPLICABLE",
  "reason_code": "all_match | rounding_only | mismatch_minor | inflation_or_cherry | scope_overclaim | missing_evidence",
  "summary": "<one-line>",
  "reviewer_model": "<model>",
  "cross_model": "ok | degraded",
  "audit_dir": "<path>",
  "details": {
    "total_claims": 47,
    "counts": {"OK": 39, "MATCH": 4, "MISMATCH": 1, "INFLATED": 1,
               "CHERRY": 0, "AGGREGATION": 0, "SCOPE": 1, "CAPTION": 0,
               "MISSING": 1},
    "per_claim": [...]
  }
}
```

Top-level verdict:
- `PASS` — all OK or MATCH (rounding only).
- `WARN` — any MISMATCH (minor) or MISSING with severity `minor`.
- `FAIL` — any INFLATED / CHERRY / SCOPE / AGGREGATION (severity
  critical or major), or MISSING with severity critical.

Also compose `CLAIM_AUDIT.md` human-readable: priority fixes,
verbatim quotes from the paper, raw evidence values, recommended
sentence patches.

### Step 3 — Citation audit phase (`citation` in --only)

This is essentially a wrapper over ARIS citation-audit semantics
adapted to our paths.

#### Step 3a — Discover citations

For each `*.tex`:

- Extract `\cite{key1,key2,...}` (also `\citep`, `\citet`, `\citeauthor`,
  `\citeyear`).
- Record `(key, file, line, surrounding sentence)`.
- Build `cited_keys` set and `bib_keys` set (from `references.bib`).
- Save to `AUDIT_DIR/citation/contexts.jsonl`.

If `--uncited` set: compute `uncited = bib_keys \ cited_keys`. This
is a set-diff, no reviewer cost.

#### Step 3b — Verify each cited entry (fresh reviewer with web access)

For each `key` in `cited_keys`:

Spawn a fresh `REVIEWER_MODEL` thread with WebSearch / WebFetch
capability. Prompt:

```
For bib entry <key> verify three axes:
1. EXISTENCE — does the paper exist at the claimed identifier
   (arXiv ID / DOI / venue+year)? Use DBLP / CrossRef / arXiv.
2. METADATA — do authors, year, venue, title match canonical sources?
3. CONTEXT — for each use site (file + line + sentence), does the
   cited paper actually support that surrounding claim?

Output per use site: SUPPORTS | WEAK | WRONG.
Output final verdict: KEEP | FIX | REPLACE | REMOVE.
```

Mapping:
- `KEEP` — entry clean, all uses appropriate.
- `FIX` — metadata correction needed; uses are appropriate.
- `REPLACE` — wrong-context cite; find a different paper.
- `REMOVE` — entry is hallucinated or unsupportable.

Save per-key trace to `AUDIT_DIR/citation/traces/<key>.md`.

#### Step 3c — Aggregate

Compose `CITATION_AUDIT.json` with the ARIS-compatible schema
(`counts: {KEEP, FIX, REPLACE, REMOVE}`, `per_entry: [...]`,
optional `uncited_entries`).

Verdict mapping:
- Every entry KEEP → `PASS`.
- Only FIX verdicts → `WARN`.
- Any REPLACE or REMOVE → `FAIL`.

Soft-only handling (when `--soft-only` set):
- Verdicts and reasoning unchanged.
- `details.soft_only_actions` array records per-occurrence sentence
  rewrites; no bib mutations.

Also compose `CITATION_AUDIT.md` with priority fixes, all-clean
entries section, and (when `--uncited`) uncited entries section.

### Step 4 — Experiment audit phase (`experiment` in --only, opt-in)

Heavier phase: reads eval source code, not just .tex.

#### Step 4a — Collect targets

For each exp referenced by the paper (per claim audit's evidence
resolution):

- Path to the exp's eval script(s) (parse `run.command` from exp
  draft).
- Path to the dataset / GT files referenced by the eval.
- The raw result files this exp produced.

#### Step 4b — Fresh reviewer with code reading

Pass to `REVIEWER_MODEL`:

```
For each evaluation script below, check four fraud patterns:
1. FAKE GROUND TRUTH — is the "ground truth" actually synthetic /
   derived from a model output, rather than dataset-provided?
2. SCORE NORMALIZATION FRAUD — are metrics divided by the model's
   own statistics (e.g. its own max), inflating apparent performance?
3. PHANTOM RESULTS — do numeric claims in the paper reference files /
   functions that don't exist, or numbers that don't actually appear
   in the output files?
4. INSUFFICIENT SCOPE — is the evaluation described as
   "comprehensive" / "across all" but really N=2 / N=3?

Output per exp: 6-point checklist verdict + file:line evidence.
Final per-exp verdict: PASS | WARN | FAIL.
```

#### Step 4c — Aggregate

Compose `EXPERIMENT_AUDIT.json` with ARIS-compatible structure:

```json
{
  "audit_skill": "paper-audit:experiment",
  "verdict": "PASS | WARN | FAIL",
  "details": {
    "per_exp": [
      {"exp": "exp:lr-sweep-2026-06-04",
       "verdict": "PASS",
       "checks": {"fake_gt": "pass", "score_norm": "pass",
                  "phantom": "pass", "scope": "warn"},
       "evidence": [...]
      }
    ]
  }
}
```

Top-level verdict:
- All exps PASS → `PASS`.
- Any WARN → `WARN`.
- Any FAIL → `FAIL`.

### Step 5 — Compose umbrella report

Write `AUDIT_DIR/PAPER_AUDIT.md`:

```markdown
# Paper Audit — <date>_run<NN>

**Paper:** <paper-dir>
**Phases:** claim, citation[, experiment]
**Reviewer:** <model> (cross-model: ok | degraded)
**Run flags:** <flags>

## Top-level verdict
**<PASS | WARN | FAIL>** — <one-line synthesis>

## Per-phase
- claim: <PASS | WARN | FAIL> — <one-line>; see claim/CLAIM_AUDIT.md
- citation: <PASS | WARN | FAIL> — <one-line>; see citation/CITATION_AUDIT.md
- experiment: <PASS | WARN | FAIL | n/a> — <one-line>;
  see experiment/EXPERIMENT_AUDIT.md

## Priority fixes (apply before submission)
1. <critical claim fix> (claim/CLAIM_AUDIT.md §3)
2. <wrong-context citation> (citation/CITATION_AUDIT.md §2)
3. ...

## Counts
- claims audited: <N>; OK: <n>, mismatch: <n>, inflated: <n>, ...
- citations audited: <N>; KEEP: <n>, FIX: <n>, REPLACE: <n>, REMOVE: <n>
- experiments audited: <N>; PASS: <n>, WARN: <n>, FAIL: <n>

## Next
- Apply priority fixes (above).
- Re-run paper-audit after fixes (separate run dir).
- For high-stakes pre-submission review of remaining concerns, route
  to @council `council-session --goal review --artifact <paper-dir>`.
```

Top-level verdict aggregation:
- All phases PASS → `PASS`.
- Any FAIL → `FAIL`.
- Otherwise → `WARN`.

### Step 6 — Append to lab/log.md

Append per D20 format:

```
## [YYYY-MM-DD HH:MM] audit | paper-audit <phases>
verdict: <PASS|WARN|FAIL>. <one-line>.
Report: <paper-dir>/.audit/<date>_run<NN>/PAPER_AUDIT.md
Affected: <wikilinks of exps referenced by paper>
```

### Step 7 — Return handoff

Return verbatim:

```
## Paper Audit
phases: <comma-separated list>
verdict: <PASS | WARN | FAIL>
report: <paper-dir>/.audit/<date>_run<NN>/PAPER_AUDIT.md

## Phase verdicts
- claim:      <verdict> (<count summary>)
- citation:   <verdict> (<count summary>)
- experiment: <verdict | n/a> (<count summary>)

## Priority fixes
<top 3-5 fixes with file:line refs>

## Next
- @writer applies fixes from <report>.
- Re-run paper-audit after fixes.
- For pre-submission adversarial review: council-session --goal review
  --artifact <paper-dir>/main.tex --artifact <paper-dir>/PAPER_PLAN.md
```

If verdict is `PASS`:

```
## Next
- No blocking issues found. Proceed to council-session pre-submission
  review or directly to compile + submit.
```

## Examples

### Example 1 — full default audit (claim + citation)

Input: empty

Process:
- Phases: `claim,citation`.
- Steps 0-2: extract 47 claim candidates, resolve evidence for 45,
  miss 2 (referenced figs not yet generated).
- Reviewer flags 1 INFLATED, 1 SCOPE, 1 MISSING — verdict
  `FAIL`.
- Step 3: 29 bib entries, 11 KEEP, 14 FIX, 3 REPLACE, 1 REMOVE —
  verdict `FAIL`.
- Step 5: umbrella verdict `FAIL`; priority fixes lists the 4
  citation REPLACE/REMOVE + 2 claim fixes.
- Step 6-7: log entry + handoff.

### Example 2 — opt-in experiment audit

Input: `--only claim,citation,experiment`

Process:
- Adds Step 4. Reviewer reads eval scripts of 3 referenced exps.
- 2 PASS, 1 WARN (insufficient scope — "comprehensive" with N=3
  datasets but paper claims "across all benchmarks").
- Umbrella verdict = max severity = FAIL (claim phase still FAIL).

### Example 3 — single phase

Input: `--only citation`

Process:
- Skip claim and experiment phases.
- Only citation phase runs; faster.
- Umbrella verdict = citation phase verdict.

### Example 4 — soft-only mode

Input: `--only citation --soft-only`

Process:
- citation phase runs identically.
- No `references.bib` mutations.
- Verdicts include `soft_only_actions` with sentence rewrites.
- Useful when bib is frozen (camera-ready window).

### Example 5 — uncited entries cleanup

Input: `--only citation --uncited`

Process:
- citation phase + set-diff of unused bib keys.
- Uncited section in the report suggests `prune` (recommend deletion)
  or `check` (may be intentional).
- Verdict unchanged by uncited findings.

### Example 6 — PASS run

Input: empty

Process:
- All claims OK or MATCH (rounding only).
- All citations KEEP.
- Umbrella verdict `PASS`.
- Handoff recommends proceeding to council-session or compile.

### Example 7 — cross-model degraded

Input: empty (executor and configured reviewer happen to be same family)

Process:
- Step 0 warning: `cross_model: degraded`.
- All phases still run; reports include `cross_model: degraded`
  field so consumers know to weight verdicts cautiously.

## Anti-patterns

- Never block the pipeline. paper-audit produces verdicts; the user /
  @writer / @council apply fixes. Even on FAIL, do not refuse to emit
  the report or to allow downstream skills to run.
- Never use the executor model as the reviewer. The whole point is
  cross-family independence.
- Never reuse a previous audit run's reviewer thread. Each phase, each
  run, fresh thread.
- Never fabricate evidence values when matching claims. If you cannot
  locate the evidence, mark `MISSING`, do not invent.
- Never silently mutate the bib without explicit consent. Apply fixes
  only when the user / @writer explicitly says so. Citation phase
  default is "report only"; mutation needs `--apply` (not implemented
  in MVP — leave the option open).
- Never report PASS when any phase FAILS. Umbrella verdict is the
  max-severity of all phases.
- Never collapse per-claim or per-citation details into a summary.
  Each item has its own trace in `traces/`.
- Never run the experiment phase by default. Opt-in via `--only`. It
  reads source code and is slow.
- Never modify `lab/drafts/`. Audit is read-only over the lab.
- Never invent a new citation to "patch" a REMOVE verdict. REPLACE
  requires user decision on which paper to substitute.
- Never auto-resolve `[VERIFY]` markers without WebSearch lookup.
  Audit phase verifies via DBLP / CrossRef / arXiv; never from memory.
- Never compare paper numbers against another paper's numbers as
  "ground truth". Evidence must come from raw result files in
  lab/drafts/.

## Related

- Writer persona (`src/agents/writer.ts`) — Phase 5 (Audit) calls
  this skill. Drafts that have already passed the persona's
  citation-integrity discipline land here for a second-pass
  cross-model check.
- Council persona (`src/agents/council.ts`) — may delegate to
  paper-audit for the integrity portion of pre-submission review
  before running adversarial `council-session`.
- `paper-plan` — defines the Claims-Evidence Matrix this skill
  reconciles against the drafted text.
- `paper-figure` — produces the PDFs; audit verifies caption numbers
  match the scripts' actual outputs.
- ARIS audit skill ancestors:
  [paper-claim-audit](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/blob/main/skills/skills-codex/paper-claim-audit/SKILL.md),
  [citation-audit](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/blob/main/skills/skills-codex/citation-audit/SKILL.md),
  [experiment-audit](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/blob/main/skills/skills-codex/experiment-audit/SKILL.md)
  — folded here into one umbrella with `--only` phase selection.
- D20 — `audit` action format for `lab/log.md`.
- `<paper-dir>/.audit/` — output directory; per-run subdirectory
  preserves history for diffing fixes across iterations.
