# 038 — UI polish batch (drawer transition + tour pill)

Date: 2026-09-20. **Status: EXECUTING (step 1/3). Commits: 94ac13a (ui:
tour pill sizing).**
Source: `docs/reports/030-port-perf-findings.md` B24 (full evidence there; origin:
plan 030 step 02 F4+F8). No harness metric moves — polish is owner-A/B
territory; this plan exists so the visual regressions get a tracked fix.

Three small visual items: the drawer opens/closes with an instant `{#if}`
(the old app was equally instant — adding a transition is polish); the
`.tour-pill` styles in `Panel.svelte` compile out (scoped styles cannot
reach `Pill.svelte`'s button) so the 027 A2 tucked-away tour pill renders
at full pill size; `App.svelte`'s `footer` style block is provably dead
(Footer.svelte owns the element) and duplicates Footer's own styles.

## Proposed decisions (settled at owner review)

| # | decision | options & recommendation |
|---|----------|--------------------------|
| D1 | Drawer transition | `transition:fly={{ y: 24, duration: 180 }}` on the `<aside class="drawer">` (mirrors the site's fade idiom from 032). With `{#if}`, wrap for the out-transition. Owner A/B decides keep/kill. **(rec) try, A/B.** |
| D2 | Tour-pill styling | Style where the element lives: pass the sizing into `Pill.svelte` (class prop) or use `:global(.tour-pill)` in Panel. **(rec) Pill prop** — keeps scoping rules visible. |
| D3 | Dead footer CSS | Delete App's `footer` block (Footer.svelte carries the equivalent styles — verify side-by-side before deleting). **(rec) yes.** |
| D4 | Motion accessibility | `prefers-reduced-motion` guard on the new transition (Comparator's `slot-in` already sets the precedent). **(rec) yes.** |

## Steps (commit per step; owner stages each diff)

1. ✅ Tour-pill fix (D2) — implemented as a boolean `tiny` prop on Pill
   (deviation from D2's letter, recorded in the as-built). Commit:
   `ui: tour pill sizing` (94ac13a, 2026-09-28). D3's dead-footer
   removal was already done by fc56a5d (036 step 1 ride-along) —
   verified, nothing left to delete; the commit message drops that half.
2. Drawer transition (D1+D4). Commit: `ui: drawer transition`.
3. Owner A/B (pill size, drawer feel); suites green; DoD audit.

## Out of scope

- Drawer behavior/logic (positioning, close paths — parity measured fine).
- Any other motion work (3D tour captions etc.).

## Definition of done

- [x] Owner approves D1–D4 in a review session (execution trigger
      2026-09-24; recommendations accepted as written).
- [x] svelte-check's 3 warnings resolved (0 unused-selector warnings) —
      fc56a5d deleted the dead blocks; clean `npm run build` is the gate
      (svelte-check deliberately not wired per AGENTS.md).
- [ ] Tour pill renders at its designed tucked-away size (owner A/B).
- [ ] Drawer transition passes the owner A/B (or is dropped, recorded here).
- [ ] Suites green; no metric regression (drawer parity ±2 ms stands).

## As-built — step 1 (2026-09-28, commit 94ac13a)

- D2 implemented where the button lives: Pill gains a boolean `tiny` prop
  rendered via static `class:tiny` (compiles — a caller-scoped rule
  can't reach the button root), sizing `.pill.tiny` in Pill's scoped
  style with the designed values byte-matching the shell's static CSS
  (padding 2px 8px, font-size 10px, border-radius 8px, opacity 0.65;
  hover restores 1) and no `!important` needed — the compound selector
  out-specifies `.pill`. Panel passes `tiny`; the dead
  `class="tour-pill"` spread pass-through is gone.
- **Deviation from D2's letter, owner-reviewed with the step diff
  (staged 2026-09-28):** the rec said "(class prop)". A string-class
  prop styled from Pill's `<style>` would re-create the exact compile-out
  this plan fixes (scoped selectors only match statically-known
  classes), so the prop is boolean `tiny` instead — same intent, sizing
  in Pill, no `:global` escape.
- D3 verified done: fc56a5d (2026-09-23, recorded as a ride-along in
  036's as-built) deleted App's dead `footer {}` block; Footer.svelte
  carries the identical rule side-by-side. Nothing to remove in this
  step — the commit message drops the "+ dead footer styles" half.
- no tests: visual-only styling; the plan's gate is the owner A/B
  (step 3) plus the suites/build.
- Verification: 170 vitest green · `npx tsc --noEmit` clean ·
  `npm run build` clean (the unused-selector gate — fc56a5d established
  clean-build as the proof for the warning cleanup).
