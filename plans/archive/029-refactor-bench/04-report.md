# Step 04 — Aggregation + report + full cutover run — ✅ COMPLETE (committed 5aaac30, 2026-09-19)

## Spec

- `lib/report.mjs` — merge `results/*.json` → markdown report:
  - header: provenance (refs, HEAD sha, dirty flag, build stamp, node/chromium
    versions, run date);
  - one table per dimension with old / new / delta columns, medians + p90
    where applicable;
  - shared-asset split so the app-only delta is visible;
  - caveats section (architecture-level comparison; feature delta: tour,
    deep-links, comparator; chromium-only memory API; local-vs-CF compression
    note resolved by A5 but `--live` numbers quoted when present).
- Full cutover run: `node .tmp/refactor-bench/run.mjs` (no args, default N).
- Deliverables: `.tmp/refactor-bench/report.md` + raw JSONs in
  `results/`.

## Not touched in this step

Modules 1–3 (only consumed); no repo files.

## Verification

- Default no-arg run completes end to end, exit 0.
- `report.md` contains all four dimension tables with populated delta columns
  and the caveats section.
- Spot-check three numbers in the report against the raw JSONs.

## Seams under test

- no tests: report is generated markdown from measured JSONs; verified by the
  spot-check above.

## As-built

`lib/report.mjs` + `run.mjs` provenance wiring. The default no-arg
`run.mjs` (7 runs) now ends with a generated `report.md` beside the raw
`results/*.json`.

**Provenance** (`run.mjs` captures + `results/provenance.json`): old/new refs,
new build HEAD + dirty flag + build stamp (`gitFacts`), `node` version,
`chromium --version` (via `spawnSync`), run date, and runs/side. The report
header prints all of it. (This run shows `dirty=true` only because plan files
were mid-edit at run time — not a harness defect.)

**Report structure** (4 sections, all with old/new/Δ columns, medians + p90):
1. Static — app-code table (files/lines/fns/cyclomaticΣ/maxFn/maxNesting/`any`/
   dup%/JS-test files+cases) + cloc totals + the shared-asset split note
   (data/logos/fonts/vendored-js/index.html unchanged → the delta is the
   vanilla→svelte app-only rewrite).
2. Load — one sub-table per condition (cold/warm × unthrottled/throttled):
   TTFB/DCL/load/FCP/LCP/chart-paint/requests/transfer KB.
3. Interactions — the 11 interaction metrics (init→paint, zoom settle, drawer
   open/close, 3D cold/steady, jank count/TBT, heap load/Δ).
4. Caveats — architecture-level comparison, feature delta (tour/comparator
   excluded from the `e858d24` baseline), chromium-only memory API, A5
   compression parity, `--live` skipped (no prod egress).

**Headline (old `7957602` → new `e858d24`, 7-run medians):**
- Static: app grows 1→26 files / 2094→2198 ln, but **cyclomatic Σ drops
  598→553**, max nesting 40→23, functions 184→173 (the svelte split is flatter
  and simpler per-function); `any` 0→25 (all in `charts.ts`, the seam rule
  holds — no `any` leaked into app components); duplication 1.62→2.00%;
  JS tests 0→12 files / 66 cases (the 028 cutover added the vitest suite).
- Load: **chart-paint parity** (cold 148→132 ms — new marginally faster;
  warm 107→131 ms — new slightly slower; throttled 7052→6850 ms — new faster).
  New is +24 ms on FCP/LCP cold-unthrottled (svelte mount before first paint)
  and +3.5 s on throttled `load` — the larger JS payload hurts most under CPU
  throttle, the dominant refactor cost.
- Interactions: **drawer open/close and 3D switch are at parity** (±a few ms);
  zoom settle slower (584→751 ms); **heap load +34 MB** (27→61 MB — svelte
  runtime + module graph + echarts-gl); jank negligible both (1 longtask).

**Verification:** default no-arg run exits 0; `report.md` has all four tables
with populated Δ columns + caveats; 3 numbers spot-checked against raw JSONs
(`new.complexity.functions`=173, `old cold-unthrottled chartMs.median`=148,
`new.drawerOpenMs.median`=168) — all match.

**In-dev fixes this step:** `prov` identifier clash with `gitFacts` result
(renamed to `provOut`); `table()`'s spread-inside-`Math.max` tripped the ESM
parser (rewrote with an explicit width loop); duplication Δ float artifact
(`0.3799…` → `0.38`).
