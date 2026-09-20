# Step 02 — Svelte-adherence audit — ✅ COMPLETE (2026-09-20, no code changes)

> Read-only audit of every file in the step spec + the full component set
> (`src/` is 5,654 lines across 25 files — all reviewed). Corroboration:
> `npx svelte-check` (3 errors, 3 warnings — cited inline), `npm run build`
> (165 modules, chunk list from step 01), step-01 probe evidence.
> Frame per A1: the cutover was a deliberate literal port; findings are the
> carried-over non-idioms worth fixing, not a rewrite case.

## Verdict

The port is **substantially idiomatic where it counts**. The components the
old app built with HTML strings (`OfPanel`, `Comparator`, `ModelSearch`,
`Footer`, `ModelCard`, `Details`) are real Svelte 5: `$derived` chains, keyed
`each`, class/style bindings, `svelte:window`, snippets, `flip` animation.
`tour.ts` is a pure injectable-ticker state machine with unit tests;
`endpoints.svelte.ts` is the textbook reactive lazy-fetch store. The settled
architecture held (imperative chart seam per 028 A4, URL state per 027,
cookieless per 020 — no storage proposals here).

The findings below are concentrated in five places: **one real reactivity
bug** (Details' sort header), **one boot-chain design** (badge await-all —
step-01's cost #2), **one render-path rebuild** (charts.ts option churn on
filter-only changes), **typing/CSS hygiene** (the `any` seam, dead scoped
CSS with a visual effect), and **small manual-DOM reaches**. Nothing found
supports "the port itself is slow" — step 01 already localized the measured
regressions to the lost static shell and the badge chain, both outside Svelte.

## Findings (per file, anti-pattern → idiomatic alternative → metric)

### F1. `src/components/Details.svelte:112` — `heads` is a plain `const`, not `$derived` (**bug**)

`heads` (the provider-table sort-header list) is built once at component
init from `provSort`; `setSort()` mutates `provSort` (rows re-sort — `rows`
is `$derived` ✓) but the header's `on`/`arr` snapshots are frozen: after
sorting by "out", the ▲ and highlight stay on "in" and the arrow never flips.
Svelte 5 only tracks `$state`/`$derived` — a plain `const` referencing state
is an init-time snapshot.
**Fix:** `const heads = $derived((["in","out","up","spd"] as const).map(th));`
**Metric:** none (correctness/UX); the fix is a one-line change.

### F2. `src/components/Details.svelte:40` — visibility recomputed O(rows) for one row

`visible = $derived(filterRows(data.rows, ui).some(...))` runs the full
filter pipeline (families + vision + thresholds) over all 154 rows on every
`ui` change while the drawer is open, to answer one row's predicate.
**Fix:** reuse the single visibility predicate (032 D5's whole point):
`isVisible(d, { ...ui, thrCtx })` — O(1), same source as the chart's tags.
**Metric:** filter/threshold-drag re-render cost with the drawer open
(no harness metric today — candidate harness addition with the fade path).

### F3. `src/components/Details.svelte:21` + `src/App.svelte:38` — two `ensureEndpoints()` trigger points

App fires it once post-boot (`if (!data.error) ensureEndpoints()`); Details
adds an `$effect(() => { ensureEndpoints(); })` per drawer mount. The cached
promise makes repeats harmless, but it's a parallel channel for the same
trigger (the effect also re-runs on store changes — reads inside
`ensureEndpoints`' guard). **Fix:** one owner (App post-boot), delete the
effect — or keep it deliberately as a retry-on-open and say so in a comment.
**Metric:** none (hygiene).

### F4. Drawer open/close: `{#if ui.selected}` with no transition — `src/App.svelte:207`

The port kept the old app's instant show/hide (harness drawer parity ±2 ms —
nothing to win there). `{#if}` + `transition:fly={{ y: 24, duration: 180 }}`
(or the 032-style opacity fade) would give the same polish the fade path
gave the bubbles. **Fix:** wrap the `<aside class="drawer">` in a keyed
transition (note: with `{#if}`, out-transitions need the element retained —
use `{#if}` + `transition:` on the aside). **Metric:** none (parity already);
user-perceived polish only. Optional.

### F5. `src/lib/charts.ts` render path — full option rebuild per change

`renderPanel`/`renderSpeedPanel` rebuild the entire option on every effect
re-run: `pointsFor` + `chartOption` re-create all ~154 per-point objects
(`itemStyle`, `emphasis`, `label` closures, tooltip formatter) even when the
change is filter-only (search keystroke, threshold drag) and 032's merge path
diffs a mostly-identical option. Static per-point shape (symbol, orgColor,
base sizes, badge) never changes within a data load; only `vis`/dim/hot do.
**Fix (echarts-side, stays imperative per 028 A4):** split static vs dynamic
point fields — build the static per-point data once per data load (module
cache keyed by `fetched_at`), rebuild only `vis`-dependent fields per render;
the merge push then carries a smaller diff. **Metric:** threshold-drag /
search-keystroke latency (the 032 fade path — not in the harness yet;
candidate metric before/after). Zoom/pan untouched (wheel path doesn't
re-render svelte — verified in step 01, `setOption` count 0).

### F6. `src/lib/charts.ts:660` — `restoreZoom` unconditional after every push

`chartPush` always dispatches the saved-window `dataZoom` after `setOption`.
On the notMerge branch it's required (018 A2); on the 032 merge branch the
windows already survive — the extra dispatch is a second echarts update pass
per filter-only render. **Fix:** gate `restoreZoom(id)` on `!animate`.
**Metric:** same as F5 (halves update passes on the fade path). Micro.

### F7. `src/lib/charts.ts` typing — `declare const echarts: any` + 28 more `any`s

The vendored global has no types, so the whole seam is `any` (chart
instances, option objects, callback params). Options, cheapest first:
(a) add `echarts` as a **devDependency for types only** (`import type {
EChartsOption, ECharts } from "echarts"` — erased at build, zero runtime
bytes; the global script keeps supplying runtime), then type option builders
and callbacks; (b) hand-write a minimal `EChartLike` interface for the used
surface (`init/getOption/setOption/dispatchAction/convertFromPixel/getZr/on/
getDom`) — no dep, still kills most `any`s. Also missing: the `window.echarts`
global declaration — `gl.ts` declares `Window["echarts-gl"]` (in-repo
precedent), App.svelte:28's access is a live svelte-check error.
**Metric:** none (type safety); unblocks tsc/svelte-check as real gates.

### F8. Dead scoped CSS with a visual effect — `src/components/Panel.svelte:142`

`.tour-pill` styles in Panel can't reach the button (it renders inside
`Pill.svelte`'s scope), so svelte compiles them out (the two warnings) and
the 027 A2 tucked-away tour pill renders at full pill size — a small ported
regression. `App.svelte:338`'s `footer` block is the same mechanism but
harmless (Footer.svelte carries its own equivalent styles). **Fix:** style it
where the element lives (Pill prop/class) or `:global(.tour-pill)` in Panel;
delete App's dead footer block. **Metric:** none (visual/hygiene).

### F9. `src/lib/badges.ts` — await-all boot gate (bridges step-01 cost #2)

`BADGE` is a plain mutable object filled by `buildBadges()`, which App awaits
before `boot.ready` — every frontier badge logo is on the first chart's
critical path (step 01: logos start 4.03 s, last lands 6.85 s throttled;
`toDataURL` 85–220 ms throttled; 256×256 canvas per badge vs the 24 px it
renders at). **Fix (svelte-idiomatic):** a reactive badge store (the
`endpoints.svelte.ts` pattern): `boot.ready` no longer awaits badges; charts
render immediately with `fallbackBadge` (already exists — the natural
placeholder), badge completion re-renders the frontier points once. Also
right-size the canvas to 48×48 (2× display). **Metric:** chart-ready
−~2.8 s throttled; `toDataURL` −60–150 ms. This is the top actionable
finding of the audit.

### F10. Manual DOM reaches across components (small, honest)

`Details.sendToCompare` → `document.getElementById("compare")?.scrollIntoView`;
`Comparator.openFull` → `requestAnimationFrame(() => document.querySelector(".drawer")…)`.
**Fix:** an element binding + a tiny imperative helper (or an action), so the
targets are typed and the rAF dance is owned in one place. **Metric:** none.
Micro — acceptable to keep if the owner prefers.

### F11. Micro-footnotes (record, don't fix)

- `family.ts` regex derivations run ~150–300×/render (`orgOf`/`familyOf` in
  `isVisible` + `chartOption`); a per-load memo (`Map<or_id, family>`) would
  remove repeated regex work — <1 ms/render today.
- `history.svelte.ts:59-60` — `contSnap()` stringifies twice per change; and
  `applyFromURL`'s `??`-chain re-hardcodes defaults that `urlstate.DEFAULTS`/
  `NO_THR` already own (three places to keep in sync — drift risk for the
  next field, not a bug today).
- `SearchBox` recomputes `filterRows` per keystroke for the n/N count — fine
  at n=154.
- `tourflag.svelte.ts` — the `readers` array is dead (always empty; polling
  `takeAutotour` replaced it); delete.
- `Comparator.svelte:64` — `cells`'s `concat(? [null] : [])` is the
  svelte-check type error (runtime-fine); type the hole explicitly.
- `ModelCard.svelte:74` — `d.arena_elo.toFixed(1)` unguarded (svelte-check
  error; runtime-safe today because cards only render for elo'd rows — the
  type should say so or guard).

### F12. Config: `vite.config.ts` / `svelte.config.js` — no change recommended

No `manualChunks`; at 42.8 KB gz the single bundle is the right call —
splitting adds a request for nothing. The eager-weight lever is the vendored
echarts classic script (step 01), which lives in `index.html`, not the
bundle. `svelte.config.js` is just `vitePreprocess`. Nothing to do here.

## What's right (audit confirmed, not incidental)

- `Panel.svelte`'s `$effect` boundary: sync reads tracked, GL-await split out
  (the #468 lesson) — correct per the settled architecture.
- `history.svelte.ts`/`urlstate.ts`: pure serializer + burst discipline
  intact (027 A4/A5); `contSnap`/`discSnap` cover the new `thr` fields.
- 032's keep-alive + GEOM-signature merge/notMerge split is the right
  echarts idiom for the fade (D4); F5/F6 shave its cost, they don't redesign it.
- No storage APIs anywhere (020 held); `ui` store naming, SvelteSet usage,
  keyed `each` with `flip` — all idiomatic.

## svelte-check corroboration (unwired tool, 3 errors / 3 warnings)

Errors: `App.svelte:28` (untyped `window.echarts` — F7), `ModelCard.svelte:74`
(possibly-null elo — F11), `Comparator.svelte:64` (concat type — F11).
Warnings: `Panel.svelte` `.tour-pill` ×2 (F8), `App.svelte` `footer` (F8).
AGENTS.md keeps svelte-check deliberately unwired (vitest is the gate); the
3 errors are known debt a typing pass (F7) would clear.

## Verification

- Audit doc present: per-file findings with anti-pattern, idiomatic
  alternative, and the harness metric each would move (F1–F12), plus the
  confirmed-correct list.
- `svelte-check` output cited (F7/F8/F11); `npm run build` chunk facts cited
  from step 01 (F12).
- No `src/` file changed (exploration-only confirmed).
