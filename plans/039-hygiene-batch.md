# 039 — Hygiene batch (carried-over reaches + dead code)

Date: 2026-09-20. **Status: EXECUTING (step 1/5). Commits: 31d0d3a (ui:
details sort header reactivity).**
Source: `docs/reports/030-port-perf-findings.md` B25 (+ B21's bug as step 1; full
evidence there; origin: plan 030 step 02 F2/F3/F10/F11).

One review, one PR for the small carried-over items. None moves a harness
metric; several consolidate shared predicates (tests guard those).

## Steps (commit per step; owner stages each diff)

1. ✅ **B21 (bug, independent-able):** `Details.svelte:112` — `heads` is a
   plain `const` built from `provSort`; the sort arrow/highlight freeze at
   the initial state. Fix: `const heads = $derived(...)`.
   Commit: `ui: details sort header reactivity` (31d0d3a, 2026-09-29).
2. ✅ `Details.svelte:40` — `visible` recomputes `filterRows` over all rows
   for one row's answer; reuse the single visibility predicate
   `isVisible(d, {...ui, thrCtx})` (032 D5's point).
   Commit: `ui: details visibility via isVisible` (52db449, 2026-09-29).
3. `ensureEndpoints` single owner — App fires it post-boot; drop the
   per-drawer-mount `$effect` in Details (or keep deliberately as a
   retry-on-open with a comment — owner picks).
   Commit: `ui: single ensureEndpoints owner`.
4. Typed scroll targets — `sendToCompare`'s `getElementById("compare")` +
   `openFull`'s rAF/`querySelector(".drawer")` → element bindings / a tiny
   shared helper. Commit: `ui: typed scroll targets`.
5. Dead code + type holes — `tourflag`'s always-empty `readers` array;
   Comparator `cells` concat type hole; ModelCard elo guard;
   `applyFromURL` defaults consolidated over `urlstate`'s
   DEFAULTS/NO_THR (three places own defaults today — drift risk for the
   next field). Commit: `ui: hygiene batch`.

## Out of scope

- `familyOf` memoization (<1 ms/render — recorded, opportunistic only).
- B27 (svelte-check wiring) — separate owner decision.
- Any behavior change to filters/thresholds (032 territory).

## Definition of done

- [x] Owner approves the step list in a review session (execution trigger
      2026-09-28 — "Execute" directive; step 3's owner pick answered
      2026-09-28: drop the per-drawer-mount effect, App stays single owner).
- [ ] Steps 1–5 landed or explicitly dropped with a reason recorded here.
- [ ] Suites green; no metric regression (none expected — hygiene only).

## As-built — step 1 (2026-09-29, commit 31d0d3a)

- B21 as specified: `const heads` → `const heads = $derived(...)` in
  Details.svelte — the only change; `th()`/`setSort` untouched.
- Test-first: new Details.test.ts case pins the arrow/highlight following
  the active sort (initial ▲ on "in" → moves to "spd" on click → ▼ on the
  flip). Red pre-fix (`expected undefined to be '▲'` — the init-time
  snapshot froze the arrow on "in"), green after.
- Title-number typo fixed in this file: "# 040" → "# 039" (the file is
  039; 040 is the echarts-npm plan).
- Verification: 13 Details tests green · full `npm test` suite green ·
  `npx tsc --noEmit` clean.
- Harness note: pure reactivity fix on a header cell — no timing metric
  touches this path.

## As-built — step 2 (2026-09-29, commit 52db449)

- `visible` now calls the shared `isVisible(d, { ...ui, thrCtx })` — the
  ctx mirrors charts.ts's construction exactly (same `speedOf(orId,
  store.data)` lookup, `mode: ui.three3d ? "3d" : ui.mode`), so the
  drawer banner answers with the same predicate the chart's fade path
  uses. `filterRows`/O(rows) per ui change is gone from the drawer.
- **Behavior note (parity fix, pinned by the new tests):** the old
  `filterRows(data.rows, ui)` call had no `thrCtx`, so
  `isVisible`'s `f.thr && f.thrCtx` guard silently skipped thresholds —
  the drawer banner never fired for threshold-only filtering while the
  chart hid the very same row. Reusing the single predicate restores
  parity (the reason 032 D5 wants one predicate). Filters/threshold
  semantics themselves are untouched — 032 territory untouched.
- Test-first: three new cases — eloMin hides; blended-price threshold
  hides live through `thrCtx` (reactivity + the ratio blend); speedMin
  hides via the endpoints store. All red pre-fix (thresholds ignored),
  green after. afterEach now resets `ui.thr`.
- Verification: Details 16 green · full `npm test` 174 green (20 files) ·
  `npx tsc --noEmit` clean.
- Harness note: no timing metric covers the drawer's banner path; the
  per-render work shrinks (O(rows) → O(1)) — direction is safe by
  construction, nothing measured.
