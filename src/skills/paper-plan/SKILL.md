---
name: paper-plan
description: Bootstrap a paper project and build its planning spine. Resolve the target venue, scaffold `<project>/paper/` with the venue-specific LaTeX skeleton, walk `lab/drafts/claim-*.md` and `exp-*.md` to build a Claims-Evidence Matrix, propose a section structure within the venue's page budget, inventory required figures + tables, and assemble a candidate citation list. Output a single `paper/PAPER_PLAN.md` for the @writer persona to consume during drafting. Use when user says "outline the paper", "write the paper plan", "plan the <venue> submission", "what claims should this paper make", "start the paper for <project>", or when the orchestrator routes a paper-planning task to @writer.
argument-hint: <venue-or-natural-language> [--rebuild] [--scope claim:<slug>,...]
---

# Paper Plan

Target: $ARGUMENTS

## Purpose

Produce the paper's planning spine — the Claims-Evidence Matrix and
section outline that all subsequent paper work (drafting, figures,
audit) consumes. You are the bootstrapper, not the drafter:

- Bootstrap `<project>/paper/` if it doesn't exist.
- Build the Claims-Evidence Matrix from lab artifacts.
- Propose section structure under the venue's page budget.
- Inventory figures, tables, and citations.
- Write `<project>/paper/PAPER_PLAN.md`.

You do NOT draft `.tex` sections (that is @writer's direct work) or
auto-generate figures (that is `paper-figure`). You produce the plan
they both consume.

## Constants

- **PAPER_DIR** — `<project>/paper/`.
- **PLAN_FILE** — `<project>/paper/PAPER_PLAN.md`.
- **PAPER_ASSETS** — `<project>/paper/{main.tex, sections/, figures/, references.bib}`.
- **LAB_DRAFTS** — `<project>/lab/drafts/`.
- **LAB_LOG** — `<project>/lab/log.md`. One `draft` action entry appended.
- **WIKI_PATH** — outside literature wiki, optional source for citations.
- **VENUE_REGISTRY** — known venues with page budgets and citation styles:

  | Venue | Pages | Cite style | Template hint | Refs in page count? |
  |---|---|---|---|---|
  | `iclr` | 9 | natbib `\citep` / `\citet` | `iclr2026_conference.sty` | no |
  | `neurips` | 9 | natbib | `neurips_2026.sty` | no |
  | `icml` | 8 | natbib | `icml2026.sty` | no |
  | `acl` | 8 | natbib (acl) | `acl.sty` | no |
  | `cvpr` | 8 | natbib | `cvpr.sty` | no |
  | `ieee-conf` | 6 | numeric `\cite{}` | `IEEEtran.cls` (conference) | yes |
  | `ieee-tnnls` | 14 | numeric | `IEEEtran.cls` (transactions) | yes |
  | `ieee-letter` | 5 | numeric | `IEEEtran.cls` (letter) | yes |
  | `arxiv` | unlimited | natbib (suggested) | bare `article` class | n/a |
  | `workshop` | 4 | natbib | `iclrworkshop.sty` etc. | usually no |
  | `custom` | (user-provided) | (user-provided) | (user-provided) | (user-provided) |

- **DEFAULT_VENUE = arxiv** — if user says "just plan the paper" with no venue.

## Inputs

`$ARGUMENTS` is one of:

1. Venue name from VENUE_REGISTRY: `iclr`, `neurips`, `ieee-tnnls`, etc.
2. Natural-language: "the ICLR submission", "workshop paper", "arXiv".
3. `--rebuild` — overwrite existing PAPER_PLAN.md (default refuses).
4. `--scope claim:<slug>,claim:<slug>` — restrict matrix to specific claims
   (default: all `claim-*.md` with `status: supported` or `partial`).
5. Empty → ask venue.

## Process

### Step 0 — Resolve venue (HARD GATE)

1. Parse venue from `$ARGUMENTS`. Map natural-language → registry key.
2. If unrecognized → ask user with the VENUE_REGISTRY list; do not
   invent a venue.
3. If `custom`, ask for: page budget (int), cite style, template hint,
   refs-in-page-count (bool).
4. Record resolved venue. It will live in `PAPER_PLAN.md` frontmatter
   as the single source of truth for downstream paper skills.

### Step 1 — Inspect lab state (HARD GATE)

Read:

- `<project>/lab/index.md` — current inventory.
- `<project>/lab/SCHEMA.md` — artifact schema reference.
- All `lab/drafts/claim-*.md` whose `status` is `supported` or
  `partial`. (Skip `open` and `invalidated` by default.)
- All `lab/drafts/exp-*.md` referenced by those claims (via
  `tested_by:` or `claim_refs:`).

If `--scope` is set, restrict to the listed claims and their tested-by
exps.

If 0 supported/partial claims exist → STOP. "Cannot plan a paper with
no supported or partial claims. Route work back to @coder /
@librarian to land at least 2-3 supported claims first."

Minimum viable spine: 2-3 supported claims. Warn if < 2.

### Step 2 — Check for existing paper/

1. If `<project>/paper/` does not exist → scaffold it (Step 3).
2. If exists AND `PAPER_PLAN.md` exists AND `--rebuild` not set →
   STOP. "Plan exists at <PLAN_FILE>. Pass --rebuild to overwrite, or
   edit it manually."
3. If exists AND `--rebuild` set → keep `main.tex`, `references.bib`,
   `figures/`, `sections/` intact (do not destroy work); only
   regenerate `PAPER_PLAN.md`.
4. If exists but `PAPER_PLAN.md` missing → proceed to build it without
   re-scaffolding.

### Step 3 — Scaffold paper/ if needed

Create the venue-specific skeleton. Layout:

```
<project>/paper/
├── PAPER_PLAN.md
├── main.tex                  # \documentclass + \input{sections/...}
├── references.bib             # initially empty
├── sections/                  # one .tex per section (created during drafting)
│   └── .gitkeep
└── figures/                   # one .pdf + one .py per figure (created by paper-figure)
    └── .gitkeep
```

`main.tex` initial content depends on venue:

- ML venues (iclr/neurips/icml/acl/cvpr): natbib + standard preamble +
  `\input{sections/0_abstract.tex}` ... placeholder list.
- IEEE: `IEEEtran` class + numeric cite + IEEE preamble.
- arxiv: bare `article` with natbib.
- Templates are skeletons — minimal, no Lorem ipsum. The user / writer
  fills them.

Do NOT include venue style files (`.sty`, `.cls`) themselves —
reference them with the standard filenames; user installs them per
venue instructions.

### Step 4 — Build the Claims-Evidence Matrix

For each in-scope claim, extract:

- `claim_id`: the node id (`claim:<slug>`).
- `statement`: the claim's title or first body sentence.
- `confidence`: from frontmatter (`low | medium | high`).
- `status`: from frontmatter (`supported | partial`).
- `supporting_exps`: list of `exp:<slug>-<date>` from `tested_by` AND
  any exp whose `claim_refs` includes this claim.
- `evidence_files`: union of `results.result_files` from each
  supporting exp.
- `outcome_summary`: union of `results.summary` from each supporting
  exp.
- `target_section`: heuristic guess (see Step 5).
- `known_weaknesses`: from claim body's `## Weaknesses` or `## Scope`
  section if present; else blank.
- `citations`: from claim's `provenance.sources` (wiki/arxiv/doi refs).

Compose as a markdown table:

```markdown
| # | Claim | Conf | Status | Supporting exps | Target § | Weakness |
|---|-------|------|--------|-----------------|----------|----------|
| C1 | claim:lr-warmup-helps-grpo | high | supported | exp:grpo-warmup-2026-06-04 | Method+Experiments | n=3 seeds |
| C2 | ... | ... | ... | ... | ... | ... |
```

Order by (confidence desc, then status `supported` before `partial`).
The top-ranked claim is the paper's headline contribution; flag it.

### Step 5 — Propose section structure

Pick a structure template by paper type:

- **Empirical ML** (default for our user / slm_agent): abstract,
  introduction, related work, method, experiments, results,
  discussion, conclusion. 7-8 sections.
- **Theory**: abstract, intro, preliminaries, theoretical analysis,
  proofs (appendix), experiments (if any), discussion, conclusion.
- **Method-driven** (model architecture): abstract, intro, related,
  method, experiments, results, ablations, conclusion.
- **Survey**: abstract, intro, taxonomy, sections per axis,
  open challenges, conclusion.

For each section, allocate:

- Page budget (sum within venue limit; account for refs-in-count for
  IEEE).
- Which claims (from Step 4 matrix) land here.
- Required figures (Step 6).
- Required citations (Step 7).

Default page allocation for empirical 9-pager:

| Section | Pages | Notes |
|---|---|---|
| Abstract + intro | 1.5 | hero figure included |
| Related work | 1 | strict; over-citing wastes budget |
| Method | 2 | formal defs, algorithm, notation |
| Experiments | 2 | setup, hyperparams, evaluation protocol |
| Results | 1.5 | main tables, learning curves |
| Discussion + conclusion | 1 | limitations, future work |
| **Total** | **9** | within ICLR/NeurIPS budget |

Adjust per matrix size; surface budget violations explicitly.

### Step 6 — Figure / table inventory

For each claim with quantitative evidence:

- **Figure type** suggested per evidence shape:
  - learning curves over training steps → line plot (`paper-figure`)
  - method vs baselines across N conditions → bar chart (`paper-figure`)
  - hyperparameter sweep → heatmap or line plot per param (`paper-figure`)
  - seed variance distribution → box / violin (`paper-figure`)
  - architecture / system pipeline → manual diagram (NOT
    `paper-figure`, drawn by @writer)
- **Priority**: hero (Fig 1), main, ablation, appendix.
- **Data source**: which exp draft, which `result_files` entry.
- **Suggested caption seed**: one-sentence summary the writer will
  expand.

Compose as a markdown table:

```markdown
| Fig | Type | Priority | Data source | Suggested caption seed |
|---|---|---|---|---|
| F1 | line plot | hero | exp:grpo-warmup-2026-06-04, runs/.../seed-{42,7,1337}/metrics.json | Validation BPB over training steps, mean ± std across 3 seeds. |
| F2 | bar chart | main | exp:lr-sweep-2026-06-04 | Final val_bpb by LR schedule. |
| F3 | diagram | hero | manual (architecture) | System overview: prospector → coder → council. |
```

Hero figure: pick the single most-comprehensible figure that explains
the paper's contribution at a skim. Mark it `F1: hero`.

### Step 7 — Citation candidate list

For each claim's `provenance.sources`:

- Walk the wiki note at `<WIKI_PATH>/<wiki-slug>.md` (if present) for
  the canonical bibliographic metadata.
- Otherwise, record the arXiv/DOI ref as `[VERIFY]` — `paper-write`
  (i.e. the writer persona during drafting) will resolve via
  DBLP/CrossRef before insertion.

Compose as a markdown list:

```markdown
## Citation candidates

- [VERIFY] arXiv 2501.12599 — shao-2025-deepseek-r1 (from
  claim:grpo-baseline)
- [VERIFY] doi:10.48550/arXiv.2501.99999 — author-year-title (from
  claim:lr-warmup-helps-grpo)
- (wiki note exists) wiki:papers/lecun-1989-backprop — full BibTeX
  available from wiki
```

This is a candidate list. `paper-write` (the persona writing it)
verifies each via DBLP/CrossRef before adding to `references.bib`.
Memory-based BibTeX is forbidden per `writer.ts` Citation integrity.

### Step 8 — Compose PAPER_PLAN.md

Write the plan with this top-of-file frontmatter (consumed by
downstream skills):

```yaml
---
schema_version: v1.0
type: paper-plan
venue: iclr | neurips | icml | ieee-tnnls | arxiv | ...
target_pages: 9
cite_style: natbib | numeric
refs_in_page_count: false
anonymous: true | false
target_submission_date: <YYYY-MM-DD or "tbd">
created: <YYYY-MM-DD>
updated: <YYYY-MM-DD>
---
```

Body sections (in this order):

1. `# <Paper working title>` — derived from the headline claim's
   statement; user will refine.
2. `## Headline contribution` — one paragraph, the spine of the paper.
3. `## Claims-Evidence Matrix` — table from Step 4.
4. `## Section outline` — table from Step 5 + per-section bullet
   notes on what evidence and citations land where.
5. `## Figure / table inventory` — table from Step 6.
6. `## Citation candidates` — list from Step 7.
7. `## Open issues` — explicit list of things @writer needs to decide
   before drafting:
   - Title finalization.
   - Author list, affiliations.
   - Funding / acknowledgements.
   - Anonymous? (camera-ready vs submission).
   - Repo URL placement.
   - Any `[VERIFY]` citations.
   - Any manual figures the user must draw.
8. `## Handoff` — next-action recommendation:
   - For the writer persona to draft sections in order.
   - For `paper-figure` to render the auto-generatable figures.
   - For `paper-audit` once a complete draft exists.

### Step 9 — Append to lab/log.md

Append per D20 format:

```
## [YYYY-MM-DD HH:MM] draft | paper-plan for <venue>
<N> claims in matrix; <M> figures; <K> citations to verify.
Affected: <list of claim wikilinks>
```

`Affected:` lists every claim in the matrix as a wikilink so the lab
index reflects that these claims are "in the paper pipeline".

### Step 10 — Return handoff

```
## Paper Plan
venue: <venue> (<pages> pages, <cite_style>)
plan: <project>/paper/PAPER_PLAN.md
scaffold: <project>/paper/{main.tex, references.bib, sections/, figures/}

## Spine
- Headline: <one-line headline contribution>
- Claims in matrix: <N>
- Hero figure: <F1 spec>

## Open issues
- <bullet list from PAPER_PLAN.md § Open issues>

## Next
- @writer drafts sections in order (Method → Experiments → Results →
  Intro → Related → Conclusion → Abstract).
- @writer runs paper-figure on auto-generatable figures (F1, F2, ...).
- After full draft + figures, @writer runs paper-audit (claim +
  citation phases) before any council review.
- For high-stakes section review or pre-submission stress test, route
  to @council `council-session --goal review --artifact <section>`.
```

## Examples

### Example 1 — fresh ICLR plan from slm_agent

Input: `iclr`

Process:
- Step 0: venue iclr, 9 pages, natbib, refs excluded.
- Step 1: 3 supported claims found, 5 supporting exps.
- Step 2-3: paper/ scaffolded with ICLR skeleton.
- Step 4: 3-row matrix; headline = top-confidence claim.
- Step 5: empirical-ML section split, 9 pages total.
- Step 6: 4 figures (1 hero, 2 main, 1 ablation); 1 manual architecture
  diagram flagged for user.
- Step 7: 8 candidate citations, 6 `[VERIFY]`.
- Steps 8-10: PAPER_PLAN.md written, log entry appended, handoff
  returned.

### Example 2 — only 1 supported claim → warn

Input: `iclr`

Process:
- Step 1: 1 supported claim, 1 partial, 3 open.
- Warn: "Minimum viable spine is 2-3 supported claims; you have 1
  supported + 1 partial. Proceed (the paper will be thin) or land
  more claims first?"
- If proceed: matrix has 2 rows (supported + partial), partial is
  flagged in the matrix.

### Example 3 — IEEE journal (refs in page count)

Input: `ieee-tnnls`

Process:
- Step 0: venue ieee-tnnls, 14 pages, numeric cite, refs IN page count.
- Step 3: scaffold with `IEEEtran` class + `\bibliographystyle{IEEEtran}`.
- Step 5: page allocation accounts for ~2 pages of refs at the end.
- Step 8: PAPER_PLAN.md frontmatter has `refs_in_page_count: true`.

### Example 4 — `--scope` to focus on subset

Input: `iclr --scope claim:lr-warmup-helps-grpo,claim:reward-shaping-helps-grpo`

Process:
- Step 1: only those 2 claims + their supporting exps in matrix.
- Step 4: matrix has exactly 2 rows.
- Rest of the plan structured around the 2 claims only.

### Example 5 — `--rebuild` after refinement

Input: `iclr --rebuild`

Process:
- Step 2: paper/ exists with sections/0_abstract.tex partially drafted.
- Step 3 skipped (sections/, references.bib preserved).
- PAPER_PLAN.md regenerated (existing one overwritten).
- Existing drafts in sections/ are not modified.

## Anti-patterns

- Never invent a venue not in VENUE_REGISTRY. Ask the user or use
  `custom` with explicit page budget + cite style.
- Never include `open` or `invalidated` claims in the matrix. They
  haven't earned a place in the paper yet.
- Never auto-overwrite an existing PAPER_PLAN.md without `--rebuild`.
- Never auto-destroy existing `sections/*.tex` or `references.bib`
  during scaffold or rebuild. Those are @writer's work product.
- Never embed venue style files (`.sty`, `.cls`). Reference by name;
  user installs per venue instructions.
- Never generate BibTeX entries from memory. Citation candidates are
  `[VERIFY]` markers + wiki refs only.
- Never write to `lab/drafts/`. Read-only over claims and exps.
- Never extract new claims from evidence here. That is @librarian +
  `claim-extract`. paper-plan only references existing claims.
- Never propose a structure that violates the venue's page budget
  without explicit warning. Page count is a hard constraint.
- Never silently include a claim with `status: partial` as if it were
  `supported`. Always mark status in the matrix.

## Related

- Writer persona (`src/agents/writer.ts`) — owns the writing-craft
  rules and consumes PAPER_PLAN.md when drafting sections directly.
  Drafting is not delegated to a skill (Wave 4 design decision).
- `paper-figure` — reads the matrix's evidence_files column and the
  figure inventory to auto-render data plots.
- `paper-audit` — runs once a complete draft exists; cross-checks the
  matrix's claims against actual numbers in the drafted text.
- `council-session` — used by @writer's Phase 6 R2 fresh review and
  pre-submission stress test on a near-final draft.
- `<project>/lab/drafts/` — source of all claims and exps. Schema in
  `<project>/lab/SCHEMA.md` and `src/lab/artifact-schema.ts`.
- D20 — `draft` action format for `lab/log.md`.
