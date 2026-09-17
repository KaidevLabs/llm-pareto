# 006 — Model details panel (bubble click)

Date: 2026-09-16. **Status: EXECUTING (step 3/3).**
Source: `plans/archive/002-exploration-backlog.md` item B3 + its exploration findings.

Clicking a bubble (or a frontier marker) opens a ~340px overlay drawer on the
right with the model's full detail info. Close via the × button or a click on
empty chart area.

## Proposed decisions (settled at owner review)

| # | decision | rationale |
|---|----------|-----------|
| D1 | Shape: overlay drawer (option b from the findings) — absolutely positioned over the chart's right edge, no layout change | Zero reflow of the chart (the rail alternative loses ~300px of width and is the one layout decision to flag at review); coexists with 004's filters; smallest CSS diff |
| D2 | Content v1: everything already in `combined.json` (rank, Elo ± CI, votes, org, license, context, in/out $/M, vision, `arena_variants`, match method/ratio, override flag) + OpenRouter page link (`https://openrouter.ai/<or_id>`) + `modelUrl` (arena's own model page, present on 154/154 rows) + arena-side $/M (145/154 rows, shown as a cross-check against OR pricing) | All content exists today except two one-line `update.py` carry-throughs; OR long-form fields (description, created, knowledge cutoff, reasoning, cache pricing) are v2 via 008 |
| D3 | Frontier marker clicks open the panel too (stash the renderPanel-local `frontier` array in module state) | ~6 lines; the frontier is the site's core highlight — its points deserve the same detail |
| D4 | A selected model that a filter hides: panel persists with a "filtered out" indicator (no auto-close) | No surprise closes; simplest state machine |
| D5 | Close: × button + click on empty chart area | Standard affordance, ~5 lines |

## Steps (commit per step; owner stages each diff)

1. update.py: carry `modelUrl` and arena-side input/output $/M through
   `join()` into `combined.json` (new fields only). Run `update.py`; review
   the data diff.
   Commit: `data: modelUrl + arena price carry-through`
   ✅ Complete — `e7f52c3` (2026-09-17). As-built: three fields carried from
   the `best` (max-Elo) entry — `arena_model_url`, `arena_price_in_per_m`,
   `arena_price_out_per_m` — same representative as every other `arena_`
   field (18/34 collapsed variant groups differ on URL, 13 on price).
   Characterization: pinned row-shape dict in test_match_join updated; new
   test pins best-entry carry. Suite 114 green. Data diff = 154×3 new keys +
   one upstream GLM-4.6 price drift (arena and OR sides moved together).
 2. app.js + index.html: drawer markup + dark-theme CSS; `chart.on("click")`
    on the models and frontier series (survives `setOption(opt, true)`
    re-renders); `state.selected`; `renderDetails()`; close affordances (D5).
    Commit: `chart: model details drawer`
    ✅ Complete — `5fc1368` (2026-09-17). As-built: two close paths because
    an empty plot never reaches ECharts' `chart.on("click")` (no series hit)
    — close-on-empty binds at the zrender level (`getZr().on("click")`, no
    target); a pan ends in a synthetic click, so `lastPanEnd` is stamped on
    the pan's `mousemove` (mouseup fires the click first) and swallows
    clicks within 300 ms. `renderDetails()` re-renders from `render()` so
    the D4 badge tracks filters without touching the selection. Verified via
    CDP-driven headless Chromium with real mouse events: open on bubble and
    on a frontier-line midpoint (resolves to a frontier model), close via ×
    and empty-area, D4 badge appears/clears on the vision filter, handlers
    survive not-Merge re-renders, pan-then-release does not open the drawer.
3. Review pass: "filtered out" indicator (D4), long variant lists, and
   verify `https://openrouter.ai/<or_id>` resolves for all 154 ids before
   wiring the link. Commit only if something changes.

## Out of scope

- OR long-form fields (description / created / knowledge cutoff / reasoning /
  cache pricing) — v2, via 008's enrichment.
- Per-board Elo display (009), benchmark scores (005 — a trivial panel add-on
  once 005 lands).

## Definition of done

- [x] Owner approves this plan (D1–D5) — `Execute` trigger 2026-09-17.
- [x] Bubble click opens the drawer with the D2 content; frontier markers
      work too. — CDP check, 2026-09-17 (`.tmp/drawer-check.mjs`).
- [x] Closes via × and empty-area click. — CDP check, 2026-09-17.
- [x] A filtered-out selection shows the "filtered out" indicator. — CDP
      check, 2026-09-17.
- [ ] Deployed per A10.
