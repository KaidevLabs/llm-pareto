# Step 03 — Capture — IN PROGRESS

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

## As-built

(to be written at close)