---
name: council-session
description: Universal multi-LLM council fan-out. Spawn N councillors of different models/roles in parallel against the same question + artifacts, collect their independent responses, and return a structured report (Councillor Details + Council Summary data + deterministic verdict). Callable by the user directly, by the @council persona (which adds Council Response synthesis on top), or by any other agent that needs adversarial / independent input. Universal — works on any artifact (claim draft, exp draft, idea, paper section, plan, idea-vs-claim contradiction). Use when user says "council", "get multiple opinions", "adversarial review of <X>", "kill argument on this", "vet this plan", "stress-test", or when an agent's confidence on a high-stakes decision warrants independent input.
argument-hint: <question> [--artifact <path>...] [--goal advice|decision|review|plan] [--role adversarial|supportive|expert|methodologist|mixed] [--members N] [--roster <name>] [--budget <USD>]
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
- **ROSTER_CONFIG** — resolution order:
  1. `--roster <name>` flag → look up named preset in config.
  2. `<project>/lab/config.json` `council.roster` field.
  3. `~/.config/opencode/ah-my-openresearch.json` `council.roster`.
  4. Built-in default (see DEFAULT_ROSTER).
- **DEFAULT_ROSTER** — 3 councillors, diverse model families:
  - `adversarial` × `anthropic/claude-sonnet-4` (strong-cheap, adversarial bias)
  - `expert` × `openai/gpt-5.5` (frontier, broad knowledge)
  - `methodologist` × `google/gemini-2-pro` (alt-family, rigor focus)
  - If a model family is unavailable, fall back to the next strongest
    in that family; never silently switch role.
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
- Optional `--members N` — override roster size.
- Optional `--roster <name>` — named preset (see ROSTER_CONFIG).
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

1. Apply ROSTER_CONFIG order to get a list of councillors:
   ```
   councillors: [
     {name: "adv-claude", role: "adversarial", model: "anthropic/claude-sonnet-4"},
     {name: "exp-gpt",    role: "expert",      model: "openai/gpt-5.5"},
     {name: "meth-gemini", role: "methodologist", model: "google/gemini-2-pro"},
   ]
   ```
2. If `--members N` is set and N < len(roster), pick the first N from
   roster (preserving role diversity). If N > len(roster) and roster is
   the default, supplement with extra councillors of the same model
   pool (warning: same-family councillors lose independence).
3. If `--role <r>` is set, override ALL councillor roles to `r`.
   This is the kill-argument shape: `--role adversarial --members 1`.
4. Probe model availability (cheap auth check, e.g. 1-token completion).
   Unreachable model → drop that councillor, log warning, do not
   silently swap.
5. If after probing the panel has 0 councillors → STOP.
   "All configured councillors are unreachable. Council aborted."

### Step 2 — Pick spawn transport (protocol-not-transport)

This skill does not hard-code an agent-spawn API. It picks the best
available transport in this order:

1. **OpenCode parallel subagents** — when running as an OpenCode
   plugin and the host exposes a parallel-agent invocation API. Each
   councillor is an ephemeral subagent.
2. **Claude Code Task tool** — when running in Claude Code. Spawn each
   councillor as a `Task` with `subagent_type: "general-purpose"` and
   `model` overridden per councillor. Tasks fan out concurrently.
3. **External CLI** — when neither host exposes parallel subagents but
   `codex` / `opencode` CLIs are installed. Spawn each councillor as a
   detached process; collect stdout.
4. **Sequential same-thread fallback** — only if nothing above
   available. Process councillors one by one, swapping model between
   turns. **Emit explicit warning in the report**: "council ran
   sequentially — context contamination possible; verdict reliability
   degraded." This is degraded mode, not normal operation.

Pick the highest-available transport. Record the chosen transport in
the report for later auditability.

### Step 3 — Build per-councillor prompt

For each councillor, compose the prompt using the existing
TypeScript builder `buildCouncillorPrompt({role, question, artifactPaths})`
exported from `src/agents/council.ts`. The builder returns a full
markdown system prompt with:

- Role framing (adversarial / supportive / expert / methodologist per
  `COUNCILLOR_ROLE_FRAMINGS`).
- The question verbatim.
- Artifact paths list (councillor reads each in full).
- Required output sections: `## Assessment`, `## Evidence`, `## Dissent
  points`, `## Confidence`.

Do NOT pre-filter, pre-analyze, or paraphrase the question. Pass it
through verbatim. Pre-filtering biases the panel toward your
assumptions (council.ts `<Anti-patterns>`).

### Step 4 — Spawn in parallel and collect

Spawn all councillors concurrently. For each:

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
roster: <name or "default">
transport: <opencode-parallel | claude-code-task | external-cli | sequential-fallback>
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
council is advisory). Default: skip indexer call.

## Examples

### Example 1 — adversarial review of a claim draft

Input: `Is claim:lr-warmup-helps-grpo solid? --artifact lab/drafts/claim-lr-warmup-helps-grpo.md --artifact lab/drafts/exp-grpo-warmup-2026-06-04.md --goal review`

Process:
- Step 0-1: question OK, both artifacts exist, default roster (3 cncl).
- Step 2: Claude Code Task transport available.
- Step 3-4: 3 parallel Tasks; all return in < 60s.
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

### Example 5 — sequential-fallback (degraded mode)

Input: same as Example 1, but running in a host with no parallel-agent API.

Process:
- Step 2: transport = `sequential-fallback`.
- Step 4: councillors processed one by one. The skill explicitly resets context between each by re-injecting the full system prompt — but cannot guarantee model state isolation.
- Report includes prominent warning at the top of `## Council Session`:

```
⚠️ sequential-fallback transport used. Councillors did not run in
parallel isolated contexts. Context contamination possible; treat
verdict with reduced confidence.
```

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
