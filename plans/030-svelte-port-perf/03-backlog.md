# Step 03 — Prioritized improvement backlog — OPEN

## Spec

Synthesize steps 01–02 into a prioritized, executable backlog. **No code** — each
item is a future plan candidate.

For every item: `title`, `hypothesis` (why it helps), `expected impact` (mapped to a
plan-029 harness metric — e.g. throttled `load`, FCP, zoom settle, heap, cyclomatic,
`any`, test count), `effort` (S/M/L), and a `future-plan` one-liner.

Seed items (from the owner's recommendations + the evidence; confirm/extend in-step):

- **P0 — route/initial-bundle code split** (owner rec 1). Split `echarts` (and the
  chart panel) out of the initial chunk so first load parses less. Impact: −throttled
  `load` (the +3.5 s), −FCP. Effort M.
- **P0 — preload/prefetch hints for the chart bundle** (owner rec 2). `<link rel=modulepreload>`
  for the echarts chunk once the shell is interactive. Impact: −FCP, −init→paint. Effort S.
- **P1 — decompose / type `charts.ts`** (A4; owner rec 3). Pull the option builder into
  typed helpers, split the 230-cyc file, remove `any` via `EChartsOption`. Impact: −`any`
  (25→0 in seam), −cyclomatic concentration, possibly −init→paint. Effort L.
- **P1 — memoize derived selectors** (filters/pareto). `$derived` for the filtered/parsed
  rows so panning doesn't recompute broadly. Impact: −zoom settle (the +170 ms). Effort M.
- **P1 — svelte `transition:` for the drawer** (Details.svelte). Replace manual
  open/close; polish + removes manual cost. Impact: drawer parity → smoother; minor. Effort S.
- **P2 — defer/verify echarts-gl lazy load** (memory #468: already script-injected, but
  confirm it's not in any initial path). Impact: −heap on non-3D sessions. Effort S.
- **P2 — evaluate SSR / prerender** (owner: "add ssr maybe"). The site is a Cloudflare
  Workers **static** SPA (plan 028 cutover). SSR would need a worker that renders on
  request, or build-time prerender to static HTML — a significant change to the build/
  `wrangler.jsonc`, but it directly attacks the +28 ms FCP / +35 ms init→paint by
  shipping rendered markup. Trade-offs: loses pure-static simplicity, adds a render path,
  and the echarts/GL chart is client-only so SSR helps the shell not the chart. Needs its
  own sub-analysis before becoming a plan. Impact: −FCP, −init→paint. Effort L
  (architectural). Future-plan: `0xx-ssr-eval`.
- **P2 — keep the vitest suite green + extend coverage** (owner rec 4). Impact: guards
  every future refactor; the refactor's biggest durable gain. Effort ongoing S.
- **P2 — lazy-load heavy panels / data** (defer non-chart panels + data parse off the
  critical path). Impact: −init→paint, −heap. Effort M.

Rank by impact × ease; the executor may add items found in 01–02 (e.g. a specific
`$effect` fix from the zoom micro-bench).

**Not touched in this step:** no `src/` edits.

## Verification

- A backlog doc with P0/P1/P2 sections; every item carries impact (harness metric) +
  effort + future-plan one-liner.
- The four owner recommendations are all represented.

## Seams under test

- `no tests`: exploration-only; verified by the backlog doc the owner reviews.
