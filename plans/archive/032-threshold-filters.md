# 032 — Threshold filters (price / Elo / speed)

Date: 2026-09-19. **Status: ARCHIVED (2026-09-19).** Commits: f7b9b93 (plan) ·
397b6e1/f9dc98e (step 1) · f51cbeb/5641db3 (step 2) · d530313/1bc7d2e
(step 3) · close (no code). Approved D1–D7 (owner
"recomended" 2026-09-19); D1/D6 revised double-sided mid-step 2, 3D
keep-alive added mid-step 3 (2026-09-19). D4 = Option
A (keep-alive + opacity merge). D5 = unify (search/family/vision also fade).
Source: owner
directive (2026-09-19) — "add some thresholds like a price (min & max), an Elo
(min) and a speed (min) to filters", plus the live requirement "if I move the
thresholds the bubbles disappear with an animation".

Add numeric threshold filters alongside the existing family / vision / search
filters. Three thresholds: **price** (min **and** max), **arena Elo** (min),
**output speed** (min). Moving a threshold must **fade the disqualified bubbles
out** (opacity tween), never blink them away.

## Owner decisions to settle (D table)

| # | decision | options & recommendation |
|---|----------|--------------------------|
| D1 | Threshold set | price(min,max) + elo(min) + speed(min). Mirrors the directive verbatim. (No max on Elo/speed — owner asked min only.) |
| D2 | Which price the price threshold measures | **(rec)** Tie it to the *active view's x-axis price*: `general`→blended `blendedPrice(d,ui.ratio)` (filters.ts:36), `in`→`price_in_per_m`, `out`→`price_out_per_m`; `3d`→blended (its x). In the **speed** view (x = tok/s, charts.ts:47) there is no price axis, so the price threshold is **inactive** there (only speed/Elo cull). Alt: always measure blended — but that silently culls points the speed view is actually showing, which is wrong. |
| D3 | State shape | Add `ui.thr = { priceMin:number|null, priceMax:number|null, eloMin:number|null, speedMin:number|null }` (null = unbounded) to `state.svelte.ts:16`. Serialize in `urlstate.ts` (defaults omitted, rounded — same discipline as `ratio`, urlstate.ts:87); add to `read`/`write` + `App.svelte:67` history effect's tracked reads. Deep-linkable per 027 A4/A5. |
| D4 | **The fade-out animation** (owner's stated requirement) | **(APPROVED) Option A — keep-alive + opacity merge.** Build the chart's point dataset from *every* plottable row once; never add/remove points on a threshold change. Out-of-threshold points get `itemStyle.opacity = 0` (and `symbolSize`→baseline) and the render pushes a **merge** `setOption(opt, false)` so ECharts tweens the opacity 1→0. Positions are unchanged, so the 018 A2 trailing concern (why `animationDurationUpdate:0`, charts.ts:318) does **not** apply — only the wheel/pan path keeps its instant `notMerge:true`; the filter/threshold path gets a short `animationDurationUpdate` (e.g. 350ms). Frontier/spread rebuilt from only the **visible** subset; axis bounds (`Bounds`, charts.ts) recomputed from visible points so the window doesn't hug invisible data. <br>**Option B — raise `animationDurationUpdate` globally:** simpler but regresses zoom/pan (018 A2's exact reason for 0). **Rejected.** <br>Scope: target the 2D "bubbles" the owner named (blend/in/out/speed panels). 3D fade is a stretch (scatter3D supports per-item `itemStyle.opacity`, config #468 — noted, not v1). |
| D5 | Unify with existing search/family/vision? | **(APPROVED) Unify:** make *all* filter predicates visibility-based (opacity) — search + family + vision also fade consistently (owner "recomended", 2026-09-19). `filterRows` (filters.ts:11) is replaced by a visibility flag over the kept-alive point set; no instant removal path remains. |
| D6 | Controls UI | New `ThresholdCtl.svelte` (sibling of `RatioCtl.svelte`) mounted in `nav.filters` (`App.svelte:101`): four native `<input type=range>` sliders — price-min, price-max, elo-min, speed-min — each with a live numeric readout + a reset (clear-to-unbounded) affordance. Slider bounds derived from data extents at boot (price on a log-ish scale to match the axis; elo/speed linear). Continuous drag → each tick re-renders → merge opacity update → bubbles fade as they cross the line (the desired feel). Mobile: the `nav.filters` flex-wrap already handles it. |
| D7 | Tests | Extend `filters.test.ts` with a pure `passThresholds(d, thr, ctx)` predicate (characterization, pinned values) — `filterRows` composes it additively with families/vision. Extend `urlstate.test.ts` for `thr` round-trip. The fade itself is the imperative seam → CDP probe + owner A/B (no vitest for the canvas). |

## Current state (evidence)

- Filters today: `filterRows(rows, {families, vision})` (filters.ts:11) + `searchHit`
  (filters.ts:23); applied inside the render functions at charts.ts:660 / 731 /
  952 and the 3D builder. The bubble set is rebuilt from `filterRows(...)` each
  render, so a filter change today = points **blink** out (notMerge setOption).
- Render trigger: `Panel.svelte:37` `$effect` re-runs `renderPanel/
  renderSpeedPanel/render3DPanel` on any tracked state read; `App.svelte:67`
  history effect lists the tracked reads (add `ui.thr.*`).
- Price axis value: `blendedPrice(d, ui.ratio)` (filters.ts:36); per-view
  prices inline in the builders (charts.ts:124, 126-129).
- Speed value: `speedOf(d.or_id, store.data)` (speed.ts:17) → `Speed.toks`
  (output tok/s p50). No per-row speed field on `Row` (types.ts:4) — the
  threshold must call `speedOf` (or precompute a `Map<or_id, Speed>` once per
  render, since `speedOf` is O(endpoints) and runs per-point already at
  charts.ts:67).
- `animationDurationUpdate:0` (charts.ts:318, 1147) is the 018 A2 zoom/pan
  anti-trailing guard; D4 keeps it for wheel/pan and uses a merge path only for
  filter changes.
- URL serializer: `urlstate.ts` (`read`/`write`, defaults omitted) — add `thr`.

## Steps (commit per step; owner stages each diff)

1. **Logic + state + URL.** `state.svelte.ts`: add `ui.thr`. `filters.ts`: add
   `passThresholds(d, thr, ctx)` (ctx = {ratio, mode, speedMap}) and compose it
   into `filterRows`. `urlstate.ts`: `thr` in/out of `read`/`write` (rounded,
   defaults omitted); `App.svelte:67` track `ui.thr.*`. No UI, no chart change
   yet. Commit: `chart: threshold predicate + url state`.
   ✅ **As-built (2026-09-19, committed 397b6e1):** as specced. Additions:
   `viewPrice(d, mode, ratio)` helper in filters.ts (blended/in/out switch,
   reused by step 2's slider bounds + step 3's builders); `ThrCtx.speed` typed
   structurally as `(orId) => { toks } | null` so tests need no full `Speed`;
   urlstate `thr` reads per-bound (invalid bound → null; no valid bound → no
   `thr` key on the URL), writes 2dp-rounded `pmin/pmax/emin/smin`; history
   `contSnap` includes `ui.thr` (continuous burst); `read` returns a complete
   `Thr` patch (absent bounds = null) so popstate apply is total. Tree was
   dirty at resume (staged 031 close + tools/refactor-bench) — owner chose to
   proceed anyway; those changes remain staged, unrelated to this step.
2. **Controls.** `ThresholdCtl.svelte` (price-min, price-max, elo-min, speed-min
   ranges + readouts + reset), bounds from data extents, mounted in
   `nav.filters` (`App.svelte`).    Wired to `ui.thr` (history debounce reuses the
   027 continuous-input path). Commit: `chart: threshold controls`.
   ✅ **As-built (2026-09-19, committed f51cbeb):** owner revised D6/D1
   mid-step: every bound is **double-sided** (Elo and speed gained max
   bounds; D1 expands to price min/max + Elo min/max + speed min/max, six
   bounds serialized as `pmin/pmax/emin/emax/smin/smax`), sliders are larger
   (170px), and every bound is directly editable via a numeric field
   (commit on change/Enter; empty/garbage → unbounded). Price min/max are
   two handles on one log line (fill between them); Elo/speed pairs are
   linear. Handles clamp at each other's position — the pair never crosses,
   by drag or by typed value; parking a handle at its unbounded end (min→0,
   max→T) clears that bound. Rows derive bounds reactively from data
   extents (price = active view's `viewPrice`, padded [lo/2, hi*2]; Elo
   linear; speed from endpoints, row disabled until the fetch settles);
   price row disables in the speed view (D2). A shared `dualRow` snippet
   renders all three rows. Tests: ThresholdCtl.test.ts (10, pinned from the
   extent math incl. cross-clamping), filters/urlstate extended for the
   max bounds. Suite 120 green, tsc + build clean.
3. **The fade (D4).** In the 2D builders, keep the full plottable point set;
   tag each with `visible`; render visible=false points at `opacity:0`/
   baseline `symbolSize`; on a threshold/filter change push a **merge**
   `setOption(opt, false)` with a short `animationDurationUpdate` so opacity
   tweens; recompute frontier/spread/bounds from the visible subset; wheel/pan
   keeps instant notMerge. (D5 unify: also drive search/family/vision via the
   same opacity flag if owner chose unify.) Commit: `chart: threshold
   fade-out animation`.
   ✅ **As-built (2026-09-19, committed d530313):** as specced for 2D +
   owner-directed 3D extension mid-review ("Not working on the 3d version").
   `filters.ts` gained `isVisible(d, f)` as the single visibility predicate
   (families + vision + thresholds; search stays a dim, 010); `filterRows`
   is now `rows.filter(isVisible)`. Both 2D builders (and, per the owner's
   live report, `build3DScene`) build a keep-alive point set tagged with
   `Pt.vis`; `chartPush` classifies renders by a per-panel geometry
   signature (ratio + spread + fetched_at): filter-only change → merge
   `setOption` with `animationDurationUpdate: 350` (the fade); geometry
   change → instant notMerge (018 A2 intact — wheel/pan never re-set
   options). Frontier/spread/bounds/count rebuild from the visible subset
   (supersedes 018 A1/A2's fit-to-all for the filter dimension). Ghost
   hygiene: hidden points render opacity 0 at rest AND emphasis, no
   tooltip, not clickable. 3D fade is INSTANT (echarts-gl has no opacity
   update tween; D4's tween was scoped to the 2D bubbles — noted to owner,
   not contested). CDP probes: `.tmp/probe_thr_fade.mjs` (2D, 11/11) and
   `.tmp/probe_thr_fade3d.mjs` (3D, 11/11) — keep-alive dataset constant,
   hidden counts, merge-path 350ms on 2D, axis refit, count, restore on
   clear, no console errors. Suite 120 green, tsc + build clean.
4. **Verify + ship.** `filters.test.ts` + `urlstate.test.ts` green; CDP probe
   confirms bubbles **fade** (not blink) as a slider crosses them and the
   frontier/counts track the visible set; cookie probe clean (no new storage);
   owner A/B feel-out; deploy (live == main).
   ✅ **As-built (2026-09-19, no code changes):** full JS suite 120 green
   (filters + urlstate included), tsc + build clean. CDP probes on `dist/`:
   `.tmp/probe_thr_fade.mjs` 11/11 (2D) and `.tmp/probe_thr_fade3d.mjs`
   11/11 (3D) — keep-alive dataset constant, hidden counts, 2D merge path
   350ms, axis refit to visible, counts follow, restore on clear, zero
   console errors. Cookie probe clean: zero cookies in the jar across
   desktop/curl/mobile UAs over `/` + every referenced asset; no
   cookie/localStorage/sessionStorage/IndexedDB anywhere in `src/` or
   `index.html`. Zoom/pan trailing unchanged (wheel/pan never re-set
   options; ratio slider asserted back on the instant path). Owner A/B
   approved ("great", 2026-09-19). Deploy NOT done at close — the push
   (and its CF auto-deploy) is owner-driven (Push policy); the live==main
   check happens on the owner's push.

## Out of scope

- 3D fade v1 (scatter3D per-item opacity) — stretch noted in D4, separate step
  if approved.
- Per-board Elo thresholds (009), benchmark-index thresholds (005).
- A fancy dual-thumb price slider component — two native ranges (D6) suffice.
- Persisted/sharable beyond the URL hash (027 already owns deep-link state).

## Definition of done

- [x] Owner approves D1–D7 (esp. D4 fade approach + D5 unify).
- [x] Dragging a threshold slider fades out the now-disqualified bubbles
      (opacity tween), frontier + counts follow the visible subset. — CDP
      probes 11/11 on 2D and 3D.
- [x] `thr` round-trips through the URL (deep-linkable, defaults omitted).
- [x] `filters.test.ts` + `urlstate.test.ts` green; cookie probe clean.
- [x] Zoom/pan trailing unchanged from 018 A2 (no regression). Owner A/B
      approved. Deploy: owner-driven push pending at archive time.

## Mid-execution owner revisions

- Step 2 (2026-09-19): every threshold double-sided (Elo/speed gained max
  bounds; `emax`/`smax` joined the URL serializer); sliders enlarged; each
  bound directly editable via a numeric field; min/max handles clamp on one
  line, never crossing.
- Step 3 (2026-09-19): the keep-alive fade extended to the 3D scene (owner
  report "Not working on the 3d version"); the 3D fade is instant —
  echarts-gl has no opacity update tween.
