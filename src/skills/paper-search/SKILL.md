---
name: paper-search
description: Discover scientific papers across top-venue sources, deduplicate them, rank by venue tier + recency + citation count + relevance, and stage raw PDFs in the literature wiki's `raw/` directory for later ingestion. Searches arXiv, Semantic Scholar, and OpenAlex in parallel (with DBLP as venue-verification cross-check). Explicit top-venue allowlist covering NeurIPS / ICML / ICLR / AISTATS / COLT / UAI (ML core), ACL / EMNLP / NAACL / TACL / EACL (NLP), CVPR / ICCV / ECCV / WACV / BMVC (CV), AAAI / IJCAI (general AI), CoRL / RLC (RL), JMLR / TMLR / TPAMI / JAIR (journals). Use when user says "find papers on", "search literature for", "what's been published about", "top papers on <topic>", "ICLR papers on <topic>", "recent work on", or when @librarian needs to discover external literature before any ingest. Returns a ranked candidate list with PDF paths and recommends the top-K for `wiki-ingest`. Never auto-ingests; staging only.
argument-hint: <topic-or-query> [--venue iclr,neurips,...] [--since YYYY] [--limit N] [--download K] [--no-download]
---

# Paper Search

Query: $ARGUMENTS

## Purpose

Discover papers across top-venue scientific sources, dedupe across
backends, rank candidates, and stage raw PDFs in the wiki's `raw/`
directory for later ingestion. You are the discovery + staging step,
not the ingest step:

- Query multiple APIs in parallel (arXiv, Semantic Scholar, OpenAlex).
- Cross-check venues against DBLP for CS papers.
- Deduplicate by arXiv ID → DOI → normalized title.
- Filter by `TOP_VENUES` allowlist and `--since` year.
- Rank candidates (venue tier × relevance × recency × citations).
- Download top-K PDFs to `<RAW_DIR>` (skip existing, rate-limited,
  size-validated).
- Return a ranked candidate table + recommendation for `wiki-ingest`.

You do NOT create paper notes in the wiki (that is `wiki-ingest`),
extract claims (that is `claim-extract`), or modify already-existing
files in `<RAW_DIR>` (raw is immutable per the llm-wiki convention).

## Constants

- **WIKI_PATH** — outside literature wiki, parameterized per user
  (placeholder same as `librarian.ts` `<WIKI_PATH>`).
- **WIKI_CONTRACT** — resolution order at session start:
  `<WIKI_PATH>/RULES.md`, then `<WIKI_PATH>/AGENTS.md`, then
  `<WIKI_PATH>/README.md`.
- **RAW_DIR** — resolution order:
  1. From wiki contract: a `raw_dir` / `sources_dir` field if declared.
  2. `<WIKI_PATH>/raw/` (llm-wiki convention; immutable).
  3. `<WIKI_PATH>/sources/` as fallback if the user's wiki uses that.
- **DEFAULT_LIMIT = 20** — per-source result cap before merging.
- **DEFAULT_DOWNLOAD = 5** — top-K PDFs to actually download.
- **MIN_PDF_BYTES = 10000** — under this, treat as error page, discard.
- **RATE_LIMIT_SECONDS = 1** — sleep between sequential HTTP calls.
- **USER_AGENT** — `amore-paper-search/1.0 (https://github.com/<repo>)`.
- **DEFAULT_SINCE_YEAR** — current year − 3, unless user overrides.
  Older papers are still searchable; this is just the default cut.
- **TOP_VENUES** — explicit allowlist; ranked into tiers.

  | Tier | Venue codes |
  |---|---|
  | A+ (flagship ML/AI) | `NeurIPS`, `ICML`, `ICLR`, `JMLR`, `TMLR` |
  | A (top ML/AI specialist) | `AISTATS`, `COLT`, `UAI`, `AAAI`, `IJCAI`, `TPAMI`, `JAIR` |
  | A (top NLP) | `ACL`, `EMNLP`, `NAACL`, `TACL`, `EACL` |
  | A (top CV) | `CVPR`, `ICCV`, `ECCV` |
  | A− (strong specialist) | `WACV`, `BMVC`, `3DV`, `COLING`, `MLJ`, `AIJ` |
  | RL-focused | `CoRL`, `RLC`, `RLDM` |
  | Theory crossover | `STOC`, `FOCS`, `SODA` |
  | Workshops | `ICLR-W`, `NeurIPS-W`, `ICML-W` (tier C, surfaced only if `--include-workshops`) |
  | Preprint | `arXiv` (no venue) — kept but tier `preprint` |

  Match is case-insensitive against the venue field from Semantic
  Scholar / OpenAlex / DBLP. Aliases ("NIPS" → "NeurIPS"; "TPAMI" →
  "IEEE Transactions on Pattern Analysis and Machine Intelligence")
  are normalized before matching.

- **SOURCES** — search backends used in parallel:
  - **arXiv** — `http://export.arxiv.org/api/query?search_query=<q>&start=0&max_results=<n>&sortBy=relevance` (or `sortBy=submittedDate` for `--sort recent`).
  - **Semantic Scholar** — `https://api.semanticscholar.org/graph/v1/paper/search?query=<q>&limit=<n>&fields=title,authors,year,venue,citationCount,openAccessPdf,externalIds`.
  - **OpenAlex** — `https://api.openalex.org/works?search=<q>&per-page=<n>&filter=type:article&select=id,title,authorships,publication_year,primary_location,cited_by_count,open_access`.
  - **DBLP** (CS venue verifier; not primary discovery) —
    `https://dblp.org/search/publ/api?q=<q>&format=json&h=<n>`.

  No API key required for any of these. Semantic Scholar's free tier
  rate-limits to ~100 req/5min — well under our budget for any single
  invocation.

## Inputs

`$ARGUMENTS` parsed as:

1. A required `<topic-or-query>` — the search string. Plain words OK
   (the skill assembles backend-specific syntax). For arXiv-id-only
   lookups → use the `arxiv-fetch` skill (defer P1) instead.
2. `--venue <list>` — comma-separated subset of TOP_VENUES to
   restrict to. Default: all A+/A/A− tiers + arXiv preprints.
3. `--since YYYY` — minimum publication year. Default
   `DEFAULT_SINCE_YEAR`.
4. `--limit N` — per-source cap before merging. Default
   `DEFAULT_LIMIT`.
5. `--download K` — number of top-ranked PDFs to fetch. Default
   `DEFAULT_DOWNLOAD`. `--download 0` = metadata only.
6. `--no-download` — alias for `--download 0`.
7. `--include-workshops` — surface workshop papers (tier C); omit by
   default since signal-to-noise is lower.
8. `--sort relevance | recent | cited` — ranking emphasis. Default
   `relevance` (composite).

## Process

### Step 0 — Read the wiki contract (HARD GATE)

Same gate as `wiki-ingest`:

1. Read the wiki contract per WIKI_CONTRACT resolution order. If
   none exists → STOP with the same message wiki-ingest uses:
   "Wiki contract not found at `<WIKI_PATH>`. Create one (RULES.md
   / AGENTS.md / README.md) before paper-search
   can stage PDFs into the wiki."
2. Resolve `RAW_DIR` per the constant order. If the contract
   explicitly forbids writes outside `inbox/` or similar, honor
   that — write PDFs to the location the contract designates as
   "drop zone for new raw sources".
3. Record the contract's log convention (used in Step 7 if the
   contract requires logging raw additions).

### Step 1 — Resolve query and flags

1. Parse `$ARGUMENTS`. If query is empty → ask user.
2. Apply defaults for unset flags.
3. Validate `--venue` entries against TOP_VENUES. Unknown venue →
   warn and continue with the recognized subset.

### Step 2 — Fan out search across backends

For each backend in SOURCES, compose its query syntax from the user's
plain query and call its API. Run them concurrently (fire all three
simultaneously, collect as they return). Rate-limit per-backend to
1 req/sec (almost never hit in a single invocation; safety against
multi-page pagination).

#### Step 2a — arXiv

Endpoint: `http://export.arxiv.org/api/query?search_query=all:<urlencoded-query>&start=0&max_results=<limit>&sortBy=<sort>`.

- `--sort relevance` → `sortBy=relevance`.
- `--sort recent` → `sortBy=submittedDate&sortOrder=descending`.
- `--sort cited` → arXiv has no citation count; fall back to
  `relevance` and let Step 4 fuse with S2/OpenAlex citations.

Parse Atom feed entries. Extract for each:

- arXiv id (canonical, no version suffix).
- Title, authors (list), abstract, primary category, submitted date,
  PDF URL (`https://arxiv.org/pdf/<id>.pdf`).
- Venue: arXiv comments occasionally state "accepted at NeurIPS 2024";
  parse if present, else leave blank (S2/OpenAlex will fill).

#### Step 2b — Semantic Scholar

Endpoint: `https://api.semanticscholar.org/graph/v1/paper/search?query=<urlencoded>&limit=<limit>&fields=title,authors,year,venue,citationCount,openAccessPdf,externalIds,abstract,publicationTypes`.

Extract per result:

- S2 paper id, title, authors, year, **venue** (string),
  citation count, open-access PDF URL (`openAccessPdf.url`),
  external ids (`arXiv`, `DOI`, `DBLP`).

S2's `venue` field is the primary source of truth for the venue
allowlist matching in Step 3. If `venue == ""`, fall back to:
`publicationTypes` and the `journal.name` field.

#### Step 2c — OpenAlex

Endpoint: `https://api.openalex.org/works?search=<urlencoded>&per-page=<limit>&filter=type:article&select=id,title,authorships,publication_year,primary_location,cited_by_count,open_access,referenced_works`.

Extract per result:

- OpenAlex id (`W<...>`), title, authors,
  publication_year, primary_location.source.display_name (venue),
  cited_by_count, open_access.oa_url (PDF if open).

OpenAlex is the broad coverage net — catches papers S2 misses.

#### Step 2d — DBLP (verification only)

Endpoint: `https://dblp.org/search/publ/api?q=<urlencoded>&format=json&h=<limit>`.

DBLP is the gold standard for CS venue normalization. Use it ONLY
to verify / normalize the `venue` field when S2/OpenAlex disagree
or are blank. Do NOT use it as a primary search source (its
relevance ranking is weaker than the others for ML).

### Step 3 — Deduplicate

Merge results from all backends. Match across backends using this
priority:

1. **arXiv id match** — same arXiv id → one canonical entry.
2. **DOI match** — same DOI → one canonical entry.
3. **Normalized title match** — lowercased, stripped of punctuation,
   collapsed whitespace, first 80 chars. Same → one canonical entry.

For each dedupe cluster, build one canonical entry by merging
fields with these priorities:

- **Title**: prefer S2 → OpenAlex → arXiv.
- **Authors**: prefer S2 → OpenAlex.
- **Year**: prefer S2 → OpenAlex → arXiv (use arXiv submission year
  if no venue-publication year).
- **Venue**: S2 → DBLP (normalized) → OpenAlex.
- **Citation count**: S2 → OpenAlex (use max if both have it).
- **PDF URL**: arXiv (`https://arxiv.org/pdf/<id>.pdf`) is always
  preferred when arXiv id is known. Otherwise S2 `openAccessPdf.url`
  → OpenAlex `open_access.oa_url`. Mark as `paywalled` if none.

Record per-entry which backends found it (`sources: [arxiv, s2,
openalex]`) for transparency in the output.

### Step 4 — Filter and rank

1. **Filter — year**: drop entries with `year < --since`.
2. **Filter — venue allowlist**: keep entries whose normalized venue
   matches TOP_VENUES (or is `arXiv` preprint). Apply `--venue` user
   subset on top if set. Drop the rest, but keep a separate
   `## Filtered out (non-top-venue)` tail with the next 10 by
   relevance — transparent to the user.
3. **Rank composite** — score each remaining entry:

   ```
   score = venue_tier_weight × relevance_signal × recency_decay × cited_bonus
   ```

   - `venue_tier_weight`: A+ → 1.0, A → 0.85, A− → 0.7, RL/Theory → 0.7,
     preprint (arXiv) → 0.6, workshop → 0.4.
   - `relevance_signal`: 1 / (1 + rank_in_source). If found by multiple
     backends, take the best (min rank).
   - `recency_decay`: `0.5 + 0.5 × (year − since_year) / max(1, current_year − since_year)`.
     Newer scores higher; old papers still keep half weight.
   - `cited_bonus`: `1 + log10(1 + citation_count) / 5`. Saturates fast.

   Override per `--sort`:
   - `--sort recent` → `score = recency_decay × venue_tier_weight`.
   - `--sort cited` → `score = cited_bonus × venue_tier_weight`.
   - `--sort relevance` (default) → composite above.

4. Sort descending by `score`. Take top `--limit` for the candidate
   list. The top `--download` of those proceed to Step 5.

### Step 5 — Download top-K PDFs

For each of the top `--download` entries with a non-paywalled PDF URL:

1. Compute target path:
   `<RAW_DIR>/<slug>.pdf` where `<slug>` is:
   - `arxiv-<id>` if arXiv id known (e.g. `arxiv-2501.12599.pdf`)
   - `doi-<sanitized-doi>` if only DOI known
   - else: `<first-author-lastname>-<year>-<first-meaningful-title-word>.pdf`
2. Skip if file exists at target path AND file size ≥ MIN_PDF_BYTES.
   Record as `cached` in the output.
3. Else: download with `curl -L -A "<USER_AGENT>" -o <target> <url>`.
4. Sleep `RATE_LIMIT_SECONDS` between downloads.
5. Verify size ≥ MIN_PDF_BYTES. If smaller → discard (likely an HTML
   error page), record as `download-failed: too-small`.
6. Verify magic bytes start with `%PDF-`. If not → discard, record
   as `download-failed: not-pdf`.

If a paywalled / no-PDF entry is in the top-K, surface it in the
candidate table with status `pdf-unavailable` — still useful to
know about; user can manually fetch from institutional access.

### Step 6 — Compose candidate list

Compose the report:

```markdown
## Paper Search
query: <verbatim query>
backends queried: arxiv, semanticscholar, openalex (+ dblp verify)
filters: since=<year>, venues=<list-or-all>, sort=<mode>
raw_dir: <RAW_DIR>
contract: <path to wiki contract used>

## Candidates (ranked, top <limit>)

| # | Year | Venue (tier) | Authors | Title | Citations | Sources | PDF status |
|---|------|--------------|---------|-------|-----------|---------|------------|
| 1 | 2024 | NeurIPS (A+) | shao et al | Title... | 312 | arxiv,s2,openalex | downloaded |
| 2 | 2024 | ICLR (A+) | author et al | ... | 87 | s2,openalex | downloaded |
| 3 | 2023 | arXiv (preprint) | ... | ... | 14 | arxiv,s2 | downloaded |
| 4 | 2024 | ACL (A) | ... | ... | 56 | s2,openalex | cached |
| 5 | 2025 | ICML (A+) | ... | ... | 9 | s2 | pdf-unavailable |
...

## Per-candidate details

### [1] <Title> (NeurIPS 2024)
- Authors: <full list>
- DOI: <doi>
- arXiv: <id>
- PDF: <RAW_DIR>/arxiv-<id>.pdf  (status: downloaded, 3.4 MB)
- Citations: 312
- Abstract: <2-3 sentence excerpt>
- Found by: arxiv, s2, openalex
- Provenance refs (for downstream):
  - arxiv:<id>
  - doi:<doi>

### [2] ... (same shape)

## Filtered out (non-top-venue, next 10 by score)

| Year | Venue | Title | Reason |
|------|-------|-------|--------|
| 2024 | <workshop-name> | ... | tier C (workshop) — pass --include-workshops to surface |
| 2023 | <unknown-venue> | ... | venue not in allowlist |
...

## Summary
- Found: <N> candidates after dedup across backends.
- After filters: <M> in top-venue + year window.
- Downloaded: <K> PDFs to <RAW_DIR>; <skipped-existing> cached;
  <failed> failed.
- Coverage: arXiv=<n>, S2=<n>, OpenAlex=<n>, dedup-overlap=<n>.

## Next
- Inspect candidates above. Pick the most relevant for ingest.
- For each you want to land in the wiki + lab:
  `@librarian wiki-ingest <RAW_DIR>/<slug>.pdf`
- For a quick claim extraction without full wiki ingest:
  `@librarian claim-extract <RAW_DIR>/<slug>.pdf`
- For broader coverage (workshops + tier C), re-run with
  `--include-workshops`.
- For a narrower window, re-run with `--since YYYY` or
  `--venue iclr,neurips`.
```

### Step 7 — Logging

By D20 lab actions (`draft | update | edge-add | handoff`), no
matching action exists for "search" → do NOT write to `lab/log.md`.

By the wiki contract: only append to the wiki's log if the contract
mandates logging raw/ additions. If it does, follow the contract's
format. If silent, do not log (the wiki ingest step downstream will
log when paper notes are actually created).

### Step 8 — Return handoff

The report block from Step 6 IS the handoff. Caller (@librarian or
user) consumes it. No further action from this skill.

## Examples

### Example 1 — broad ML topic search, default flags

Input: `GRPO post-training stability`

Process:
- Step 0: contract at `<WIKI_PATH>/AGENTS.md` resolved; RAW_DIR =
  `<WIKI_PATH>/raw/`.
- Step 2: arXiv returns 18, S2 returns 20, OpenAlex returns 19.
- Step 3: dedup leaves 32 unique entries (15 overlap).
- Step 4: 12 pass year + venue filter; ranked.
- Step 5: top 5 downloaded; 1 already cached.
- Step 6: report returned.

Output: candidate table with 12 in main list, 10 in "Filtered out",
5 PDFs at `<WIKI_PATH>/raw/arxiv-<id>.pdf`.

### Example 2 — venue-restricted, recent

Input: `LLM agent benchmarks --venue iclr,neurips --since 2024 --download 10`

Process:
- Filter to ICLR + NeurIPS only.
- 14 hits across backends; 9 unique after dedup.
- 7 pass year filter (≥ 2024).
- Top 10 requested but only 7 qualify → download all 7.

### Example 3 — metadata-only (no PDF download)

Input: `attention mechanism survey --no-download`

Process:
- Same Steps 0-4.
- Step 5 skipped entirely.
- Output candidate list with PDF status `not-attempted (--no-download)`.

Useful for first-pass literature scan; user picks which to download
separately by re-running specific entries via `arxiv-fetch` (future
skill) or by manually invoking with `--download 3`.

### Example 4 — single arXiv id

Input: `arxiv:2501.12599`

Process:
- Detect arxiv-id-only input; fetch directly from arXiv (skip S2/
  OpenAlex bulk search, but cross-verify metadata via S2 + DBLP).
- Single-entry result.

Output: 1-row candidate table, PDF downloaded if open access.

If the user just wants this single paper landed, suggest
`wiki-ingest arxiv:2501.12599` directly — paper-search is overkill
for known IDs.

### Example 5 — include workshops

Input: `mechanistic interpretability --include-workshops --since 2023`

Process:
- Step 4: workshop entries (NeurIPS-W, ICLR-W) are NOT filtered
  out; they receive tier C weight (0.4) in scoring.
- Output table includes workshop venue cells; they typically rank
  below main-conference papers unless very recent / very relevant.

### Example 6 — wiki contract missing

Input: `transformer scaling laws`

Process:
- Step 0: no RULES.md / AGENTS.md / README.md at
  `<WIKI_PATH>`.
- STOP. Return contract-missing message (same as wiki-ingest). Do
  not download PDFs anywhere without a contract telling us where.

### Example 7 — PDF download fails for top entry

Input: `<some topic>`

Process:
- Top-ranked entry is paywalled (no `openAccessPdf` URL); falls
  through with status `pdf-unavailable`.
- Skill surfaces it in the candidate table; recommends user fetch
  manually if interesting (institutional access / Sci-Hub / direct
  author contact are outside the skill's scope).

## Anti-patterns

- Never auto-call `wiki-ingest` after a search. paper-search stages
  PDFs and reports; the user picks which to ingest. Auto-chaining
  pollutes the wiki with marginal results.
- Never write to wiki/ — only to `<RAW_DIR>` (or the contract's
  designated drop zone). Compiled wiki pages are `wiki-ingest`'s
  output.
- Never modify a file already in `<RAW_DIR>`. Raw is immutable
  (llm-wiki convention). If a file with the same slug exists with
  insufficient size, rename the new one rather than overwriting.
- Never invent venue tier. If a venue isn't in TOP_VENUES and isn't
  arXiv, drop the entry into "Filtered out" with explicit reason
  ("venue not in allowlist"). Do not silently include it.
- Never query Google Scholar. No official API; scraping breaks
  Google's ToS and gets rate-blocked.
- Never trust a single backend. If S2 disagrees with OpenAlex on
  venue, cross-verify with DBLP (CS) before promoting the venue
  string into the report.
- Never extract claims here. Claim extraction is `claim-extract`
  (post-ingest, against the paper note).
- Never paste full abstracts into the report. 2-3 sentence excerpts
  are enough for triage. Full text lives in the PDF.
- Never include a PDF link that is not from the open-access URL the
  backend returned. Don't construct URLs from author names or
  guesses.
- Never auto-include workshop papers without `--include-workshops`.
  Default off — too much noise.
- Never log to `lab/log.md`. No matching D20 action; this skill is
  read-mostly with respect to lab/.
- Never invent a citation count. If neither S2 nor OpenAlex has it,
  print `—` and explain "no citation data available", not `0`.
- Never embed PDF binary content in the report. Output paths.

## Related

- Librarian persona (`src/agents/librarian.ts`) — owns the
  literature wiki side and invokes this skill before `wiki-ingest`.
  Persona prompt reads wiki contract at session start; this skill
  honors that contract for raw_dir resolution.
- `wiki-ingest` — the natural next step after paper-search: takes a
  PDF path (or arxiv:/doi: ref) from the candidate list and lands a
  paper note in the wiki + mirrors atomic claims to
  `lab/drafts/claim-*.md`. paper-search produces the input;
  wiki-ingest consumes it.
- `claim-extract` (P0, not yet written) — operates against an
  ingested paper note OR directly against a PDF. paper-search can
  feed it indirectly via wiki-ingest, or directly via PDF path.
- `wiki-lint` — health-check after batch ingest. Useful after
  paper-search + wiki-ingest of a small batch.
- The user's wiki contract files (`<WIKI_PATH>/RULES.md`,
  `<WIKI_PATH>/AGENTS.md`, or `<WIKI_PATH>/README.md`) —
  authoritative for raw_dir location and log format.
- ARIS reference skills:
  [research-lit](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/blob/main/skills/skills-codex/research-lit/SKILL.md)
  (multi-source synthesis pattern, output table shape),
  [arxiv](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/blob/main/skills/skills-codex/arxiv/SKILL.md)
  (arXiv API + rate limit + size validation patterns) — synthesized
  here with our venue allowlist + multi-backend dedup logic.
- D22 — provenance source refs (`arxiv:<id>`, `doi:<id>`,
  `url:<...>`); paper-search outputs ready-to-use refs for downstream
  claim drafts.
