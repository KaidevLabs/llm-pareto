# 039 — UI polish batch (drawer transition + tour pill)

Date: 2026-09-20. **Status: PROPOSED — not reviewed, not executed.**
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

1. Tour-pill fix + dead footer removal (D2+D3). Commit: `ui: tour pill
   sizing + dead footer styles`.
2. Drawer transition (D1+D4). Commit: `ui: drawer transition`.
3. Owner A/B (pill size, drawer feel); suites green; DoD audit.

## Out of scope

- Drawer behavior/logic (positioning, close paths — parity measured fine).
- Any other motion work (3D tour captions etc.).

## Definition of done

- [ ] Owner approves D1–D4 in a review session.
- [ ] svelte-check's 3 warnings resolved (0 unused-selector warnings).
- [ ] Tour pill renders at its designed tucked-away size (owner A/B).
- [ ] Drawer transition passes the owner A/B (or is dropped, recorded here).
- [ ] Suites green; no metric regression (drawer parity ±2 ms stands).
