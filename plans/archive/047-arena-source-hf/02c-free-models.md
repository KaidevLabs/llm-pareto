# Step 02c — Free models on the log price axis — ✅ COMPLETE (committed 8ca9b9c, 2026-11-11)

> Runs after `02-failure-alert.md` and **before** `02b-schema-drift.md`: the
> pipeline has been red since 2026-11-09 18:19 UTC, so no run reaches the
> write step, and 02b's fingerprint baseline needs exactly such a run.

## Why

`update.py` dies in `validate_provider_layer` (line ~896) on real data:

```
ERROR: provider: thinkingmachines/inkling-2-small:free: Thinking Machines:
prompt price not > 0: '0'
```

The invariant was written for corruption (`a strict > 0 prompt price`), but
Thinking Machines serves a genuinely free endpoint, and that model is the only
representation of the arena row of the same name, so it joins. Nine
consecutive runs have been red since; `public/data` is frozen at `e70dde0`
(2026-11-09 12:26).

The 0 itself is not the problem — free is real, and the owner wants free
models **on the graph** (2026-11-11). The problem is the price axis: it is
`log10`, and `log10(0) = -∞`. Today `fitLog` silently filters `v > 0`
(`pareto.ts:17`), so a free row would drop out of the 2D bounds and sit at
`-Infinity` in the 3D scene; `trailDots3D` already skips `price <= 0`
outright. Every price consumer assumes a positive number.

## Decisions (settled 2026-11-11)

| # | decision | rationale |
|---|----------|-----------|
| 1 | The data keeps the truth: `price_in_per_m: 0` stays 0 in `openrouter.json` / `combined.json`. `fmtPrice(0)` already prints `$0`. | No clamping, no epsilon, no fabricated price — 047 decision #5's rule. |
| 2 | On the chart, a free model is drawn at a **free lane**: half the cheapest positive price of the whole dataset in that panel's view. All free models share that x. | One octave below the cheapest paid is a visible gap on a log axis (~0.3 decade) with no empty decades, unlike a fixed floor (`$0.0001` would stretch today's axis by ~1.8 decades below the $0.006 cheapest). Computed from the whole dataset, not the filtered view, so the lane does not move while filtering. It also equals the price slider's existing left end (`lo / 2` in `ThresholdCtl`), so the two agree by construction. |
| 3 | The lane's tick reads **"free"**, never a made-up price. Tooltips, Details and the comparator keep `$0`. | The axis compresses; the value does not. |
| 4 | Free models are ordinary rows everywhere else: the Pareto frontier (they are non-dominated by definition — among several free ones the highest Elo wins), the price threshold sliders (compared at their drawn position), search, details, history. | Zero special cases outside the one coordinate mapping. |
| 5 | `update.py`'s invariant becomes **negative** price is corruption; zero is a normal value and is counted in the provider report. | Keeps the tripwire for real anomalies while accepting the value upstream actually sends. Same shape as 01b's fix. |

## Spec — `update.py`

1. `validate_provider_layer` (line ~896): `float(price) <= 0` → `float(price) < 0`.
   Update the docstring line that says the price check guards anomalies.
2. Count free endpoint entries while walking the layer: in
   `build_provider_layer`'s report dict add `"free_entries": 0`, incremented
   where an entry's prompt price is `0`; the main() print gains
   `, {n} free` after `with stats)`.
3. `priced` (line ~1645) already counts `price_in_per_m is not None`, so 0
   counts as priced — no change, but a test pins it.

## Spec — `src/lib/filters.ts` (the price seam)

```ts
// Free models are drawn one octave below the cheapest paid price of the
// whole dataset in this view (047 step 02c): log10(0) has no place on the
// price axis, and the lane is where a free model actually sits — cheapest
// possible — without inventing a price. Half the cheapest positive is also
// what ThresholdCtl's price extent already uses as its left end.
export function freeLane(rows: Row[], mode: Mode | "3d", ratio: number): number {
  let lo = Infinity;
  for (const d of rows) {
    const p = viewPrice(d, mode, ratio);
    if (p != null && p > 0 && p < lo) lo = p;
  }
  return lo === Infinity ? 1 : lo / 2;
}

// The x coordinate a price is drawn at.
export function priceX(p: number | null, lane: number): number | null {
  if (p == null) return null;
  return p > 0 ? p : lane;
}
```

`ThrCtx` gains `lane: number`; `passThresholds` compares the drawn position:

```ts
const p = viewPrice(d, ctx.mode, ctx.ratio);
if (p == null) return false;
const pos = p > 0 ? p : ctx.lane;
if (thr.priceMin != null && pos < thr.priceMin) return false;
if (thr.priceMax != null && pos > thr.priceMax) return false;
```

so a min handle parked at the slider's left end (`null`) or sitting on the
lane includes free models, and raising it excludes them — which is what the
slider shows.

## Spec — `src/lib/charts.ts`

1. `renderPanel`: `const lane = freeLane(store.data.rows, panelKey, ui.ratio);`
   → `pointsFor(getPrice, frameRows(), lane)`, `f.thrCtx.lane = lane`, and
   `xvals` maps through `priceX(p, lane)` for the fit.
2. `pointsFor(..., lane)`: `const p = priceX(getPrice(d), lane);` before the
   null check; `value: [p, d.arena_elo!]`. `skipped` semantics unchanged.
3. `chartOption`: the price panels pass
   `xFmt = (v) => Math.abs(v - lane) / lane < 0.02 ? "free" : fmtPrice(v)`
   instead of the default price formatter; the speed panel keeps its own.
4. 3D: `render3DPanel` (`Math.log10(price)` at ~line 1216) and
   `trailDots3D` (~line 128, which currently drops `price <= 0`) both map
   through `priceX(price, lane)` before `Math.log10`, so free spheres sit on
   the lane and trails show them.
5. `spreadPts`: unchanged — the `> 0` guard already means a free model draws
   no in/out bar (there is no spread to draw).

`ThresholdCtl.svelte`: no change — its price extent already ignores
`p <= 0` and uses `lo / 2`, the same value as the lane.

## Tests

Python (`tests/test_provider_validate.py`), one behaviour each, written first:

- a zero prompt price passes validation (no `SystemExit`), and the report
  counts it as free;
- a negative prompt price still dies with `prompt price not < 0`;
- `priced` counts a 0-priced model as priced.

JS (`src/lib/filters.test.ts`):

- `freeLane` returns half the cheapest positive price in the view;
- `freeLane` falls back to `1` when no row has a positive price;
- `priceX(0, lane) === lane`, `priceX(0.5, lane) === 0.5`, `priceX(null, lane) === null`;
- `passThresholds` keeps a free row when `priceMin` is parked or equals the
  lane, drops it when `priceMin` is above the lane.

Existing `ThrCtx` fixtures across the suites gain `lane`.

## Verification

```sh
python3 -m unittest discover -s tests -v      # green
python3 update.py                             # green, reaches the writes
npm test && npx tsc --noEmit && npm run build
```

`update.py`'s report must show `, N free` in the provider line and
`join: 156 models matched` (the free model now survives to `combined.json`,
155–157 rows depending on the day's arena names). Review `public/data` in the
usual order — `meta.json` first.

Browser probe (`.tmp/`, not committed): free rows draw on the lane, the lane
tick reads `free`, the tooltip says `$0`, the frontier still picks the best
model, and the price slider's left end includes free models. Then commit the
data through the normal flow.

## Not touched in this step

02b's fingerprint, the speed view's axis, the table/details layouts,
`urlstate` (no new state), `meta.json`'s shape.

## Seams under test

`filters.ts` (`freeLane`, `priceX`, `passThresholds`) and `update.py`'s
provider validation — both pure. The chart wiring is verified by the probe,
as the echarts seam always is.
