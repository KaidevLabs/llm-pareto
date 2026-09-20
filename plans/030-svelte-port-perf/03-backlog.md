# Step 03 — Prioritized improvement backlog — ✅ COMPLETE (2026-09-20, no code changes)

> Synthesis of steps 01–02 into future plan candidates. Every item: hypothesis,
> expected impact (mapped to the plan-029 harness metrics or a named new one),
> effort, and a one-line future-plan spec. **No code.**
> Standing discipline (owner rec 4, "keep tests green"): not an item — every
> future plan inherits the repo's verification hierarchy (python suite + vitest
> + tsc → build → update.py → probes); TDD per the tdd skill on behavior steps.

## P0 — the measured regressions + one real bug

### B1. Restore a static shell + defer the echarts script (re-aims owner recs 1+2)
- **Hypothesis:** the only big measured regression left (plan-029: throttled FCP
  608→3152; step-01: 3.27–3.61 s, Phase-A busy 0.2–0.7 s = network-gated) is
  structural: the port's `index.html` has an empty `#app`, so nothing paints
  until the classic 1 MB echarts script (656→3204 ms download) executes and the
  deferred module mounts. The old app painted its whole static chrome at
  608 ms while echarts was still in flight. Bundle-splitting (rec 1's literal
  form) attacks nothing — echarts is **not** in the bundle (120 KB/42.8 KB gz
  total); preloading (rec 2) is redundant — all three top resources already
  start at the first RTT (656 ms). The goal of both recs (less before paint)
  is served by: static chrome in `index.html` + `defer` on the echarts script
  (deferred scripts no longer block parsing; the shell paints at ~0.6 s
  throttled; echarts still executes before the module, so the window.echarts
  contract is untouched).
- **Impact:** throttled FCP/LCP **−~2.7 s** (to ~0.6 s); unthrottled FCP to
  first-RTT+ε; `load` artifact unaffected (it's logo accounting, not cost).
  Harness metric: `fcpMs`/`lcpMs` (cold-throttled).
- **Effort:** M — design decision first: hand-written shell vs build-time
  prerender of the chrome (this is the cheap version of the SSR idea), plus
  the mount flash question (svelte tears the shell down as it mounts — needs
  an owner A/B).
- **Future-plan:** `0xx-static-shell` — index.html ships the chrome + defer
  echarts; FCP harness A/B; owner A/B for mount flash.

### B2. Decouple the badge chain from first chart (step-02 F9)
- **Hypothesis:** `boot.ready` awaits `buildBadges()`, which awaits ~25 logo
  images (step-01 throttled: logos start 4.03 s, last lands 6.85 s; chart
  7.0–7.5 s) + composites 256×256 canvases (toDataURL 85–220 ms throttled)
  that render at 24 px. The frontier symbol's fallback badge already exists —
  the chart can render before badges land and swap symbols on arrival.
- **Impact:** throttled chartMs **−~2.8 s** (7.0–7.5 → ~4.2 s = data fetch +
  parse + first render); toDataURL −60–150 ms; badge logo RTTs move off the
  first-chart critical path. Harness metric: `chartMs` (cold-throttled).
- **Effort:** M — reactive badge store (endpoints.svelte.ts pattern), render
  with fallbackBadge, one re-render on arrival; canvas 256→48.
- **Future-plan:** `0xx-badge-store` — badges become a reactive store off the
  critical path; chartMs harness A/B; owner A/B for the symbol swap.

### B3. Fix the Details sort-header reactivity bug (step-02 F1)
- **Hypothesis:** `heads` is a plain `const` built from `provSort` — the sort
  arrow/highlight freeze on "in"/▲ and never update (rows do re-sort; the
  chrome lies about the sort state).
- **Impact:** correctness; no harness metric. One-line `$derived`.
- **Effort:** S.
- **Future-plan:** `0xx-details-heads-derived` — or folded into B5's hygiene
  batch if the owner prefers one PR.

## P1 — meaningful, measurement-first

### B4. Fade-path render shave (step-02 F5+F6)
- **Hypothesis:** filter-only changes (search keystroke, threshold drag)
  rebuild all ~154 per-point option objects + run an unconditional second
  `restoreZoom` dispatch (merge branch doesn't need it — windows survive).
  Splitting static per-point shape (built once per data load) from
  vis-dependent fields shrinks the merge diff; gating `restoreZoom` on the
  notMerge branch halves update passes.
- **Impact:** the 032 fade path's drag/keystroke latency — **no harness
  metric exists yet** (zoom settle is a different path and is fine, 018 A2
  held). Per the owner's measurement standards: add the metric FIRST
  (threshold-drag settle to the harness), then measure before/after — no
  proxy gate-count claims.
- **Effort:** M (+S for the harness metric).
- **Future-plan:** `0xx-fade-shave` — preceded by a harness-metric addition
  (coordinate with plan 033's harness work).

### B5. Type the chart seam; clear the svelte-check debt (step-02 F7)
- **Hypothesis:** `declare const echarts: any` + 28 more `any`s exist because
  the vendored global has no types. Two routes: `echarts` as a
  devDependency for types only (`import type`, erased at build — zero runtime
  bytes, the global script keeps supplying runtime) or a minimal local
  `EChartLike` interface. Also declare `window.echarts` (precedent:
  gl.ts's `echarts-gl` declaration) — clears App.svelte:28's error.
- **Impact:** −`any` in the seam (25→~0), svelte-check errors 3→0, types
  become the gate for future seam edits. No timing metric.
- **Effort:** M (typing pass over ~1300 lines).
- **Future-plan:** `0xx-chart-typing` — optionally includes splitting
  charts.ts into option-builder/interaction/3D-scene modules (A4
  decomposition; cyclomatic 230 → spread) if the owner wants it in the same
  pass.

## P2 — polish + hygiene + evaluations

### B6. Interaction polish batch (step-02 F4+F8)
Drawer `transition:fly` (parity today — pure polish, owner A/B decides);
fix the dead `.tour-pill` scoped CSS (the tour pill renders full-size — a
real visual regression of 027 A2) and delete App's dead `footer` styles.
**Effort:** S. **Metric:** none (visual); owner A/B.
**Future-plan:** `0xx-polish-batch`.

### B7. Hygiene batch (step-02 F2/F3/F10/F11)
Details' O(rows) visibility recompute → `isVisible`; single
`ensureEndpoints()` owner; typed scroll targets for
`sendToCompare`/`openFull`; `tourflag` dead `readers`; Comparator `cells`
type hole; ModelCard elo guard; defaults-ownership consolidation in
`applyFromURL`. **Effort:** S. **Metric:** none; some touch shared
predicates → tests guard.
**Future-plan:** `0xx-hygiene-batch` (could absorb B3).

### B8. SSR/prerender evaluation (narrowed; owner "add ssr maybe")
After B1 ships, re-measure: the static shell IS the achievable prerender —
the chart is client-only, so SSR helps exactly the chrome B1 fixes. Revisit
only if B1's shell isn't enough (e.g. data-dependent shell bits: the stamp
line). Workers static constraint (#331/#336) makes request-time SSR a real
architecture change; build-time prerender is the only shape worth costing.
**Effort:** L (architectural) if ever. **Metric:** −FCP beyond B1's floor.
**Future-plan:** `0xx-ssr-eval` (parked on B1's outcome).

### B9. svelte-check wiring — revisit only
AGENTS.md keeps it deliberately unwired (vitest is the gate). After B5
clears the 3 errors, wiring it is a one-liner the owner can choose; until
then it stays a manual check (this session's extra evidence). **Effort:** S.
**Future-plan:** none unless the owner opts in.

## Verified-and-dismissed (evidence recorded, no plan)

- **Code-split the bundle (rec 1, literal form):** echarts is not in the
  bundle; 120 KB/42.8 KB gz total, app 54%/runtime 45%. Splitting buys
  nothing; B1 attacks the real eager weight (the classic script).
- **modulepreload as the primary lever (rec 2, literal form):** all
  top-level resources already start at the first RTT (step-01 waterfall);
  discovery is not the bottleneck — exec ordering is; covered by B1.
- **Memoize derived selectors for panning (seed P1):** zoom/pan triggers
  **zero** svelte re-renders (step-01 probe: `setOption` count 0 during
  bursts; the +170 ms was probe amplification; per-tick render ~4.8 ms).
  Search-keystroke memoization is micro at n=154.
- **echarts-gl lazy-load verify (seed P2):** confirmed lazy (absent from
  initial load; +1.4 MB retained only after 3D). No action.
- **Lazy-load heavy panels/data (seed P2):** already the behavior — hidden
  panels never render (Panel `$effect` guard), data fetch is post-mount,
  endpoints post-`boot.ready`. No action.
- **Heap action:** retained delta is +5.6 MB (13.4 vs 7.8 post-GC; step-01);
  the +33 MB reading was young-gen churn at an uncollected instant. No plan.

## Verification

- Backlog doc present with P0/P1/P2 + dismissed section; every kept item
  carries hypothesis + impact (harness metric) + effort + future-plan
  one-liner.
- The four owner recommendations all represented: rec 1 → re-aimed into B1
  (dismissed in literal form, evidence cited); rec 2 → folded into B1
  (redundant as stated); rec 3 → B5; rec 4 → standing discipline preamble.
- No `src/` edits (exploration-only confirmed).
