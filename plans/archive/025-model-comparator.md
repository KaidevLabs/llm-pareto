# 025 — Two-model comparator

Date: 2026-09-17. **Status: ARCHIVED (2026-09-20) — owner approved by
execute trigger (2026-09-19) → f231435 (multi-model comparator, executed
on the 028 svelte surfaces; owner amendments 1–10) → 20a87b0 (comparator
polish) → close (no code).**
Source: `plans/021-exploration-backlog.md` item B16 + its exploration
findings. **No dependency on 022** — builds now on `combined.json`; the
future rows (speed, provider count, benchmarks) slot in afterward.

A hardware-comparator-style two-model view: pick model A and model B, see
every attribute side by side, winners highlighted, delta bars quantified.
Client-side only, no data changes, no new libraries.

## Owner amendments (2026-09-19, during execution)

1. **D5 superseded** — the two selects became one tag input; picks render
   as removable chips (X / backspace). The picked models render as the
   bubble-click model card minus the Providers section (Details was split
   into `ModelCard` + `Details` to share the body). The drawer's card
   carries a solid "◈ compare" button that appends the model to the
   comparator (slot B in the two-slot phase; appends + dedup + cap now).
2. **Multi-comparator** — up to 4 models at once (`ui.cmps` list, D6
   semantics unchanged): arrow-key + click selection in the dropdown,
   N-way winner logic (co-leaders tie, one big input, "max 4" note at the
   cap). Cards: 4-per-row desktop / 2 tablet / 1 mobile (grid).
3. **D4 superseded twice** — the delta bars became colored %/× verdict
   lines, then (same day) died entirely: the win/lose/tie colors land
   directly on the cards' own attribute rows (winner green `--accent`,
   loser orange `--lose`, tie blue `--tie`; speed row via the 022
   endpoints p50), replacing the separate verdict table.
4. **Cards capped at the chart height** via a shared `--chart-h` (drawer
   bottom realigns with the chart; the comparator columns scroll).
5. **Section uncapped** (supersedes the interim 960px max-width) and the
   whole shell capped at one centered 1440px column (`#app > *`); wide
   viewports get symmetric breathing room outside the column.
6. **Aligned rows** — comparator cards render a fixed canonical row set
   (`arena`, `openrouter $/m`, `arena $/m (reported)`, `speed`, `context`,
   `org`) with `--` placeholders where a model lacks data, so side-by-side
   columns line up row-for-row; variants/match stay drawer-only (the
   original D2 exclusion, now enforced).
7. **Slot matrix** — the tag input dissolves: picked cards + one dashed
   add slot (holding the bare search input) until 4 slots are filled; a
   × on each card removes (mid-removals close the gap); chips are gone.
   One shared left title rail (right-aligned toward the values) labels
   each band of slots — 4-up desktop / 2-up tablet / 1-up mobile — with
   fixed row heights (`--row-h`/`--head-block`/`--links-block`) syncing
   rail and cards; in-card labels are gone.
8. **Skeleton add slot + fixed slot width** — the empty slot is a
   skeleton screen (shimmering bars aligned with the rail rows, the search
   input in the model-name position); every slot is a fixed
   `--card-w: 280px` and the rail+cards block right-aligns in the
   full-width section (surplus space falls on the left).
9. **Rail on the far right + split add slot + motion** — the title rail
   sits at the band's right end (titles left-aligned, hugging the cards);
   the empty slot is two separated elements — the input as its title
   (14px/600, card-title size) above a bordered skeleton card, both
   replaced by the full card on pick; slots animate (`animate:flip`:
   the add pair slides right on pick, cards close the gap on removal;
   `in:fly` rise for new slots, `out:fade` for removed ones).
10. **Final geometry (owner corrections)** — the rail returns to the
   LEFT (titles right-aligned toward the cards); the green focus state
   moves to the input title (the skeleton card drops its border/highlight
   — bare shimmer bars like the other cards); an emptied roster STANDS
   (no pre-seed resurrection: `ui.cmps` null = untouched pre-seed vs
   [] = the user's empty roster, empty renders rail + add slot only).
   Motion reworked to survive jsdom: `animate:flip` (add pair slides
   right on pick, cards close the gap) + a pure-CSS `slot-in` keyframe
   for entry — svelte's `in:/out:` transitions broke keyed-each updates
   under vitest (getAnimations/animate stubs in `src/test-setup.ts`).
   A "full model card" chip on each comparator card opens the drawer for
   the rest of the info (scrolls up a frame after the state flush).

The steps' vanilla surfaces (`index.html` + `app.js`) are the 028 svelte
equivalents: `index.html` (vars) + `src/components/` / `src/lib/`.

## As-built (2026-09-20)

The three steps as written (separate shell → logic → verify commits on the
vanilla surfaces) never ran: execution happened in one owner-driven pass
on the 028 svelte surfaces, as two commits — `f231435` (the comparator:
`Comparator.svelte` + `comparator.ts` marks + `ModelCard`/`ModelSearch`
split out of `Details`, the drawer "◈ compare" fast-access, amendments
recorded) and `20a87b0` (polish: full-card chip, rail left, own-roster
`ui.cmps` semantics). No data files touched. Verification stack: the
vitest seams (`comparator.test.ts`, `Comparator.test.ts`,
`ModelSearch.test.ts`, `Details.test.ts`), the CDP probes
(`.tmp/probe_cmp_step1.mjs`, `.tmp/probe_cmp_step2.mjs`, load check
`compare_load.mjs`), and the owner's live A/B — the amendments themselves.

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

Superseded by the As-built pass — kept as the original intent record.

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

- [x] Owner approves this plan (D1–D6) in a review session. — execute
      trigger (2026-09-19); D4/D5 were amended live during execution
      (amendments 1–10), so the D-table records the v1 intent and the
      amendments the as-run state.
- [x] The section renders the D2 rows for the pre-seeded top-2 on load;
      selecting A/B re-renders with winners per D3. — as amended: the
      slot matrix (no selects), `resolvedCmps` pre-seeding top-2 by
      arena rank; the D3 winner/tie logic is `buildMarks`
      (`src/lib/comparator.ts`), vitest-covered (comparator /
      Comparator / ModelSearch / Details suites), CDP probes + owner
      A/B on top.
- [x] A CI-overlapping Elo pair renders as a tie; delta bars render on
      the price rows (D4). — the CI-overlap tie is in (the elo chain:
      the top cluster ties, a strict leader wins); the delta bars were
      superseded twice and dropped (amendment 3) — the win/lose/tie
      colors land directly on the cards' own attribute rows.
- [x] The chart, the frontier, and `combined.json` are byte-identical
      before/after. — both commits touch only `src/` + `index.html` +
      this plan; the data commits since are scheduled bot refreshes.
- [x] Cookie probe clean (no new storage) + owner A/B feel-out; deployed
      (live == main). — probe re-run 2026-09-20: 0 Set-Cookie on `/` +
      the bundle, desktop/curl/mobile UAs; live bundle hash == local
      dist build (`assets/index-EQ3sqAiT.js`).
