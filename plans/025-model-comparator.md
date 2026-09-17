# 025 — Two-model comparator

Date: 2026-09-17. **Status: PROPOSED — not reviewed, not executed.**
Source: `plans/021-exploration-backlog.md` item B16 + its exploration
findings. **No dependency on 022** — builds now on `combined.json`; the
future rows (speed, provider count, benchmarks) slot in afterward.

A hardware-comparator-style two-model view: pick model A and model B, see
every attribute side by side, winners highlighted, delta bars quantified.
Client-side only, no data changes, no new libraries.

## Proposed decisions (settled at owner review)

| # | decision | rationale |
|---|----------|-----------|
| D1 | Surface: a panel section below the chart (not a modal, not a 006-drawer extension) | the modal has no precedent in the codebase (the 006 drawer is the only overlay); the panel section inherits the existing `@media (max-width:600px)` flex-wrap for free (~20 lines HTML + 40–60 lines CSS + 60–90 lines JS vs. a bespoke mobile stack for a modal, 021 B16 findings); a 006-drawer extension is possible after 006 closes but the drawer is one-model-shaped (two selects inside a 340 px overlay is cramped) |
| D2 | v1 row set (all measured non-null on 154/154, no missing-value display needed in v1): price in ($/M), price out ($/M), arena Elo ± CI (two lines: value + CI span), arena rank, arena votes, context length, vision (yes/no), license, org (logo + name). Excluded in v1: `or_id` (identity, not a comparison attribute), `arena_variants`, `match_method`/`match_ratio` (join diagnostics) | measured 154/154 non-null → no "n/a" edge case in v1 (021 B16); identity and join-internals are noise in a comparison; the exclusion list is a v1 choice, not a data constraint |
| D3 | Winner logic: price in/out → lower wins; Elo → higher wins; rank → lower number wins; votes → higher wins; context → higher wins; vision → `true` beats `false`; license and org → no winner (display only). **Elo tie rule: CIs overlap → "tie"** | the CI-overlap tie is the statistically honest one (measured: `arena_elo_upper`/`arena_elo_lower` present on 154/154); "strictly higher by >CI" is overkill — overlap-tie is the standard comparator semantics and renders clearly (021 B16 OQ4) |
| D4 | Delta bars: per-row normalization — price rows on a log scale (the measured spread is ~3 orders of magnitude: 0.04–300 $/M in), Elo on a linear scale; bar length = \|Δ\| against the row's max, colored with the existing `on` accent + the frontier spread swatch gradient | reuses the established accent/gradient (021 B16 CSS precedent) — no new palette; log for price because a linear bar would be 99% ink for the most expensive model on every row |
| D5 | Selection: two `<select>`s pre-seeded with the top-2 ranked models (sorted by arena rank, all 154 options); no bubble-click "compare" wiring in v1 | the 006 click handler is one-model-selection-shaped; two-bubble selection (click A, click B) is new machinery (state + a second-pass affordance) and a clean later add-on; pre-seeding top-2 makes the section useful on load, before any interaction |
| D6 | State: in-memory (`state.cmpA`/`state.cmpB`), reset on reload — no URL hash, no storage | every existing control is in-memory only (021 B16 measured: zero storage APIs in `app.js`); the cookieless rule (#333) is untouched; a shareable URL (`#cmp=…`) is a later add-on that does not need a schema |

## Current state (evidence)

- `combined.json`: 154 models × 18 fields; the D2 rows are all present and
  non-null on 154/154 (measured 2026-09-17); org logos are
  `meta.json` → `assets/logos/` (007, registry-driven).
- `app.js` (1351 lines): the panel sections under the chart are plain
  sections re-rendered from `render()`; the `on` accent + spread-swatch
  gradient exist in the CSS; `state` is in-memory; no storage APIs anywhere
  (grep: `localStorage`/`sessionStorage`/`document.cookie`/`indexedDB` →
  0 hits in `app.js`/`index.html`/`js/`).
- JS unit tests are not runnable until the ESM split lands (017 A2) —
  verification is CDP-driven headless Chromium + the owner's manual A/B.

## Steps (commit per step; owner stages each diff)

1. `index.html` + CSS: the comparator section — the two selects (D5
   pre-seed), the table shell, the winner-highlight + delta-bar CSS (D4,
   reusing `on` accent + the spread gradient), mobile flex-wrap inherited.
   No JS yet. Commit: `chart: comparator section shell`.
2. `app.js`: the row spec + winner/tie functions (D2/D3 — pure, operating on
   the joined row), `renderComparator()` wired into `render()` (re-renders
   with the panel, like the other sections), the select bindings, the
   delta-bar math (D4). Not touched: `update.py`, `combined.json`, the
   chart, the 006 drawer. Commit: `chart: two-model comparator logic`.
3. Verify + ship: CDP structural checks (select A/B → rows render, winners
   highlighted per D3, a CI-overlap Elo renders as tie, delta bars present
   on the price rows; the pre-seed is top-2), the cookie probe (no new
   storage), owner manual A/B, deploy.

## Out of scope

- Future rows that need other plans: speed (022/023 — a one-line row-spec
  add once `endpoints.json` is in), provider count / cheapest provider
  (022), benchmark indices (005), per-board Elo (009), modality/divergence
  (008).
- The "compare" affordance from chart bubbles (two-bubble selection) — the
  006 click handler is one-model-shaped; a later add-on.
- A shareable URL / persisted selection (D6).
- More than two models (three-way is a different layout problem).

## Definition of done

- [ ] Owner approves this plan (D1–D6) in a review session.
- [ ] The section renders the D2 rows for the pre-seeded top-2 on load;
      selecting A/B re-renders with winners per D3. — CDP check.
- [ ] A CI-overlapping Elo pair renders as a tie; delta bars render on the
      price rows (D4). — CDP check.
- [ ] The chart, the frontier, and `combined.json` are byte-identical
      before/after.
- [ ] Cookie probe clean (no new storage) + owner A/B feel-out; deployed
      (live == main).
