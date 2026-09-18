# Step 02 — Guided tour — ✅ COMPLETE (committed 051f99d, 2026-09-18)

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

## As-built (final, incl. owner-review round 2026-09-18 ~23:00–00:30Z)

- `src/lib/tour.ts`: the controller as specified — waypoints, per-segment
  ease-in-out rAF flight over alpha/beta/distance **+ `center` (lerped 3-vector,
  optional per waypoint)**, shortest-arc alpha (never spins the long way round),
  hold timing, `onCaption(""/text)`, `onDone`, `cancel()` freezing the camera in
  place. Injectable ticker (`rafTicker()`) makes the tests deterministic.
- Owner-review round (A/B feel-out, 5 asks applied in this step's window):
  captions 12→16px semibold; flight 1.6→2.6s; holds 1.4–3.2s (then the
  choreography rewrite); **choreography per owner spec**: wide start → full
  lateral (Elo×price, alpha≈2/beta 0) diving to the cheapest → full top-down
  (speed×price, alpha≈88) diving to the fastest → lateral again diving to the
  smartest → finish 45° framing the cloud; each stop **centers on its crown
  bubble** (viewControl.center), finale recenters the box at distance 150.
- **The crowns** (owner pick "3D crowns + tour naming"): `$ champion` /
  `speed champion` / `Elo king` — computed per render over the PLOTTED set;
  chrome = translucent colored sphere (26px, 0.3α) + big gold ♛ glyph label
  (26px) + small role-name label (11px, distance 40); click → drawer; tooltip
  carries the crown title. `CROWNS` stash backs click resolution + the tour.
  **GL lessons encoded (see #499):** mesh symbols ignore borderColor (the
  "ring" idea died), `opacity: 0` culls labels (carrier points keep opacity
  1 + transparent color), and a merge setOption appending series no-ops.
- Tour captions expand `{crown.<kind>}` slots live (tourScript() at
  startTour time) — "the price floor: {model} — $ champion" etc.; resolved
  per filter state, so filtering re-targets the tour.
- `viewControl.center` mapping (the hard-won part): GL world units, origin
  at box center, depth REVERSED — full formula in charts.ts `toWorld` and
  memory #499. The first attempt passed raw data values (owner-visible bug:
  "tiny cloud at the back"), bisected to the coordinate space via 4 CDP
  screenshots, then confirmed against echarts-gl's grid3DCreator source
  (fetched from unpkg).
- `src/lib/tourflag.svelte.ts`: the one-shot App→charts handoff module
  (A3). `src/components/Panel.svelte`: the tiny 3D-only pill (▶/■, 28px vs
  fit 55px) + caption chip; `src/App.svelte`: `tour=1` read-once + stripped
  before history seeding (A5).
- **Regression found + fixed during the round:** a TDZ crash (crowns block
  referenced `toWorld` before its declaration) killed the scene at boot —
  caught by the "no chart instance" probe result, fixed by moving
  bounds/toWorld above the crowns computation.
- Verification: `npx vitest run src/lib/tour.test.ts` 6/6 every cycle; full
  gate `npm test` (72/72) + `npx tsc --noEmit` + `npm run build` clean; CDP
  probe `.tmp/tour_verify.mjs` 13/13 ALL PASS (re-run after every owner
  round); stop-2 centering verified by screenshot (crown dead-center under
  the lateral camera); cookieless grep clean. Probe scripts + bisect
  artifacts deleted after use (.tmp scratch discipline). Harness note: 34
  stray `http.server` processes had squatted port 8125 serving a stale
  dist — killed before the final verification.
