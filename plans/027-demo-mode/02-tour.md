# Step 02 — Guided tour — IN PROGRESS (code done, awaiting owner staging)

027 step 2, executing 2026-09-18. Spec: `plans/027-demo-mode.md` step 2
(its A2/A3/A5 and current-state sections carry the settled decisions).
Commit subject: `chart: 3D guided tour`.

## Spec

**New file `src/lib/tour.ts`** — the tour engine, framework-agnostic:

- `Waypoint`: `{ alpha, beta, distance, caption, hold }` — camera spherical
  coords (degrees), a caption chip string, a hold time (ms) at arrival.
- `TOUR: Waypoint[]` — the script (drafted below; owner edits copy at
  review). Waypoints are frame-of-reference moves over the scene, in
  order: (1) wide establishing orbit from the default camera
  (alpha −45°, beta 30° per echarts-gl's default view — VERIFY live,
  see verification), (2) glide to the low-price shelf (low log10-price,
  caption names the cheap-frontier cluster), (3) glide to the fast shelf
  (high log10-speed), (4) glide to the Elo peak, (5) sweep back to a
  mid-shot on the frontier glow, then hand back to idle autoRotate.
  Alpha/beta/distance targets chosen against the shipped scene's bounds
  (distance 60–500, data spans ~log10 0–2 price / 1–2.5 tok/s / 1111–1506
  Elo); fine-tuned live by CDP read-back + owner A/B.
- `startTour(chart, opts)` / `stopTour()`:
  - The flight is a rAF loop lerping `alpha/beta/distance` between the
    current camera and the waypoint target with easing (ease-in-out per
    segment); echarts-gl has no tween API — the loop drives
    `chart.setOption({ grid3D: { viewControl: { alpha, beta, distance } } })`
    per frame (merge mode — the option piece is small, NOT a not-Merge
    full setOption; the scene re-render seam stays untouched). Captions
    render in DOM (below), not in the canvas.
  - `onDone` fires after the last waypoint's hold; the tour then leaves
    the camera where it ended (idle autoRotate takes over — it is the
    scene's default).
  - `cancel()` — any real interaction (pointerdown/wheel on the chart
    host) cancels the flight mid-waypoint without snapping the camera
    (it stays where it is; the idle autoRotate resumes per scene
    default) and clears the caption.
  - While touring, the scene's `autoRotateAfterStill` idle rotation must
    not fight the flight: the flight sets viewControl each frame, which
    resets the still-timer — no extra handling needed (verify by probe).
- Caption chip DOM: `showCaption(text)` / `hideCaption()` — a single
  positioned chip over the chart host (`<div class="tour-cap">`), styled
  like the site's chip/badge chrome. The Panel component owns the DOM
  node (Svelte), tour.ts drives it via callbacks — no framework import
  in tour.ts.

**`src/components/Panel.svelte`** — the tour trigger (A2, "tiny and
hidden"): a 3D-only micro-pill in the panel-head, left of the existing
"⤢ fit" pill: label "▶", `title="Play the guided tour"`, font-size ~10px,
padding 2px 7px (visibly smaller than the fit pill — tucked, not
promoted). Shown only when `key === "3d"`. Click → `startTour` on the
chart instance (via a charts.ts export; see below) and toggle to "■
stop" while running. The caption chip renders inside the panel
(absolutely positioned over `.chart`).

**`src/lib/charts.ts`** — the seam between tour.ts and the chart
instance: export `tour3D(el)` (starts the tour on the `chart-3d`
instance; no-op with a console warn if the instance/GL isn't ready) and
expose the caption-DOM mount point. `onChartClick` and the existing
pointer handlers are untouched.

**Boot deep-link (A3)** — `src/App.svelte` boot path: after
`boot.ready` flips true, if the URL carried `tour=1` (read once,
stripped immediately via `history.replaceState` — A5: tour is an entry
action, never state; the strip happens BEFORE `initHistory`'s seed so
the first history entry is clean and popstate never replays the tour),
enter 3D (`ui.three3d = true`) and autostart the tour once the
`chart-3d` instance exists (a small one-shot flag the Panel effect
consumes; if the user is not on 3D-capable state, the flag clears on
first cancel/finish).

**Not touched in this step:** urlstate/history (the `tour=1` strip
happens before seedFromURL; `read()` never sees it), the 2D panels,
update.py, data files, the vendored echarts files. `ui` gains NO new
field — tour state is module-local in tour.ts + a panel-local
`$state` for the pill/caption.

## Seams under test

1. `tour.ts` module seam (unit, vitest): the tour controller as a pure
   state machine — `startTour(chart, opts)` with a **fake chart**
   (records setOption calls + a clock) drives waypoint sequencing,
   easing monotonicity, hold timing, cancel-on-demand, onDone firing,
   and caption callbacks. No echarts import in the test.
2. `urlstate.read` extension: `tour` is deliberately NOT serialized by
   `write` (entry action, not state) — the existing round-trip test
   already pins this; the new read-side test pins `tour` being ignored
   by `read` (it is App's boot concern, not state).

No component-level test for the Panel pill (visual chrome, owner A/B);
no CDP assertion for caption copy (owner edits at review).

## Verification

- `npx vitest run src/lib/tour.test.ts` (single file, every cycle)
- `npm test && npx tsc --noEmit` (step close)
- `npm run build` clean
- CDP probe (`.tmp/`, scratch): `?view=3d&tour=1` in a fresh headless
  load → caption chip appears, camera reads back changing
  alpha/beta/distance across ≥3 samples during the flight, a synthetic
  pointerdown cancels (caption gone, no further camera drift), and a
  reload without `tour=1` never autostarts. Delete after use (probe →
  the kept assertions live in tour.test.ts).
- Cookieless grep unchanged (no storage APIs).

## As-built

- `src/lib/tour.ts`: the controller as specified — waypoints, per-segment
  ease-in-out rAF flight over alpha/beta/distance, shortest-arc alpha
  (never spins the long way round), hold timing, `onCaption(""/text)`,
  `onDone`, `cancel()` freezing the camera in place. Injectable ticker
  (`rafTicker()` for the real rAF clock) makes the tests deterministic.
- `src/lib/charts.ts`: the tour seam grew a small lifecycle —
  `startTour3D()/stopTour3D()/tourRunning()/registerTourUi()`; the Panel
  registers caption/state callbacks, the pill click and the `tour=1`
  autostart take the same path. Cancel-on-interaction binds
  mousedown/wheel/touchstart on the instance's zr layer per tour start.
  **DEVIATION from spec (better):** the autotour flag is consumed inside
  `render3DPanel`'s GL-load `.then` — right after `setOption` — not in
  the Panel effect: on a fresh deep-link load the Panel effect runs
  before the async GL load creates the instance, so an early consume
  raced it and silently dropped the autostart (found by the CDP probe,
  tour_debug trace: `ReferenceError`→fixed, then the race→restructure).
- `src/lib/tourflag.svelte.ts`: the one-shot App→Panel handoff module
  (A3) — App reads/strips `tour=1` at boot and publishes; charts.ts
  consumes at chart-exists time.
- `src/components/Panel.svelte`: the tiny 3D-only pill (▶/■, 28px vs the
  fit pill's 55px — "tiny and hidden" A2) + the caption chip
  (`.tour-cap`, badge-chrome styling, bottom-center over the scene).
  **One regression found + fixed by the probe: my first edit dropped
  Panel's `boot` import — the whole app died with `boot is not
  defined`; the probe caught it immediately.**
- `src/lib/charts.ts` TOUR_WAYPOINTS: 5 waypoints (establishing orbit →
  cheap shelf → fast shelf → Elo ceiling → frontier glow return);
  targets hand-tuned against the shipped scene's bounds.
- Verification: `npx vitest run src/lib/tour.test.ts` 6/6 every cycle;
  full gate `npm test` (72/72) + `npx tsc --noEmit` + `npm run build`
  clean; CDP probe `.tmp/tour_verify.mjs` 13/13 ALL PASS (autostart,
  URL strip, camera read-back 20,330 → 25.95,299.38 during flight,
  cancel-on-interaction, plain-load no-autostart, pill size/behavior);
  cookieless grep clean (0 storage-API hits in src/). Harness note: 69
  stray chromium processes from earlier sessions had to be killed before
  the probe ran clean — port 9226 was answering from a stale instance.
