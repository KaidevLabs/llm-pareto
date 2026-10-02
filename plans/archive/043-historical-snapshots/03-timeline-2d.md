# Step 03 — Timeline dock, play pill, per-frame 2D render — ✅ COMPLETE (committed cdb3c1d, 2026-10-02)

## As-built

All spec items shipped. Deviations and owner decisions made mid-review:

- **Dock layout**: the dock sits under the chart area (App.svelte,
  above the comparator), plain DOM + the store's chrome — the Pill
  vocabulary carried over as classes (`tl-btn` takes the pill look, the
  `● live` button takes the History pill's active state). Hidden with no
  loaded index (the store's soft 404 tolerance makes this the fresh-clone
  state).
- **Slider binding**: `value={pos}` is a local rune + a sync `$effect`
  (not a `bind:`) — a drag updates the slider at once while the frame
  load is in flight, the store catches up when it lands; the effect also
  parks the slider at the newest frame on exit (live sits past the last
  snapshot). Dragging while playing pauses (spec) — and a scrub takes
  `enterTime` (pin-first entry), so the first drag never renders a
  per-frame fit.
- **Stale-scrub guard (owner A/B "smoother", 2026-10-02)**: a fast drag
  issues overlapping frame loads; `showFrame`/`tick` now carry a
  monotonic `selectSeq` guard — only the NEWEST selection lands, a
  slower older fetch resolving later is dropped. Seam-tested
  (Timeline.test.ts: "a fast scrub: a stale selection never lands after
  a newer one", proven red-without/green-with).
- **Frame-swap tween (owner A/B, 2026-10-02)**: two owner rounds.
  UniversalTransition (+ per-model `id`s, the +8 KB feature) was tried
  and REVERTED — element tracking proved it dissolves every dot and
  fades in a new element at the new position (no movement at all). The
  plain merge tween is the morph: element identity preserved
  (`getItemGraphicEl` returns the same object across a swap), monotone
  glide measured (`.tmp/probe_043_glide.mjs`: 929→880 px, no backwards
  moves). While PLAYING the tween now fills the whole tick interval with
  linear easing (`frameTween()` in charts.ts) — consecutive glides join
  into one continuous drift at any fps; paused/scrub swaps and live
  filter fades keep the 032 fade (350ms, cubicOut). `labelLayout` was
  removed and restored during the A/B — innocent (the Symbol element
  natively extends Group).
- **Known residual artifact (documented, owner to pick a/b/c)**: a
  frontier badge↔circle symbol-type change forces echarts to recreate
  the element instantly (no tween possible on that path). Measured
  frequency: 0–2 flips per frame boundary across the 16-boundary history,
  13 + 10 at the two newest boundaries. Options presented 2026-10-02:
  (a) accept, (b) badges in their own series (dots always tween),
  (c) circular badges via image-fill (symbol type never changes).
- **`window.__charts` probe seam (main.ts)**: the post-040 page has no
  global echarts and the bundle exports nothing — the CDP probes read
  the live chart instances through it (the 028-era `window.stP`
  precedent).
- **Step-02 characterization amended**: `play()` awaits the pinned
  domain at entry, so the "frame 2 not fetched yet" prefetch assertion
  became "every frame lands exactly once (shown/prefetched/pinned)".
- **`_headers` shape (deviation from the sketch)**: the verified working
  shape (wrangler dev 4.146.0, lab-measured) needs the index rule to
  `!`-detach `Cache-Control` and set its own value **in the same block**
  — a lone detach block gets lost and a plain second value comma-joins
  with the year max-age first (which wins under RFC-9111). Verified:
  snapshots `max-age=31536000, immutable`, index `max-age=60`,
  `_headers` itself 404. The deployed-Worker check is step 06's probe.
- **Probes**: `.tmp/probe_043_step3.mjs` (25 checks, ALL PASS — index
  fetched once, dock/pill chrome, pinned domain vs an independent
  recompute of the fits, no-rescale scrub, per-page-load cache, drawer
  on a frame point, live exit, wrangler-dev `_headers`) and
  `.tmp/probe_043_glide.mjs` (glide verification). Scratch, not
  committed.

## Spec

The orthogonal-controls design (settled): time is not a mode — it plays
over any surface.

**`src/components/Timeline.svelte`** (new; plain DOM + the store):

- Dock under the chart area (App.svelte layout), hidden when
  `snapIndex.entries.length === 0` (fresh clone / failed index → no
  chrome).
- Slider `min=0 max=entries.length-1`, bound to `playback.i`; tick labels
  sparse (first/last + month marks; the full ts list lives in the
  index). Dragging while playing pauses.
- `▶︎ Play / ⏸ Pause` button, frame-rate toggle (0.5×/1×/2×), `● live`
  exit button visible when `playback.active`.
- Frame readout: `ts` + `N models · joined/unmatched` from the frame's
  meta; entry/exit delta vs the previous frame comes in step 04.
- Styling matches the existing nav/pill chrome (Pill.svelte vocabulary).

**Play pill in `nav.filters`** (App.svelte, next to the 3D pill): toggles
`playback.active` (on = enter time mode at the newest frame; off = exit).
Active state styled like the 3D pill.

**Per-frame render wiring** (the render-path switch):

- `charts.ts`: `renderPanel` (line ~698) and `renderSpeedPanel`
  (~769) read `data.rows` at 720/804/1038 — switch those reads to
  `frameRows()`. Filters/search/thresholds already operate on the rows
  array passed to `pointsFor`/`filterRows`, so the whole filter stack
  applies to the frame for free.
- **Pinned domain while playing**: when `playback.active`, the 2D axes'
  min/max are the union over the *full snapshot set* (computed once from
  the index's referenced frames — or, cheap v1: the union over the first
  and last frames, monotone-ish by construction), passed as explicit
  xAxis/yAxis min/max in the setOption; pan/zoom still overrides the view
  (018's window persists per the existing notMerge handling). No
  rescale-jitter between frames.
- Live header stamp (`App.svelte` ~110): in time mode show the frame's ts
  + a "time view" marker instead of the live `updated` stamp.
- The 3D panel (`render3DPanel`, ~869) is wired in step 05 — this step
  explicitly leaves it reading live data.

**`_headers` for immutable snapshots** (the caching half):

- New `public/_headers` (vite copies `public/` verbatim):
  ```
  /data/history/*
    Cache-Control: public, max-age=31536000, immutable
  /data/history/index.json
    Cache-Control: public, max-age=60
  ```
- Verify the deployed Worker honors it (Workers static assets support
  `_headers`/`_redirects` — confirm against the wrangler version in
  `package.json`; if unsupported, fall back to the default ETag
  revalidation and note it in the as-built). NOT a cookie — 020-compliant.

**Not touched in this step**: `gl.ts`/3D, urlstate, comparator, details
panels.

## Verification

- `npm test` green (existing suites prove the non-time path unchanged:
  components render without `playback.active`).
- `npx vitest run src/components/Timeline.test.ts` — new: renders only
  with a loaded index; slider reflects `playback.i`; play/pause toggles;
  live-exit restores `data.rows` rendering.
- `npx tsc --noEmit` clean; `npm run build` clean.
- `.tmp/` CDP probe (scratch, per repo convention): serve `dist/`, flip
  the play pill, drag the slider across two frames — bubbles move, axes
  don't rescale, detail panel opens on a frame point. Reuse the drawer/
  chart probe recipe from the archive plans.

## Seams under test

`src/components/Timeline.test.ts` (vitest + @testing-library/svelte,
typed index fixtures — synthetic, never real payloads). The render-path
switch is covered indirectly by the existing `pareto`/component suites +
the CDP probe (no new unit seam: it is a data-source swap, not new
logic).
