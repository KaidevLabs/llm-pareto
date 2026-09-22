# Step 03 — Compare page — ✅ COMPLETE (committed e6052b9, 2026-09-22)

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

## As-built

Shipped in `e6052b9` — one code commit with the page, the module, and its
vitest file.

- `public/bench/compare-view.mjs`: `pickPair` (A1 last-two default, A2
  `?a=&b=`, unknown/half params → `{error}`), the four diff-row builders,
  render helpers + same-origin boot. Δ is polarity-aware (`dir`: lower-better
  for static/load/interactions, higher-better for coverage) so green =
  improvement rather than raw sign — the pre-rework report's blanket
  lower-is-better coloring would have painted rising coverage red; presented
  at review, accepted.
- `public/bench/compare.html`: inline CSS in the report's language, one
  module script, the two-select picker, footer with the `?a=&b=` note. No
  third parties, no cookies, no storage.
- `tools/refactor-bench/lib/compare-view.test.ts`: 25 tests at the declared
  seams, importing the shipped module by relative path.
- `README.md` needed **no edit**: the line the spec asks for
  (`/bench/compare.html`, last-two default, `?a=<id>&b=<id>`) already shipped
  in `013e1c8`'s publish paragraph — verified.

Close verification (2026-09-22, `e6052b9`):

- `node --check` ok; seam file 25/25; `npm test` 162/162 (19 files);
  `npx tsc --noEmit` clean; python suite 159 tests OK; `npm run build` clean
  (`dist/bench/` carries both new files).
- CDP probe (`.tmp/probe_compare_page.mjs`, scratch): 25/25 PASS — default
  render = last two entries (7 tables, pill `4d908ab (dirty) → 013e1c8`);
  reversed `?a=&b=` keeps query order in pill and columns; unknown id →
  visible `unknown entry id: run-nope` with the picker intact and no partial
  tables; picker click navigates + re-renders with the pair in the URL; the
  cold-unthrottled chart-paint row equals the entry JSONs (151 → 160, Δ +9,
  class `neg`); every request same-origin; `document.cookie` empty, cookie
  store empty, zero `Set-Cookie`; no console errors.
- 020 cookie probe (`.tmp/probe_compare_cookies.zsh`): 45 requests (3 UAs ×
  15 URLs — page, module, `index.json`, both entries' 5 JSONs + report.html)
  → all 200, cookie jar empty, no `Set-Cookie`.

Review notes:

- Probe-found mid-review: the first render reused `lib/page.mjs`'s `table()`
  with pre-wrapped cells and doubled the wrap; the HTML parser split each row
  into an extra empty cell. The page now builds rows directly. The same defect
  remains in `lib/page.mjs` (the published reports' load/interaction tables
  render with an empty first column and shifted cells: `['', 'TTFB', '',
  '1 (1 p90)']`) — reported to the owner at review, deliberately untouched
  here.
- The "Not touched" list above says "Footer.svelte (step 03)" — stale
  numbering from before the step renumber; the footer link is step 04.
- The registry holds two entries, so the `?a=&b=` path is exercised by
  reversing their order; the default and explicit paths otherwise render the
  same pair.
