# Step 02 — Cyclomatic per-function report — DONE (2026-09-19)

## Spec

Extend the static dimension so the report names the per-function cyclomatic offenders
(the analysis this session proved `data`=34 is the worst fn and `charts.ts`=42% of all
cyclomatic).

- In `tools/refactor-bench/lib/static.mjs`, the `complexityPass` already walks every
  function; add a **per-function record** `{ file, name, cyc, nest }` (reuse the same
  attribution: branches count toward the innermost enclosing function) and keep the top
  **N=15** by `cyc` in `static.json` under `complexity.topFunctions`.
- Bump the existing `complexity.files` top-8 to top-15 for context (optional).
- In `lib/report.mjs`: add a "Cyclomatic offenders" subsection (old vs new top-N) showing
  the worst function, its file, and the concentration (e.g. `charts.ts` share).
- In the HTML generator (step 04): render the same as a small table/card.

**Not touched in this step:** load/interact/coverage modules; the page generator file
(step 04 picks this up).

## Verification

- After a run, `static.json` contains `complexity.topFunctions` with ≥1 entry per side;
  the worst new-side function is `data` (34) in `src/lib/charts.ts`.
- `report.md` "Cyclomatic offenders" section lists old vs new top functions.
- A quick `node -e` parse of `static.json` confirms the shape (no manual eyeballing).

## Seams under test

- `no tests`: reporting-only change to `static.mjs`/`report.mjs`; verified by the JSON
  shape check + `report.md` content. The attribution method mirrors plan 029 (verified).
