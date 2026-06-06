---
name: paper-figure
description: Auto-generate publication-quality data plots for the paper from experiment result files. Read the figure inventory in `paper/PAPER_PLAN.md`, locate `result_files` from the referenced exp drafts, and produce one standalone Python script per figure that emits a vector PDF in `paper/figures/`. Also emit ready-to-paste LaTeX `\includegraphics` snippets. Covers line plots (learning curves), bar charts (method vs baseline), scatter plots, heatmaps (parameter sweeps), and box/violin plots (seed variance). Does NOT draw architecture diagrams, system pipelines, or any non-data figure — those are drawn by @writer directly. Use when user says "render the figures", "make the plots", "auto-generate figures", "plot fig 2", or when @writer needs the data plots for a paper draft.
argument-hint: <figure-id> | all | --hero | --auto-only | --dry-run
---

# Paper Figure

Target: $ARGUMENTS

## Purpose

Turn one (or all) figure-inventory rows from `PAPER_PLAN.md` into a
reproducible plot: one Python script that reads from exp result files
and emits a vector PDF.

- Read the figure inventory from `PAPER_PLAN.md`.
- For each in-scope figure, write `paper/figures/gen_<id>_<slug>.py`.
- Run the script to emit `paper/figures/<id>_<slug>.pdf`.
- Emit a `\includegraphics{...}` LaTeX snippet for @writer to paste.

You are the data-plot pipeline, not the design oracle. Architecture
diagrams, system overviews, schematic illustrations, and any figure
that does not read from result_files are NOT in scope — @writer draws
those (TikZ, Inkscape, etc.).

## Constants

- **PLAN_FILE** — `<project>/paper/PAPER_PLAN.md`.
- **FIGURES_DIR** — `<project>/paper/figures/`.
- **LAB_DRAFTS** — `<project>/lab/drafts/`.
- **LAB_LOG** — `<project>/lab/log.md`. One `draft` entry per session.
- **AUTO_GENERATABLE_TYPES** — the figure types this skill handles:
  - `line` — learning curves, time series, training curves
  - `bar` — categorical comparisons (method vs baselines)
  - `scatter` — pairwise comparisons, correlation plots
  - `heatmap` — 2D parameter sweeps, confusion matrices
  - `box` / `violin` — distribution / seed variance plots
  - `table` — LaTeX `\begin{tabular}` from per-condition aggregates
- **MANUAL_TYPES** — explicitly NOT in scope:
  - `diagram` — architecture, system pipeline, schematic
  - `image-sample` — generated samples (images, text completions)
  - any figure tagged `manual` in the inventory
  - For these, return a polite stub directing @writer to draw it.
- **PLOT_STYLE_DEFAULTS** — matplotlib settings consumed by every
  generated script:
  - DPI: 300 (for raster fallback)
  - Format: PDF (vector)
  - Base font size: 10 pt
  - Figure size: `(3.5, 2.5)` inches for single-column;
    `(7.0, 3.0)` for double-column (set by venue from PAPER_PLAN.md)
  - Grayscale-safe palette (default: tab10 with markers, not
    color-only encoding)
  - No chart junk: no grid backgrounds by default; legend without
    border; no figure title (caption lives in LaTeX, not the plot)
  - Tight layout
- **SCRIPT_HEADER_TEMPLATE** — every generated script includes a
  standard header block declaring inputs, outputs, and `set_seed`.

## Inputs

`$ARGUMENTS` is one of:

1. A specific figure id from PAPER_PLAN.md inventory: `F1`, `F2`, ...
2. `all` — render every auto-generatable figure in the inventory.
3. `--hero` — render only the figure tagged `hero` priority.
4. `--auto-only` — render all figures whose `type` is in
   AUTO_GENERATABLE_TYPES (skip manual silently).
5. `--dry-run` — write the script(s) but do not execute; useful when
   inspecting before render.
6. Empty → list figures available and ask.

## Process

### Step 0 — Read the figure inventory (HARD GATE)

1. Read `PAPER_PLAN.md`. Locate `## Figure / table inventory` table.
2. If `PAPER_PLAN.md` missing → STOP. "No paper plan found at
   <PLAN_FILE>. Run paper-plan first."
3. If the inventory table is missing or empty → STOP. "Plan exists
   but has no figure inventory. Re-run paper-plan."
4. Parse each row into:
   - `fig_id`: `F1`, `F2`, ...
   - `type`: line | bar | scatter | heatmap | box | violin | table | diagram | image-sample
   - `priority`: hero | main | ablation | appendix
   - `data_source`: text mentioning `exp:<slug>-<date>` and optionally
     specific `result_files` paths
   - `caption_seed`: one-line caption summary

5. Filter to the in-scope subset per `$ARGUMENTS`.

6. For each in-scope figure, check whether it is in
   `AUTO_GENERATABLE_TYPES`. If not (`diagram` / `image-sample` /
   `manual`-tagged), emit a stub message (see Step 6) and move on.

### Step 1 — Resolve data sources

For each in-scope auto-generatable figure:

1. Parse `data_source` to extract exp node ids and optional explicit
   paths.
2. Read each referenced exp draft `lab/drafts/exp-<slug>-<date>.md`.
3. Pull `results.result_files` list (written by `analyze-results`).
   If the list is empty:
   - Check the body's `## Run` section for a `runs_dir` reference.
   - If still nothing → flag the figure as `data-missing`, do not
     render, surface in the handoff.
4. Verify each referenced result file exists on disk:
   - exists → record absolute path.
   - missing → flag the figure as `data-missing`, do not render.

### Step 2 — Pick the right plot recipe

Recipe selection by type and data shape:

| Type | Recipe | When to use |
|---|---|---|
| `line` | seaborn / matplotlib line plot; mean over seeds with std band | training curves vs steps; multiple conditions overlaid |
| `bar` | matplotlib `bar` with error bars (std across seeds) | final metric per method/baseline, categorical x-axis |
| `scatter` | matplotlib `scatter` | pairwise (e.g. compute vs accuracy) or per-instance comparisons |
| `heatmap` | matplotlib `imshow` with annotation | 2D sweep (e.g. LR × batch size → final metric) |
| `box` | matplotlib `boxplot`; seaborn `boxplot` if mature data | seed variance distribution per condition |
| `violin` | matplotlib `violinplot` | dense distribution display |
| `table` | LaTeX `\begin{tabular}` from per-condition mean ± std | numerical result table, not a plot |

For `table` type: emit a `.tex` file (not `.py`) directly under
`paper/sections/tables/<id>_<slug>.tex` so `\input{}` works. No PDF.

### Step 3 — Write the Python script

Compose `paper/figures/gen_<fig_id>_<slug>.py` with this template:

```python
#!/usr/bin/env python3
"""
Generate <fig_id>: <caption seed>
Inputs:  <list of result file absolute paths>
Output:  paper/figures/<fig_id>_<slug>.pdf
Reproducibility: deterministic; no model calls; reads only result files.
"""

import json
import sys
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np

# ── Style ──────────────────────────────────────────────────────────────
plt.rcParams.update({
    "font.size": 10,
    "axes.labelsize": 10,
    "legend.fontsize": 9,
    "figure.figsize": (3.5, 2.5),
    "pdf.fonttype": 42,   # editable in Illustrator
    "ps.fonttype": 42,
    "savefig.bbox": "tight",
})

INPUTS = [
    "<absolute path 1>",
    "<absolute path 2>",
    ...
]
OUTPUT = "<absolute paper/figures path>"

# ── Load ───────────────────────────────────────────────────────────────
def load_one(path):
    with open(path) as f:
        return json.load(f)   # adapt to CSV / pkl if needed

datasets = {Path(p).parent.name: load_one(p) for p in INPUTS}

# ── Aggregate (mean ± std across seeds) ────────────────────────────────
# <type-specific aggregation code generated here>

# ── Plot ───────────────────────────────────────────────────────────────
fig, ax = plt.subplots()
# <type-specific plotting code generated here>
ax.set_xlabel("<x label from PAPER_PLAN context>")
ax.set_ylabel("<primary metric name from exp plan.metrics>")
ax.legend(frameon=False)
fig.savefig(OUTPUT, format="pdf")
print(f"Wrote {OUTPUT}")
```

Type-specific body (illustrative, line-plot example):

```python
xs = np.array(datasets["seed-42"]["steps"])
for name, data in datasets.items():
    ys = np.array(data["val_bpb"])
    ax.plot(xs, ys, label=name, lw=1.2)

# Optional: mean ± std band over seeds
seeds = np.stack([np.array(d["val_bpb"]) for d in datasets.values()])
mean, std = seeds.mean(0), seeds.std(0)
ax.plot(xs, mean, color="black", lw=1.5, label="mean")
ax.fill_between(xs, mean - std, mean + std, color="black", alpha=0.15)
```

Keep the script:

- Standalone (no `sys.path` mangling, no project imports).
- Reproducible (hard-coded INPUTS list with absolute paths so it can be
  re-run any time; seeds set if there is randomness, but there should
  not be).
- Compact (≤ 80 lines for simple plots, ≤ 150 for multi-panel).

### Step 4 — Execute the script

Unless `--dry-run`:

1. `python paper/figures/gen_<fig_id>_<slug>.py`
2. Capture stdout/stderr.
3. Verify the PDF was written; size > 0; file has `%PDF-` magic bytes.
4. On script error:
   - Surface the traceback verbatim.
   - Do NOT silently retry with a different recipe.
   - Mark figure as `render-failed`.

### Step 5 — Emit LaTeX snippet

For each rendered figure, produce a paste-ready snippet:

```latex
% Auto-generated by paper-figure for <fig_id>.
% Source script: paper/figures/gen_<fig_id>_<slug>.py
\begin{figure}[t]
  \centering
  \includegraphics[width=\linewidth]{figures/<fig_id>_<slug>.pdf}
  \caption{<caption seed from PAPER_PLAN.md inventory — refine in
    @writer's section drafting>}
  \label{fig:<slug>}
\end{figure}
```

Use `width=\linewidth` for single-column, `width=0.95\textwidth` for
double-column (set from venue in PAPER_PLAN.md frontmatter).

For `table` type: snippet is `\input{sections/tables/<id>_<slug>.tex}`
with optional caption block.

### Step 6 — Handle non-scope figures politely

For each in-scope figure whose `type` is in `MANUAL_TYPES`:

Do not error. Emit a clear stub for @writer:

```
Figure <fig_id> (<type>): NOT auto-generated by paper-figure.
  Caption seed: <seed>
  Source: <data_source from inventory>
  Recommendation: draw manually (TikZ for diagrams; Inkscape for
  schematics; sample exporter for generated images). Place the final
  vector PDF at paper/figures/<fig_id>_<slug>.pdf and use the same
  \includegraphics snippet shape paper-figure produces for the others.
```

This shows up in the handoff so @writer knows what's still owed.

### Step 7 — Append to lab/log.md

Append one entry per session:

```
## [YYYY-MM-DD HH:MM] draft | paper-figure rendered <N>/<M> figures
<rendered ids>; <skipped manual ids>; <failed ids>
Affected: <wikilinks of source exps>
```

### Step 8 — Return handoff

```
## Paper Figure
plan: <project>/paper/PAPER_PLAN.md
inventory: <M> figures total

## Rendered
- F1 (line, hero): paper/figures/F1_train_curves.pdf
  Source: exp:grpo-warmup-2026-06-04
- F2 (bar, main): paper/figures/F2_method_vs_baseline.pdf
  Source: exp:lr-sweep-2026-06-04
...

## Manual (drawn by @writer)
- F3 (diagram, hero): system overview — TikZ recommended.

## Skipped — data-missing
- F4: exp:cnn-baseline-2026-06-04 has no result_files (status: failed)

## Render failures
- (none) or: <fig_id>: <traceback summary>

## LaTeX snippets
(one block per rendered figure — paste into the appropriate section)

\begin{figure}[t]
  \includegraphics[width=\linewidth]{figures/F1_train_curves.pdf}
  \caption{Validation BPB over training steps, mean ± std across 3 seeds.}
  \label{fig:train-curves}
\end{figure}

...

## Next
- @writer pastes snippets into sections/*.tex.
- @writer draws F3 (manual diagram) and saves to paper/figures/F3_*.pdf.
- After all figures land, run paper-audit (claim phase verifies the
  numbers in captions match the underlying result files).
```

## Examples

### Example 1 — render all auto-generatable figures

Input: `all`

Process:
- Step 0: 4 figures in inventory: F1 line/hero, F2 bar/main, F3
  diagram/hero, F4 line/ablation.
- Step 1: F1 + F2 + F4 data resolved; F3 is diagram → stub.
- Steps 3-4: write and execute 3 scripts.
- Step 6: F3 stub.
- Step 8: handoff shows 3 rendered + 1 manual.

### Example 2 — single figure re-render

Input: `F2`

Process:
- Step 0: inventory parsed, filter to F2 only.
- Renders just F2.
- Handoff focuses on F2.

### Example 3 — dry run for inspection

Input: `all --dry-run`

Process:
- Steps 0-3: write scripts to disk.
- Step 4 skipped.
- Step 8 handoff notes "scripts written; no PDFs generated yet. Inspect
  paper/figures/gen_*.py and re-run without --dry-run to render."

### Example 4 — data missing for one figure

Input: `all`

Process:
- F1 OK, F2 OK, F3 manual (stub), F4: referenced exp has empty
  `results.result_files` (still running or failed).
- F4 marked `data-missing`; handoff calls out routing back to @coder.

### Example 5 — Python script crashes

Input: `F2`

Process:
- Step 4: matplotlib raises `ValueError: x and y must have same first
  dimension`.
- Skill surfaces the traceback verbatim, does NOT auto-fix.
- Handoff notes render-failed and suggests inspecting the result file
  shape vs the generated aggregation.

### Example 6 — table type → LaTeX file

Input: `F5`  (F5 is `table` type per inventory)

Process:
- Compute mean ± std per condition from result_files.
- Emit `paper/sections/tables/F5_main_table.tex` with `tabular` block,
  not a PDF.
- Snippet uses `\input{sections/tables/F5_main_table.tex}`.

## Anti-patterns

- Never invent data. If a referenced result file is missing, do NOT
  fabricate plausible numbers. Flag data-missing and move on.
- Never auto-fix a render error by swapping the data shape. The script
  is a contract with the underlying result file format.
- Never embed figure titles inside the plot. Caption belongs in
  LaTeX `\caption{}`.
- Never use color-only encoding. Add markers / linestyles so the
  figure is readable in grayscale print.
- Never hardcode numbers in the script. Numbers come from the result
  files via INPUTS list.
- Never write a draft `.tex` section. paper-figure produces snippets
  for paste; @writer composes the prose.
- Never silently skip a `data-missing` figure. Surface it explicitly
  in the handoff.
- Never inflate the plot DPI to mask a low-resolution issue. Vector
  PDF is the format; rasterizing is wrong.
- Never modify lab/drafts/. Read-only over exp drafts.
- Never re-run a failed render with different settings to "see if it
  works". Inspect the data first.
- Never auto-generate `diagram` / `image-sample` figures. They belong
  to @writer; emit a stub instead.

## Related

- `paper-plan` — owns the figure inventory this skill consumes. If
  the inventory is wrong or empty, fix it in PAPER_PLAN.md before
  re-running paper-figure.
- Writer persona (`src/agents/writer.ts`) — owns figure design
  philosophy (Figure 1 hero, captions self-contained, no chart junk,
  vector PDF) which this skill implements procedurally. Persona
  prompt rules are authoritative; this skill executes them.
- `analyze-results` — produces the `results.result_files` list this
  skill reads. If a figure shows `data-missing`, route back to @coder
  to finalize the exp.
- `paper-audit` (claim phase) — verifies that numbers cited in the
  paper match the result files this skill plotted from.
- `<project>/paper/figures/` — output directory; scripts are kept
  alongside PDFs for reproducibility.
- D20 — `draft` action format for `lab/log.md`.
