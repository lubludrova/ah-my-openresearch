---
name: orchestrate-task
description: Decompose a multi-part research request into a safe multi-agent task graph, assign registered amore personas and skills, detect dependencies/write conflicts, schedule execution waves up to orchestration.max_parallel, dispatch independent work through the host task/subagent mechanism, and synthesize the results. Use when a user gives multiple tasks, asks to parallelize work, needs wiki/lab/code work coordinated, or when more than one persona should contribute.
argument-hint: <multi-part request> [--mode plan|confirm|dispatch] [--strategy safe|fast|thorough]
---

# Orchestrate Task

Request: $ARGUMENTS

## Purpose

Turn a broad or multi-part research request into an explicit, safe
multi-agent execution plan. You are the orchestration contract for
@orchestrator:

- split work into concrete tasks;
- assign each task to a registered amore persona;
- specify the skills each persona should use;
- detect dependencies and write conflicts before dispatch;
- schedule independent tasks into execution waves;
- dispatch through the host task/subagent mechanism when allowed;
- verify returned artifacts and synthesize the result.

You do NOT simulate multiple personas inside one context. If a task belongs
to @librarian, @prospector, @coder, @council, or @writer, invoke that
registered persona through the host's task/subagent mechanism. If the host
cannot spawn subagents, stop after the plan and tell the user the transport
is unavailable.

## Configuration

Read `<project>/.opencode/amore.json` if it exists. The relevant field is:

```json
{
  "orchestration": {
    "max_parallel": 5
  }
}
```

Rules:

- Default `max_parallel` is `5` when the field is absent.
- Treat `max_parallel` as a hard planning cap for each execution wave.
- Smaller is allowed when conflicts or dependencies require it.
- Larger user requests do not override config; explain the cap instead.

## Valid Personas

Only dispatch to these registered personas:

| Persona | Owns |
|---|---|
| `@librarian` | literature search, wiki ingest/lint, claim extraction |
| `@prospector` | gaps, novelty checks, ideas, experiment plans |
| `@coder` | code changes, experiment runs, result analysis |
| `@council` | multi-model critique through `council-session` |
| `@writer` | paper planning, figures, narrative, paper audits |

Never invent ad-hoc agents. Never dispatch to hidden `councillor-*` agents
directly; `@council` owns `council-session`.

## Modes

Parse optional `--mode`:

| Mode | Behavior |
|---|---|
| `plan` | Produce the plan only. Do not dispatch. |
| `confirm` | Produce the plan and ask for confirmation before dispatch. Default. |
| `dispatch` | Dispatch only if the plan has no high-risk writes or unresolved ambiguity. Otherwise ask. |

If no mode is provided, use `confirm`.

Parse optional `--strategy`:

| Strategy | Behavior |
|---|---|
| `safe` | Prefer fewer parallel writes and more explicit dependencies. Default. |
| `fast` | Maximize read-only parallelism while preserving write safety. |
| `thorough` | Add review/verification tasks when useful, especially `@council`. |

## Inputs To Read Before Planning

Read these when present:

- `<project>/lab/log.md` — recent activity and already-running work.
- `<project>/lab/index.md` — known claim/idea/experiment inventory.
- `<project>/.opencode/amore.json` — orchestration limit and wiki path.
- Any user-mentioned files, lab nodes, wiki pages, papers, or experiment IDs.

If the project has not run `amore install` and `lab/` is absent, ask whether
to proceed as a generic OpenCode task. Do not invent lab state.

## Task Graph

For every task, produce a row with these fields:

| Field | Meaning |
|---|---|
| `id` | Stable short ID: `T1`, `T2`, ... |
| `persona` | One valid persona. |
| `skills` | Skill names the persona should use. |
| `objective` | One sentence. |
| `reads` | Files, wiki areas, lab nodes, network sources, commands. |
| `writes` | Exact files, globs, wiki namespaces, lab node patterns, or `none`. |
| `depends_on` | Task IDs that must finish first. |
| `risk` | `low`, `medium`, or `high`. |
| `deliverable` | Concrete output and where it should land. |
| `success` | Verification condition. |

If a task cannot name its write set, mark `risk: high` and do not place it in
a parallel wave with other writers.

## Dependency Rules

Add dependencies when:

- a task reads another task's output;
- claim extraction needs paper search/ingest output;
- novelty/gap work needs fresh claims or wiki pages;
- experiment planning needs selected idea/claim context;
- experiment running needs an experiment plan;
- result-to-claim work needs completed experiment results;
- council/writer work needs concrete artifacts to review or draft from.

Do not parallelize merely because tasks have different personas. Parallelize
only when dependencies and write sets permit it.

## Conflict Rules

Tasks may share a wave only if all are true:

- no task depends on another task in the same wave;
- no two tasks write the same file, lab node, wiki page, wiki namespace, or
  unknown write target;
- no task reads an output another same-wave task is expected to create;
- the wave size is `<= orchestration.max_parallel`;
- source-code writes are disjoint and explicit, or only one source writer is
  in the wave;
- wiki writes are disjoint and explicit, or only one wiki writer is in the
  wave;
- generated files such as `lab/index.md` are not hand-edited.

Special cases:

- `lab/log.md` is append-only. Multiple tasks may intend to append, but still
  instruct each task to append exactly one concise entry after its work.
- `lab/drafts/claim-*.md`, `idea-*.md`, and `exp-*.md` can be parallel only
  when slugs are unique or the task is explicitly read-only.
- `@coder` tasks that edit source should run sequentially by default unless
  their path sets are clearly disjoint.

## Dispatch Prompt Template

When dispatching a task, send the specialist a self-contained prompt:

```markdown
## Orchestrated Task <id>

Persona: @<persona>
Required skills: <skill list>

Objective: <one sentence>

Context:
- User request: <original request>
- Relevant prior lab state: <short bullets>
- Dependencies completed: <task ids and outputs>

Allowed reads:
- <paths / wiki areas / lab nodes / tools>

Allowed writes:
- <paths / wiki areas / lab nodes, or "none">

Forbidden:
- Do not write outside the allowed write set.
- Do not hand-edit lab/index.md.
- Do not delegate to unregistered personas.

Deliverable:
- <concrete output and location>

Success criteria:
- <checks>

Logging:
- Append one concise entry to lab/log.md if lab exists.
```

Do not paraphrase away important user constraints. Do not hide conflicts from
the specialist.

## Execution

1. Build and print the full plan.
2. If mode is `plan`, stop.
3. If mode is `confirm`, ask for confirmation before dispatch.
4. If mode is `dispatch`, dispatch only when there is no unresolved ambiguity
   and no high-risk write. Otherwise ask first.
5. Dispatch one wave at a time. Tasks inside a wave may be issued in one
   batch; hosts that support parallel task execution can run them concurrently.
6. After each wave, verify success criteria before starting dependent waves.
7. If any task fails, stop dependent tasks, report the blocker, and synthesize
   partial results.

If the host task/subagent mechanism is unavailable, output the plan and stop:
`orchestrate-task requires registered amore personas and the host task tool
for dispatch; run inside OpenCode with the amore plugin enabled.`

## Output Format

Use this structure:

```markdown
## Orchestration Plan

mode: <plan|confirm|dispatch>
strategy: <safe|fast|thorough>
max_parallel: <N>

## Task Graph

| id | persona | skills | objective | reads | writes | depends_on | risk | deliverable | success |
|---|---|---|---|---|---|---|---|---|---|
| T1 | @... | ... | ... | ... | ... | - | low | ... | ... |

## Conflict Analysis

- <bullets explaining why tasks can/cannot run together>

## Execution Waves

- Wave 1: T1, T2
- Wave 2: T3

## Dispatch Prompts

### T1 → @persona
<self-contained prompt>

## Synthesis

<filled after dispatch; in plan-only mode say "pending">

## Next

- <confirmation request, dispatch status, or follow-up>
```

## Examples

### Literature + Wiki + Ideas + Council

Request:
`Find recent GRPO variance-reduction papers, add useful ones to my wiki,
extract claims, propose three experiments, and have council pick the best.`

Plan:

- `T1 @librarian` with `paper-search`, read-only web/wiki survey.
- `T2 @librarian` with `wiki-ingest` + `claim-extract`, depends on `T1`,
  writes selected wiki pages and `lab/drafts/claim-*.md`.
- `T3 @prospector` with `novelty-vs-wiki` + `idea-creator`, depends on `T2`,
  writes `lab/drafts/idea-*.md`.
- `T4 @council` with `council-session`, depends on `T3`, appends advisory
  result to `lab/log.md`.

Do not run `T3` in parallel with `T2`: it needs the new claims.

### Wiki Maintenance + Paper Search

If the user asks to lint a wiki namespace and search new papers, do not
parallelize both as writers to the same namespace. Prefer:

- Wave 1: read-only search and read-only lint diagnostics in parallel.
- Wave 2: one `@librarian` merge/write task after conflicts are visible.

## Anti-Patterns

- Do not force every multi-part request into one persona.
- Do not dispatch before declaring reads/writes.
- Do not parallelize unknown write sets.
- Do not let two agents edit the same wiki page, source file, or lab draft.
- Do not invent new personas or hidden councillors.
- Do not run `@council` before concrete artifacts exist.
- Do not use this skill for a simple single-route request; use
  `intake-dispatch-summary` instead.

## Related

- `intake-dispatch-summary` — single-persona routing.
- `council-session` — fan-out inside the council persona.
- `claim-extract`, `wiki-ingest`, `gap-map`, `idea-creator`,
  `run-experiment`, `analyze-results` — common specialist task skills.
