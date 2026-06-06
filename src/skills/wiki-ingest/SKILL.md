---
name: wiki-ingest
description: Ingest a paper into the user's outside literature wiki under that wiki's own contract, then mirror the paper's atomic claims into the project lab as claim drafts. Use when user says "add this paper", "ingest", "<paper-slug> to wiki", "I have a new PDF", "register this paper", or wants a new paper landed in both the literature wiki and the project lab. Requires the literature wiki to have a contract file (AGENTS.md or CLAUDE.md or ingest_prompt.md at the wiki root).
argument-hint: <source-ref-or-paste>
---

# Wiki Ingest

Source: $ARGUMENTS

## Purpose

Single user-facing operation: land a paper. The wiki side is owned by
the user's wiki contract. The lab side is amore's responsibility (write
`claim-*.md` drafts so prospector, coder, council, and writer can act
on the paper's claims later).

You are a wrapper — you do NOT re-invent the wiki's ingest workflow.
You read the wiki's contract and execute it verbatim.

## Constants

- **WIKI_PATH** — outside literature wiki path, configured per project.
- **LAB_DRAFTS** — `<project>/lab/drafts/`. Where claim mirror lands.
- **LAB_LOG** — `<project>/lab/log.md`. Append-only `draft` entries.
- **LAB_INDEX** — `<project>/lab/index.md`. Regenerated after writes.
- **SCHEMA_VERSION = v1.0** — Lab artifact schema version.

## Inputs

`$ARGUMENTS` is the source of the paper:
1. A path to a PDF in the user's `raw/` or anywhere reachable.
2. An `arxiv:<id>` or `doi:<id>` ref.
3. A wiki slug like `<paper-slug>` if updating an existing paper note.
4. `paste:<inline-text>` for direct text input.

## Process

### Step 0 — Detect wiki contract (HARD GATE)

Try in order:
1. Read `<WIKI_PATH>/ingest_prompt.md` if it exists — the explicit
   playbook.
2. Read `<WIKI_PATH>/AGENTS.md` — the wiki schema and rules.
3. Read `<WIKI_PATH>/CLAUDE.md` — fallback equivalent.
4. Read `<WIKI_PATH>/README.md` — last fallback.

If NONE of these files exist or none describes naming / frontmatter /
log format, STOP and respond:

```
Wiki contract not found at <WIKI_PATH>.

To use wiki-ingest, your literature wiki must declare its rules in one
of: AGENTS.md, CLAUDE.md, README.md, or ingest_prompt.md at the wiki
root. The file should cover at minimum:
- page naming convention
- frontmatter schema
- log format
- any approval rules

Please create a contract file and re-invoke wiki-ingest.
```

Do not proceed without a contract. Do not invent a default schema.

### Step A — Execute the wiki contract flow

If `ingest_prompt.md` (or equivalent step-by-step playbook) exists:
- Follow its steps verbatim, including any STOP / approval gates.
- Honor its required artifacts (paper note, concept stubs, MoCs, index,
  log entry).
- Honor its language and style rules.

If only AGENTS.md / CLAUDE.md / README.md is present (declarative, no
explicit ingest playbook):
- Execute this generic flow, deriving format from the contract:
  1. Read the paper (PDF / URL / text).
  2. Propose a paper note (frontmatter per contract + 5-part body:
     TL;DR / Context / Key Ideas / Method / Results) and STOP for the
     user's approval.
  3. Write the paper note to the wiki path implied by the contract's
     naming rule.
  4. Append the wiki log entry per the contract's log format.
  5. Update the wiki index per the contract's index rule.

At the end of Step A you must have:
- A wiki paper-note path (e.g. `<WIKI_PATH>/wiki/<paper-slug>.md`).
- A list of other wiki artifacts touched (concept stubs, MoCs).
- Confirmation that the wiki log + index were updated per contract.

If any step is rejected by the user, abort wiki-ingest WITHOUT touching
the project lab.

### Step B — Mirror atomic claims to project lab

Triggered only after Step A completes successfully (paper note exists
in the wiki).

1. Read the freshly-written paper note.
2. Identify the section that holds the paper's atomic claims. Common
   names: "Key Ideas", "Claims", "Main contributions", "Key findings".
   The contract dictates the section name; use whatever the wiki uses.
3. For each atomic claim statement found, render a lab claim draft:

````markdown
---
schema_version: v1.0
type: claim
node_id: claim:<slug>
title: <one-line claim statement, ≤120 chars>
created: <YYYY-MM-DD>
updated: <YYYY-MM-DD>
tags: []
status: open
confidence: low
provenance:
  sources:
    - wiki:<paper-slug>#<section>
  experiments: []
  commits: []
domain: {}
supports: []
contradicts: []
tested_by: []
---

# <claim title>

<the claim statement in the paper's own framing>

## Evidence

- Wiki paper note: [[<paper-slug>]] — see "<section name>".
- <optional: which figure/table/section in the original paper supports this>

## Scope

<scope statement copied from the paper or marked [?] if the paper does
not bound it>
````

Slug rules:
- lowercase, hyphenated.
- drop stopwords (a, an, the, of, in, for, to, on, at, by, with, from,
  as, is, are, was, were, be, been, being, and, or).
- ≤ 60 characters.
- Collision with existing `claim:` node_id → suffix `-2`, `-3`, ...

Default `confidence: low` because the claim is freshly imported and
unverified by project experiments yet. The lab schema accepts only the
enum `low | medium | high`; promotion to `medium`/`high` happens after
an experiment tests the claim (see `claim-extract` calibration matrix).

4. Write each claim draft to `<LAB_DRAFTS>/claim-<slug>.md`.

5. Append a single `draft` entry to `<LAB_LOG>` per the log format:

```
## [YYYY-MM-DD HH:MM] draft | wiki-ingest from <paper-slug>
<count> claim drafts created:
- [[claim:<slug-1>]]
- [[claim:<slug-2>]]
- ...
Affected: [[<paper-slug>]]
```

6. Regenerate `<LAB_INDEX>`.

7. (Optional) If the paper extends a prior paper already in the wiki,
   add an `extends` edge to `<project>/lab/edges.jsonl` from each new
   claim to the corresponding existing claim. Skip if uncertain — do
   not invent edges.

### Step C — Return handoff summary

Return a markdown summary to the caller:

```
## Wiki ingest
Source: <input source>
Paper note: [[<paper-slug>]] (at <WIKI_PATH>/wiki/<paper-slug>.md)
Other wiki artifacts: <list or "none">

## Lab mirror
<N> claim drafts written to lab/drafts/:
- claim:<slug-1>
- claim:<slug-2>

## Logs
- Wiki log: appended per contract
- Lab log: 1 entry appended

## Next
- Inspect claim drafts in lab/drafts/ before next step.
- Or invoke @prospector / @writer / @coder against the new claims.
```

## Examples

### Example 1 — full ingest with contract present

Input: `paste:<inline paper text> <topic>`

Process:
- Step 0: contract found at `<WIKI_PATH>/AGENTS.md` + ingest playbook at `<WIKI_PATH>/ingest_prompt.md`.
- Step A: execute the playbook with user approvals; ends with paper note + 2 concept stubs written.
- Step B: read paper note → 3 atomic claims found in "Key Ideas" → write 3 `claim-*.md` to lab/drafts/.
- Step C: return summary.

Output:
```
## Wiki ingest
Source: paste (inline text)
Paper note: [[<paper-slug>]] (at <WIKI_PATH>/wiki/<paper-slug>.md)
Other wiki artifacts:
- Concept stub: [[<concept-slug-1>]]
- Concept stub: [[<concept-slug-2>]]

## Lab mirror
3 claim drafts written to lab/drafts/:
- claim:<extracted-slug-1>
- claim:<extracted-slug-2>
- claim:<extracted-slug-3>

## Logs
- Wiki log: appended per contract (action: ingest)
- Lab log: 1 entry appended (action: draft)

## Next
- Inspect claim drafts in lab/drafts/.
- Or invoke @prospector / @writer / @coder against the new claims.
```

### Example 2 — no contract → reject

Input: `arxiv:<id>`

Process:
- Step 0: scanned `<WIKI_PATH>/` for AGENTS.md / CLAUDE.md / README.md / ingest_prompt.md — none found.
- Stop.

Output:
```
Wiki contract not found at <WIKI_PATH>.

To use wiki-ingest, your literature wiki must declare its rules in one
of: AGENTS.md, CLAUDE.md, README.md, or ingest_prompt.md at the wiki
root. The file should cover at minimum:
- page naming convention
- frontmatter schema
- log format
- any approval rules

Please create a contract file and re-invoke wiki-ingest.
```

### Example 3 — duplicate paper

Input: `<paper-slug>` for a paper already in the wiki.

Process:
- Step 0: contract present, playbook present.
- Pre-flight check: `<WIKI_PATH>/wiki/<paper-slug>.md` already exists.
- Stop and ask.

Output:
```
Paper [[<paper-slug>]] already exists in the wiki (created
<YYYY-MM-DD>).

Two options:
1. Update the existing note — re-invoke wiki-ingest with intent
   "update <paper-slug>". The contract's update flow will apply.
2. Skip — the existing note is sufficient.

Which one?
```

### Example 4 — user rejects wiki step → no lab mirror

Input: `paste:<text>`

Process:
- Step 0: contract present.
- Step A: drafting paper note → user rejects (e.g. "this isn't the right TL;DR").
- Abort. Lab is NOT touched.

Output:
```
Wiki ingest aborted at draft stage by user feedback.
No wiki files written.
No lab files written.

The lab mirror runs only after the wiki step succeeds.
```

## Anti-patterns

- Never write to the wiki without a wiki contract present. Hard gate.
- Never invent the wiki's naming, frontmatter, or log format. Always
  derive from the contract.
- Never mirror lab claims if the wiki step was aborted. The lab mirror
  runs only on success.
- Never extract claims from the abstract. Use the structured Key Ideas
  / Claims section the paper note contains.
- Never duplicate an existing wiki paper note silently. Detect and ask.
- Never invent provenance refs. Use the paper-note wiki slug as the
  authoritative source ref (`wiki:<paper-slug>#<section>`).
- Never invent edges (`extends`, `supports`, etc.). Skip when uncertain.
- Never write more than what the contract specifies in Step A. If the
  contract is minimal (one paper note), don't auto-generate concept
  stubs or MoCs unless the contract says to.

## Related

- Librarian persona (`src/agents/librarian.ts`) — invokes this skill
  on user/orchestrator request to add a paper.
- The user's wiki contract files (`<WIKI_PATH>/AGENTS.md`,
  `ingest_prompt.md`, etc.) — authoritative for the wiki side.
- The lab artifact schema (`<project>/lab/SCHEMA.md`) — authoritative
  for the claim draft shape.
