# Step 03 — Timeline dock, play pill, per-frame 2D render — OPEN

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
