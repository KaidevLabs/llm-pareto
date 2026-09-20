# Step 01 — Deep performance profile — ✅ COMPLETE (2026-09-20, no code changes)

> Exploration-only step: no `src/` changes. Evidence probes live in `.tmp/030/`
> (scratch, not committed): `trace.mjs` (first-paint attribution), `zoom.mjs`
> (wheel micro-bench), `heap.mjs` (heap checkpoints + allocation sampling),
> `bundleattr.py` (sourcemap VLQ byte attribution), plus their `*-report.json`.
> Machine: headless Chromium 153, node v26.8.2, conditions identical to the
> plan-029 harness (FAST3G 562 ms RTT / 176 KB·s⁻¹ + 4× CPU throttle, cache
> disabled for cold runs).

## Measurement state (caveat)

Probes ran on the **current tree** (HEAD `38bc0db` + 032 steps 1–3 in the
worktree, dirty: `charts.ts`/`filters.ts` fade changes) — owner authorized
starting the exploration despite the in-flight step. 032's additions are
~3.7 KB of bundle and do not touch the boot path, so the numbers are directly
comparable to the plan-029 medians (old `7957602` vanilla vs new `e858d24`
cutover). Old-side zoom/heap comparisons ran in a fresh worktree at
`7957602` served straight from `public/`.

## Bundle breakdown (initial JS)

`npm run build` → 165 modules, single chunk (no manualChunks):

| asset | raw | gzip | role |
|---|---|---|---|
| `dist/js/echarts-5.6.0.min.js` | 1,034,102 B | **335.4 KB** | classic `<script>` at end of body — **parse-blocking**, must execute before the deferred module runs |
| `dist/assets/index-*.js` | 120.0 KB | **42.8 KB** | svelte bundle — app `src/` **64.4 KB (54%)** + svelte runtime **53.8 KB (45%)**; largest module `charts.ts` 18.2 KB (28% of app code); includes `svelte/animate` 2.3 KB (Comparator's `flip`) |
| `dist/assets/index-*.css` | 19.2 KB | 3.8 KB | |
| `dist/fonts/inter-var.woff2` | 48.3 KB | 47 KB | self-hosted, font-display:swap |
| `dist/data/combined.json` | 224 KB | 16.3 KB | fetched post-mount (boot) |
| `dist/data/meta.json` | 4.6 KB | ~1 KB | fetched post-mount |
| `dist/data/endpoints.json` | 2,197 KB | **157.4 KB** | fetched **after** `boot.ready` (hover cards / speed view) — not on the first-chart path |
| `dist/js/echarts-gl-2.1.0.min.js` | 639.8 KB | 175.2 KB | **lazy** — confirmed absent from the initial load; only on 3D entry |

Total eager weight ≈ 445 KB gz (echarts is 75% of it). The svelte bundle is
**not** the load problem — the vendored echarts script is.

## Top 3 costs

### 1. FCP/LCP regression: 608 ms → ~3.3 s throttled (+2.7 s) — the lost static shell

Plan-029 cold-throttled: old FCP 608 / LCP 624; new FCP 3152 / LCP 3152.
Probe reproduces (3 runs): FCP 3268 / 3292 / 3608 ms, and shows the mechanism:

- Resource offsets: HTML arrives at ~656 ms (one FAST3G RTT); **all three
  top-level resources start at 656 ms** in parallel (the module + CSS are
  preloaded from `<head>` while echarts downloads). echarts finishes
  downloading at **3204 ms** (656 + 2548), executes, then the deferred module
  executes and mounts → DCL 3242–3497, FCP ≈ DCL.
- Phase A (nav→FCP) CPU profile: only **164–719 ms busy** in a 3.3 s window —
  first paint is **network-gated** (echarts bytes + RTT), not main-thread
  blocked. Longtasks ≤ 144 ms; TBT over the whole load ≈ 60–240 ms.
- The old app painted at 608 ms because `public/index.html` shipped the
  **entire static shell** (header, nav, five panels, legends — contentful DOM)
  and the blocking echarts script sat *after* it in `<body>`. The port's
  `index.html` renders only an empty `<div id="app">`, so nothing can paint
  until svelte mounts — gated behind the full echarts download+exec chain.
- The harness's "+3.5 s throttled `load`" (3332→6806) is a **logo-`<img>`
  accounting artifact, not a user cost**: `OfPanel`/`ModelCard` create DOM
  `<img>`s once data loads (~4 s), so new's `load` event waits for them
  (~6.9–7.4 s); old created its logo imgs *after* its load event fired (3.3 s),
  so they were never counted. Same bytes both sides.

Fix candidates for the backlog: restore a static shell in `index.html`
(header/nav/panel chrome; FCP back to ~600 ms without touching the bundle),
optionally `defer` the echarts script (DCL/module ordering), preload hints.

### 2. First-chart tail: the badge-logo RTT chain (parity regression, biggest absolute cost)

Chart-ready ≈ 7.0–7.5 s throttled on new (029: 6853 new / 7066 old — parity).
The tail decomposition (throttled): data fetch starts at 3256 ms post-mount
(`combined` done 4011), then `buildBadges()` awaits **~25 logo images**
(starting 4033 ms, RTT-stretched to 4600–6853: moonshot 51 KB → 6270, rekaai
4 KB → 6853) before `boot.ready` — the first chart cannot render until every
badge logo lands. Canvas badge compositing itself (`toDataURL`) costs
85–220 ms throttled / 27–75 ms unthrottled. Old pays the identical chain
(same `buildBadges` design) — this is the app's biggest remaining load cost,
not a port regression.

Fix candidates: render charts before badges finish (circles first, badge
symbols swapped in on ready — the frontier badge is already a canvas dataURL,
so the swap is one re-render), or build badges only for frontier orgs
(~15 of ~40), or load logos concurrently in one pool with the data fetch.

### 3. Zoom per-tick render +~30–40% — small, and the harness's +170 ms is probe amplification

Per wheel tick (10-tick burst, 7 repeats each side, fresh warm nav):

| | old `7957602` | new (current) |
|---|---|---|
| first visible repaint after 1st tick | **45 ms** | **84 ms** |
| `dispatchAction` render, Σ10 ticks | 37.4 ms (max 6.2) | 47.6 ms (max 9.1) |
| `getOption` clones, 20 calls | 16.4 ms | 20.6 ms |
| svelte-driven `setOption` during burst | **0** | **0** |
| burst-window busy (incl. probe's canvas reads) | 158 ms | 426 ms |
| settle (029's `zoomSettleMs` metric) | 575 ms | 781 ms |

- **No reactive thrash**: zero `setOption` calls from svelte during a wheel
  burst — the zoom path is pure echarts (the 018 A2 design held through the
  port). The +170 ms harness delta (581→751) reproduces (575→781) but is the
  probe's own 10-wheel dispatch loop stretching with per-tick main-thread
  work (`wheelDone` 516→725 ms), not a discrete stall.
- Real per-tick cost is ~4.8 ms render + ~1 ms `getOption`×2 — imperceptible
  at wheel rates. Mechanisms if it ever matters: the keep-alive point set
  draws every plottable row (ghosts included), and each tick runs
  `windows()` + `captureZoom()` = two full `getOption` deep clones.
- No longtasks during bursts; GC ~9 ms.

Fix candidates (low priority): cache the fit-window/zoom-window reads
(`ZOOM` map already exists) to drop the two `getOption` clones per tick.

## Heap: the +33 MB was sampling-instant churn; retained delta is +5.6 MB

`performance.memory` without forced GC is GC-timing-sensitive. Post-GC
(`HeapProfiler.collectGarbage`, precise-memory-info Chromium):

| checkpoint | old `7957602` | new (current) |
|---|---|---|
| raw usedJSHeapSize @ chart+300 ms | 11.6 MB | 16.6 MB |
| **retained 2D, post-GC** | **7.8 MB** | **13.4 MB** |
| 3D view (GL on) | 11.3 MB | 14.8 MB |
| back to 2D | 11.9 MB | 15.3 MB |
| no-data baseline (fetch rejected) | 2.9 MB | 3.5 MB |

- The 029 interact metric (`memLoadKB` 28→62) read the heap **uncollected,
  immediately after first render** — peak young-gen garbage from mount +
  echarts init + JSON parse (2.6 MB raw) + badge building. Retained reality:
  **+5.6 MB** (7.8→13.4), of which framework/runtime share is +0.6 MB
  (no-data delta); the rest is svelte's deep-proxied rows/state + per-render
  option structures. 3D adds +1.4 MB retained on new (GL module + context);
  interestingly old retains *more* after 3D (+3.5 MB).
- Echarts-gl stays out of the initial heap (lazy, confirmed).

## Verification

- Bundle breakdown present: table above + `.tmp/030/bundleattr.py` output
  (sourcemap VLQ attribution; `--sourcemap` build, dist rebuilt clean after).
- First-paint trace: `.tmp/030/trace-report.json` (3× unthrottled + 3×
  throttled; phase A/B CPU profiles, resource offsets, longtasks, LCP).
- Zoom micro-bench: `.tmp/030/zoom-report.json` (7× old + 7× new, instrumented
  instance + burst-window CPU profile).
- Heap: `.tmp/030/heap-report.json` (checkpoints + allocation sampling, both
  sides).
- No `src/` file changed (exploration-only confirmed; the dirty `charts.ts`/
  `filters.ts` are 032 step 3's in-flight work, untouched by this step).

## Seams under test

- `no tests`: exploration-only; verified by the evidence artifacts above,
  which the owner reviews.
