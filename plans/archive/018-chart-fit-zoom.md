# 018 — Chart fit-to-data axes + TradingView-style zoom (dashboard)

Date: 2026-09-16. **Status: ARCHIVED (2026-09-16).** Commits: b52561f (step 1), c55d2d7 (plan 1), 3b863c5 (step 2), 8394641 (plan 2).
Source: owner request (session, 2026-09-16) — user feedback: the chart feels
squeezed/elongated and most of its height is empty (nothing below ~1100 Elo /
~$0.03); owner asked for zoom-to-interesting-parts and the TradingView
interaction model. No backlog item.

Owner approved execution 2026-09-16 (DoD item 1; "Execute" + step-level
staging during the session).

## Amendments (owner-settled during execution — do not revisit)

| # | amendment | rationale |
|---|-----------|-----------|
| A5′ | **Full-width main** — the A5 cap (~1100–1200px, centered) was removed at the owner's request mid-step-1: the owner prefers the chart to use all available screen width | Owner's call after a live feel-out; accepted cost: ratio drifts past ~2:1 toward ~3:1 on very wide screens; the taller plot (560px) partially compensates |

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
   charts). No interaction yet. — **✅ COMPLETE (committed b52561f, 2026-09-16)**
   As-built: implemented as specified — `fitLinear`/`fitLog` helpers
   (padded 5%/10%-of-decades, y snapped to 25, null-guards); bounds computed in
   `renderPanel` from `DATA`, never `filtered()` (A2); blend panel's x range
   additionally covers real in/out prices when spread bars are on (bars can't
   clip); `chartOption` spreads `{min,max}` into both axes. A5 amendment: cap
   dropped → full-width main (A5′ above); panel min-height 480→620px, chart
   420→560px. Measured on real data: y 1075→1550 (Elo 1110.8→1505.7, ticks
   1100–1500 visible); x ≈ 0.02–0.03 → 64–86 per ratio mode.
   Seams: `no tests: chart-option construction not at a node:test seam yet
   (017 A2, ESM split pending); render-side — owner manual A/B` (owner staged
   and committed after live feel-out, including the A5′ decision).
   Commit: `chart: fit-to-data axes + 2:1 plot shape` (b52561f)
2. **Zoom/pan/reset** (app.js, index.html): dataZoom-inside both axes
   `filterMode: 'none'` (A4); x wheel-zoom native, y wheel off; custom
   y-strip wheel handler (strip = current grid.left offset; anchored window
   math, clamped, `dispatchAction`); drag pans both; dblclick resets; reset
   pill per panel head; zoom window preserved across re-renders (A2); axis
   note text updated to teach the interaction. — **✅ COMPLETE (committed 3b863c5, 2026-09-16)**
   As-built: `GRID` const extracted (grid insets = y-strip geometry, single
   source); `dataZoom` inside × 2, `filterMode:'none'`, y `zoomOnMouseWheel:
   false`; `captureZoom`/`resetZoom`/`bindZoomChart` — y-strip wheel anchored
   via `convertFromPixel`, factor 0.85/1.18, zoom-out clamped at the axis
   extent (fit view = widest window, A1/A4); window captured as percents on
   `datazoom` events and re-dispatched after the not-Merge `setOption` (A2);
   dblclick + `⤢ fit` pill in each panel head; axis note teaches the
   interaction. Owner validated in-session: "it just works". No deviations.
   Seams: `no tests: same as step 1 — render-side interaction, owner manual
   A/B` (017 A2, ESM split pending).
   Commit: `chart: TradingView-style zoom/pan + reset` (3b863c5)
3. **Feel-check pass** (no code expected): owner-style A/B on desktop + mobile
   emulation. Feel-check list: wheel-zoom x anchors at cursor (ECharts native
   behavior — verify, don't assume); pinch on touch — whether two inside
   dataZooms zoom both axes or x only (acceptable either way; record what is
   true); drag-pan and tooltip don't fight; cursor feedback on the y-strip
   (ns-resize nicety — keep only if it doesn't fight zrender's cursor);
   dblclick doesn't collide with hover states.
   — **✅ COMPLETE (2026-09-16, no code changes)**
   As-built: owner ran the full feel-out (desktop + mobile emulation) and
   reported everything working ("Tested everything is right"); no anomalies
   surfaced on any checklist item, so no cursor nicety was added and no
   behavior needed recording beyond "all gestures sane". No code changed.
   Commit: none.

## Out of scope

- Visible zoom slider bar (option C — declined in favor of wheel + reset).
- Log y-axis or any y-scale change (Elo stays linear — already a log-odds
  scale).
- New chart library, backend, or `update.py`/data-layer changes (001 A-set
  not reopened; filters stay fully client-side per 001 DoD).
- Per-board dimension (009 owns multi-board).
- Test suite for the zoom math (017's call, not this plan's).

## Definition of done

- [x] Owner approves this plan (A1–A5) in a review session. (2026-09-16;
      A5 later amended to A5′ full-width by owner decision, see Amendments)
- [x] Default view: no 0→1100 dead band on y, x starts just under the cheapest
      price; tick labels visible; edge bubbles unclipped. (owner feel-out
      2026-09-16)
- [x] Plot reads ~2:1, centered, no horizontal scrollbar; mobile drag/pinch
      sane (behavior recorded). — superseded by A5′ full-width (owner feel-out
      2026-09-16); mobile/pinch verified sane by owner (step 3, 2026-09-16)
- [x] Wheel = x-zoom; wheel on y-strip = y-zoom; drag pans both; double-click
      and the reset pill restore the fit view; zoom window survives filter
      changes; axes identical across filters (fitted to all data).
      (owner-validated in-session, 2026-09-16)
- [x] Frontier line only ever clipped, never redrawn across hidden points
      (filterMode 'none' — verified in the feel-check pass). (owner feel-out
      2026-09-16)
- [x] Zero new dependencies; `python3 update.py` and `public/data/` untouched
      (git status evidence: `git diff b52561f~1..HEAD -- public/data update.py`
      empty, 2026-09-16).
