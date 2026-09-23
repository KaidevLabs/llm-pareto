# 036 — Fade-path render shave (measurement-first)

Date: 2026-09-20. **Status: EXECUTING (step 1/4) — owner triggered execution
2026-09-23; D1–D4 approved with their recommendations as written.**
Source: `docs/reports/030-port-perf-findings.md` B22 (full evidence there; origin:
plan 030 step 02 F5+F6). Standing rule honored: **metric first** — no
optimization without a before/after on a real metric (owner's measurement
standards); "do nothing" is an honest possible outcome.

The 032 fade path (search keystroke, threshold drag) rebuilds the entire
chart option per change (all ~154 per-point objects + tooltip closures)
even though the merge `setOption` diffs a mostly-identical option, and
`chartPush` dispatches a `restoreZoom` dataZoom after **every** push — a
second echarts update pass the merge branch doesn't need (windows survive).

## Proposed decisions (settled at owner review)

| # | decision | options & recommendation |
|---|----------|--------------------------|
| D1 | New harness metric | Threshold-drag settle metric in the harness (drag a threshold across points, time until the canvas stops changing; mirror of `zoomSettleMs`). Coordinate with plan 033's harness work. **(rec) own step 1 — it survives whatever the shave decides.** |
| D2 | restoreZoom gate | Gate `restoreZoom(id)` on the notMerge branch only (charts.ts:660). S, mechanical, testable by the new metric. **(rec) yes.** |
| D3 | Static/dynamic point split | Build static per-point shape once per data load (keyed by `fetched_at`), rebuild only vis-dependent fields per render. Only if D1's before numbers show the path is actually hot (≥ one frame budget). **(rec) conditional.** |
| D4 | Outcome rule | If the metric shows the fade path already inside one frame budget, record "measured cheap — no change" and close with the metric in place. **(rec) accepted up front.** |

## Steps (commit per step; owner stages each diff)

1. ✅ Harness: threshold-drag metric (D1). Commit: `bench: threshold-drag
   settle metric` (f8e64a5, 2026-09-23).
2. Baseline measurement recorded in this plan's as-built.
3. D2 (gate restoreZoom) if the baseline says the second pass is visible;
   D3 only if still hot. Commit: `chart: fade-path shave` / or
   `chart: fade-path measured cheap (no change)`.
4. Re-measure; DoD audit; owner A/B (drag feel unchanged).

## Out of scope

- Zoom/pan path (018 A2 — instant notMerge; measured fine).
- 3D scene prep (separate seam).
- Changing the fade design itself (032 D4 approved).

## Definition of done

- [x] Owner approves D1–D4 in a review session (execution trigger
      2026-09-23; recommendations accepted as written).
- [x] The threshold-drag metric exists in the harness with a recorded baseline.
- [ ] Either a measured shave (before/after on the new metric) or the
      "measured cheap" close — both evidenced, no proxy claims.
- [ ] Suites green; owner A/B ok.

## As-built — step 1 (2026-09-23, commit f8e64a5)

- `thrDragSettleMs` in `tools/refactor-bench/lib/interact.mjs`: CDP-drags the
  blend panel's price-max handle from its parked (unbounded) end to mid-track
  — every mousemove is a filter-only merge render through the 032 fade path —
  and times first press → canvas hash stable (two identical consecutive
  hashes; zoom's settle uses first-change, but the merge branch tweens
  animationDurationUpdate 350, so settle must mean the tween landed). Ends by
  clicking the thr reset so the drawer/3D/jank probes run on default state.
  Svelte-side only (`SIDE_CFG.svelte.thr`); vanilla predates 032 → null.
  Label wired into report.mjs / page.mjs / compare-view.mjs (+ test pin).
- **Baseline (owner-run, published):** `bench: publish run-20260923-1527`,
  ref 70f14c4, 7 repeats — `thrDragSettleMs` median **898** (p90 916,
  min 892 / max 916); `zoomSettleMs` median 745. Known-nulls not caused by
  the probe: `drawerOpenMs` is null in all published runs (grid-scan).
- Probe design notes: the drag runs between the zoom burst and the drawer
  scan on the SAME document (no reload — `__lt`/heap probes stay comparable
  with historical runs); a reset click + 400 ms wait restores default state
  before the drawer grid-scan.
- Ride-along (same review, separate commit `build: clean vite build
  warnings`): removed App.svelte's dead duplicate `footer {}` block,
  Panel.svelte's `.tour-pill` styles (never applied since the 028 cutover —
  the class lands on `<Pill>`'s child root), and switched index.html's
  echarts/font URLs to public-dir-absolute (base "./" rebases them; build
  now warning-free).
