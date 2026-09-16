# 018 — Chart fit-to-data axes + TradingView-style zoom (dashboard)

Date: 2026-09-16. **Status: PROPOSED — not reviewed, not executed.**
Source: owner request (session, 2026-09-16) — user feedback: the chart feels
squeezed/elongated and most of its height is empty (nothing below ~1100 Elo /
~$0.03); owner asked for zoom-to-interesting-parts and the TradingView
interaction model. No backlog item.

Default view shows the whole dataset tightly instead of floating in a mostly
empty frame, and the user can zoom/pan to explore without the chart ever
rewiring itself. Honest-by-construction: tick labels always visible, axes
never rescale behind the viewer's back, the Pareto frontier is only ever
clipped, never redrawn.

## Settled decisions (discovery session with owner, 2026-09-16 — do not revisit)

| # | decision | rationale |
|---|----------|-----------|
| A1 | Default view = **fit-to-data bounds** computed at render time, never hardcoded: y (Elo, linear) from just under data-min to just over data-max, padded and tick-rounded (today ≈ [1100, 1550]); x (log) from just under the cheapest price to just over the dearest, per panel (blend/in/out have different price ranges). Edge padding so boundary bubbles are not clipped | Measured: Elo spans 1110.9→1505.7 — the zero-based y axis leaves ~70% of the height empty; zero-baseline is a bar/area rule, position-encoded scatters carry the truth in tick labels; Elo is Bradley–Terry (no meaningful zero, same as 001's log-x choice); computed bounds self-heal when `update.py` brings new models |
| A2 | Axes are **stable across filters**: fitted to ALL joined data, never the filtered set; the current zoom window survives filter re-renders (captured and re-applied across the not-Merge `setOption`) | Rescaling per filter would make cross-filter comparisons an illusion; since bounds don't move, preserving the window is consistent |
| A3 | Interaction = **TradingView model**: wheel on plot → zoom X (price) anchored at cursor (native dataZoom-inside); wheel while hovering the y-axis strip → zoom Y (Elo) anchored at cursor (small custom handler — ECharts cannot scope inside-zoom to the axis strip); drag → pan both axes (native); double-click → reset both axes to fit; the reset pill in each panel head stays as the discoverable fallback | Owner directive ("like tradingview does — default zoom is X axis, mouse on the y axis zooms Y, double click zooms to center/fit"); keeps accidental Elo squashing off the default gesture; zero new dependencies |
| A4 | Honesty guardrails: dataZoom `filterMode: 'none'` on both axes (the frontier line is only clipped, never re-connected across hidden points — the default 'filter' would draw fake segments); axis tick labels always visible; no hardcoded bounds anywhere | Zoom must not rewire the Pareto frontier; ticks carry the truth; A1's computed bounds already self-heal |
| A5 | Shape: `main` capped at ~1100–1200px and centered; chart min-height raised to ~560px (~2:1 plot) | Full-width × ~480px ≈ 4:1 reads squeezed/elongated; scatter + frontier read best around 2:1; accepted cost: side margins on very wide screens |

## Current state (evidence)

- 154 models; Elo 1110.9→1505.7 (median 1421); buckets 1100s×2, 1200s×14,
  1300s×46, 1400s×89, 1500s×3 — y starting at 0 leaves ~70% of the height
  empty (measured on `public/data/combined.json`).
- Prices $/M: input 0.027→30, output 0.08→75; the log axis floors at 0.01, so
  the x dead strip is minor (~4% of width).
- `app.js` `chartOption` (app.js:192): xAxis log with default bounds, yAxis
  value (zero-based), grid `{left:58, right:24, top:26, bottom:56}`; no
  dataZoom anywhere; ECharts 5.6.0 from CDN (dataZoom-inside is in the core).
- `renderPanel` calls `setOption(option, true)` (not-Merge): any zoom window
  resets on filter re-render unless captured and re-applied (A2).
- Layout: `main` is full-width 1fr (index.html:176), `.panel` min-height
  480px, `.chart` min-height 420px → ~4:1 on a desktop viewport.
- The axis note (index.html:346) documents axes/bubbles — it must also teach
  the new wheel/drag/dblclick interaction.
- No test suite yet (017 PROPOSED); verification is the owner's manual A/B
  feel-out plus the checks below. If 017 lands first, the anchored-zoom window
  math is the natural first `node:test` seam — decision at execution time, not
  a dependency of this plan.

## Steps (commit per step; owner stages each diff)

1. **Fit + shape** (app.js, index.html): per-panel fit-to-data axis bounds
   (A1 — y from all-data Elo; x from all-data prices through the panel's price
   function; padded, tick-rounded); CSS per A5 (cap + center main, taller
   charts). No interaction yet.
   Verify: default view has no 0→1100 dead band, ticks visible, edge bubbles
   unclipped, ~2:1 centered plot, filters still work (axes identical across
   them). Commit: `chart: fit-to-data axes + 2:1 plot shape`
2. **Zoom/pan/reset** (app.js, index.html): dataZoom-inside both axes
   `filterMode: 'none'` (A4); x wheel-zoom native, y wheel off; custom
   y-strip wheel handler (strip = current grid.left offset; anchored window
   math, clamped, `dispatchAction`); drag pans both; dblclick resets; reset
   pill per panel head; zoom window preserved across re-renders (A2); axis
   note text updated to teach the interaction.
   Verify: each A3 gesture works per panel; frontier clipped, never redrawn;
   window survives vision/family/mode/ratio/spread changes.
   Commit: `chart: TradingView-style zoom/pan + reset`
3. **Feel-check pass** (no code expected): owner-style A/B on desktop + mobile
   emulation. Feel-check list: wheel-zoom x anchors at cursor (ECharts native
   behavior — verify, don't assume); pinch on touch — whether two inside
   dataZooms zoom both axes or x only (acceptable either way; record what is
   true); drag-pan and tooltip don't fight; cursor feedback on the y-strip
   (ns-resize nicety — keep only if it doesn't fight zrender's cursor);
   dblclick doesn't collide with hover states.
   Commit only if something changes.

## Out of scope

- Visible zoom slider bar (option C — declined in favor of wheel + reset).
- Log y-axis or any y-scale change (Elo stays linear — already a log-odds
  scale).
- New chart library, backend, or `update.py`/data-layer changes (001 A-set
  not reopened; filters stay fully client-side per 001 DoD).
- Per-board dimension (009 owns multi-board).
- Test suite for the zoom math (017's call, not this plan's).

## Definition of done

- [ ] Owner approves this plan (A1–A5) in a review session.
- [ ] Default view: no 0→1100 dead band on y, x starts just under the cheapest
      price; tick labels visible; edge bubbles unclipped.
- [ ] Wheel = x-zoom; wheel on y-strip = y-zoom; drag pans both; double-click
      and the reset pill restore the fit view; zoom window survives filter
      changes; axes identical across filters (fitted to all data).
- [ ] Frontier line only ever clipped, never redrawn across hidden points
      (filterMode 'none' — verified in the feel-check pass).
- [ ] Plot reads ~2:1, centered, no horizontal scrollbar; mobile drag/pinch
      sane (behavior recorded).
- [ ] Zero new dependencies; `python3 update.py` and `public/data/` untouched
      (git status evidence).
