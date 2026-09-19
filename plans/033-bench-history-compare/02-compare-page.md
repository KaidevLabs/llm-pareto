# Step 02 — Compare page — OPEN

## Spec

- **`public/bench/compare-view.mjs`** — shipped module (pure logic + render
  helpers, ES module):
  - `pickPair(search, index)` — defaults to the **last two** entries of
    `index.json` (A1); `?a=<id>&b=<id>` loads any pair (A2); unknown/missing
    ids → visible error state, never a blank page.
  - `diffRows(dimA, dimB)` per dimension — static (files, lines, functions,
    Σ cyclomatic, max fn, `any`, duplication %), coverage (lines, branches,
    functions %, files), load (per condition: chart-paint, load, transfer KB
    — median + Δ), interactions (init paint, zoom settle, drawer open, 3D
    cold/steady, jank, heap Δ — median + Δ). Δ colored (pos/neg).
  - Render helpers produce the same card/table language as `report.html`
    (page.mjs is the visual reference).
- **`public/bench/compare.html`** — self-contained chrome: inline CSS, one
  `<script type="module" src="./compare-view.mjs">`; fetches
  `./index.json` + the two entries' JSONs — **same-origin only** (A4); no
  third parties, no cookies; an in-page entry list (two selects + compare)
  for arbitrary pairs.
- **`tools/refactor-bench/lib/compare-view.test.ts`** — vitest imports the
  shipped module by relative path (the tested module IS the shipped one).
  Seams: `pickPair` (defaults, overrides, unknown ids) + the diff-row
  builders (typed fixtures).
- **`README.md`** — one line: the compare page URL and the `?a=&b=` params.

**Not touched in this step:** `Footer.svelte` (step 03), harness measuring
phases, `publish.mjs` behavior, app source.

## Seams under test

`pickPair` + diff-row builders (see above). The HTML shell itself has no
logic to unit-test — verified by probe below.

## Verification

```sh
node --check public/bench/compare-view.mjs
npx vitest run tools/refactor-bench/lib/compare-view.test.ts
npm run build && npm run preview   # or: python3 -m http.server -d dist
# CDP probe (.tmp/ scratch): GET /bench/compare.html renders last-two tables;
#   ?a=&b= with known ids renders that pair; unknown id → error state.
# 020 cookie probe (cookie-jar curl) over /bench/compare.html + its fetched
#   JSONs — desktop + curl + mobile UAs: no cookies, same-origin requests only.
```
