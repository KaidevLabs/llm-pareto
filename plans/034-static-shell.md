# 035 — Static shell + deferred echarts script

Date: 2026-09-20. **Status: PROPOSED — not reviewed, not executed.**
Source: `docs/reports/030-port-perf-findings.md` B19 (full evidence there; origin:
plan 030 step 01). Re-aims the owner's recs 1+2 (code-split / preload) —
both refuted in literal form, goal preserved.

Restore first-paint to the pre-port level: the port's `index.html` has an
empty `#app`, so nothing paints until the 1 MB vendored echarts classic
script (parse-blocking, body-end) executes and the deferred svelte module
mounts — throttled FCP 608→3.27–3.61 s. The old app painted its full static
chrome at 608 ms while echarts was still in flight.

## Proposed decisions (settled at owner review)

| # | decision | options & recommendation |
|---|----------|--------------------------|
| D1 | Shell shape | (a) hand-written static chrome in `index.html` — cheap, duplicates chrome Svelte owns (drift risk); (b) build-time prerender of the chrome (vite step renders App's static parts) — single source, more machinery. **(rec) (a) for v1** — the shell is ~40 lines of static header/nav/panel chrome; the drift story: the shell shows only truly-static bits. (b) re-evaluated if the shell grows. |
| D2 | `defer` the echarts script | Required companion: with a shell above it, the parse-blocking script at body-end delays everything below again. `defer` keeps execution order before the module (both join the deferred-execution list in tree order). **(rec) yes.** |
| D3 | Shell content | Header (title/subtitle), nav controls (mode segs, ratio, vision, orgs pill, search, 3D + frontier pills), panel chrome, axis-note, footer skeleton. Data-dependent bits (stamp line, counts) render as the old shell did — static placeholders, replaced on mount; must not lie (no fake numbers). |
| D4 | Mount semantics | Verify how `mount()` treats `#app`'s existing children (wipe vs append) on the current Svelte 5 line; if append, clear explicitly. Decide the flash policy: shell = the same chrome Svelte renders first, so the swap should be visually silent — owner A/B decides. |
| D5 | Verification | Harness A/B (`fcpMs`/`lcpMs` cold-throttled; expect ~3.4→~0.6 s) + `npm test`/tsc/build green + cookie probe (shell must not add storage) + owner A/B (mount flash, feel). |

## Steps (commit per step; owner stages each diff)

1. Shell + defer in `index.html`; mount-semantics verification (D4).
   Harness load A/B. Commit: `chart: static shell + defer echarts`.
2. Owner A/B (flash, feel); cookie probe; DoD audit. Commit:
   `chart: static shell verification` (or fold into 1 if clean).

## Out of scope

- Prerender machinery (D1 option b) unless the shell proves hard to keep.
- Data-dependent shell content (SSR — parked as B26).
- Bundle changes (the bundle stays 42.8 KB gz; no code-splitting).

## Definition of done

- [ ] Owner approves D1–D5 in a review session.
- [ ] Throttled FCP ≈ 0.6 s in the harness A/B (from ~3.3 s); LCP likewise.
- [ ] No visual regression at mount (owner A/B); zoom/pan unaffected.
- [ ] Cookie probe clean; suites green; deployed (live == main) per owner.
