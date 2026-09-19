# Step 02 — Svelte-adherence audit — OPEN

## Spec

Read-only audit of the suspect files for svelte anti-patterns carried over from the
literal port. For each finding: the anti-pattern, the svelte-idiomatic alternative,
and which plan-029 harness metric it would move.

Files to audit (priority order from the complexity/perf evidence):

- `src/lib/charts.ts` — **prime suspect** (230/553 cyclomatic, all 25 `any`). The
  imperative echarts seam: is it calling `echarts.init`/imperative DOM inside reactive
  context? Are `$effect` boundaries correct (reads tracked vs untracked)? Could the
  chart become a thin svelte component wrapping the instance? Is `any` there because of
  echarts option typing — could it be `echarts.EChartsOption` / a typed option?
- `src/components/Details.svelte` — 47 cyclomatic. Manual open/close + DOM building?
  Could use a svelte `transition:` for the drawer instead of manual class/style toggles
  (ties to the parity-but-manual drawer open/close).
- `src/lib/state.svelte.ts` (`ui` store), `src/lib/panels.svelte.ts`,
  `src/lib/history.svelte.ts` (39 cyc), `src/lib/urlstate.ts` (28) — store vs prop
  drilling; `$derived` vs recomputed-in-`$effect`; effect re-run frequency (relevant to
  the +170 ms zoom settle if panning triggers broad reactive invalidation).
- `src/lib/pareto.ts` (40), `src/lib/family.ts` (25), `src/lib/filters.ts`,
  `src/components/Panel.svelte`, `src/components/Seg.svelte`,
  `src/components/Pill.svelte`, `src/components/RatioCtl.svelte`,
  `src/components/SearchBox.svelte`, `src/components/OfPanel.svelte`,
  `src/components/Footer.svelte`, `src/components/Comparator.svelte`,
  `src/App.svelte`, `src/main.ts` — scan for manual DOM, eager imports
  (`echarts`, data fetch at module load), and reactive misuse.
- `vite.config.ts` / `svelte.config.js` — confirm code-splitting / manualChunks
  settings; this is where the bundle-size fix would live.

Cross-check with `npx svelte-check` warnings (untracked reads, effect issues) and
`npm run build` rollup output.

**Not touched in this step:** no `src/` edits — findings only.

## Verification

- An audit doc listing, per file, concrete anti-patterns with the svelte-idiomatic
  alternative and the harness metric each would move (e.g. "manual drawer toggle →
  svelte `transition:` → removes manual close cost / polish"; "echarts eagerly imported
  → manual chunk → −throttled load"; "$derived memoization of filtered list → −zoom
  settle").
- `svelte-check` and build output cited where they corroborate a finding.

## Seams under test

- `no tests`: exploration-only; verified by the audit doc the owner reviews.
