---
name: contradiction-check
description: STUB (D8/D13) — post-MVP semantic contradiction check against canon claims; advisory only, never blocks writes.
---

# contradiction-check (STUB)

Post-MVP skill backed by basicmachines-co/basic-memory (fastembed + sqlite-vec). It runs after `canon/` exists, compares candidate claims against reviewed canon claims, and returns advisory contradiction candidates. It does not add contradiction frontmatter and is not part of the MVP ingest loop.

## Related

- design/Skill Catalog.md → `contradiction-check` row
- design/Product Design.md §7 (Contradiction-check policy)
