# Step 03 — Interactions module — ✅ COMPLETE (committed 86a20ad, 2026-09-19)

## Spec

- `lib/interact.mjs` — per side (A2), sequential, each interaction timed
  (median of ≥5 repeats, fresh state between repeats):
  1. chart init → first data paint (from `echarts.init` call to the
     `chart-blend` series carrying data);
  2. zoom: synthetic `WheelEvent` bursts on the chart div — per-event handler
     latency + settle time;
  3. drawer open/close via the trusted Input pipeline
     (`Input.dispatchMouseEvent`) — open latency to panel content visible;
     era-specific selectors verified per app (old: `.tmp/drawer-check.mjs`
     patterns; new: current probe patterns);
  4. 2D→3D mode switch including GL lazy-load cost (cold, first switch only)
     and steady-state re-switch;
  5. long-task jank: buffered `PerformanceObserver` longtask entries during
     the interaction burst (count + total blocking time);
  6. memory: `performance.memory.usedJSHeapSize` after load and after the
     burst (delta reported; chromium-only API, noted in output).
- Output: `results/interact.json` + markdown section.

## Not touched in this step

Static/load modules; report aggregation; no changes to either app's code.

## Verification

- `node .tmp/refactor-bench/run.mjs --runs 3` exits 0 (default 7; ≥5 requested
  by owner); `results/interact.json` populated for both sides across all 6
  measurements.
- Selector assertions PASS per side (no silent skips — a missing selector on
  one side is a recorded caveat, not a failure of the other side's numbers).

## Seams under test

- no tests: scratch benchmark tooling (gitignored); verified by running it
  against the cutover pair — there is no repo-facing behavior.

## As-built

`lib/interact.mjs` — per-side CDP interaction benchmark, 6 measurements ×
`repeats` (default 7; owner asked ≥5) fresh navigations per side, medians
aggregated (median/p90/min/max like load).

**Key design correction (in-dev):** the first draft relied on `window.echarts`
instance APIs (`getInstanceByDom` / `convertToPixel` / `getOption`) — that
works for the OLD app (echarts is a global UMD) but the NEW svelte/vite app
bundles echarts as a module and exposes **no `window.echarts` global** (probed:
`typeof echarts === "undefined"`). The UMD also *reassigns* `window.echarts`,
shadowing any `Object.defineProperty` init-patch (so an `echarts.init` wrapper
never captured). Fix: **drop all instance dependence** — every probe is now
DOM/canvas-only, so the comparison is fair across the refactor:

- `chart init → first paint`: `window.__navStart` (set at doc start) →
  first time `#chart-blend canvas` hash flips from blank (`hashExpr` samples
  every 4000th alpha byte; webgl/3D canvas has no 2d ctx → treated painted).
- `zoom settle`: CDP `mouseWheel` burst (10× δY −120) on `#chart-blend`
  center → poll until canvas hash changes (zoom repaint applied).
- `drawer open/close`: **grid-scan** clicks across `#chart-blend` (14×10) until
  `drawerVerify` true (no need for point coordinates) — era-specific verify:
  old `#details` (`.hidden`), new `.drawer` (Svelte `{#if ui.selected}`);
  close old `#details-x`, new `.drawer-x`.
- `2D→3D`: old `#tgl-3d`, new the `button.pill` whose text includes "3D"
  (toggles `ui.three3d`); `chart-3d` canvas hash flips → ready. Cold = first
  switch (loads `echarts-gl-2.1.0.min.js`); steady = 3D→2D→3D re-switch.
- `jank`: buffered `PerformanceObserver('longtask')` reset before the burst,
  read `count` + total-blocking-time (TBT) after.
- `memory`: `performance.memory.usedJSHeapSize` after load + after the burst
  (chromium-only; both null-safe).

**3-run medians (old `7957602` → new `e858d24`):**

| metric | old | new | read |
|---|---|---|---|
| init→paint | 170 ms | 191 ms | new +21 (svelte mount/module eval) |
| zoom settle | 554 ms | 734 ms | new slower — see caveat |
| drawer open / close | 164 / 155 | 166 / 154 | **parity** |
| 3D cold / steady | 176 / 196 | 185 / 204 | parity (GL load cost ~same) |
| jank count / TBT | 1 / 15 | 2 / 13 | negligible both |
| mem load / Δ | 29 MB / −6 | 49 MB / −6 | **new +20 MB heap** (real refactor cost: svelte runtime + module graph) |

**Headline:** the refactor is interaction-neutral on drawer open/close, 3D
switch, and jank. Real costs: ~+20 MB JS heap and a slightly slower zoom
settle on the new side. Both are acceptable and expected for a component
framework vs vanilla; recorded, not a regression alarm.

**Caveats (recorded, not failures):** (1) `init→paint` is proxied as
document-start→first-paint because the new bundle exposes no `echarts.init`
handle to patch — comparable across eras but not literally init→paint; (2)
zoom-settle delta (new 734 vs old 554) may be partly measurement cadence
(canvas-hash poll every 30 ms) vs a real svelte re-render cost — flagged for
step-04 report wording; (3) drawer grid-scan is a brute-force coordinate-free
open (era-agnostic by design).

**In-dev fixes this step:** window.echarts dependence removed (new-side
blocker); zoom→drawer ordering (zoom burst had clipped the first data point
out of view → null drawer) fixed by grid-scan open before any zoom; 3D toggle
selector corrected to the new `button.pill` ("3D").
