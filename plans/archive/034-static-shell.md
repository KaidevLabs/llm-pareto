# 034 — Static shell + deferred echarts script

Date: 2026-09-20. **Status: ARCHIVED (2026-09-23).** Commits: `942e118`
`chart: static shell + defer echarts` (step 1) · `a9443c6` `plan: 034 —
step 1` · close step below (no code changes).
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

| step | file | depends on | status | commit |
|---|---|---|---|---|
| 01 | (shell + defer, this file's as-built) | — | ✅ COMPLETE (2026-09-23) | `942e118` |
| 02 | `034-02-close.md` | 01 | ✅ COMPLETE (2026-09-23, no code changes) | — |

## As-built — step 1 (2026-09-23, code `942e118`)

- **D1a** as planned: the shell is a copy of the app's first render in its
  pre-data state (header, nav with the 032 threshold rows disabled, five
  panel chromes, axis note, footer with "data unknown") inside `#app`;
  data-dependent bits are the same placeholders Svelte itself renders first
  (no stamp, empty counts) — nothing lies. Chrome styles live in a
  "static shell" section of index.html's global `<style>`, commented as a
  mirror of the component styles.
- **D2** — with a deviation the plan didn't foresee: the echarts script
  moved to `<head>` with `defer`, not deferred at body-end. Vite 8 hoists
  the entry module tag into `<head>` right after the original head content,
  so a body-end deferred classic script would execute *after* the module
  (deferred + module scripts run in document order). Head placement keeps
  echarts ahead of the module in document order — guarantee preserved.
- **D4** verified against the installed source: Svelte 5.57 `_mount`
  (node_modules/svelte/src/internal/client/render.js:173) does
  `target.appendChild(create_text())` — **append, no clear**. `main.ts`
  therefore calls `target.replaceChildren()` before `mount()`; the A/B's
  post-mount audit confirms exactly one header/nav/main/footer, 5 panels.
- **Owner-directed amendment (mid-step, 2026-09-23):** an agent-proposed
  custom vite `generateBundle` plugin to inline the built CSS asset was
  rejected — not idiomatic, machinery. The Svelte-native dial is
  `svelte.config.js → compilerOptions.css: "injected"`: component CSS
  compiles into the JS bundle (dev's existing behavior; build now agrees).
  Consequence: the built HTML has no render-blocking CSS `<link>` — the
  single-HTML-document first-paint architecture of the pre-port app is
  restored. Bundle: JS 42.97 → 48.40 KB gz gross, CSS asset (3.88 KB gz)
  gone → net eager +1.55 KB, one fewer request.
- **Harness** (`.tmp/034/fcp-ab.mjs`, scratch): three roots interleaved —
  old (`7957602` worktree, public/), base (pre-change dist), new — 5×
  throttled (FAST3G + 4× CPU, cache off, 030's conditions) + 1× unthrottled
  sanity, CDP, post-mount structural audit + console-error capture.
- **Numbers** (medians, throttled): FCP old 668 / base 3232 / **new 696 ms**
  (DoD ≈0.6 s ✓, from ~3.3 s; intermediate shell-only build measured 1300 —
  the residual was exactly the CSS link RTT). Chart-ready parity (7.0–7.3 s
  all sides). Unthrottled FCP 40–56 ms all sides. Zero console errors.
- **Known residual, flagged to owner:** throttled LCP ~3.5 s (DoD said
  "likewise"). Mechanism: the mount swap (`replaceChildren`) removes the
  shell's text nodes and Chromium promotes the re-painted mounted chrome
  (~3.5 s) to the LCP candidate — same pixels, metric sees a repaint. The
  in-place-DOM cure is hydration/prerender (B26, out of scope). FCP — the
  "page is here" metric — is on target; owner A/B (step 2) decides whether
  the mount frame is visibly silent.

## Out of scope

- Prerender machinery (D1 option b) unless the shell proves hard to keep.
- Data-dependent shell content (SSR — parked as B26).
- Bundle changes (the bundle stays 42.8 KB gz; no code-splitting).
  — actual outcome: +1.55 KB gz net eager (CSS rides the bundle), accepted
  at owner review as the price of the single-document first paint.

## Definition of done

- [x] Owner approves D1–D5 in a review session. — plan executed on the
      owner's `Execute @plans/034-static-shell.md` signal; the mid-step
      `css: "injected"` amendment (replacing the rejected vite plugin) was
      reviewed and staged by the owner.
- [x] Throttled FCP ≈ 0.6 s in the harness A/B (from ~3.3 s) — 696 ms.
      ~~LCP likewise~~ → waived by the owner at close: the ~3.5 s throttled
      LCP is the mount swap's repaint artifact (same pixels, B26 owns the
      DOM-preserving cure).
- [x] No visual regression at mount; zoom/pan unaffected. — owner waived
      the live A/B ("I do not need to AB, I'm going to make a bench and
      stage it"); structural audit + screenshots + zero console errors in
      the harness stand as evidence.
- [x] Cookie probe clean (120 requests / 3 UAs, zero Set-Cookie); suites
      green (tsc + 170 vitest + build); deploy is owner-driven (#467) — the
      owner stages and pushes deliberately, then live == main is verified by
      content (bundle hash + meta fetched_at).
