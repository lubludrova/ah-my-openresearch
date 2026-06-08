---
name: run-experiment
description: Launch a planned experiment from its lab draft. Read the exp draft's plan and command notes, check git tree, run the sanity stage, bind GPUs, launch one local screen per seed, update the draft's run section, flip status planned → running, append a lab/log.md update entry, and return a launch summary. Use when user says "run exp:<slug>", "kick off the <name> experiment", "launch the planned run", "start training for <exp>", or when the orchestrator routes an `experiment-run` category task to @coder.
argument-hint: <exp-id> | <natural-language-ref>
---

# Run Experiment

Target: $ARGUMENTS

## Purpose

Take one planned experiment draft (`exp-<slug>-<YYYY-MM-DD>.md`) and turn it
into running jobs. You are the launcher, not the analyser:

- Validate the plan, check the working tree, do a sanity run.
- Launch one local screen per seed.
- Write the `run` section and flip status `planned → running`.
- Hand back a launch summary. Do NOT wait for completion. Do NOT analyse.

Result finalization (`running → completed/failed/abandoned`, comparison
tables, outcome verdict) belongs to `analyze-results`. Mid-run inspection
belongs to `monitor-experiment`. Claim extraction belongs to @librarian.

## Constants

- **LAB_DRAFTS** — `<project>/lab/drafts/`. Where exp-*.md lives.
- **LAB_LOG** — `<project>/lab/log.md`. Append-only `update` entry here.
- **LAB_INDEX** — `<project>/lab/index.md`. Regenerated after the write.
- **PROJECT_AGENTS** — `<project>/AGENTS.md`. Project instructions; read for
  project-specific command/output conventions only.
- **DEFAULT_OUTPUT_ROOT** — `<project>/lab/drafts/exp-<slug>-<date>-outputs/`.
  Per-seed `train.log` (full stdout via `tee`) and `metrics.json` live below it.
- **GPU_FREE_THRESHOLD = 500 MiB** — `memory.used` below this counts free.
- **SANITY_MAX_RETRIES = 1** — re-run sanity at most once after a fix.
  Two consecutive sanity failures → STOP and ask for review.
- **WALL_CLOCK_OVERRUN = 2.0** — flag at 2× of plan's expected runtime.

## Inputs

`$ARGUMENTS` is one of:

1. A full node id: `exp:<slug>-<YYYY-MM-DD>`.
2. A bare slug: `<slug>` — resolve to the latest matching exp draft.
3. A natural-language reference: "the GRPO warmup experiment" — find the
   single matching `status: planned` exp draft; ambiguous → ask.
4. Empty — pick the most recently `created` exp draft with `status: planned`
   from `lab/index.md` and confirm with the user before launching.

## Process

### Step 0 — Resolve and validate the draft (HARD GATE)

1. Resolve `$ARGUMENTS` to one file `<project>/lab/drafts/exp-<slug>-<date>.md`.
   On no match or multi-match → stop and ask.
2. Parse frontmatter against the exp schema (see `<project>/lab/SCHEMA.md`).
3. Status MUST be `planned`. If `running` / `completed` / `failed` /
   `abandoned`:
   - `running` → "Already running. Did you mean monitor-experiment?"
   - `completed` / `failed` / `abandoned` → confirm relaunch will overwrite
     the existing `run` and `results` sections; require explicit "yes,
     overwrite" before proceeding.
4. `plan.question`, `plan.metrics`, and either `plan.baselines` or
   `plan.ablations` MUST be non-empty. Empty fields → stop and ask
   @prospector to complete the plan. Do not invent.
5. The draft body MUST declare a launch command or command template
   (commonly under `## Command` or `## Execution`). For relaunches, an
   existing `run.command` is also acceptable. If no command is declared,
   stop and ask @prospector / @coder to complete the experiment draft.
6. If `plan.seeds` is null, default to `[42]` (single-seed run) and note
   that in the launch summary. Do not silently fan out.

### Step 1 — Resolve launch conventions (HARD GATE)

Read `<project>/AGENTS.md` for project-specific command/output conventions
only. The current skill is local-only: if the user asks for SSH, Slurm,
Vast.ai, Modal, or another remote integration, STOP and say that
this release does not support that launch path yet.

Resolve `output_root`:
1. Use an explicit output path from the draft body if it exists.
2. Otherwise use `DEFAULT_OUTPUT_ROOT`.

Record the final `output_root` in the draft body's `## Run` section.

### Step 2 — Working-tree gate (HARD GATE)

Run `git status --porcelain` in the project root.

- Clean tree → record `HEAD` hash, continue.
- Dirty tree → STOP and ask the user, exactly:

```
Working tree has uncommitted changes:
<paths>

Pick one:
1. commit  — I create a "pre-exp <slug>" snapshot commit, then launch.
2. stash   — I `git stash push -u -m "pre-exp <slug>"`, launch on HEAD.
3. abort   — I do nothing; you handle git yourself and re-run me.
```

Apply the chosen action. Capture the resulting commit hash (or the
stash-base HEAD if `stash`) into `run.commit`.

Never auto-commit without asking.

### Step 3 — Resource pre-flight (HARD GATE)

1. `nvidia-smi --query-gpu=index,memory.used --format=csv,noheader,nounits`
   for CUDA; on Apple Silicon, fall back to `MPS_AVAILABLE` probe via
   `python -c "import torch; print(torch.backends.mps.is_available())"`.
2. Need `len(plan.seeds)` free devices. A device is free when
   `memory.used < GPU_FREE_THRESHOLD`. If not enough free devices →
   stop and ask whether to (a) wait, (b) reduce seeds, or (c) abort.
3. Bind devices explicitly. Pick the first N free indices and record them
   as `device_assignment: {seed -> gpu_index}`. Never bind a device
   without an explicit decision.

### Step 4 — Sanity stage (HARD GATE, default on)

Skip only if the user explicitly passed `--skip-sanity` in `$ARGUMENTS`.

1. Compose a sanity command from the declared command template: same
   training script, one seed
   (first of `plan.seeds`), smallest available config — minimum batch,
   minimum steps just enough to emit one metric line. If the plan does not
   declare a sanity variant, fall back to `--max-steps 50` (or the
   project's documented sanity flag in AGENTS.md).
2. Run in the foreground on one bound device. Capture stdout via `tee` to
   `<output_root>/sanity.log`.
3. Pass criteria:
   - Process exit code 0.
   - At least one parsed metric line for every metric in `plan.metrics`.
   - No `nan` / `inf` in metric values.
4. Failure → present the last 50 log lines, ask whether to apply a small
   fix and retry once (`SANITY_MAX_RETRIES`). Two consecutive sanity
   failures → STOP. Do not proceed to the full launch.

### Step 5 — Compose launch commands

For each seed in `plan.seeds`:

1. Build the command from the declared command template:
   ```
   CUDA_VISIBLE_DEVICES=<gpu_index> \
     <declared-command> \
       --seed <seed> \
       --output-dir <output_root>/seed-<seed> \
       2>&1 | tee <output_root>/seed-<seed>/train.log
   ```
   Adapt for Apple/MPS (`PYTORCH_ENABLE_MPS_FALLBACK=1`), and use the
   project's own seed/output-dir flag names if AGENTS.md documents them.
2. Validate the plan's command itself does not bypass these flags
   (no hardcoded seed inside the script that overrides `--seed`).
3. Pick a screen name per seed: `exp-<slug>-<date>-s<seed>`.

### Step 6 — Launch

For each composed command:

- `screen -dmS <name> bash -lc "<command>"`.

Right after each launch:

- Verify the screen exists: `screen -ls | grep <name>` (or remote
  equivalent). If a screen failed to start, mark that seed as
  `launch_failed` and continue with the rest. Surface failures in the
  summary; do not silently skip.

### Step 7 — Update the exp draft

Inside the draft frontmatter, set:

```yaml
status: running
run:
  commit: <HEAD-or-snapshot-hash>
  command: <one composed command, with <seed> as placeholder>
  started_at: <ISO 8601, UTC>
  completed_at: null
```

Inside the body, add or replace a `## Run` section:

```markdown
## Run

- location: local
- devices: {42: 0, 7: 1, 1337: 2}
- screens: exp-<slug>-<date>-s42, exp-<slug>-<date>-s7, exp-<slug>-<date>-s1337
- output_root: lab/drafts/exp-<slug>-<date>-outputs/
- sanity: pass (sanity.log, mean <metric>=<value>)
- launched_at: <ISO 8601>
- launched_by: run-experiment skill
```

Do not touch `plan`, `tests`, `idea_refs`, `claim_refs`, or any other
field. Do not edit other drafts.

### Step 8 — Append to lab/log.md

Append ONE entry, per D20 format:

```
## [YYYY-MM-DD HH:MM] update | exp:<slug>-<date> planned → running
<N> seeds launched locally. Sanity pass. Commit <short-hash>.
Affected: [[exp:<slug>-<date>]]
```

If any seed `launch_failed`, also note it on the description line. Do not
write a separate `failed` entry for partial launches — they are still
`running` from the draft's perspective until analyze-results finalizes.

### Step 9 — Regenerate lab/index.md

Trigger the indexer (`src/lab/indexer.ts`) so the new `status: running`
shows up. Skip if no exp drafts changed (defensive).

### Step 10 — Return launch summary

Return this block to the caller verbatim:

```
## Launch
exp: exp:<slug>-<date>
location: local
commit: <short-hash>
sanity: pass | skipped

## Devices
| seed | gpu | screen                            | status   |
|------|-----|-----------------------------------|----------|
| 42   | 0   | exp-<slug>-<date>-s42             | running  |
| 7    | 1   | exp-<slug>-<date>-s7              | running  |
| 1337 | 2   | exp-<slug>-<date>-s1337           | running  |

## Estimated
- runtime: ~<X> min per seed (from the draft body, if declared)
- wall_clock_overrun_at: <X * 2.0> min — flag from monitor

## Next
- @coder monitor-experiment exp:<slug>-<date>   (poll progress / verdict)
- @coder analyze-results exp:<slug>-<date>       (when all screens exit)
```

If any seed `launch_failed`, include a `## Failures` section above
`## Next` with the failed seeds and the captured stderr tail.

## Examples

### Example 1 — clean launch, 3 seeds, local

Input: `exp:grpo-warmup-2026-06-04`

Process:
- Step 0: draft found, `status: planned`, plan complete, seeds = [42, 7, 1337].
- Step 1: local-only launch conventions resolved; output_root selected.
- Step 2: git clean, HEAD = `9f3a21c`.
- Step 3: 3 GPUs free (idx 0, 1, 2), bind them.
- Step 4: sanity on seed=42, gpu=0, 50 steps, pass.
- Step 5-6: 3 screens launched.
- Step 7-9: draft and log updated, index regenerated.

Output: launch summary block (see Step 10).

### Example 2 — dirty tree, user picks "commit"

Input: `exp:lr-sweep-2026-06-04`

Process:
- Step 0-1: pass.
- Step 2: dirty tree (`train.py` modified). Skill asks. User: `1` (commit).
  Skill runs `git add -A && git commit -m "pre-exp lr-sweep snapshot"`,
  records new commit.
- Steps 3-10: proceed normally.

### Example 3 — sanity fails twice

Input: `exp:cnn-baseline-2026-06-04`

Process:
- Steps 0-3: pass.
- Step 4: sanity fails (KeyError in metric parsing). User suggests a fix
  to the metric parser. Retry — still fails (the fix exposed another bug).
- STOP. Skill returns:

```
## Sanity failed (2 attempts)
exp: exp:cnn-baseline-2026-06-04
last error: KeyError 'eval/accuracy' in train.py:184

Draft NOT updated. Status remains 'planned'. Logs preserved under
lab/drafts/exp-cnn-baseline-2026-06-04-outputs/sanity-*.log.

Suggested next: route to @coder for code review, or re-run after
fixing the plan / training script.
```

No status flip. No log entry. Tree is left where it is.

### Example 4 — unsupported remote launch request

Input: `exp:big-grpo-2026-06-04`

Process:
- Step 0: pass.
- Step 1: user asks to launch on SSH / Slurm.
- STOP. Skill returns:

```
## Unsupported launch target
target: SSH / Slurm

This release of run-experiment is local-only. I will not silently launch a
remote job because amore has no remote execution contract yet.
```

## Anti-patterns

- Never launch without a complete `plan` (question + metrics + baselines/
  ablations). Empty plan → ask @prospector, do not invent.
- Never skip the sanity stage unless `--skip-sanity` was explicitly passed.
- Never auto-commit a dirty tree without asking. Commit/Stash/Abort is a
  user decision, not a default.
- Never launch remote/SSH/Slurm jobs from this skill in the current release.
  Stop and ask for explicit manual instructions instead.
- Never bind a GPU without explicit availability check and explicit
  `CUDA_VISIBLE_DEVICES`. Implicit binding wastes seeds.
- Never write to other drafts (`claim-*`, `idea-*`, other `exp-*`). Only
  the target exp draft + `lab/log.md` + `lab/index.md`.
- Never set `status: completed` here. That is `analyze-results`' job.
  We only flip `planned → running`.
- Never extract claims from results. That is @librarian's job after
  analyze-results returns.
- Never relaunch a `running` or `completed` exp without explicit
  "yes, overwrite" confirmation.
- Never invent the project's seed/output-dir flag names. Read them from
  AGENTS.md, the exp draft body, or the existing training script; if
  unclear, ask.

## Related

- Coder persona (`src/agents/coder.ts`) — invokes this skill on user
  request or orchestrator routing. Persona prompt owns the pre-flight
  philosophy, status state machine, and the CONTINUE/WAIT/STOP matrix.
- `monitor-experiment` — poll a running exp; produces a verdict, never
  writes the draft.
- `analyze-results` — finalize a finished exp; flips `running →
  completed/failed/abandoned`, fills the `results` section, returns a
  comparison table and candidate claim hooks for @librarian.
- `intake-dispatch-summary` — classifies `experiment-run` requests and
  routes to @coder, which then picks this skill.
- The lab artifact schema (`<project>/lab/SCHEMA.md`,
  `src/lab/artifact-schema.ts`) — authoritative for exp frontmatter
  (`plan` / `run` / `results` / `status`).
- `<project>/AGENTS.md` — project-level instructions and command/output
  conventions. Read-only from this skill.
