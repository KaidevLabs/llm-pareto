# 006 — Model details panel (bubble click)

Date: 2026-09-16. **Status: PROPOSED — not reviewed, not executed.**
Source: `plans/002-exploration-backlog.md` item B3 + its exploration findings.

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
2. app.js + index.html: drawer markup + dark-theme CSS; `chart.on("click")`
   on the models and frontier series (survives `setOption(opt, true)`
   re-renders); `state.selected`; `renderDetails()`; close affordances (D5).
   Commit: `chart: model details drawer`
3. Review pass: "filtered out" indicator (D4), long variant lists, and
   verify `https://openrouter.ai/<or_id>` resolves for all 154 ids before
   wiring the link. Commit only if something changes.

## Out of scope

- OR long-form fields (description / created / knowledge cutoff / reasoning /
  cache pricing) — v2, via 008's enrichment.
- Per-board Elo display (009), benchmark scores (005 — a trivial panel add-on
  once 005 lands).

## Definition of done

- [ ] Owner approves this plan (D1–D5).
- [ ] Bubble click opens the drawer with the D2 content; frontier markers
      work too.
- [ ] Closes via × and empty-area click.
- [ ] A filtered-out selection shows the "filtered out" indicator.
- [ ] Deployed per A10.
