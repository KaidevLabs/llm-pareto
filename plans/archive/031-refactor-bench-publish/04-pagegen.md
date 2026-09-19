# Step 04 — Page generator — DONE (2026-09-19)

## Spec

Turn the hand-written board infographic into a data-driven generator so the report is
reproducible, not a hand-maintained file.

- New `tools/refactor-bench/lib/page.mjs`: `genPage(ctx)` reads `static.json`,
  `load.json`, `interact.json`, `coverage.json`, `provenance.json` from `--out` and
  writes a **self-contained `report.html`** — inline CSS + inline JS, **no external
  network requests, no cookies** (consistent with the site's cookieless rule #349).
- Port the design validated this session: hero + verdict pill, KPI strip, section cards
  (code/complexity, load per condition, interactions, coverage), a "big offender"
  cyclomatic card (from step 02), strengths/weaknesses scorecard, methodology footnote.
  All numbers come from the JSONs; nothing hard-coded.
- `run.mjs` calls `genPage` at the end (alongside `reportAnalysis`) so each run yields
  both `report.md` and `report.html` in `--out`.
- Keep the hand-written `.tmp` page as a reference only; the generator is the source of
  truth.

**Not touched in this step:** measurement modules; `report.md` generation (parallel
output).

## Verification

- After a run, `--out/report.html` exists and is self-contained: opening it via
  `file://` renders all sections with numbers matching the JSONs.
- Grep the generated HTML for `http://`/`https://` external `<script>`/`<link>` and for
  `document.cookie` — expect zero (cookieless, offline).
- A spot-check: 3 numbers in `report.html` equal the same values in `report.md`.

## Seams under test

- `no tests`: a generator; verified by the offline/cookieless grep + the 3-number
  spot-check + a manual `file://` open (or a headless render smoke check).
