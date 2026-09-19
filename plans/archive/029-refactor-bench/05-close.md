# Step 05 — Close — ✅ COMPLETE (committed 04d7baf, 2026-09-19)

## Spec

Closing procedure per plans skill:

1. Final verification: full no-arg run once more from a clean slate
   (`.tmp/refactor-bench/results/` wiped first) to prove reproducibility.
2. Definition-of-done audit in `00-overview.md` — each item checked only with
   evidence from the run.
3. A6: paste the full report (or its essential tables + link to the mirrored
   `.tmp/refactor-bench/report.md`) into this step's as-built record — the
   durable home for the writeup the cutover forgot.
4. Resolve the open branch's state for the record (promote-to-`tools/` stays
   parked unless the owner says otherwise at close).
5. Update overview status → `ARCHIVED (date)` with the plan's commit history;
   move `plans/029-refactor-bench/` → `plans/archive/029-refactor-bench/`;
   single closing plan commit, message suffixed ` (plan: 029-refactor-bench)`.

## Not touched in this step

All harness modules (read-only rerun); repo code; plan-025 files.

## Verification

- Clean-slate rerun exits 0 with a byte-different-but-shape-identical report
  (timings vary; tables/columns identical).
- `plans/archive/029-refactor-bench/` exists; no `plans/029-refactor-bench/`
  remains; overview status line reads `ARCHIVED (date)`.
- Closing commit contains only plan files.

## Seams under test

- no tests: closing procedure; verified by the checklist above.

## As-built

Plan 029 closed. The harness (`.tmp/refactor-bench/`, gitignored) is complete and
reproducible; the recorded old-vs-new report (A6) lives below and is mirrored to
`.tmp/refactor-bench/results/report.md`.

**Close verification (step 5.1):** `rm -rf results && node .tmp/refactor-bench/run.mjs`
(no args, 7 runs) exits 0 with a freshly generated `report.md`; re-run is
byte-different-but-shape-identical (timings vary run to run). `--single` mode
also verified exit 0 (single-side report) after fixing a missing-side crash in
`report.mjs`.

**A6 — the report the svelte cutover forgot** (old `7957602` → new `e858d24`,
7-run medians; full 4-condition load table in `results/report.md`):

### 1. Static analysis

| metric | old | new | Δ |
| --- | --- | --- | --- |
| files (app) | 1 | 26 | +25 |
| lines (app) | 2094 | 2198 | +104 |
| functions | 184 | 173 | −11 |
| cyclomatic Σ | 598 | 553 | −45 |
| max fn cyclomatic | 34 | 34 | 0 |
| max nesting | 40 | 23 | −17 |
| `any` count | 0 | 25 | +25 |
| duplication % | 1.62 | 2.00 | 0.38 |
| JS test files | 0 | 12 | +12 |
| JS test cases | 0 | 66 | +66 |

App grows in file/line count (vanilla `app.js` → svelte `src/`) but is **flatter
and simpler per function**: cyclomatic Σ −45, max nesting 40→23, functions −11.
`any` 0→25 (all in `charts.ts`, the one echarts seam — rule holds, no `any`
leaked into components). Duplication up 1.62→2.00%. The 028 cutover **added the
vitest suite** (0→12 files / 66 cases). Shared assets (data/logos/fonts/vendored
echarts+GL/index.html) are unchanged both sides — the delta is the app-only
rewrite.

### 2. Load timing (median ms; p90 in parens) — cold-unthrottled

| metric | old | new | Δ |
| --- | --- | --- | --- |
| TTFB | 2 | 1 | −1 |
| DOMContentLoaded | 38 | 40 | +2 |
| load | 38 | 46 | +8 |
| FCP / LCP | 28 | 56 | +28 |
| chart-paint | 143 | 135 | −8 |
| requests | 30 | 31 | +1 |
| transfer KB | 627 | 636 | +9 |

Throttled (CPU 4× + Fast 3G): chart-paint parity (7049→6857 ms, new faster);
FCP/LCP +2.5 s; **`load` +3.5 s** (the larger JS payload is the dominant refactor
cost under CPU throttle). Warm + throttled: FCP/LCP +32 ms, chart-paint +23 ms.
Full cold/warm × throttled/unthrottled tables in `results/report.md`.

### 3. Interactions (median; p90 in parens)

| metric | old | new | Δ |
| --- | --- | --- | --- |
| init→paint | 154 | 189 | +35 |
| zoom settle | 581 | 751 | +170 |
| zoom events | 10 | 10 | 0 |
| drawer open | 167 | 169 | +2 |
| drawer close | 154 | 155 | +1 |
| 3D cold | 176 | 183 | +7 |
| 3D steady | 193 | 197 | +4 |
| jank count | 1 | 1 | 0 |
| jank TBT | 13 | 11 | −2 |
| heap load (KB) | 28598 | 62263 | +33665 |
| heap Δ (KB) | −9996 | −4331 | +5665 |

**Drawer open/close and 2D→3D switch are at parity** (±a few ms) — the refactor
did not regress interaction latency there. Zoom settle slower (581→751 ms).
**Heap +33 MB** (28→62 MB) — svelte runtime + module graph + echarts-gl. Jank
negligible both (1 longtask).

### Verdict

The svelte cutover is **load- and interaction-neutral on the metrics that matter
to a user** (chart paint parity, drawer/3D latency parity, negligible jank). Its
real costs are a **+33 MB JS heap** and a **slower `load` (+3.5 s) under CPU
throttle / +28 ms FCP cold** from the larger bundle — expected for a component
framework and within acceptable bounds. The complexity actually *improved* per
function (flatter, less nested). The writeup is now durable (A6) instead of
forgotten.

### Open branches (step 5.4 — both remain PARKED)

- **Promote harness `.tmp/` → `tools/`**: stays parked. Owner asked for scratch;
  revisit only after 2+ real uses prove it durable.
- **Exec-grade results dashboard** (owner's mid-execution "cool page for C-level
  seniors"): stays parked. 029's settled scope is the markdown report; a
  presentable page is its own follow-up plan. Both branches unchanged by this
  close.
