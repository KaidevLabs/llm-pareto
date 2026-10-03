# Step 04 — Board switcher UI + per-board chart rendering — OPEN

Depends on: step 03.

## Spec

Front end rendering/chrome only:

1. **charts.ts**: `pointsFor`/`tooltipHTML`/axis labels/frontier/bounds/counts read the active board's Elo via `eloOf(d, board)` (the GEOM signature gains the board so board switches take the instant notMerge path — signature change, not filter-only). Bubble size maps that board's `votes`; tooltip shows that board's rank/votes; elo CI (±) uses that board's upper/lower.
2. **Board switcher**: a `Seg` control (existing shared component) in the filter bar listing the boards present in `meta.json`'s per-board section (data-driven labels — no hardcoded board list in the UI; unknown/absent → hide the control). Binds to `ui.board`.
3. **Panels/counts**: `panels.svelte.ts` status counts and any crowns/labels recompute from the visible subset per active board (they already read the visibility predicate — confirm they follow `eloOf` through it; fix if they read flat fields directly).
4. **ThresholdCtl**: its Elo bounds display the active board's renormalized min/max (existing per-view price mapping precedent); label unchanged.
5. **Footer**: per-board staleness note for the active board (from meta.json per-board `voteCutoffISOString`), same pattern as the existing data-age line.
6. **Vision filter relabel (009 D5)**: the "vision" capability filter becomes "vision input" — kills the board/capability naming collision.
7. **3D panel**: `build3DScene` uses the active board's elo as the z/elo dimension; the GL fade stays instant (unchanged mechanics).

## Not touched in this step

- update.py / data files (steps 01–02), urlstate/state (step 03), the imperative chart-seam architecture, speed view, tour/trails logic.

## Verification

- `npm test` + `npx tsc --noEmit` green; component-test updates where read sites changed (Details/Comparator/ThresholdCtl fixtures gain board map fields — characterization values pinned from actual output).
- `npm run build` clean.
- Headless probe (`.tmp/`, scratch): serve `dist/`, switch board via the control, assert the y-axis label + a known point's elo change and the frontier path redraws; deep-link `?board=vision` lands on vision. Record findings in the as-built.
- Owner A/B: the owner exercises the switcher and reports feel — approval is experience-based (their standard bar for UI work).

## Seams under test

- Chart option builders through the existing chart-level test surface if present, plus component tests for relabel/switcher bindings. The GL/board-switch probe is a scratch probe, not a committed test.
