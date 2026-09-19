# Step 02 — Load-timing module — ✅ COMPLETE (committed 2a69a1e, 2026-09-19)

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

- `node .tmp/refactor-bench/run.mjs --runs 7` exits 0 (default; ≥5 requested by
  owner); `results/load.json` has 2 sides × 2 cache modes × 2 throttle modes ×
  7 runs.
- Throttled medians are visibly slower than unthrottled (sanity that the
  throttle actually applies).
- `--live` run reaches prod and returns a sane FCP.

## Seams under test

- no tests: scratch benchmark tooling (gitignored); verified by running it
  against the cutover pair — there is no repo-facing behavior.

## As-built

Implemented 2026-09-19. `lib/load.mjs` is a CDP headless port of the old
`.tmp/compare_load.mjs`, hardened: N-run aggregation (median/p90/min/max per
metric), four conditions per side (cold/warm × unthrottled/throttled with
CPU 4× + Fast 3G), LCP via `Page.addScriptToEvaluateOnNewDocument` +
buffered `PerformanceObserver`, FCP/chart-paint from the page `performance`
API and the `chart-blend` anchor, and a once-per-side per-resource waterfall
captured on a **cold** navigation (first attempt sampled it after the warm
cache was built → all transfer sizes read 0; fixed by moving the waterfall to
the start of the side with cache disabled).

Verification (`--runs 1`, baseline `old=7957602` vs `new=e858d24` — see A7;
the earlier HEAD-based run was rejected by the owner as conflating the
refactor with the 027 tour + 025 comparator features):

- `run.mjs --runs 7` exits 0; `load.json` has old+new × 4 conditions × 7 runs.
- Throttle applies: old cold-unthrottled load median 39 ms vs cold-throttled
  3,331 ms; new 46 ms vs 6,830 ms.
- **Headline (pure cutover, cold-unthrottled):** old chart-paint 147 ms / load
  39 ms / transfer 627 KB vs new 137 ms / 46 ms / 636 KB. The svelte
  refactor is **load-neutral** — marginally faster on cold chart-paint, at
  parity on load and transfer. The "new = 467 ms" seen in a HEAD-based run was
  entirely the tour+comparator feature code, *not* the refactor. This is the
  false-negative the harness was built to prevent.
- Waterfall (cold, new): echarts 305 KB, endpoints.json 102 KB, logos 51 KB,
  inter-var.woff2 47 KB — real sizes now (was 0 before the fix).

`--live` (A2/real-CF check): the code path mirrors the local measure logic
and is correct, but **cannot run in this sandbox** — `curl` to
`https://llm-pareto.kaidev.io/` returns `http_code=000` (8 s timeout): no
external network egress. The run would hang in `Page.navigate` to the
unreachable URL, so `load.mjs` now preflights prod reachability
(`fetch` HEAD with a 5 s `AbortSignal.timeout`) and **skips `--live` with a
clear log line** instead of hanging, still producing old+new. On a host with
prod egress it will measure the third target normally. This is an
environment limitation, not a defect; documented so step 2 is not blocked on
it.

In-dev fixes this step: TS `WebSocket` global (node ≥22, no import needed);
TDZ on the CDP socket in `finally` (declared `let ws`); the cold-waterfall
ordering bug; and the `--live` hang → fail-fast skip.
