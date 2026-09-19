# Step 02 — Load-timing module — OPEN

## Spec

- `lib/load.mjs` — port + harden `.tmp/compare_load.mjs`:
  - N runs (default 7) per side per condition → median / p90 / min / max
    (replace keep-last-of-3);
  - conditions: cold (cache disabled per run) and warm (same context reused),
    each unthrottled and throttled — CPU 4×
    (`Emulation.setCPUThrottlingRate`) + Fast 3G
    (`Network.emulateNetworkConditions`);
  - metrics per run: TTFB, DCL, load, FCP, LCP (buffered PerformanceObserver),
    time-to-chart-paint (`chart-blend` anchor, both apps), requests, transfer/
    encoded/decoded KB;
  - per-resource waterfall table (url, size, encoded, duration) sampled once
    per side;
  - `--live` third target: https://llm-pareto.kaidev.io/ measured with the
    same procedure (real CF compression check).
- Serves both sides via `lib/serve.mjs` (A5) + fairness copy from step 1.
- Output: `results/load.json` + markdown section.

## Not touched in this step

Static module outputs; interactions module; report aggregation.

## Verification

- `node .tmp/refactor-bench/run.mjs --runs 3` exits 0;
  `results/load.json` has 2 sides × 2 cache modes × 2 throttle modes × ≥3 runs.
- Throttled medians are visibly slower than unthrottled (sanity that the
  throttle actually applies).
- `--live` run reaches prod and returns a sane FCP.

## Seams under test

- no tests: scratch benchmark tooling (gitignored); verified by running it
  against the cutover pair — there is no repo-facing behavior.

## As-built

(to be written at close)
