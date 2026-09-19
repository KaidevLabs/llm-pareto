# Step 03 — Interactions module — OPEN

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

- `node .tmp/refactor-bench/run.mjs --runs 3` exits 0;
  `results/interact.json` populated for both sides across all 6 measurements.
- Selector assertions PASS per side (no silent skips — a missing selector on
  one side is a recorded caveat, not a failure of the other side's numbers).

## Seams under test

- no tests: scratch benchmark tooling (gitignored); verified by running it
  against the cutover pair — there is no repo-facing behavior.

## As-built

(to be written at close)
