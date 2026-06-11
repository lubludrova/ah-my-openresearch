---
name: council-session
description: Universal multi-LLM council fan-out. Spawn N councillors of different models/roles in parallel against the same question + artifacts, collect their independent responses, and return a structured report (Councillor Details + Council Summary data + deterministic verdict). Callable by the user directly, by the @council persona (which adds Council Response synthesis on top), or by any other agent that needs adversarial / independent input. Universal — works on any artifact (claim draft, exp draft, idea, paper section, plan, idea-vs-claim contradiction). Use when user says "council", "get multiple opinions", "adversarial review of <X>", "kill argument on this", "vet this plan", "stress-test", or when an agent's confidence on a high-stakes decision warrants independent input.
argument-hint: <question> [--artifact <path>...] [--goal advice|decision|review|plan] [--role adversarial|supportive|expert|methodologist|mixed] [--members N] [--budget <USD>]
---

# Council Session

Question + artifacts: $ARGUMENTS

## Purpose

Fan a question out to N councillors in parallel, return their
independent responses, deterministic verdict, and consensus
confidence. You are the fan-out mechanism, not the synthesizer:

- Resolve roster + roles from config or flags.
- Spawn each councillor as a fresh, isolated agent.
- Collect responses in a structured shape.
- Compute verdict deterministically from per-councillor verdicts.
- Return Councillor Details + Council Summary (data).

You do NOT produce the synthesized "Council Response" prose. If called
by the @council persona, the persona writes that section on top. If
called by a user directly, the user reads raw councillor details +
deterministic verdict and decides.

## Constants

- **LAB_LOG** — `<project>/lab/log.md`. Append one `council` entry per
  session per D20.
- **ROSTER_CONFIG** — the panel is the set of registered
  `councillor-*` subagents. The amore plugin registers them at startup
  from, in priority order:
  1. `<project>/.opencode/amore.json` → `personas.council.councillors`
     (array of `{model, role?}`).
  2. `<project>/lab/config.json` legacy fallback → same field.
  3. `~/.config/opencode/ah-my-openresearch.json` → same field.
  4. Built-in default (see DEFAULT_ROSTER).
  To change the panel, edit the config and restart the host — do not
  invent councillors that are not registered.
- **DEFAULT_ROSTER** — 3 councillors, diverse model families
  (`DEFAULT_COUNCILLORS` in `src/agents/council.ts`). Skills do not
  name or choose models; registered subagents carry their configured
  model at runtime.
  - If a councillor's provider is not configured in the host, its
    invocation fails; record the failure — never silently swap models.
- **MAX_MEMBERS = 7** — hard cap. Larger panels burn budget without
  improving verdict reliability past N≈5.
- **MIN_MEMBERS = 1** — single-councillor mode allowed for kill-argument-style
  use, but emits a warning that "single councillor ≠ council".
- **DEFAULT_GOAL = review** — adversarial framing, the most common
  high-stakes invocation.
- **TIMEOUT_PER_COUNCILLOR = 300s** — kill and report failure if a
  councillor exceeds this.
- **SCHEMA_VERSION = v1.0** — Council artifact schema version.

## Inputs

`$ARGUMENTS` is parsed as:

- A required `<question>` — the crisp question. If missing or vague →
  STOP and ask user/orchestrator to crystalise. Do NOT fan out fuzz.
- Optional `--artifact <path>` flags (can repeat) — files every
  councillor reads in full. Paths must resolve. Missing artifact →
  STOP and ask.
- Optional `--goal advice | decision | review | plan` (default
  `review`). Maps to the councillor framing per `<Councillor Framing>`
  in `src/agents/council.ts`.
- Optional `--role` — override roster's default roles, apply this role
  to ALL councillors (degenerate-but-useful, e.g. all-adversarial).
  Role overrides are passed in the task message framing — registered
  councillors keep their system prompt, so state the override
  explicitly: "For this session, adopt this framing instead: <framing>".
- Optional `--members N` — override roster size.
- Optional `--budget <USD>` — soft cap; track per-call cost and stop
  spawning new councillors when projected total exceeds budget. Already
  spawned ones complete.

## Process

### Step 0 — Validate inputs (HARD GATE)

1. Question present and non-empty. Empty → "I need a question.
   What should the councillors assess?"
2. Question is a single, answerable question. Fuzzy multi-question
   bundles → "Pick ONE: <bullet candidates>". Council on a fuzzy
   prompt produces fuzzy verdicts.
3. Each `--artifact` path resolves on disk. Missing → "Artifact <path>
   not found. Provide a valid path or drop the flag."
4. `--members` in `[MIN_MEMBERS, MAX_MEMBERS]`. Out of range → clamp
   with warning.

### Step 1 — Resolve roster

1. List the registered `councillor-*` subagents (the plugin registered
   them at startup per ROSTER_CONFIG). Each carries its role and
   configured model, e.g.:
   ```
   councillor-adversarial    (role: adversarial,    model: configured by plugin)
   councillor-expert         (role: expert,         model: configured by plugin)
   councillor-methodologist  (role: methodologist,  model: configured by plugin)
   ```
2. If `--members N` is set and N < len(roster), pick the first N from
   roster (preserving role diversity). If N > len(roster), invoke some
   councillors more than once only when explicitly asked — repeated
   same-model votes lose independence; say so.
3. If `--role <r>` is set, keep the registered agents but put the
   role-override framing into each task message (see Inputs).
   This is the kill-argument shape: `--role adversarial --members 1`.
4. If no `councillor-*` subagents are registered (plugin not loaded or
   host rejected them) → STOP. "No councillor subagents registered.
   Check that the amore plugin is active (`amore doctor`) and restart
   the host." Do not improvise councillors in your own context.

### Step 2 — Spawn transport (registered subagents via task tool)

The transport is the host's native subagent invocation (OpenCode task
tool): one task per councillor against its registered `councillor-*`
subagent. Each invocation is a fresh, isolated context — that is what
makes the assessments independent.

- Issue all councillor tasks in one batch; hosts that support it run
  them concurrently.
- If the host executes them sequentially, that is fine: independence
  comes from fresh per-task contexts, not simultaneity. Note
  `transport: task-tool-sequential` in the report.
- If the task tool is unavailable, STOP: "council-session requires the
  host task tool and registered `councillor-*` subagents. Run inside
  OpenCode with the amore plugin enabled." Do not fall back to external
  CLIs and do not answer as multiple councillors in your own context.

Record the chosen transport in the report for auditability.

### Step 3 — Build per-councillor task message

Registered councillors already carry role framing + required output
format in their system prompt. The task message you send each one is
only:

- The question VERBATIM.
- The artifact paths list (one per line) the councillor must read.
- The `--role` override framing, if any.

Do NOT pre-filter, pre-analyze, or paraphrase the question. Pass it
through verbatim. Pre-filtering biases the panel toward your
assumptions (council.ts `<Anti-patterns>`).

### Step 4 — Invoke and collect

Invoke all councillor tasks (one batch). For each:

- Apply `TIMEOUT_PER_COUNCILLOR`. On timeout: record councillor status
  `timeout`, capture partial output if any, move on.
- On model error / refusal: record councillor status `error` with the
  error message. Move on.
- On success: capture the full response markdown.
- Track per-councillor cost (input tokens × input price + output
  tokens × output price). Add to running total.
- If `--budget` is set and running total exceeds `--budget` BEFORE
  spawning the next councillor: stop spawning, mark remaining
  councillors `skipped-budget`, proceed with what arrived.

### Step 5 — Parse councillor responses

For each successful response, extract:

- `Assessment` (full markdown subsection)
- `Evidence` (quoted lines from artifacts)
- `Dissent points` (or `none`)
- `Confidence` — normalize to `low | medium | high`. Unparseable →
  `unknown` and flag.

For `--goal review` (adversarial), also extract:

- Implicit per-councillor verdict from the assessment:
  - Mentions "strongest argument for rejecting" + no concessions →
    `FAIL-vote`.
  - Mentions concerns but acknowledges mitigations → `WARN-vote`.
  - Mentions strengths and minor issues only → `PASS-vote`.
  - If the councillor is unclear → `unclear-vote`, flag in report.

For other goal modes, per-councillor verdict is the councillor's
explicit recommendation if they made one; else `n/a`.

### Step 6 — Deterministic verdict assembly

Council does NOT self-grade. Verdict comes from counting per-councillor
votes:

For `--goal review`:
- ≥1 unresolved critical concern from any councillor → `FAIL`
- ≥1 major/minor concern unresolved → `WARN`
- 0 unresolved concerns → `PASS`
- All `unclear-vote` → `INCONCLUSIVE`

For `--goal decision`:
- Most-voted option wins; tie → `INCONCLUSIVE` with options listed.

For `--goal advice` / `--goal plan`:
- No verdict; just summary of agreed / disputed points.

Consensus confidence:
- All councillors agree on verdict (or top option) → `unanimous`.
- Majority agree, minority dissents → `majority`.
- No clear majority → `split`.

If any councillor failed (`timeout` / `error` / `skipped-budget`),
include this in the report and consider whether the verdict is robust
without them. Drop verdict to `INCONCLUSIVE` if failed-councillor count
≥ ceil(len(roster) / 2).

### Step 7 — Compose report

Return the report verbatim in this shape. The synthesizing persona (if
this skill is called by @council) replaces `## Council Response` with
its synthesized text; otherwise the section stays as the deterministic
data summary.

```
## Council Session
question: <verbatim question>
goal: <advice | decision | review | plan>
roster: <registered councillor-* names, or "default">
transport: <task-tool-parallel | task-tool-sequential>
artifacts:
  - <path>
  - <path>

## Council Response
(synthesis pending — @council persona fills this. If you are calling
this skill directly without the persona, treat the Councillor Details
+ Council Summary below as the raw report and decide for yourself.)

## Councillor Details

### <councillor name> (role: <role>, model: <model>, status: <ok|timeout|error|skipped-budget>)

<councillor's full response verbatim — do NOT collapse>

### <next councillor name> ...

(one subsection per councillor)

## Council Summary

- agreements: <bullet list of points councillors agreed on>
- disagreements: <bullet list of points councillors disagreed on; cite
  the councillors by name>
- failed-councillors: <list with reason, or "none">
- verdict: <PASS | WARN | FAIL | INCONCLUSIVE | n/a>
- consensus: <unanimous | majority | split>
- per-councillor-vote: {<name>: <vote>, ...}
- cost-usd: <approx running total>
- transport: <repeat for clarity>

## Next
- <one-line suggested action based on verdict>
- (if INCONCLUSIVE) "consider re-running with a larger / fresher panel"
- (if FAIL) "address the unresolved critical concern(s) before
  proceeding"
- (if PASS unanimous) "proceed; record verdict in lab/log.md handoff"
```

### Step 8 — Append to lab/log.md

Append ONE entry per D20 format:

```
## [YYYY-MM-DD HH:MM] council | <one-line topic>
question: <question>
roster: <name or "default">
members: <N> (<role list>)
verdict: <PASS|WARN|FAIL|INCONCLUSIVE|n/a>
consensus: <unanimous|majority|split>
cost-usd: <total>
Affected: <wikilinks of artifacts if they are lab nodes, else "none">
```

If artifacts are not lab nodes (e.g. paper sections), still log the
council entry but mark `Affected: none (external artifacts: <count>)`.

### Step 9 — Regenerate lab/index.md if needed

Only if `Affected:` contains lab nodes whose status changed (rare —
council is advisory), run `amore doctor --repair`. Default: skip. Do not
hand-edit `lab/index.md`; it is generated.

## Examples

### Example 1 — adversarial review of a claim draft

Input: `Is claim:lr-warmup-helps-grpo solid? --artifact lab/drafts/claim-lr-warmup-helps-grpo.md --artifact lab/drafts/exp-grpo-warmup-2026-06-04.md --goal review`

Process:
- Step 0-1: question OK, both artifacts exist, default roster (3 cncl).
- Step 2: registered `councillor-*` subagents invoked via the task tool.
- Step 3-4: 3 councillor tasks in one batch; all return in < 60s.
- Step 5: 1 FAIL-vote (adversarial: "n=3 is too few seeds for the claimed effect size"), 2 WARN-votes (expert + methodologist agree on seed-count concern, more measured).
- Step 6: verdict = `WARN` (no unresolved critical, but consistent major concern). Consensus = `unanimous` on the seed-count issue.
- Step 7: report with all 3 councillor responses verbatim.
- Step 8: log entry appended.

Output: report block; user routes to @coder to re-run with more seeds before claim promotion.

### Example 2 — kill-argument equivalent (single adversarial)

Input: `--role adversarial --members 1 --artifact paper/sections/3_method.tex --goal review "Construct the strongest reject argument for this method section before submission"`

Process:
- Step 0-1: 1 councillor (the adversarial preset), explicit single-member.
- Step 7: report includes warning "single councillor ≠ council; verdict is one model's worst-case attack, not consensus".
- Verdict is just that councillor's vote.

Output: 200-word attack memo per the adversarial framing in `COUNCILLOR_ROLE_FRAMINGS`.

### Example 3 — decision between two ideas

Input: `Pick between idea:grpo-warmup-2026-06-04 and idea:lr-cosine-2026-06-04 for the next experiment cycle. --artifact lab/drafts/idea-grpo-warmup-2026-06-04.md --artifact lab/drafts/idea-lr-cosine-2026-06-04.md --goal decision`

Process:
- 3 councillors each pick one option with reasoning.
- Step 6: 2 picked grpo-warmup, 1 picked lr-cosine → verdict `grpo-warmup`, consensus `majority`.

Output: report; user uses verdict to update @prospector's planning queue.

### Example 4 — budget cap hits mid-spawn

Input: `--budget 0.50 --members 5 ...`

Process:
- 3 councillors complete at $0.42 total.
- Step 4: projected 4th councillor cost ~$0.15 → would exceed budget.
- Stop spawning. Mark 4th and 5th as `skipped-budget`.
- Step 6: verdict from 3 completed councillors with note about reduced panel.

### Example 5 — no task tool available

Input: same as Example 1, but running outside the plugin host with no
task tool.

Process:
- Step 2: STOP. The skill returns:

```
council-session requires the host task tool and registered
`councillor-*` subagents. Run inside OpenCode with the amore plugin
enabled.
```

Note: `task-tool-sequential` is NOT degraded mode — each task still
runs in a fresh isolated context; only simultaneity is lost.

### Example 6 — agent caller (not user)

@writer is in Phase 6 (Round 2 fresh review). It calls:
```
council-session "Adversarially review paper/sections/4_experiments.tex. Find the strongest reject argument an ICLR area chair would raise." --artifact paper/sections/4_experiments.tex --artifact paper/PAPER_PLAN.md --goal review --members 3
```

Process:
- Standard fan-out; @writer reads the report and applies fixes.
- @writer's own Round-2 contract (no R1 context) is enforced by the
  freshness of the councillor spawn.

## Anti-patterns

- Never pre-filter or paraphrase the question. Pass it verbatim.
  Pre-filtering biases the panel toward the caller's framing.
- Never average councillor responses or collapse them into a summary.
  Preserve each verbatim under `## Councillor Details`.
- Never silently drop a failed councillor from the report. Surface
  `timeout` / `error` / `skipped-budget` explicitly.
- Never self-grade as the synthesizer. Verdict is computed from
  per-councillor votes deterministically.
- Never silently switch a councillor's model on probe failure. Drop
  with a warning instead.
- Never improvise councillors in your own context. Without registered
  `councillor-*` subagents and the host task tool, stop.
- Never re-run a "Round 2" by continuing the same councillor session.
  Round 2 is a fresh `council-session` call with new artifact set.
- Never run more than one debate round per session. Use a follow-up
  `council-session` invocation instead.
- Never invent a `--role` that isn't in `COUNCILLOR_ROLE_FRAMINGS`.
  Stick to the 4 known roles.
- Never write to artifact files. This skill is read-only on artifacts;
  it only appends to `lab/log.md`.
- Never let a councillor's role bias its artifact access. Every
  councillor reads the same artifacts.

## Related

- Council persona (`src/agents/council.ts`) — owns the WHY/WHEN of
  council invocation, the Goal Modes, the Councillor Framings (now
  exported as `COUNCILLOR_ROLE_FRAMINGS`), and the synthesis policy.
  This skill is the procedural fan-out it delegates to.
- `buildCouncillorPrompt({role, question, artifactPaths})` in
  `src/agents/council.ts` — the per-councillor prompt builder this
  skill calls to render system prompts.
- D17 / D18 / D26 — council config surface and roster overrides.
- D20 — `council` action format for `lab/log.md`.
- `paper-audit` — for paper-specific audits, prefer `paper-audit`
  (cheaper, deterministic checks) over a full council session.
  Council is for adversarial review of work where qualitative
  judgment matters.
