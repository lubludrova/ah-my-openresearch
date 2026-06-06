---
name: wiki-lint
description: Health-check the user's outside literature wiki. Two modes: single-paper (focused checks on one wiki page) and full-wiki (structural pass across the whole vault). Reports issues with severity (ERROR/WARN/INFO) and surfaces proactive suggestions for new sources or unexplored branches. Writes LINT_REPORT.md to the wiki root. Use when user says "lint", "audit the wiki", "check the wiki", "wiki health", "find broken links", "find orphans", "validate frontmatter", "wiki sanity check", or wants periodic maintenance of the literature wiki. Does NOT touch the project lab (use `amore doctor` for that). Does NOT auto-fix anything — reports only.
argument-hint: <full | paper:<slug> | scope:<category>>
---

# Wiki Lint

Target: $ARGUMENTS

## Purpose

Periodic or focused health-check of the outside literature wiki. You
find problems and surface them in a structured report. You do NOT fix
anything automatically. You do NOT touch the project lab (that's
`amore doctor`).

You defer to the user's wiki contract for what counts as "healthy":
naming rules, frontmatter requirements, log format, immutable zones.
When the contract is silent on a check, fall back to a universal
markdown baseline.

## Constants

- **WIKI_PATH** — outside literature wiki path, configured per project.
- **REPORT_PATH** — `<WIKI_PATH>/LINT_REPORT.md`. Single file,
  overwritten on each run.
- **STALE_DAYS = 180** — Pages untouched for ≥ this many days are WARN
  (only if frontmatter `updated:` exists).
- **HUB_THRESHOLD = 8** — Pages with ≥ this many incoming wikilinks are
  flagged as INFO bridge/hub nodes.
- **SPARSE_EMPTY_SECTIONS = 3** — A page with ≥ this many empty
  sections is WARN sparse.

## Inputs (modes)

`$ARGUMENTS` selects the mode:

| Input | Mode |
|---|---|
| `full` or empty | Full-wiki structural pass (Mode B) |
| `paper:<slug>` or `<slug>` | Single-paper focused lint (Mode A) |
| `scope:<category>` | Category-scoped lint (Mode C) |

Categories for `scope:` — `structural`, `contract`, `graph`, `content`,
`raw`, `proactive`.

## Process

### Step 0 — Read wiki contract

Read in order until one is found:
1. `<WIKI_PATH>/AGENTS.md`
2. `<WIKI_PATH>/CLAUDE.md`
3. `<WIKI_PATH>/README.md`

Extract the lint-relevant rules:
- Required frontmatter fields.
- Naming convention for pages.
- Log format and the actions allowed.
- Immutable zones (e.g. `raw/`).
- Index format.
- MoC structure (if defined).

If NONE of these files exist, proceed with the **structural baseline
only** — no contract-driven checks. Emit one INFO at the top of the
report noting the missing contract.

### Mode A — Single-paper lint

For `$ARGUMENTS = paper:<slug>` or `<slug>`:

1. Read `<WIKI_PATH>/wiki/<slug>.md` (or wherever the contract puts it).
   If missing, ERROR and stop.
2. Read `<WIKI_PATH>/wiki/index.md` (to count incoming links).
3. Run focused checks:
   - **Frontmatter** — every required field present (per contract);
     YAML parseable; values match types.
   - **Naming** — file name matches contract convention.
   - **Wikilinks** — every `[[X]]` in the page resolves to a real file.
   - **Incoming links** — count from index.md + grep across wiki/. If
     zero → INFO orphan.
   - **Content quality** — empty sections, `[?]` markers without
     resolution, links to abstract/not-yet-existent papers.
   - **Source ref** — if frontmatter has a `pdf:` (or contract
     equivalent) field, check the referenced file exists in `raw/`.
4. Render the report scoped to this page only.

### Mode B — Full-wiki lint

For `$ARGUMENTS = full` or empty:

1. Build inventory:
   - All wiki pages excluding `_*.md` meta files.
   - `index.md` and `log.md`.
   - `raw/` files if the directory exists.
2. Run all check categories (described in detail below).
3. Aggregate counts and produce the full report.

### Mode C — Category-scoped lint

For `$ARGUMENTS = scope:<category>`:

Run only checks in that category. Useful for quick re-runs after fixing
a specific class of issue (e.g. `scope:graph` after relinking).

## Check categories (detailed)

### [a] Structural baseline (universal — runs always)

Drawn from canonical markdown lint patterns. Runs whether or not a
contract is present.

- **Heading hierarchy** — no level skips (H1 → H3 without H2); exactly
  one H1 per file. Severity: WARN.
- **Wikilink syntax** — `[[X]]` is well-formed; no unmatched brackets.
  Severity: ERROR.
- **Broken wikilinks** — every `[[X]]` resolves to a real file in the
  wiki. Severity: ERROR.
- **Frontmatter YAML parseable** — opening `---`, closing `---`, valid
  YAML in between. Severity: ERROR.
- **First-line presence** — non-empty content immediately after
  frontmatter (used by index entries). Severity: WARN.
- **Code fence balance** — opening ``` matches a closing. Severity: WARN.

### [b] Contract-driven (only if contract specifies)

- **Required frontmatter fields** — per contract list (e.g. `created`,
  `updated`, `tags`). Severity: ERROR if missing, WARN if present-but-empty.
- **Naming convention** — file names match contract pattern (e.g.
  `<author>-<year>-<keyword>.md`). Severity: WARN.
- **Language** — if contract requires English, flag obvious non-English
  page bodies. Severity: INFO (heuristic only).
- **Log format** — recent entries in `log.md` match contract format
  (date header, action, affected pages). Severity: WARN.
- **Immutable zones** — verify the zone is intact: e.g. `raw/` PDFs not
  modified since logged date. Severity: INFO (advisory only).

### [c] Graph health

- **Orphan pages** — wiki pages with zero incoming wikilinks. Excludes
  index/log/meta files. Severity: INFO (orphans are not always wrong,
  but worth surfacing).
- **Missing pages** — `[[X]]` references to files that don't exist
  (red links). Severity: ERROR or WARN (depends on whether the contract
  allows aspirational red links).
- **Bridge / hub pages** — pages with ≥ `HUB_THRESHOLD` incoming links.
  Severity: INFO. These are knowledge centers worth noting.
- **Index drift** — for each page listed in `index.md`, compare the
  one-line summary in `index.md` vs the first line of the page itself.
  Mismatch → WARN.
- **Index duplicates** — `sort | uniq -d` on the wikilink anchors in
  `index.md`. Each duplicate → ERROR.
- **Index completeness** — every wiki page (excluding meta) appears
  exactly once in `index.md`. Missing → WARN.

### [d] Content (heuristic)

- **Stale pages** — pages with `updated:` ≥ `STALE_DAYS` ago AND no
  recent log entries touching them. Severity: WARN.
- **Sparse pages** — pages with ≥ `SPARSE_EMPTY_SECTIONS` empty
  sections. Severity: WARN.
- **Unresolved `[?]` markers** — count of `[?]` inline markers per
  page. ≥ 5 markers and updated ≥ 90 days ago → INFO.
- **Contradiction candidates** — two pages mention the same concept
  but with opposite framings (advisory, heuristic). Severity: INFO.

### [e] Raw / source materials (only if contract mentions raw/)

- **PDF reference integrity** — for every page with a `pdf:` (or
  contract-equivalent) frontmatter field, the referenced file exists
  in `raw/`. Missing → ERROR.
- **Duplicate PDFs** — files in `raw/` with the same SHA-256 hash but
  different names. Severity: INFO (don't auto-delete).
- **Unreferenced PDFs** — files in `raw/` that no wiki page references.
  Severity: INFO.

### [f] Proactive suggestions

Per the wiki contract pattern: "Lint is also the moment to be
proactive: suggest new questions, new sources, underexplored branches.
Surface as a numbered list — do not act silently."

Produce 3-7 suggestions, numbered:
1. **Underexplored graph branches** — sub-graphs with few outgoing
   links and no MoC.
2. **Missing canonical sources** — wikilinks to authors/papers that
   are mentioned but have no page.
3. **Gap follow-ups** — `[?]` markers in core pages that have aged
   without resolution.
4. **Cross-domain bridges** — two clusters mentioned together once but
   never cross-linked.
5. **Stale MoCs** — MoC pages older than 6 months that haven't been
   updated despite new papers being ingested in their topic.

Each suggestion: one line + (optional) one explanatory line. User picks
what to act on; lint does NOT act.

## Output format

`<WIKI_PATH>/LINT_REPORT.md`:

````markdown
# Wiki Lint Report — <YYYY-MM-DD HH:MM>

Mode: <full | paper:<slug> | scope:<category>>
Contract: <found at <path> | NOT FOUND (running baseline only)>
Pages scanned: <N>
Raw files scanned: <M or "N/A">
Issues: ERROR=<x> · WARN=<y> · INFO=<z>

## Top 5 to fix first

1. [ERROR] <category> — <one-line description>
2. ...

## Structural baseline

| Severity | File | Issue | Suggested fix |
|---|---|---|---|
| ERROR | wiki/<slug>.md:42 | Broken wikilink `[[missing-page]]` | Create the page or remove the link |
| WARN | wiki/<slug>.md | Heading hierarchy skip (H1 → H3) | Insert H2 between |

## Contract-driven

<table per category, or "no contract-defined rules to check">

## Graph health

### Orphans (<n>)
- [[<slug>]] — no incoming links

### Missing pages / red links (<n>)
- [[<missing-slug>]] referenced from <list of source files>

### Bridge / hub pages (<n>)
- [[<slug>]] — <count> incoming links

### Index drift (<n>)
- [[<slug>]] — index says "<x>", page first line is "<y>"

### Index duplicates / missing
- ...

## Content

| Severity | Page | Issue | Suggested fix |
|---|---|---|---|
| WARN | wiki/<slug>.md | Stale (updated <date>, no log entry since) | Review or archive |
| INFO | wiki/<slug>.md | 7 unresolved `[?]` markers, last touched 142 days ago | Re-read or close |

## Raw / source materials

<table or "no raw/ in this wiki" or "contract doesn't reference raw/">

## Proactive suggestions

1. **Underexplored branch**: <topic> — <count> related pages but no MoC. Consider creating `moc-<topic>.md`.
2. **Missing canonical source**: <author-year-keyword> mentioned in 3 pages but no page exists. Worth ingesting?
3. ...

## Summary

- Pages scanned: <N>
- Contract checks ran: <yes | no — baseline only>
- Total ERROR: <x>
- Total WARN: <y>
- Total INFO: <z>
- Suggestions for follow-up: <count>

Time: <YYYY-MM-DD HH:MM> · Mode: <mode>
````

## Examples

### Example 1 — full-wiki, healthy

Input: `full` (or empty)

Output (excerpt of `LINT_REPORT.md`):
```
# Wiki Lint Report — 2026-06-04 12:00

Mode: full
Contract: found at <WIKI_PATH>/AGENTS.md
Pages scanned: 142
Raw files scanned: 87
Issues: ERROR=0 · WARN=2 · INFO=11

## Top 5 to fix first

1. [WARN] content — wiki/<slug>.md is stale (updated 2025-12-01)
2. [WARN] graph — wiki/<slug-2>.md index drift

## Structural baseline
(no errors)

## Graph health

### Bridge / hub pages (3)
- [[<topic-slug>]] — 18 incoming links
- ...

## Proactive suggestions

1. **Underexplored branch**: <topic> — 4 related pages but no MoC.
2. **Missing canonical source**: <author-year-keyword> mentioned in 2 pages but no page exists.
```

### Example 2 — full-wiki with errors

Input: `full`

Output highlights:
```
Issues: ERROR=5 · WARN=12 · INFO=8

## Top 5 to fix first

1. [ERROR] graph — wiki/<slug>.md has broken link `[[<missing>]]`
2. [ERROR] graph — index.md lists [[<duplicated-slug>]] twice
3. [ERROR] contract — wiki/<slug-3>.md missing required frontmatter field `tags`
...
```

### Example 3 — single-paper lint

Input: `paper:<slug>`

Process: focused checks on that ONE page + its links.

Output:
```
# Wiki Lint Report — 2026-06-04 12:05

Mode: paper:<slug>
Contract: found at <WIKI_PATH>/AGENTS.md
Pages scanned: 1
Issues: ERROR=0 · WARN=1 · INFO=2

## Page: wiki/<slug>.md

### Frontmatter — OK

### Wikilinks — OK (12 out, all resolve)

### Incoming links: 0 — INFO orphan
This page has no incoming wikilinks. Consider linking from a relevant MoC.

### Content
- WARN: section "## Method" is empty

### Source ref
- OK: pdf points to raw/<slug>.pdf which exists.
```

### Example 4 — no contract → baseline only

Input: `full`

Process: contract files absent. Run structural baseline + graph health
+ raw/ skipped + content heuristics. Skip contract-driven and any
checks that depend on contract specifics.

Output:
```
# Wiki Lint Report — 2026-06-04 12:10

Mode: full
Contract: NOT FOUND (running baseline only)
Pages scanned: 142
Issues: ERROR=2 · WARN=18 · INFO=5

INFO: No wiki contract file detected at <WIKI_PATH>/AGENTS.md,
<WIKI_PATH>/CLAUDE.md, or <WIKI_PATH>/README.md. Contract-driven
checks (required frontmatter fields, naming convention, log format)
were skipped. Create a contract to enable full lint coverage.

## Structural baseline
...
```

## Anti-patterns

- Never auto-fix. Report only. The user (or a future `wiki-fix` skill)
  applies fixes.
- Never delete files. Not duplicates, not stale pages, not unreferenced
  PDFs. Flag, never act.
- Never invent rules not in the contract. If the contract doesn't
  specify a check, fall back to baseline OR skip — don't impose.
- Never lint the project lab. That's `amore doctor` territory.
- Never edit `LINT_REPORT.md` content in place. Overwrite the whole
  file with each run; preserving stale issues confuses the user.
- Never act on proactive suggestions. They are for human review only —
  surface as a numbered list, do not silently ingest, create, or link.
- Never count meta files (`_*.md`) as orphans, missing, or sparse.
  They are templates and reference, not wiki content.
- Never block on INFO. INFO is observational. ERROR is the only hard
  signal; WARN is review-recommended.

## Related

- Librarian persona (`src/agents/librarian.ts`) — invokes this skill on
  user request, periodically, or right after `wiki-ingest` (for the
  newly-added page in single-paper mode).
- The user's wiki contract files (`<WIKI_PATH>/AGENTS.md` etc.) —
  authoritative for contract-driven checks.
- `amore doctor` (CLI) — analogous health-check for the project lab.
  Run both to cover both zones.
- `wiki-ingest` — typical predecessor: after a fresh ingest, run
  `wiki-lint paper:<new-slug>` to catch issues before they propagate.
