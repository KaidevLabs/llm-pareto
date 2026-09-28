# 039 — Hygiene batch (carried-over reaches + dead code)

Date: 2026-09-20. **Status: ARCHIVED (2026-09-29). Commits: 31d0d3a (ui:
details sort header reactivity) · 11b9a4c (plan: step 1) · 52db449 (ui:
details visibility via isVisible) · 9ddc932 (plan: step 2) · f4de24b (ui:
single ensureEndpoints owner) · bce7eba (plan: step 3) · 49d5b4d (ui:
typed scroll targets) · 107af3b (plan: step 4) · de521e5 (ui: hygiene
batch).**
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
3. ✅ `ensureEndpoints` single owner — App fires it post-boot; Details'
   per-drawer-mount `$effect` dropped (owner pick 2026-09-28: drop — the
   "keep as retry" option was a no-op, see as-built).
   Commit: `ui: single ensureEndpoints owner` (f4de24b, 2026-09-29).
4. ✅ Typed scroll targets — `sendToCompare`'s `getElementById("compare")` +
   `openFull`'s rAF/`querySelector(".drawer")` → a tiny shared helper
   (`src/lib/scroll.ts`; bindings were the alternative, helper chosen —
   as-built). Commit: `ui: typed scroll targets` (49d5b4d, 2026-09-29).
5. ✅ Dead code + type holes — `tourflag`'s always-empty `readers` array;
   Comparator `cells` concat type hole; ModelCard elo guard;
   `applyFromURL` defaults consolidated over `urlstate`'s
   DEFAULTS/NO_THR (three places own defaults today — drift risk for the
   next field). Commit: `ui: hygiene batch` (de521e5, 2026-09-29).

## Out of scope

- `familyOf` memoization (<1 ms/render — recorded, opportunistic only).
- B27 (svelte-check wiring) — separate owner decision.
- Any behavior change to filters/thresholds (032 territory).

## Definition of done

- [x] Owner approves the step list in a review session (execution trigger
      2026-09-28 — "Execute" directive; step 3's owner pick answered
      2026-09-28: drop the per-drawer-mount effect, App stays single owner;
      commit flow directive: per-step commits, owner reviews at the end).
- [x] Steps 1–5 landed (all five, none dropped).
- [x] Suites green; no metric regression — final tree: python 159 OK ·
      vitest 180 green (22 files) · `npx tsc --noEmit` clean · `npm run
      build` clean. Browser probe over dist/ green (11 checks). No harness
      metric covers the touched paths (drawer reactivity, scroll); none
      can move.

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

## As-built — step 3 (2026-09-29, commit f4de24b)

- Details' `$effect(() => { ensureEndpoints(); })` and its import are
  gone; App.svelte's post-boot `if (!data.error) ensureEndpoints()` is
  the single trigger (unchanged). The per-drawer-mount effect was a
  parallel channel — every re-fire after boot re-awaited the settled
  cache, so no observable path changes.
- **Owner pick, resolved (answered 2026-09-28):** drop. The plan's
  "keep deliberately as a retry-on-open" branch was a no-op as written —
  `ensureEndpoints` caches its promise even on failure (`.catch` → null,
  the `let promise` stays set), so a re-open re-awaits the settled
  promise and never refetches; a comment claiming retry would have lied.
  Making retry real (cache clears on failure) is a behavior change
  outside this hygiene batch's scope — recorded here as the explicit
  reason the branch was not taken.
- Test-infra only: Details.test.ts calls `ensureEndpoints()` in
  beforeEach (after the fetch stub) — the component no longer triggers
  the fetch, and the module cache still settles once per file. The
  error-path tests' direct store writes are unaffected.
- Verification: Details 16 green · full `npm test` 174 green ·
  `npx tsc --noEmit` clean.
- Harness note: no metric covers the endpoints fetch trigger count; the
  removed effect was reactive bookkeeping only.

## As-built — step 4 (2026-09-29, commit 49d5b4d)

- New `src/lib/scroll.ts`: `scrollToCompare()` + `scrollToDrawer()` — the
  two manual reaches (Details.sendToCompare, Comparator.openFull) call
  these; the `getElementById`/`querySelector` strings and the
  mount-flush rAF live in one place now, with typed receivers at the
  helper (the only `document` reach for either flow).
- **Design pick within the step's "bindings / helper" fork:** the helper,
  not element bindings — the compare section lives in Comparator and the
  drawer in App, so cross-component bindings would have needed prop
  plumbing (or a wrapper div that changes `main`'s grid children); the
  helper keeps both call sites one-liners with zero structural change.
  The rAF mount-flush comment moved into the helper it belongs to.
- no tests: the helpers are behavior-identical to the inline reaches;
  `src/lib/scroll.test.ts` was added anyway as a cheap seam guard — it
  pins the targets (`#compare`, `.drawer`), the scrollIntoView options,
  and the one-frame delay, with a hand stub (jsdom has no scrolling).
- Verification: scroll/Details/Comparator tests green · full `npm test`
  177 green (21 files) · `npx tsc --noEmit` clean.
- Harness note: scrolling is outside every measured path; no metric can
  move.

## As-built — step 5 (2026-09-29, commit de521e5)

- **tourflag:** the `readers` array, its splice loop in `setAutotour`, and
  the trailing `void readers;` are gone — `takeAutotour` polling owns the
  handoff (027 A3). Side observation (not acted on, out of scope):
  `peekAutotour` has no call sites today — dropped or kept is an owner
  choice for a later hygiene pass.
- **Comparator cells:** typed via a local `type Cell = { r: Row; i: number }
  | null;` — the map callback annotates its return and `concat([null])`
  widens cleanly. svelte-check's Comparator error is gone.
- **ModelCard elo:** `{d.arena_elo != null ? d.arena_elo.toFixed(1) : "--"}`
  — matches the card's existing missing-value convention (`--`), never
  crashes on an elo-less row. svelte-check's ModelCard error is gone.
  (svelte-check now reports exactly 1 error: App's `window.echarts`
  global — B23/B28 territory, `plans/040-echarts-npm.md`, deliberately
  untouched here.)
- **Defaults single owner:** urlstate's `DEFAULTS`/`NO_THR` are now
  exported (DEFAULTS gains `search: ""`); `state.svelte.ts`'s `ui` field
  initializers read them; `applyFromURL`'s popstate fallbacks read them
  (the `(patch.mode ?? "general") as Mode` cast is gone with it; NO_THR
  is spread into `ui.thr` so consumers copy the shared const). Both files
  comment the ownership. Runtime import direction: state.svelte.ts →
  urlstate.ts, urlstate's state import stays type-only — no cycle.
- Guard test `src/lib/history.test.ts` (new): pins applyFromURL's
  reset-to-defaults on an empty URL, a full non-default apply
  field-for-field, and that the reset thr is a fresh object (not the
  shared NO_THR) — the drift tripwire the F11 note asked for.
- Verification: full `npm test` 180 green · `npx tsc --noEmit` clean ·
  svelte-check 3 errors → 1 (the out-of-scope window.echarts one) ·
  `npm run build` clean.
- Harness note: none — no measured path touched.

## As-built — close (2026-09-29, no code changes)

- Final verification on the clean tree: python 159 OK · vitest 180 green
  (22 files) · `npx tsc --noEmit` clean · `npm run build` clean ·
  cookieless grep clean (no `document.cookie`/`localStorage`/
  `sessionStorage`/IndexedDB in `src/` + `index.html`). `python3
  update.py` not run — no data-seam touch (UI-only batch; running it
  would only churn `public/data/`).
- Browser-level probe `.tmp/039-hygiene-probe.mjs` (scratch, rerunnable):
  dist served, headless Chromium CDP, real bubble click → drawer — 11
  checks green: sort arrow/highlight follows the active sort and flips
  (B21); a threshold typed into the real ThresholdCtl shows/clears the
  drawer's filtered-out banner (isVisible parity through the live UI);
  compare fast-access closes the drawer, scrolls, and carries the pick;
  no URL threshold residue; zero page exceptions.
- Two probe-authoring fixes along the way (both probe bugs, not code):
  (1) reads must wait a frame after clicks — Svelte 5 batches updates in
  microtasks, the unit tests' awaited ticks already handled this; (2)
  the original `top < 120` scroll assertion was geometry-wrong — at
  1600×1000 the compare section is taller than the content below it, so
  `block:"start"` tops out at the document's max scroll (verified with a
  manual scrollIntoView diagnostic, `.tmp/039-scroll-diag.mjs`, which
  reproduced the identical landing on the untouched browser path); the
  probe now asserts aligned-at-top OR at docMax.
- No harness metric moved (none covers these paths); nothing to publish.
