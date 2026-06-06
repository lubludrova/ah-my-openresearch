---
name: run-experiment
description: Launch a planned experiment from its lab draft. Read the exp draft's plan, check git tree, run the sanity stage, bind GPUs, launch one screen per seed (local or SSH), update the draft's run section, flip status planned → running, append a lab/log.md update entry, and return a launch summary. Use when user says "run exp:<slug>", "kick off the <name> experiment", "launch the planned run", "start training for <exp>", or when the orchestrator routes an `experiment-run` category task to @coder.
argument-hint: <exp-id> | <natural-language-ref>
---

# Run Experiment

Target: $ARGUMENTS

## Purpose

Take one planned experiment draft (`exp-<slug>-<YYYY-MM-DD>.md`) and turn it
into running jobs. You are the launcher, not the analyser:

- Validate the plan, check the working tree, do a sanity run.
- Launch one screen per seed on the chosen backend.
- Write the `run` section and flip status `planned → running`.
- Hand back a launch summary. Do NOT wait for completion. Do NOT analyse.

Result finalization (`running → completed/failed/abandoned`, comparison
tables, outcome verdict) belongs to `analyze-results`. Mid-run inspection
belongs to `monitor-experiment`. Claim extraction belongs to @librarian.

## Constants

- **LAB_DRAFTS** — `<project>/lab/drafts/`. Where exp-*.md lives.
- **LAB_LOG** — `<project>/lab/log.md`. Append-only `update` entry here.
- **LAB_INDEX** — `<project>/lab/index.md`. Regenerated after the write.
- **PROJECT_AGENTS** — `<project>/AGENTS.md`. Optional backend config.
- **DEFAULT_RUNS_DIR** — `<project>/runs/exp-<slug>-<date>/seed-<N>/`.
  Per-seed `train.log` (full stdout via `tee`) and `metrics.json`.
- **GPU_FREE_THRESHOLD = 500 MiB** — `memory.used` below this counts free.
- **SANITY_MAX_RETRIES = 1** — re-run sanity at most once after a fix.
  Two consecutive sanity failures → STOP and ask for review.
- **WALL_CLOCK_OVERRUN = 2.0** — flag at 2× of plan's expected runtime.
- **BACKENDS = local | ssh** — MVP set. Vast.ai/Modal not in scope yet.

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
5. If `plan.seeds` is null, default to `[42]` (single-seed run) and note
   that in the launch summary. Do not silently fan out.

### Step 1 — Detect backend (HARD GATE)

Read `<project>/AGENTS.md`. Look for an `## amore` or `### backend` section
declaring:

```yaml
backend: local           # or: ssh
ssh:                     # only when backend == ssh
  host: <user@host>
  cwd: <remote project root>
  python: <remote python path, optional>
wandb: false             # default
runs_dir: <override>     # optional, otherwise DEFAULT_RUNS_DIR
```

If `AGENTS.md` has no amore section → default to `backend: local`,
`wandb: false`, `runs_dir: DEFAULT_RUNS_DIR`.

For `backend: ssh`, verify reachability with `ssh -o BatchMode=yes
<host> "echo ok"`. Unreachable → stop with a configuration error.
Do not silently fall back to local.

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

1. Local backend:
   - `nvidia-smi --query-gpu=index,memory.used --format=csv,noheader,nounits`
     for CUDA; on Apple Silicon, fall back to `MPS_AVAILABLE` probe via
     `python -c "import torch; print(torch.backends.mps.is_available())"`.
   - Need `len(plan.seeds)` free devices. A device is free when
     `memory.used < GPU_FREE_THRESHOLD`. If not enough free devices →
     stop and ask whether to (a) wait, (b) reduce seeds, or (c) abort.
2. SSH backend:
   - Run the same probe over `ssh <host>`.
3. Bind devices explicitly. Pick the first N free indices and record them
   as `device_assignment: {seed -> gpu_index}`. Never bind a device
   without an explicit decision.

### Step 4 — Sanity stage (HARD GATE, default on)

Skip only if the user explicitly passed `--skip-sanity` in `$ARGUMENTS`.

1. Compose a sanity command from the plan: same training script, one seed
   (first of `plan.seeds`), smallest available config — minimum batch,
   minimum steps just enough to emit one metric line. If the plan does not
   declare a sanity variant, fall back to `--max-steps 50` (or the
   project's documented sanity flag in AGENTS.md).
2. Run in the foreground on one bound device. Capture stdout via `tee` to
   `<runs_dir>/sanity.log`.
3. Pass criteria:
   - Process exit code 0.
   - At least one parsed metric line for every metric in `plan.metrics`.
   - No `nan` / `inf` in metric values.
4. Failure → present the last 50 log lines, ask whether to apply a small
   fix and retry once (`SANITY_MAX_RETRIES`). Two consecutive sanity
   failures → STOP. Do not proceed to the full launch.

### Step 5 — Compose launch commands

For each seed in `plan.seeds`:

1. Build the command:
   ```
   CUDA_VISIBLE_DEVICES=<gpu_index> \
     python <plan.command> \
       --seed <seed> \
       --output-dir <runs_dir>/seed-<seed> \
       2>&1 | tee <runs_dir>/seed-<seed>/train.log
   ```
   Adapt for Apple/MPS (`PYTORCH_ENABLE_MPS_FALLBACK=1`), and use the
   project's own seed/output-dir flag names if AGENTS.md documents them.
2. Validate the plan's command itself does not bypass these flags
   (no hardcoded seed inside the script that overrides `--seed`).
3. Pick a screen name per seed: `exp-<slug>-<date>-s<seed>`.

### Step 6 — Launch

For each composed command:

- Local: `screen -dmS <name> bash -lc "<command>"`.
- SSH: `ssh <host> "cd <cwd> && screen -dmS <name> bash -lc '<command>'"`.

Right after each launch:

- Verify the screen exists: `screen -ls | grep <name>` (or remote
  equivalent). If a screen failed to start, mark that seed as
  `launch_failed` and continue with the rest. Surface failures in the
  summary; do not silently skip.

W&B integration (only if AGENTS.md has `wandb: true`):

- The training script handles its own W&B init. Do not inject W&B code
  here. Just capture the project/entity strings from AGENTS.md into the
  launch summary so monitor-experiment knows where to look.

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

- backend: local | ssh@<host>
- devices: {42: 0, 7: 1, 1337: 2}
- screens: exp-<slug>-<date>-s42, exp-<slug>-<date>-s7, exp-<slug>-<date>-s1337
- runs_dir: runs/exp-<slug>-<date>/
- sanity: pass (sanity.log, mean <metric>=<value>)
- launched_at: <ISO 8601>
- launched_by: run-experiment skill
- wandb_project: <if any>
```

Do not touch `plan`, `tests`, `idea_refs`, `claim_refs`, or any other
field. Do not edit other drafts.

### Step 8 — Append to lab/log.md

Append ONE entry, per D20 format:

```
## [YYYY-MM-DD HH:MM] update | exp:<slug>-<date> planned → running
<N> seeds launched on <backend>. Sanity pass. Commit <short-hash>.
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
backend: local | ssh@<host>
commit: <short-hash>
sanity: pass | skipped

## Devices
| seed | gpu | screen                            | status   |
|------|-----|-----------------------------------|----------|
| 42   | 0   | exp-<slug>-<date>-s42             | running  |
| 7    | 1   | exp-<slug>-<date>-s7              | running  |
| 1337 | 2   | exp-<slug>-<date>-s1337           | running  |

## Estimated
- runtime: ~<X> min per seed (from plan.expected_runtime, if any)
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
- Step 1: AGENTS.md → `backend: local`, no W&B.
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

Draft NOT updated. Status remains 'planned'. Logs preserved at
runs/exp-cnn-baseline-2026-06-04/sanity-*.log.

Suggested next: route to @coder for code review, or re-run after
fixing the plan / training script.
```

No status flip. No log entry. Tree is left where it is.

### Example 4 — SSH backend unreachable

Input: `exp:big-grpo-2026-06-04`

Process:
- Step 0: pass.
- Step 1: AGENTS.md declares `backend: ssh`, host `ml@workstation`.
  `ssh -o BatchMode=yes ml@workstation "echo ok"` times out.
- STOP. Skill returns:

```
## Backend unreachable
backend: ssh, host: ml@workstation
probe: timeout after 5s

I will not silently fall back to local — that would change the run's
recorded environment. Pick one:
1. Bring the SSH host up and re-run.
2. Edit AGENTS.md to backend: local and re-run.
3. Pass --skip-backend-check if you accept the risk.
```

## Anti-patterns

- Never launch without a complete `plan` (question + metrics + baselines/
  ablations). Empty plan → ask @prospector, do not invent.
- Never skip the sanity stage unless `--skip-sanity` was explicitly passed.
- Never auto-commit a dirty tree without asking. Commit/Stash/Abort is a
  user decision, not a default.
- Never silently switch backend. SSH unreachable → stop, do not run local.
- Never bind a GPU without explicit availability check and explicit
  `CUDA_VISIBLE_DEVICES`. Implicit binding wastes seeds.
- Never inject W&B code into training scripts. The training script owns
  its W&B init; AGENTS.md just tells us where to look later.
- Never write to other drafts (`claim-*`, `idea-*`, other `exp-*`). Only
  the target exp draft + `lab/log.md` + `lab/index.md`.
- Never set `status: completed` here. That is `analyze-results`' job.
  We only flip `planned → running`.
- Never extract claims from results. That is @librarian's job after
  analyze-results returns.
- Never relaunch a `running` or `completed` exp without explicit
  "yes, overwrite" confirmation.
- Never invent the project's seed/output-dir flag names. Read them from
  AGENTS.md or from the existing training script; if unclear, ask.

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
- `<project>/AGENTS.md` — authoritative for backend, W&B, and runs-dir
  overrides. Read-only from this skill.
