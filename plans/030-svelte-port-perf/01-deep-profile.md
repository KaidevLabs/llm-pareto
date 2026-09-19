# Step 01 — Deep performance profile — OPEN

## Spec

Localize the cost behind the plan-029 deltas with real evidence — the harness gives
us *what* regressed (FCP/LCP/throttled-load/init-paint/zoom), not *why*. This step
produces a written profile naming the top-3 costs.

- **Bundle breakdown.** `npm run build`, then inspect `dist/assets/`:
  - total initial JS (the `index-*.js` entry + anything it statically imports);
  - whether `echarts` (≈1 MB raw / 305 KB gzip) and `echarts-gl` are in the initial
    chunk or split/lazy;
  - use `npx vite-bundle-visualizer` (or read rollup's `dist/.vite/manifest.json` /
    build stdout) to attribute weight per module.
- **First-paint trace.** Serve the built app (`npm run preview`, or reuse the plan-029
  A5 static server against `dist/`) and capture a Chrome DevTools trace / Lighthouse
  run: identify what occupies the main thread before first paint — svelte mount,
  echarts `init`, GL load, or the data `fetch`/parse. Record TBT and the longest task.
- **Zoom micro-bench.** The +170 ms zoom settle (581→751) is the most suspicious
  interaction cost. Reproduce the wheel handler in isolation (or instrument
  `bindPan`/`charts.ts` zoom path) to see if it is reactive re-render thrash
  (many `$effect` runs) vs a single expensive layout/paint.
- **Heap.** Note the +33 MB (28→62) in the profile as framework + module graph +
  echarts-gl; no deep-dive required, just confirmed.

**Not touched in this step:** all `src/` files (read-only analysis); the harness
(used as-is).

## Verification

- A `findings` doc (step-01 as-built) listing the **top 3** perf costs, each backed by
  a number (chunk KB, trace span ms, or micro-bench ms).
- Bundle breakdown present (initial-JS size + echarts/echarts-gl placement confirmed).
- A trace/Lighthouse artifact or its key numbers captured (TBT, longest task, what
  blocks first paint).

## Seams under test

- `no tests`: exploration-only; verified by the three evidence artifacts above
  (bundle sizes, trace spans, micro-bench) the owner reviews.
