# Report — port-performance findings & open items (from plan 030)

Location: `docs/reports/` — exploration reports live here, not in `plans/`
(a report is a record to read and discuss; plans are the actionable docs).
Date: 2026-09-20.

Items continue the cross-backlog B-ID space (021 ends at B18); plan 030's
interim "B1–B9" numbering is retired — the mapping is stated per item.

## The short list — what to do, which plan fixes what

| B# | plan doc | what it fixes |
|----|----------|---------------|
| **B19** | `plans/034-static-shell.md` | First paint waits for the whole echarts-download→exec→mount chain (throttled FCP ~3.3 s) because `#app` is empty — paint the static chrome immediately instead (~0.6 s), with the echarts script deferred |
| **B20** ✅ | `plans/archive/035-badge-store.md` | The first chart waits for ~25 badge logos (throttled chart ~7.0–7.5 s) — render with fallback badges immediately, swap real ones in (~4.2 s). **Done 2026-09-23: throttled chartMs 7203 → 4444 ms.** |
| **B21** | `plans/039-hygiene-batch.md` step 1 | Details' sort-header arrow/highlight is frozen (plain const off reactive state) — one-line reactivity fix |
| **B22** | `plans/036-fade-shave.md` | Threshold-drag / search-keystroke re-render cost — add a real harness metric first, shave only if it measures hot ("measured cheap" is an accepted outcome) |
| **B23** | `plans/040-echarts-npm.md` (absorbed) | The `any`-typed echarts seam — real types come free with npm echarts; residual component type holes already live in `plans/039-hygiene-batch.md` step 5 |
| **B24** | `plans/038-ui-polish.md` | Drawer opens with no transition; the tour pill renders at full size (its scoped styles compile out — a ported visual regression); dead footer CSS |
| **B25** | `plans/039-hygiene-batch.md` | Carried-over reaches: duplicate visibility recompute, a second fetch trigger, manual DOM lookups, dead `tourflag` code, default-drift cleanup |
| **B26** | — parked on B19 | SSR/prerender evaluation — only if B19's static shell isn't enough |
| **B27** | — revisit-only | Wiring `svelte-check` into the gates — owner opt-in, no plan unless chosen |
| **B28** | `plans/040-echarts-npm.md` | npm echarts instead of the vendored classic script: eager chart JS 335→166 KB gz (treeshake), the parse-blocking script disappears, real types replace the `any` seam, GL becomes a dynamic-import chunk (absorbs B23) |

## Full findings

Source: plan 030 (archived 2026-09-20) — its steps 01 (deep performance
profile), 02 (svelte-adherence audit), 03 (terse backlog). This doc is the
**complete report**: per-item full evidence + reasoning. Items that
graduated to PROPOSED plan docs are marked per section; execution order is
the owner's — nothing implements until a plan is agreed in a review session.

## Measurement base (how every number below was produced)

- Worktree: `38bc0db` + 032's step-3 fade WIP (owner authorized proceeding;
  the fade changes only the filter path — boot-path numbers are comparable to
  the plan-029 baseline on `e858d24`). Harness methodology inherited from
  plan 029: cold Chromium, cache disabled, FAST3G (562 ms RTT, 176 KB/s) +
  4× CPU for the throttled conditions, 3–7 repeats, medians reported.
- Probes (scratch, `.tmp/030/`): `trace.mjs` (two-phase CPU profiler
  nav→FCP→chart-ready + resource waterfall with start offsets + longtasks),
  `zoom.mjs` (wheel-burst instrumentation, both sides via a `7957602`
  worktree), `heap.mjs` (post-GC heap checkpoints + allocation sampling +
  no-data baseline, both sides), `bundleattr.py` (sourcemap VLQ decode →
  per-module byte attribution). Raw reports: `trace-report.json`,
  `zoom-report.json`, `heap-report.json` in `.tmp/030/`.
- Old-side baselines: plan-029 seven-run medians (old `7957602` vanilla vs
  new `e858d24` cutover) + step-01's own old-side zoom/heap runs.

## The measured picture (complete, with numbers)

### Bundle + eager weight (as served from `dist/`)

| Resource | raw | gzip | eager? |
|---|---|---|---|
| `js/echarts-5.6.0.min.js` (vendored classic script) | 1,034,102 B | 335 KB | **yes — parse-blocking, end of body** |
| `assets/index-*.js` (svelte bundle) | 120.0 KB | 42.8 KB | yes (module) |
| `assets/index-*.css` | 19.2 KB | 3.8 KB | yes |
| font `inter-var.woff2` | 48 KB | ~47 KB | yes (font swap) |
| `data/combined.json` | 111 KB | 16.3 KB | fetched post-mount |
| `data/meta.json` | ~2 KB | ~1 KB | fetched post-mount |
| `data/endpoints.json` | 2,197,042 B | 157 KB | fetched post-`boot.ready` (speed/hover only) |
| `js/echarts-gl-2.1.0.min.js` | 639,846 B | 175 KB | **no — lazy, 3D only** (verified: absent from initial load) |
| logos | ~150 KB total | | fetched for badges post-data |

Svelte bundle attribution (sourcemap decode): app code 64.4 KB (54% —
`charts.ts` 18.2 KB is the largest module, 28% of app), svelte runtime
53.8 KB (45%, of which `svelte/animate`+`transitions` ≈ 4.7 KB).
**The vite bundle is not the problem** — the eager weight is the vendored
echarts script (52% of eager gz) + data.

### First paint (the real regression)

- Throttled: FCP **608 ms → 3.27–3.61 s** (029: +2.5 s; today's tree confirms
  3.27–3.61 s). Unthrottled: parity-ish (029: old 36 / new 56 ms).
- Mechanism (waterfall offsets, throttled): all three top-level resources
  start at 656 ms (one HTML RTT); echarts **download finishes at 3204 ms**
  (2548 ms duration); the classic script blocks parsing at its body-end
  position; the deferred module executes only after parsing completes →
  svelte mounts → first contentful paint ≈ DCL ≈ 3.26–3.50 s.
- Phase-A (nav→FCP) profiler: busy only **164–719 ms** of the 3.3 s window
  ((program)/compile 116–547 ms, echarts exec 23–69 ms, bundle exec 15–58 ms)
  — the rest is **network wait**. It is not a main-thread problem.
- Why old painted early: old `index.html` shipped the **full static shell**
  (header, nav, all panel chrome, axis note, footer) as HTML+CSS → painted at
  608 ms while echarts was still in flight. The port replaced it with an
  empty `<div id="app">`.

### First chart (parity, but the biggest absolute cost)

- Throttled chart-ready: old 7066 / new 6853–7517 ms (parity). Unthrottled
  init→paint: parity (135 vs 143 ms, 029).
- Mechanism: `boot.ready` awaits `buildBadges()` → ~25 logo images start at
  **4033 ms** (after data) and land **4600–6853 ms** (connection-limited RTT
  serialization) → first chart at ~7.0–7.5 s. Badge compositing itself:
  `toDataURL` **85–220 ms throttled** / 27–75 ms unthrottled; JSON parse +
  first render ≈ 400 ms busy in phase B. Old pays the same chain (same
  buildBadges port) — parity, not regression — but it is the largest
  remaining load cost and mostly invisible work (badges decorate the
  frontier only).
- TBT/longtasks: throttled load TBT ≈ **60–240 ms** across runs, longest
  task 144 ms (the first chart render at ~7.3 s). Unthrottled negligible.
  First paint is network-gated, not CPU-blocked.

### Zoom (the "+170 ms" is measurement structure, with a small real tail)

- 7-repeat medians, both sides (fresh nav each, warm cache):
  first visible repaint after first wheel tick: **old 45 / new 84 ms**;
  per-tick `dispatchAction` render: **old 3.7 / new 4.8 ms** (max 6.2/9.1);
  20 `getOption` calls ≈ 16.4/21 ms (~0.8–1.05 ms each — no deep-clone
  problem at 154 points); **`setOption` calls from svelte during the burst:
  0** (no reactive thrash — the 018 A2 rule held); GC ≈ 9 ms; no longtasks.
- The harness's `zoomSettleMs` (581→751) reproduces (568–575 vs 781) but
  equals the probe's own 10-wheel dispatch loop stretching
  (`wheelDone` old ~510 / new ~725 ms) — per-tick render delta amplified by
  the tight loop + the probe's canvas-hash reads. Real user cost at wheel
  rates: ~5 ms/tick — imperceptible. Verdict: minor per-tick tail (~+1 ms
  render, ~+40 ms first repaint), **not** a top-3 cost.

### The two plan-029 artifact metrics (resolved — don't chase them)

- **Throttled `load` +3.5 s (3332→6806):** event-accounting artifact. All
  subresource bytes are the same old vs new; the delta is *when logo `<img>`
  elements exist relative to the load event*: old built its org chips after
  data (~6 s), i.e. after its load event (3.3 s) had fired — its imgs didn't
  delay it; new mounts at ~3.3 s (before load) so its OfPanel/ModelCard imgs
  join the load-blocking set → load lands with the last logo (~6.9–7.4 s).
  Same bytes, different bookkeeping. Headline metrics that reflect users:
  `fcpMs`/`lcpMs`/`chartMs`.
- **Heap +33 MB (28→62):** uncollected-instant reading. Post-GC retained
  (precise memory info + forced GC): **old 7.8 / new 13.4 MB** at 2D-ready
  (raw, uncollected: 11.6 / 16.6) — real retained delta **+5.6 MB** (no-data
  baseline 2.9 vs 3.5 MB = framework share +0.6; the rest is app/data
  structures). 3D adds +1.4 MB retained (new) / +3.5 MB (old). The 029 gap
  was young-gen churn at the sampling instant right after first render.
- **echarts-npm probe (B28):** a scratch vite build of treeshaken
  echarts 5.6.0 (`.tmp/echarts-probe/`) measuring what the package route
  would weigh for our exact feature set (see B28 for numbers).

## Open items

### B19 — Static shell + defer the echarts script *(plan: `plans/034-static-shell.md`)*

- **Hypothesis.** The only big measured regression left is structural: an
  empty `#app` gates first paint on the full echarts→module→mount chain.
  Old's static shell painted at 608 ms throttled while echarts was in flight.
- **Evidence.** FCP 608→3.27–3.61 s throttled (complete mechanism above);
  phase-A busy 164–719 ms of 3.3 s (network-gated); echarts download
  656→3204 ms; DCL parity (3326 old / 3129–3497 new) — the regression is
  purely "no static content to paint".
- **Options.** (a) Hand-written static shell in `index.html` (old-app style)
  — cheap, but duplicates chrome that Svelte owns (drift risk, needs a
  maintenance story). (b) Build-time prerender of the chrome (a small vite
  step renders App's static parts to HTML at build) — single source of truth,
  more machinery. (c) defer/async the echarts script — necessary companion in
  both cases: with a shell above it, a parse-blocking script at body-end
  would again delay everything below; `defer` keeps its exec before the
  module (document-order guarantee: deferred classic scripts and module
  scripts run in tree order, echarts is after the module tag in <head> —
  order preserved). (d) Full SSR worker — out: #331/#336 static site; see B26.
  - Consequences (a+b): (a) simplifies build, complicates maintenance;
    (b) simplifies maintenance, complicates build. (c) is orthogonal and
    cheap either way.
- **Open questions.** 1. (a) vs (b). 2. Mount-flash: svelte mounts over the
  shell — tear-down flash acceptable? (needs owner A/B; mitigation: shell is
  the same chrome Svelte renders). 3. Which shell bits are static (mode
  segs, labels) vs data-dependent (stamp line, counts — must not lie).
- **Effort.** M. **Deps:** none. **Impact:** throttled FCP/LCP −~2.7 s.

### B20 — Decouple the badge chain from first chart *(plan: `plans/archive/035-badge-store.md` — done 2026-09-23)*

- **Outcome.** D1 reactive store + D2 fallback-first/swap + D3 48px
  canvases, executed as planned. Throttled chartMs **7203 → 4444 ms**
  (bench run-20260923-1009 vs 0130, 7-run medians; −38%); requests at
  first paint 30 → 7 (logos still in flight). Swap reads as progressive
  waves, owner-accepted. Consumer inventory: the badge store's only
  consumer is the frontier symbol seam — tooltip/drawer/selector logos
  ride `logoFor` (raw files) and never gated.
- **Hypothesis.** `boot.ready` awaits `buildBadges()` — every frontier badge
  logo is on the first chart's critical path; fallback badges already exist
  as the natural placeholder.
- **Evidence.** Logos start 4033 ms, last lands 6853 ms throttled; chart
  7.0–7.5 s; `toDataURL` 85–220 ms throttled; canvas is 256×256 for a 24 px
  symbol (10× oversized → PNG-encode cost + memory).
- **Options.** (a) Reactive badge store (endpoints.svelte.ts pattern):
  charts render at `boot.ready`-without-badges using `fallbackBadge`, one
  merge re-render when badges land. Simplifies the boot gate; complicates:
  one extra render + a symbol-swap flash (owner A/B). (b) Keep the gate but
  right-size canvases (256→48) + only await frontier orgs (~10–15 logos) —
  smaller gain, zero flash risk. (c) Both.
- **Open questions.** 1. Symbol-swap flash acceptable? 2. Are non-frontier
  badge consumers waiting (tooltip logos?) — inventory in the plan.
- **Effort.** M (a), S (b). **Deps:** none. **Impact:** throttled chartMs
  −~2.8 s; toDataURL −60–150 ms.

### B21 — Details sort-header reactivity bug *(plan: step 1 of `plans/039-hygiene-batch.md`, independent-able)*

- **Hypothesis.** `heads` in `Details.svelte:112` is a plain `const` built
  from `provSort` — Svelte 5 only tracks `$state`/`$derived`; the header's
  `on`/`arr` are init-time snapshots: after sorting by "out", the ▲ and
  highlight stay frozen on "in" and the arrow never flips (rows do re-sort).
- **Evidence.** Code read (line refs); svelte-check flags nothing here
  (it's semantic, not a type error). Reproduction is deterministic by
  construction.
- **Why.** One-line fix (`const heads = $derived(...)`) — correctness, free.
- **Effort.** S. **Impact:** none (correctness).

### B22 — Fade-path render shave, measurement-first *(plan: `plans/036-fade-shave.md`)*

- **Hypothesis.** Filter-only changes (search keystroke, threshold drag)
  rebuild the entire chart option (all ~154 per-point objects + tooltip
  formatter closures) even though 032's merge path diffs a mostly-identical
  option; `chartPush` also dispatches the saved-window `restoreZoom` after
  **every** push — on the merge branch the windows already survive, so it is
  a second echarts update pass per render.
- **Evidence.** Render-path code read (charts.ts:649–747): per-render
  `pointsFor` + `chartOption` full rebuild + unconditional `restoreZoom`.
  No harness metric exists for the fade path (zoom settle is a different
  path and is fine — see above). At today's scale the cost is plausibly
  small — **that's exactly why the metric comes first**: per the owner's
  measurement standards, no proxy gate-count claims; add a threshold-drag
  settle metric to the harness, then measure before/after.
- **Options.** 1. Gate `restoreZoom` on the notMerge branch (S). 2. Split
  static per-point shape (built once per data load, keyed by `fetched_at`)
  from vis-dependent fields (M) — merge pushes then carry smaller diffs.
  3. Do nothing (if the metric shows the path is already cheap) — an honest
  possible outcome; the metric addition survives either way.
- **Open questions.** 1. Where the metric lives (the harness is 033's
  domain — coordinate). 2. Is the static/dynamic split worth it if the
  measured cost is <16 ms/frame? (probably not).
- **Effort.** S for the metric + S–M for the shave. **Deps:** 033's harness
  work (coordination, not a blocker). **Impact:** a NEW metric (threshold-drag
  latency); no existing metric moves.

### B23 — Type the chart seam; clear the svelte-check debt *(absorbed by B28 → `plans/040-echarts-npm.md`)*

- **Hypothesis.** `declare const echarts: any` + 28 more `any`s exist because
  the vendored global has no types; the `window.echarts` global is
  undeclared (live svelte-check error).
- **Evidence.** svelte-check (unwired tool): 3 errors — App.svelte:28
  (`window.echarts` untyped), ModelCard.svelte:74 (`d.arena_elo` possibly
  null), Comparator.svelte:64 (concat type hole) — all runtime-safe today,
  all type-truths; 29 `any` occurrences enumerated in charts.ts (1 declare,
  chart instances, callback params, option returns).
- **Options.** 1. `echarts` as a devDependency for **types only** (`import
  type`, erased at build — zero runtime bytes; the global script keeps
  supplying runtime). 2. Hand-write a minimal `EChartLike` interface for the
  used surface. 1 is recommended (real option types + `EChartsOption`); 2 is
  the zero-dep fallback.
- **Open questions.** 1. Owner's stance on a types-only devDep (new
  dependency even if runtime-inert). 2. Include the optional charts.ts file
  split (A4 decomposition) in the same pass?
- **Resolution (2026-09-20):** superseded by B28 — npm echarts ships the
  real types, so the devDep question dissolves; the component type holes
  (ModelCard, Comparator) are already step 5 of `plans/039-hygiene-batch.md`;
  the `window.echarts` declaration becomes unnecessary (module imports).
- **Effort.** M. **Impact:** `any` 25→~0, svelte-check errors 3→0; no
  timing metric.

### B24 — Interaction polish: drawer transition + tour-pill CSS *(plan: `plans/038-ui-polish.md`)*

- **Hypothesis.** Drawer open/close is an instant `{#if}` (parity ±2 ms —
  polish only); the `.tour-pill` scoped styles in Panel compile out (they
  can't reach Pill.svelte's button) so the 027 A2 tucked-away tour pill
  renders at full pill size — a real, small ported visual regression;
  App's `footer` block is provably dead (Footer.svelte owns the element)
  and is redundantly duplicated there.
- **Evidence.** svelte-check warnings ×3 (Panel `.tour-pill` ×2, App
  `footer`); build-time warnings corroborate. Drawer: harness parity ±2 ms.
- **Options.** Drawer transition: `transition:fly` (Svelte-idiomatic, needs
  owner A/B — motion is taste); tour-pill: style where the element lives
  (Pill prop/class) or `:global`; footer: delete the dead block.
- **Effort.** S. **Impact:** none (visual); owner A/B.

### B25 — Hygiene batch *(plan: `plans/039-hygiene-batch.md`, includes B21)*

- **Hypothesis.** Small carried-over reaches and dead code, cheap to batch:
  Details' O(rows) visibility recompute → `isVisible` (F2); two
  `ensureEndpoints()` trigger points → one owner (F3); manual DOM reaches
  (`sendToCompare`'s `getElementById`, `openFull`'s rAF + `querySelector`)
  → typed bindings/actions (F10); `tourflag`'s dead `readers` array; the
  Comparator `cells` concat type hole; ModelCard's unguarded elo;
  `applyFromURL`'s re-hardcoded defaults (three places own defaults —
  drift risk for the next field); micro-memoization of `familyOf`
  (<1 ms/render — record only, fix opportunistically).
- **Evidence.** Per-finding line refs in the archived step-02 audit (F2, F3,
  F10, F11); all verified by code read + svelte-check.
- **Why batch.** Each is S; together they're one review + one PR; tests
  guard the shared-predicate touches.
- **Effort.** S–M total. **Impact:** none (hygiene); some reuse wins
  (single visibility predicate).

### B26 — SSR/prerender evaluation *(parked — revisit after B19)*

- **Hypothesis.** After B19's shell ships, is more needed? The chart is
  client-only, so request-time SSR helps exactly the chrome B19 fixes; the
  static site constraint (#331/#336) makes request-time SSR a real
  architecture change, while build-time prerender of the chrome IS B19's
  option (b).
- **Evidence.** Step-01: FCP is network/structure-gated, not CPU — SSR's
  value here = shipping the chrome earlier, which B19 delivers statically.
  Data-dependent shell bits (stamp line) are the only SSR-specific leftovers.
- **Why parked.** B19's outcome decides whether this exists. Re-evaluate
  with post-B19 FCP numbers.
- **Effort.** L if ever (architectural). **Impact:** −FCP beyond B19's floor.

### B27 — svelte-check wiring *(revisit-only — no plan unless the owner opts in)*

- **Hypothesis.** AGENTS.md keeps svelte-check deliberately unwired (vitest +
  tsc are the gates); after B23 clears the 3 errors, wiring it is a
  one-liner the owner can choose.
- **Evidence.** The 3 errors + 3 warnings it found this session — all real
  (F7/F8/F21). The tool is a useful manual check today.
- **Effort.** S. **Impact:** none (gate hygiene).

### B28 — Bundle echarts from npm (treeshake + dynamic GL chunk) *(plan: `plans/040-echarts-npm.md`; absorbs B23)*

Owner question (2026-09-20): "what if we add echarts via package.json —
could we improve the situation? by splitting it and such things?"

- **Hypothesis.** The vendored full echarts (plan 019's byte-pinned classic
  script) carries every chart type we never use; npm + vite treeshaking to
  our feature set should roughly halve it, the defer-by-nature module kills
  the parse-blocking body-end script, and the package ships real types.
- **Evidence (measured, `.tmp/echarts-probe/`):** treeshaken echarts 5.6.0
  (custom/line/scatter + grid/tooltip/inside-zoom + canvas — the exact set
  charts.ts uses): **505,771 B raw / 166 KB gz9 vs the vendored
  1,034,102 B / 335 KB gz9 (−50%)**. echarts-gl: unchanged either way
  (~175 KB gz9) — it becomes a dynamic-import chunk (vite splits it
  automatically, replacing the manual script-inject; the #468
  await-before-init invariant is preserved by awaiting the import).
  Eager JS total ~378 → ~215 KB gz (−43%). Without any shell this alone
  moves throttled FCP ~3.3 s → ~1.5–2 s (the deferred bundle downloads
  from the first RTT in parallel and is never parser-blocking) — but
  B19's shell still wins alone (~0.6 s); they compose. Chart-ready stays
  dominated by data + badge logos (B20).
- **Consequences.** *Simplifies:* −50% eager chart JS; real `EChartsOption`
  types (B23's `any` seam becomes free); no `window.echarts` global; no
  `gl.ts` inject; one less vendored file; parse-blocking script gone.
  *Complicates:* amends 019's byte-pin audit mechanism → lockfile
  pinning (package-lock integrity; 020's self-hosting rule untouched);
  a charts.ts import refactor (logic untouched — 9 call sites keep their
  behavior); a version-pin policy (exact 5.6.0/2.1.0; bumps = deliberate
  re-audit); echarts-gl's own treeshake-ability unverified (lazy chunk
  may stay whole-package — acceptable, it's lazy).
- **Open questions.** 1. Owner approves the 019 mechanism amendment.
  2. Bump policy (D3). 3. Does the GL chunk treeshake at all (measure in
  the plan's step 1; no action needed if it doesn't).
- **Effort.** M. **Deps:** none (composes with B19/B20).
- **Impact:** eager JS −43%; FCP −~1.5 s without a shell (bounded by B19);
  types free.

## Dismissed by measurement (full reasoning — no plans)

- **Code-split the initial bundle (owner rec 1, literal form).** The premise
  fails: echarts is NOT in the bundle (vendored classic script); the bundle
  is 120 KB/42.8 KB gz total. Splitting it adds a request for nothing. The
  rec's goal (less before paint) is served by B19's shell + defer.
- **modulepreload/prefetch as the primary lever (owner rec 2, literal
  form).** All three top-level resources already start at the first RTT
  (656 ms) — discovery is not the bottleneck; exec ordering + the empty
  shell are (B19). `fetchpriority=high` on echarts is the only marginal
  variant, folded into B19.
- **Memoize derived selectors for panning (030 seed P1).** Zoom/pan triggers
  zero svelte re-renders (probe: 0 `setOption` during bursts); the +170 ms
  settle was probe amplification (see above). Search-keystroke memoization
  is micro at n=154.
- **echarts-gl lazy-load verify (030 seed P2).** Confirmed already lazy:
  absent from the initial load; retained GL cost +1.4 MB only after 3D
  entry. No action.
- **Lazy-load heavy panels/data (030 seed P2).** Already the behavior:
  hidden panels never render (Panel's `$effect` guard), data fetch is
  post-mount, endpoints post-`boot.ready`. No action.
- **Heap action.** Retained delta +5.6 MB (7.8→13.4 post-GC) is acceptable;
  the +33 MB was churn at an uncollected instant. No plan.

## Standing discipline (owner rec 4)

Not an item: every plan inherits the repo's verification hierarchy (python
suite + vitest + tsc → build → `update.py` → probes) and the TDD skill on
behavior steps. Raw artifacts live in gitignored `.tmp/` per AGENTS.md.
