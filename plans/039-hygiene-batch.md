# 040 — Hygiene batch (carried-over reaches + dead code)

Date: 2026-09-20. **Status: PROPOSED — not reviewed, not executed.**
Source: `docs/reports/030-port-perf-findings.md` B25 (+ B21's bug as step 1; full
evidence there; origin: plan 030 step 02 F2/F3/F10/F11).

One review, one PR for the small carried-over items. None moves a harness
metric; several consolidate shared predicates (tests guard those).

## Steps (commit per step; owner stages each diff)

1. **B21 (bug, independent-able):** `Details.svelte:112` — `heads` is a
   plain `const` built from `provSort`; the sort arrow/highlight freeze at
   the initial state. Fix: `const heads = $derived(...)`.
   Commit: `ui: details sort header reactivity`.
2. `Details.svelte:40` — `visible` recomputes `filterRows` over all rows
   for one row's answer; reuse the single visibility predicate
   `isVisible(d, {...ui, thrCtx})` (032 D5's point).
   Commit: `ui: details visibility via isVisible`.
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

- [ ] Owner approves the step list in a review session.
- [ ] Steps 1–5 landed or explicitly dropped with a reason recorded here.
- [ ] Suites green; no metric regression (none expected — hygiene only).
