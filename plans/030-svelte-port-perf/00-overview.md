# 030 — Svelte port performance & adherence exploration — OWNER REVIEW

> **Status:** OWNER REVIEW (created 2026-09-19; execution deferred — owner: "we will work to it in the future").

Date: 2026-09-19.

## Goal

Produce an **evidence-backed diagnosis** of why the svelte port is slower than the
vanilla `app.js` it replaced, and a **prioritized, executable improvement backlog**
(applying svelte-idiomatic + general performance patterns). No app code is changed
in this plan — its deliverable is findings + a backlog of future plan candidates.

## Settled decisions

| A# | Decision | Rationale | Date |
|----|----------|-----------|------|
| A1 | Treat the svelte cutover as a *literal port*, not a svelte-idiomatic rewrite; the perf regression is presumed to come from non-svelte patterns carried over | Owner hypothesis 2026-09-19: "we just ported it badly… now we have a framework, so we could improve by applying svelte patterns" |
| A2 | This plan is **exploration only** — it outputs a prioritized backlog of future executable plans; no `src/` edits | Owner: "lets create such an exploration plan now and we will work to it in the future" |
| A3 | The refactor-bench harness (plan 029, `.tmp/refactor-bench/run.mjs`) is the measurement oracle for before/after of any future fix | Plan 029 already produced reproducible old-vs-new numbers; reuse, don't rebuild a second harness |
| A4 | `src/lib/charts.ts` is the prime suspect for both complexity and perf (230/553 cyclomatic = 42%, and all 25 `any`) | Per-function analysis from the plan-029 follow-up (this session) |
| A5 | Bundle size is the leading hypothesis for the throttled-`load` +3.5 s cost; confirm with a real bundle breakdown before prescribing code-splitting | Owner rec (1) + harness shows the load cost appears only under CPU throttle, i.e. parse/compile-bound, not network-bound |

## Current state

Evidenced facts (plan 029 seven-run medians, old `7957602` vanilla → new `e858d24`
pure cutover; plus this session's per-function cyclomatic analysis):

- **Perf regression is real and broad.** New side is worse on most timing metrics:
  FCP +28 ms (cold), LCP +28 ms, throttled `load` **+3.5 s** (3332→6806 ms),
  init→paint +35 ms, zoom settle **+170 ms** (581→751), heap **+33 MB** (28→62).
  At **parity or better**: chart-paint (143→135 cold; 7049→6857 throttled — new
  faster), drawer open/close (±2 ms), 2D→3D switch (±7 ms), jank count (1 both).
- **Complexity is healthy on average but concentrated.** Cyclomatic Σ 598→553
  (avg 3.2/fn), max nesting 40→23. But `charts.ts` = 230/553 (42%) and holds all
  25 `any`. Worst single function `data` (cyclomatic 34) is **identical both
  sides** — the arena↔OpenRouter join/normalize core (architecture rule #334),
  genuine domain complexity the refactor correctly left alone. The old app's worst
  *nesting* lived in HTML-string builders (`detailsHTML` 21, `providersHTML` 18,
  `renderFooter` 19) that the refactor dissolved into Svelte components — that is
  why max-nesting fell.
- **Tests:** 0 → 66 cases (vitest) — the refactor's biggest durable gain.
- **Suspect seams:** `charts.ts` (imperative echarts), `Details.svelte` (47 cyc),
  `history.svelte.ts` (39), `urlstate.ts` (28), `family.ts` (25), `pareto.ts` (40).

## Design

Exploration in three analytical steps + a close. Each step writes a findings doc;
no code.

- **Step 01 — deep performance profile.** Localize the cost beyond the harness
  deltas: real bundle breakdown (`dist/assets` chunk sizes + what is eagerly in the
  initial bundle), a Chrome trace / Lighthouse on the built app to find what blocks
  first paint (svelte mount vs echarts init vs data fetch), and a targeted zoom-path
  micro-bench for the +170 ms. Output: top-3 costs, each with evidence.
- **Step 02 — svelte-adherence audit.** Review the suspect files for anti-patterns:
  manual DOM/echarts calls that could be components/bindings; `$effect` misuse
  (imperative work that should be `$derived`); store-vs-prop drilling; monolithic
  components; missing transitions (drawer open/close is manual); eager imports
  (echarts, data). Each finding: anti-pattern + svelte-idiomatic alternative + which
  harness metric it would move.
- **Step 03 — prioritized backlog.** Synthesize 01–02 into P0/P1/P2 items, each
  with expected impact (tied to a harness metric), effort, and a one-line future-plan
  spec. Includes the owner's four recommendations (code-split, preload, tighten
  `any`, keep tests green) plus anything found.
- **Step 04 — close.** Finalize findings + backlog, DoD audit, archive.

## Execution order

| Step | File | Depends on | Status | Commit |
|------|------|------------|--------|--------|
| 1 | 01-deep-profile.md | — | OPEN | plan: 030 — step 01 |
| 2 | 02-svelte-audit.md | 1 | OPEN | plan: 030 — step 02 |
| 3 | 03-backlog.md | 1, 2 | OPEN | plan: 030 — step 03 |
| 4 | 04-close.md | 3 | OPEN | plan: 030 — step 04 (`plan: 030-svelte-port-perf`) |

## Definition of done

- [ ] Deep profile names the **top 3** perf costs with evidence (bundle sizes, trace
      spans, or a micro-bench) — not just the plan-029 deltas.
- [ ] Svelte-adherence audit lists concrete anti-patterns **per file** with the
      svelte-idiomatic alternative and the harness metric each would move.
- [ ] Backlog is prioritized P0/P1/P2; every item maps to an expected harness-metric
      impact + effort + a one-line future-plan spec.
- [ ] No `src/` file changed in this plan (exploration only).

## Not yet specified

- Exactly which svelte patterns apply where — discovered in step 02.
- Whether to promote/commit the refactor-bench harness before execution (see Open
  branches) — the executor can use the `.tmp/` copy in the meantime.

## Open branches

| Branch | Hangs on | Parked because | Forces revisit when |
|--------|----------|----------------|---------------------|
| Promote refactor-bench harness from `.tmp/` into the repo (`tools/refactor-bench/`) + add the board-HTML generator (owner liked both) | Owner approval of placement/commit | Owner asked "could we add them to the project and commit them" 2026-09-19; logically a precursor to executing 030 (the oracle) | Owner green-lights → becomes plan 031, done before/with step 01 |
| Ship the board infographic to the live CF site as a `/aftermath` route | Promotion above + a publish decision | Owner floated "presented to the world"; not yet a deploy decision | Owner wants it public |

## Out of scope

- Implementing any fix (those are future plans graduated from the backlog).
- Promoting/committing the harness (plan 031) and deploying the page (Open branch).
- Touching `update.py` / data pipeline / `public/` assets.

## Executor rules

- Work from repo root; node ≥ 22 (repo standard).
- Bundle sizes: `npm run build` then inspect `dist/assets/` (hashed `index-*.js`,
  `*.css`; note any echarts/echarts-gl chunks and whether they are in the initial
  bundle vs lazy).
- Measurement oracle: `node .tmp/refactor-bench/run.mjs` (or the promoted copy) for
  before/after of any future fix — not rebuilt here.
- Svelte signals: `npx svelte-check` (compile warnings), `npm run build` (rollup
  output) as extra evidence.
- **Do not modify `src/`, `update.py`, or `public/`** in this plan — findings only.
- Each step: write the findings doc → owner reviews → (future) execute; plan files
  committed per the plans skill. No push (Push policy).
