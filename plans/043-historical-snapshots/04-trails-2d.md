# Step 04 — Trails + entry/exit highlights (2D) — AMENDED 2026-10-02

> **Owner verdict post-A/B (2026-10-02): the 2D `lines` trails are removed
> as noise** — they were visible mainly when zoomed, on a handful of
> models, and read as clutter. What SURVIVES from this step:
> `frameDiff` (entry/exit by or_id), the frame-swap entry pulse (name-keyed
> highlight bursts), and the Timeline readout's `+N / −M since previous`.
> `computeTrails` stays in the module — it is the 3D dot-chain trails'
> source (step 05). The scatter's `name: or_id` diff keys stay (the pulse
> dispatches by name).

## Spec

Movement-encoding on the 2D panels, composabled with the per-frame swap
of step 03.

**Trails** (`src/lib/trails.ts` + charts.ts integration):

- `computeTrails(uptoIndex: number, topN: number): Trail[]` — for each
  model present in ≥2 frames of `0..uptoIndex`, its ordered
  `(price, elo)` positions across those frames. Trails are computed from
  already-cached snapshots only; a not-yet-fetched frame contributes
  nothing (no blocking fetch on the render path — the prefetch of step 02
  fills the cache as playback advances).
- Cap: top-N by `arena_votes` (fallback arena rank) of the *current*
  frame, N = 25 (settled default; a knob, not a promise). The frontier +
  comparator-picked models always trail regardless of N.
- Render: an ECharts `lines` series (coords → `lineStyle: { opacity 0.35
  }`, no symbols) added beneath the bubble series when `playback.active`.
  New model ids entering mid-play start their trail at their entry frame.
- Org-colored (the existing palette) so trails read as ownership.

**Entry/exit highlights**:

- `frameDiff(prev, cur)` (trails.ts): `entered: Row[]`, `exited: Row[]`
  by `or_id`.
- Entered points in the current frame: one-shot emphasis pulse (the
  existing emphasis style, re-applied on frame swap via a
  `dispatchAction({ type: 'highlight' })` burst); exited models get a
  small "+E/−E" delta count in the Timeline readout (e.g. `+3 / −1 since
  previous`), not ghosts in the chart.
- The Details panel keeps working on frame rows for free (it reads the
  same rows source).

**Not touched in this step**: 3D (`gl.ts`), urlstate, filters, comparator.

## Verification

- `npx vitest run src/lib/trails.test.ts` — new: trail computation
  (entry mid-play, exit termination, top-N cap, frontier/pick override,
  gaps from uncached frames); `frameDiff` entered/exited sets.
- `npm test` green; `npx tsc --noEmit` clean; `npm run build` clean.
- `.tmp/` CDP probe extended: play across 3 frames with ≥1 model entering
  — trail line visible, pulse fires, readout shows the delta.

## Seams under test

`src/lib/trails.test.ts` (vitest; typed Snapshot fixtures, synthetic).
