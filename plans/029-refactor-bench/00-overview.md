# 029 — Refactor benchmark suite (app.js → svelte cutover, reusable)

> **Status:** EXECUTING (step 1/5).

Date: 2026-09-19.

## Goal

A reusable refactor-benchmark harness in `.tmp/refactor-bench/` plus the recorded
old-vs-new comparison report the svelte cutover forgot. The harness takes any two
refs (default: the cutover pair `7957602` → current HEAD), measures both sides
across four dimensions (static analysis, assets, load timing, runtime
interactions), and emits a markdown report. Reusable single-ref (svelte-only)
and for every future big refactor.

## Settled decisions

| A# | Decision | Rationale | Date |
|----|----------|-----------|------|
| A1 | Harness lives in `.tmp/refactor-bench/` (scratch, gitignored), parameterized two-ref worktree, zero repo deps | Survives future tree changes — the one-shot `.tmp/compare_load.mjs` broke the moment the cutover removed `app.js` from `public/`; scratch-grade per repo rules | 2026-09-19 |
| A2 | Runtime interaction benchmarks in scope (chart init, zoom/pan, drawer, 2D→3D, jank, memory) | Owner call ("include interactions") | 2026-09-19 |
| A3 | Static analysis via proper tools through npx (cloc, complexity, jscpd) + `.svelte` script-block extraction | Owner call; raw JS tools choke on `.svelte` | 2026-09-19 |
| A4 | Old worktree gets current `public/data`, `public/assets`, `public/fonts` copied over before serving | Fairness: both sides serve the identical data snapshot — only app code differs | 2026-09-19 |
| A5 | Serving via a small node zero-dep static server with gzip + brotli | `python3 http.server` sends no compression — transfer numbers would mislead vs real CF behavior | 2026-09-19 |
| A6 | The report is durable: recorded in this plan's close step (05) as-built, mirrored to `.tmp/refactor-bench/report.md` | Solves the actual "forgotten writeup" failure mode permanently | 2026-09-19 |

## Current state

- Cutover pair: old = `7957602` (last pre-028 commit: `public/app.js` 2,093 ln /
  74.8 KB + 627-line `index.html` with inline CSS); new = HEAD (`src/` 5,491 ln
  across 48 files → `dist/assets/index-*.{js,css}`). Shared both sides: vendored
  echarts 5.6.0 + GL, Inter, same data → the app delta is clean.
- `.tmp/compare_load.mjs` (028 step 6) already proves the CDP pattern: transfer/
  encoded/decoded KB, requests, DCL, load, FCP, time-to-chart via
  `chart-blend` anchor — but it is one-shot, uncompressed-serve, keep-last-of-3.
- Probe precedents for both eras: synthetic `WheelEvent` (GL probes),
  trusted Input pipeline (`.tmp/probe_cmp_step2.mjs`, 025).
- Environment: node v26.8.2 (built-in WebSocket, zlib brotli), chromium at
  `/usr/bin/chromium`, cloc not installed (→ npx).
- At planning: HEAD `d9335a9`; tree carries in-flight plan-025 comparator work
  (unrelated; 029 never touches it). Concurrent sessions may run CDP probes —
  the harness must use its own non-conflicting ports.

## Design

CLI contract (one runner, module-per-dimension):

```
node .tmp/refactor-bench/run.mjs [refA] [refB] [--single] [--live] [--runs N]
#   refA default 7957602 (pinned old side, worktree)
#   refB default: current tree (fresh `npm run build` → dist/)
#   --single  measure refB only   --live  add prod llm-pareto.kaidev.io target
#   --runs N  iterations per timing metric (default 7)
```

- **Static module** — cloc (language split, code/comment/blank), complexity +
  maintainability (escomplex-style, on app.js / `.ts` / extracted `.svelte`
  scripts), jscpd duplication, function/nesting counts, `any`-count vs the
  one-echarts-seam rule, test counts (old node:test vs vitest).
- **Assets module** — per-asset raw/gzip/brotli, app-only vs shared split
  (shared = echarts, GL, Inter, data), request count, per-resource waterfall.
- **Load module** — `compare_load` hardened: median/p90/min/max of N runs,
  cold + warm cache, CPU 4× + Fast 3G throttling (CDP Emulation), TTFB/DCL/
  load/FCP/LCP/time-to-chart-paint.
- **Interactions module** — chart init → data paint; zoom/pan latency
  (synthetic WheelEvent); drawer open (trusted Input pipeline); 2D→3D switch
  incl. GL lazy-load cost; long-task jank during the burst; `performance.memory`
  heap after load and after the burst. Both apps share the `chart-blend`
  anchor; drawer selectors are era-specific and verified per app.
- **Report module** — merge raw JSONs → aggregated stats → markdown report
  (delta tables + caveats: the new app ships more features — tour, deep-links,
  comparator — so the comparison is architecture-level, not feature-identical;
  provenance: HEAD sha + dirty flag + fresh-build stamp recorded in results).
- **Serving** — one ~30-line node http server (zlib gzip/brotli by
  Accept-Encoding), one instance per side, distinct ports (defaults 8311/8312;
  CDP 9243 — chosen away from 025's 9237).

No repo code commits: all harness code is scratch under `.tmp/` (gitignored).
Each step's deliverable is its module running clean; the step's only commit is
the plan commit carrying the as-built record.

## Execution order

| Step | File | Depends on | Status | Commit |
|------|------|------------|--------|--------|
| 1 | 01-harness-static.md | — | ✅ COMPLETE (committed 5c119bc, 2026-09-19) | plan: 029 — step 01 |
| 2 | 02-load-timing.md | 1 | OPEN | plan commit only |
| 3 | 03-interactions.md | 1, 2 | OPEN | plan commit only |
| 4 | 04-report.md | 1–3 | OPEN | plan commit only |
| 5 | 05-close.md | 4 | OPEN | closing plan commit (`plan: 029-refactor-bench`) |

## Definition of done

- [ ] `node .tmp/refactor-bench/run.mjs` (no args) reproduces the full
      old-vs-new comparison end to end, exit 0.
- [ ] `run.mjs <refA> <refB>` works on an arbitrary pair (spot-check);
      `--single` measures the current tree only.
- [ ] Load results include throttled (CPU 4× + Fast 3G) and unthrottled runs,
      cold + warm cache, median/p90.
- [ ] Report markdown has all four dimension tables + caveats + provenance,
      and is recorded in 05-close's as-built (A6).
- [ ] Raw per-run JSON lives in `.tmp/refactor-bench/results/` (traceability).
- [ ] Plan archived per the closing procedure.

## Open branches

| Branch | Hangs on | Parked because | Forces revisit when |
|--------|----------|----------------|---------------------|
| Promote the harness from `.tmp/` scratch to a committed `tools/` entry | Harness surviving 2+ real uses | Owner asked for scratch; repo-hygiene call is theirs | Owner finds it durable/valuable after this run or a future refactor |
| Exec-grade results dashboard — owner, 2026-09-19, mid-execution: "make a really good page that shows this data to me, like a dashboard and some insights on the numbers this vs that, in a really cool way, like if we like to show this on a bunch of C level seniors" | The step-4 report + `results/*.json` existing to visualize | Floated mid-execution; 029's settled scope is the markdown report — a presentable page is its own plan | Owner green-lights a follow-up plan after reviewing 029's report |

## Out of scope

- Data-pipeline benchmarks (`update.py` — untouched by the front-end refactor).
- Committing the harness into the repo (open branch above).
- CI integration (never — cookieless discipline and zero-dep culture stay).
- Plan 005's Epoch AI benchmarks (different domain, its own plan).
- Fixing whatever the numbers reveal — 029 measures; remedies are separate plans.

## Executor rules

- Work from repo root; all artifacts under `.tmp/refactor-bench/` (gitignored —
  never staged, never committed).
- Harness code: node ≥22 stdlib only (no new npm deps in `package.json`;
  npx-called tools are ephemeral cache, acceptable per A3).
- Never touch `src/`, `update.py`, `public/`, or in-flight plan-025 files;
  the old side lives in a worktree at `.tmp/refactor-bench/old/` (A4 fairness
  copy applied there only).
- Ports fixed at 8311/8312 (HTTP) and 9243 (CDP); bump with `--port-base` if
  a concurrent session collides.
- Each step: implement → run its verification → write the as-built section →
  stage + commit ONLY `plans/029-refactor-bench/` (`plan: 029 — step NN`).
  The owner's confirmation of the step output is the close signal.
