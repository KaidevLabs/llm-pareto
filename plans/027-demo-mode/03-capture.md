# Step 03 — Capture — ✅ COMPLETE (committed a7d8243, 2026-09-19)

027 step 3, executing 2026-09-18. Spec: `plans/027-demo-mode.md` step 3
(A6 pins the destination: committed + embedded in README). Commit subject:
`demo: capture the tour`.

## Spec

**New scratch script `.tmp/capture_tour.mjs`** (stays in `.tmp/` per A6 —
only the OUTPUT is committed):

- Rebuild `dist/` (`npm run build`), serve it (python http.server, fresh
  port), launch headless Chromium (SwiftShader WebGL, proven on this
  stack — #468).
- Navigate to `?view=3d&tour=1` — the real entry path the demo shares
  (dogfood: the capture exercises exactly what a visitor experiences).
- `Page.startScreencast` (JPEG, everyNthFrame 1) from just before
  navigation; collect frames with arrival timestamps for the full tour
  plus boot margin (~34s), then stop.
- Mux with `ffmpeg` (present at /usr/bin/ffmpeg): per-frame-duration
  concat demuxer (screencast frames arrive irregularly — image2 with a
  fixed framerate would warp the pacing), `libvpx-vp9`, yuv420p, scaled
  to 1120×720, aiming for a few MB (A6 "kept small").
- Output: `demo-tour.webm` at the repo root; report duration + size.
- **`README.md`**: embed the video under the header (GitHub renders
  repo-path webm in README media syntax). Minimal diff — one paragraph +
  one line.

**Not touched in this step:** src/, update.py, data files, vendored js.

## Verification

- The script runs clean end-to-end from a fresh build; the webm plays
  (duration ≈ tour length; size reported; a frame spot-check shows the
  scene, not a black frame).
- `git status` shows only the webm + README diff (script stays scratch).

## Seams under test

no tests: capture-only step — the artifact is the deliverable (A6); the
tour behavior it records is already covered by step 2's suite + probe.

## As-built (final, incl. owner-review round 2026-09-19)

- `.tmp/capture_tour.mjs`: rebuild → serve → headless Chromium (window
  1400×1100) → navigate `?view=3d&tour=1` → wait for the crowns series +
  rect-stability loop (font reflow) → CDP screencast (JPEG q100, acked
  frames) for 34s → ffmpeg. **Owner-review round changes:** (1) "save
  both" — one capture, TWO encodes; (2) "focus on the graph" — the video
  is cropped to `#panel-3d`'s live rect (crop=`W:H:X:Y` from the measured
  bounding box; measured twice until stable to dodge font-reflow shifts);
  (3) quality chase: VP9 600k/720p → CRF 30 → CRF 22 → CRF 16 — owner
  still unhappy → **H.264 mp4, CRF 14, `-tune animation`, `-preset slow`**
  (the winner, 2.8 MB).
- **Debug findings worth keeping:** headless=new's `--window-size`
  includes ~143px of window chrome — the real viewport was 817px, the
  panel bottom (858) overflowed it, and ffmpeg SILENTLY clamped the crop
  origin upward (the axis-note creeping into the frame). Fixed with
  window 1400×1100. Also: screencast frame timestamps arrive irregularly
  (60fps bursts) — the concat-demuxer durations must use RAW gaps
  (a 33ms floor slow-mo'd the video 1.34×); and per-frame `duration`
  pacing beats `-framerate` image2 for VFR screencast input.
- Committed artifacts: `demo-tour-hq.mp4` (1328×636 H.264, 2.8 MB — the
  README embed), `demo-tour.webm` (1280w VP9 600k, 1.7 MB — light spare).
  README gains "The 3D tour" section: mp4 embed + the live deep-link
  `https://llm-pareto.kaidev.io/?view=3d&tour=1`. The README body's
  pre-028 staleness (no-build-step text, app.js layout) was flagged to
  the owner and parked — out of this step's scope.
- Verification: ffprobe on both outputs (codec/dims/duration ≈ tour
  length); frame spot-checks at multiple timestamps show the scene +
  crowns + captions (never black frames); zoom crops compared across
  codecs before the owner picked. The script stays scratch (.tmp/); the
  OUTPUT is the commit (A6).