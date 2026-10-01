# Step 05 — 3D playback — OPEN

## Spec

Time playback on the 3D showcase (`gl.ts` + `charts.ts render3DPanel`),
the "evolver" surface.

- **Frame swap**: `render3DPanel` reads `data.rows` at ~1038 — switch to
  `frameRows()`, same as step 03. The 3-objective frontier glow
  recomputes per frame (pareto.ts is already a pure function of rows).
- **Trails**: `lines3D` series (already vendored, echarts-gl 2.1.0) —
  `computeTrails` extended to 3-tuples `(price, elo, speed)`; the speed
  coordinate comes from the frame's `speed` map (`speedAt`), frames
  without speed data (backfilled ones) fall back to the live speed map —
  documented in the tooltip note as "as-of" semantics (B14: never
  averaged across frames). Same top-N cap as 2D.
- **Camera while playing** (settled here, previously "not yet specified"):
  autoRotate keeps running during playback (it is the idle behavior and
  the motion pairs well); user drag always wins (the existing
  viewControl). No camera lock, no per-frame camera moves.
- The 3D note (`NOTE_3D`, charts.ts ~52) gains a time-mode sentence when
  `playback.active`.
- Panel visibility: the timeline dock stays visible in 3D mode (it is
  orthogonal chrome); the play pill already toggles independent of mode.

**Not touched in this step**: tour.ts camera choreography (except: the
tour refuses to start while `playback.active` — one guard), urlstate,
endpoints fetch path.

## Verification

- `npx vitest run src/lib/trails.test.ts` extended: 3-tuple trails with
  speed fallback.
- `npm test` green; `npx tsc --noEmit` clean; `npm run build` clean.
- `.tmp/` CDP probe (3D seam — the existing gl/chart probe recipe): enter
  time mode, flip the 3D pill, play — spheres move, frontier glow
  recomputes, rotate keeps working mid-playback, WebGL context survives a
  20-frame play (no context loss in the probe log).

## Seams under test

The 3D trail computation (unit, trails.test.ts). The gl seam itself has
no unit seam (echarts-gl mock boundary per `echarts-gl.d.ts`) — covered
by the CDP probe; noted here as the step's `no unit tests: WebGL render
path, probed instead` line.
