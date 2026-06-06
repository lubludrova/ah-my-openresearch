---
name: monitor-experiment
description: Poll a running experiment and produce a per-seed verdict (CONTINUE / WAIT / STOP). Read screens, tee logs, JSON metric files, and optionally W&B; compute training-quality checks (NaN/Inf, sustained divergence, plateau, wall-clock overrun); return a structured status report and, when all seeds have exited cleanly, hint to finalize via analyze-results. Read-only — never writes the exp draft or kills jobs. Use when user says "how is exp:<slug> going", "check progress", "monitor exp:<slug>", "is training healthy", or when the orchestrator routes an `experiment-monitor` category task to @coder.
argument-hint: <exp-id> | <natural-language-ref>
---

# Monitor Experiment

Target: $ARGUMENTS

## Purpose

Pulse-check a running experiment. You are the inspector, not the launcher
or the finaliser:

- Collect live evidence (screens, logs, JSON, optional W&B).
- Apply training-quality checks (NaN/Inf, divergence, plateau, overrun).
- Emit a CONTINUE / WAIT / STOP verdict per seed.
- Hint when ready to finalize.

Hard rule: **read-only**. You do not edit the exp draft, you do not append
to `lab/log.md`, you do not kill screens. STOP is a verdict you surface;
the @coder persona decides whether to act on it and run the kill itself
per its prompt.

## Constants

- **LAB_DRAFTS** — `<project>/lab/drafts/`. Read exp drafts here.
- **LAB_INDEX** — `<project>/lab/index.md`. Read for inventory.
- **PROJECT_AGENTS** — `<project>/AGENTS.md`. Backend + wandb config.
- **DEFAULT_RUNS_DIR** — `<project>/runs/exp-<slug>-<date>/seed-<N>/`.
  Same convention as `run-experiment`.
- **TAIL_LINES = 100** — Log tail read per screen / per check.
- **PLATEAU_WINDOW = 200** — Last N steps used to detect plateau.
- **PLATEAU_EPS = 1e-4** — `|max − min|` over the window below this = plateau.
- **DIVERGENCE_RUN = 5** — N consecutive eval points where the primary
  metric moves the wrong direction → divergence.
- **WALL_CLOCK_OVERRUN = 2.0** — Multiply by `plan.expected_runtime` (if
  declared) to compute the overrun flag time.

## Inputs

`$ARGUMENTS` is one of:

1. A full node id: `exp:<slug>-<YYYY-MM-DD>`.
2. A bare slug: `<slug>` — resolve to the latest matching exp draft.
3. A natural-language reference: "the GRPO warmup run" — find the single
   matching `status: running` exp; ambiguous → ask.
4. Empty — list all `status: running` exps from `lab/index.md`. If exactly
   one → use it. If zero → say so and stop. If more than one → ask which.

## Process

### Step 0 — Resolve the draft (HARD GATE)

1. Resolve `$ARGUMENTS` to one `<project>/lab/drafts/exp-<slug>-<date>.md`.
2. Parse frontmatter. `status` MUST be `running`. If `planned`:
   - "Not launched yet. Did you mean run-experiment?"
   If `completed` / `failed` / `abandoned`:
   - "Already finalized (`<status>`). The last run section is from
     `<run.started_at>`. Did you mean analyze-results or a re-launch?"
3. Read the body's `## Run` section (written by run-experiment) for:
   `backend`, `devices`, `screens`, `runs_dir`, `wandb_project` (if any),
   `launched_at`.

### Step 1 — Detect backend

Re-read `<project>/AGENTS.md`'s `## amore` block to confirm backend and
W&B settings agree with what's recorded in the draft body. Mismatch
(e.g. draft says `local`, AGENTS now says `ssh`) → surface as a warning
in the report; do not silently re-route the probe. Keep monitoring the
backend recorded in the draft.

### Step 2 — Collect per-seed evidence

For each `(seed, screen)` pair in the draft body's screens list:

#### Step 2a — Screen liveness

- Local: `screen -ls | grep <screen>` and, if present, find the inner
  PID via `screen -S <screen> -X writebuf` then `ps -o pid= -p ...`.
- SSH: same wrapped in `ssh <host> "..."`.

Map state:

| screen | python PID | state               |
|--------|------------|---------------------|
| present | alive     | `running`           |
| present | gone      | `screen-orphan`     |
| absent  | —         | `screen-gone`       |
| timeout / ssh error | — | `probe-failed`    |

#### Step 2b — Tail the log

For `running`, `screen-orphan`, and `screen-gone`:

- Read last `TAIL_LINES` lines of `<runs_dir>/seed-<N>/train.log`.
- Parse metric lines per the plan's metric names. If the project uses
  structured logs (JSON-per-line) prefer that; otherwise fall back to
  regex on the human-readable training output.

If the tail is empty AND screen is `screen-gone` → likely crashed before
emitting metrics. Surface explicitly.

#### Step 2c — Read metrics file (if present)

If `<runs_dir>/seed-<N>/metrics.json` (or `.csv`) exists, read it as the
preferred truth source — files outlive screens. Keep stdout-tail metrics
as fallback.

#### Step 2d — W&B (optional; only if AGENTS.md `wandb: true`)

For each seed, if a W&B run id was recorded (typical: in `train.log`
as `wandb: Syncing run <id>`):

```python
import wandb
api = wandb.Api()
run = api.run(f"<entity>/<project>/{run_id}")
history = list(run.history(samples=50, keys=plan.metrics + ["train/loss"]))
summary = dict(run.summary)
```

- If W&B is configured but unreachable → note connectivity issue and
  fall back to log/json evidence. Do NOT treat missing W&B as failure.
- Always capture `run.url` for the report.

### Step 3 — Training-quality checks per seed

Apply each check against the evidence assembled in Step 2. Stop early
on the first STOP-level finding; do not double-report.

#### Hard failures → STOP

- Any `nan` or `inf` in metric values within the tail / metrics file.
- Process exit code present and non-zero in `train.log`.
- `screen-gone` AND last metrics absent AND no `metrics.json` → crashed.

#### Sustained divergence → STOP

- For the plan's primary metric (first entry of `plan.metrics`), if the
  last `DIVERGENCE_RUN` consecutive eval points move opposite to
  `plan.success_direction` (default: assume "lower is better" if metric
  contains "loss" / "bpb" / "error"; else "higher is better"; if unclear,
  treat as WAIT and report).
- Plateau alone is NOT divergence. Plateau is WAIT.

#### Wall-clock overrun → flag (not STOP by itself)

- If `plan.expected_runtime` is declared, compute deadline =
  `launched_at + WALL_CLOCK_OVERRUN * expected_runtime`.
- If now > deadline AND seed still `running`, flag in the report and add
  a WAIT recommendation. Escalate to STOP only if combined with another
  signal (e.g. plateau + overrun = STOP).

#### Plateau → WAIT

- Over the last `PLATEAU_WINDOW` eval points, if `max − min <
  PLATEAU_EPS` for the primary metric → plateau. Report it; recommend
  re-checking later or finalizing if plateau persists across two monitors.

#### Healthy → CONTINUE

- None of the above triggered; metrics are progressing in the expected
  direction; screen running; log fresh (last metric line < 5 min old).

### Step 4 — Compute "ready to finalize" hint

A hint, never an action. The trigger:

- All seeds have left `running` (each is `screen-gone` or `screen-orphan`).
- Each seed has either `metrics.json` present OR a clean "training
  finished" marker in the log tail.
- No STOP-level finding requiring user attention first.

When triggered, add the hint to the report:

```
Ready to finalize → @coder analyze-results exp:<slug>-<date>
```

If any seed has a STOP-level finding, instead say:

```
At least one seed flagged STOP. Decide kill / preserve / restart before
running analyze-results on partial evidence.
```

### Step 5 — Format and return the report

Return this block verbatim:

```
## Monitor
exp: exp:<slug>-<date>
backend: local | ssh@<host>
launched: <relative ago> (at <launched_at>)
elapsed: <Xm>  expected: <Ym> (overrun threshold <Zm>)
wandb: <run.url> | n/a

## Per-seed
| seed | screen-state    | last step | <primary metric> | other metrics      | verdict   |
|------|-----------------|-----------|------------------|--------------------|-----------|
| 42   | running         | 1200      | 0.34 (-)         | eval=0.71 (+)      | CONTINUE  |
| 7    | running         | 850       | nan              | —                  | STOP      |
| 1337 | screen-gone     | 5000      | 0.28 (-)         | eval=0.79 (+)      | finalize  |

Legend: (-) lower is better, (+) higher is better.

## Findings
- seed=7: NaN in primary metric at step 850. Kill / preserve logs / restart.
- seed=42: healthy trend (loss -0.04 over last 200 steps).
- seed=1337: clean exit; metrics.json present. Ready for analyze.

## Verdict per seed
- 42:   CONTINUE — keep training.
- 7:    STOP — hard failure (NaN). Action needed.
- 1337: finalize — training ended cleanly.

## Action
Two seeds done, one diverged. Suggested next:
1. Decide on seed=7 (kill + preserve / restart with smaller LR).
2. Wait for seed=42 to finish (~10m remaining).
3. Then: @coder analyze-results exp:<slug>-<date>.
```

If `screen-gone` for ALL seeds AND all metrics present AND no STOP:

```
## Action
All seeds finished cleanly. Ready to finalize.
→ @coder analyze-results exp:<slug>-<date>
```

If exactly zero useful evidence yet (just-launched, < 1 min):

```
## Status
Too early — no metric lines yet (run elapsed: <Xs>). Recheck in ~1 min.
```

## Examples

### Example 1 — all healthy, mid-run

Input: `exp:grpo-warmup-2026-06-04`

- 3 seeds, all `running`, fresh metric lines, no NaN, no divergence,
  loss trending down. No W&B.
- Output: per-seed table, all `CONTINUE`, no Action urgency, elapsed
  ~30% of expected.

### Example 2 — one seed NaN, others healthy

Input: `exp:grpo-warmup-2026-06-04`

- seed=7 hit NaN at step 850.
- Output (as in Step 5 template): STOP for seed=7, CONTINUE for the rest.
  Hint: kill + preserve logs + decide on restart; do NOT run
  analyze-results yet.

### Example 3 — all seeds done

Input: `exp:lr-sweep-2026-06-04`

- All screens gone; `metrics.json` present for all 3 seeds. No flagged
  failures.
- Output: per-seed table marking each `finalize`, recommendation:

```
All seeds finished cleanly. Ready to finalize.
→ @coder analyze-results exp:<slug>-<date>
```

### Example 4 — W&B reachable, log fallback used

Input: `exp:cnn-baseline-2026-06-04`

- AGENTS.md has `wandb: true`. W&B API is slow but reachable for
  seed=42, times out for seed=7.
- Skill reports W&B data for 42 and log-based metrics for 7, flags
  partial connectivity, recommends WAIT.

### Example 5 — too-early call

Input: `exp:big-grpo-2026-06-04`

- Elapsed 40 seconds, no metric lines yet.
- Output:

```
## Status
Too early — no metric lines yet (run elapsed: 40s). Recheck in ~1 min.
```

## Anti-patterns

- Never write to the exp draft. Read-only. status / run / results
  edits belong to `run-experiment` / `analyze-results`.
- Never append to `lab/log.md`. Polling is not a state change.
- Never kill a screen. STOP is a verdict; the @coder persona decides
  whether to act, then executes the kill itself per its prompt.
- Never treat ordinary metric noise as divergence. Require sustained
  trend across at least `DIVERGENCE_RUN` consecutive eval points.
- Never declare success. CONTINUE means "still going, no obvious issue",
  not "this experiment supports its claim". That verdict is for
  analyze-results.
- Never declare failure on missing W&B alone. Fall back to logs.
- Never silently re-route the probe to a different backend than the one
  recorded in the draft. Mismatch → warn, keep probing the recorded one.
- Never invent metric names or success directions. Use `plan.metrics` and
  a documented heuristic; if unclear, report and ask.
- Never run analyze-results yourself. You only HINT it.
- Never collect evidence into a private cache the user can't see. Quote
  log paths, screen names, and W&B URLs explicitly in the report so the
  user can independently verify.

## Related

- Coder persona (`src/agents/coder.ts`) — owns the CONTINUE/WAIT/STOP
  matrix philosophy and the rule "monitor is read-only". This skill
  implements the procedure.
- `run-experiment` — wrote the `## Run` section in the draft body that
  this skill relies on (devices, screens, runs_dir, wandb_project).
- `analyze-results` — the next step after a successful finalize hint.
- `intake-dispatch-summary` — classifies `experiment-monitor` requests
  and routes to @coder, which then picks this skill.
- The lab artifact schema (`<project>/lab/SCHEMA.md`,
  `src/lab/artifact-schema.ts`) — authoritative for exp frontmatter.
- `<project>/AGENTS.md` — authoritative for backend, W&B, and runs-dir
  overrides.
