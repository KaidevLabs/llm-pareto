# Step 01b — Provider stats after OpenRouter's percentile flip — OPEN

> Runs immediately after `01-hf-source.md`: it restores the green end-to-end
> run that step 01's outstanding verification item depends on. It touches the
> provider layer, not the arena source.

## Why

OpenRouter changed the `endpointStats` block of the model page between the
Oct-13 snapshot and Oct-24, in two ways, both verified against the live
payloads:

1. **Throughput percentiles inverted.** Oct-13 (`endpoints.json`, model
   `anthropic/claude-fable-5`, provider Amazon Bedrock):
   `p50..p99 = 47, 55, 70, 77, 87.5` — ascending. Oct-24, same model family:
   `58, 40, 25.2, 23, 18` — descending. Measured across the whole layer:
   **856 of 858** endpoints with throughput stats now descend, none mixed;
   latency percentiles still ascend. Reading: both metrics are now
   distributions *over requests* (p99 = the slowest 1%), which is coherent —
   the old ascending throughput was the odd one out.
2. **`throughput_window_minutes` appeared**, absent from the Oct-13 file:
   30 min on 723 endpoints, 1440 min on 137, absent on 12. Latency's
   `window_minutes` is 30 everywhere.

`validate_provider_layer`'s monotonicity tripwire (plan 022) assumed
ascending and now dies on the first endpoint in sorted order:

```
ERROR: provider: anthropic/claude-fable-5: Claude Platform on AWS: throughput percentiles not monotonic: [58, 40, 25.2, 23, 18]
```

Everything else in the layer is healthy (measured): join hit rate 939/939 =
100 %, stats coverage 156/163 models = 96 %, no zero-endpoint model, no
non-positive prompt price, latency percentiles monotone.

Latent wart this exposes: `speedOf()`'s eligibility floor is
`request_count >= 30`, but `request_count` counts *latency* samples (it equals
`latency_request_count`: 3 and 10 on that endpoint) while the throughput
median comes from `throughput_request_count` (1803, 2354). Same on Oct-13
(rc 28 vs trc 751) — the floor never matched the number it guards.

## Settled decisions (owner, 2026-10-24)

| D# | decision | rationale |
|----|----------|-----------|
| 1 | The percentile tripwire accepts a series monotone in **either** direction and dies on a mixed one. | Keeps drift detection; the flip is upstream semantics, not corrupt data. |
| 2 | The site's speed stays the **median `p50_throughput`** (t/s); the higher percentiles now mean "slow tail" and nothing in `src/` reads them. | No UI semantics change; p50 is a median in both eras. |
| 3 | The eligibility floor and the summed basis move from `request_count` to **`throughput_request_count`**. | The floor finally describes the sample the median comes from. Effect: 162/163 models keep a speed, 5 gain one, 36 numbers move slightly (gpt-5.6-terra 71→84, claude-sonnet-4.6 50→58). |
| 4 | `throughput_window_minutes` is **stored, not filtered on**. | No model loses its speed; filtering to 30-min-only would cost 16 models their speed and move 47 numbers. The 30-min/24-h mix is documented instead. |
| 5 | Storage keeps `p50..p99` as received plus the window field. | Dropping the unused tail saves 180 KB of 2.12 MB and loses the slow-tail data. |
| 6 | `Details.svelte`'s copy of the speed rule is folded into `speed.ts` (`speedEligible`, `SPEED_MIN_REQUESTS`). | Two copies of the floor would drift the moment its field changes. |

## Spec — `update.py`

1. **`_STATS_KEYS`** (near `speed_map`, plan 022 D4): append
   `"throughput_window_minutes"` as the last entry, and replace the comment
   above the tuple with:

   ```python
   # speed stats kept per endpoint (plan 022, D4; plan 047 step 01b): values as
   # received. Latency percentiles ascend (p99 = slow tail); throughput
   # percentiles run the other way since ~2026-10-13 (p50 = the fastest
   # typical rate, p99 = slow tail) — the site reads p50 only. Two windows,
   # per endpoint: window_minutes (latency, always 30) and
   # throughput_window_minutes (30 or 1440).
   ```

2. **`validate_provider_layer`** — the percentile block currently reads:

   ```python
               for metric in ("latency", "throughput"):
                   present = [
                       s.get(f"p{q}_{metric}")
                       for q in (50, 75, 90, 95, 99)
                       if s.get(f"p{q}_{metric}") is not None
                   ]
                   if any(a > b for a, b in zip(present, present[1:])):
                       die(
                           f"provider: {or_id}: {e.get('provider')}: "
                           f"{metric} percentiles not monotonic: {present}"
                       )
   ```

   Replace the `if` with a mixed-direction test:

   ```python
                   steps = [a - b for a, b in zip(present, present[1:])]
                   if any(s > 0 for s in steps) and any(s < 0 for s in steps):
                       die(
                           f"provider: {or_id}: {e.get('provider')}: "
                           f"{metric} percentiles not monotone: {present}"
                       )
   ```

   Extend the function docstring with one sentence: `A percentile series may
   run either way (047 step 01b: throughput now descends); a series that turns
   is the drift this dies on.`

3. **`speed_map`** — the floor and the sum move to the throughput sample:

   ```python
               t = s.get("p50_throughput")
               c = s.get("throughput_request_count") or 0
   ```

   and the stored key becomes `"throughput_request_count"`:

   ```python
           if vals:
               out[or_id] = {
                   "p50_throughput": statistics.median(vals),
                   "throughput_request_count": rc,
               }
   ```

   Docstring: replace `plus their summed request_count` with `plus their
   summed throughput_request_count (the sample behind the p50 — 047 step 01b)`.

## Spec — front end

4. **`src/lib/types.ts`** — `EndpointStats` gains the fields the stats block
   now carries, with the semantics stated once:

   ```ts
   // Throughput percentiles run high -> low (p50 = fastest typical rate,
   // p99 = slow tail); latency percentiles ascend. The site reads p50 only.
   export type EndpointStats = {
     [k in `${Pct}_throughput` | `${Pct}_latency`]: number;
   } & {
     /** latency samples (latency window minutes, always 30). */
     request_count: number;
     window_minutes?: number;
     latency_request_count?: number;
     /** samples behind the throughput percentiles — the speed floor. */
     throughput_request_count?: number;
     /** throughput window in minutes: 30 or 1440, mixed across endpoints. */
     throughput_window_minutes?: number;
   };
   ```

5. **`src/lib/speed.ts`** — this file becomes the single owner of the rule:

   ```ts
   export const SPEED_MIN_REQUESTS = 30;

   export function speedEligible(e: Endpoint): boolean {
     return (
       !!e.stats &&
       e.stats.p50_throughput > 0 &&
       (e.stats.throughput_request_count || 0) >= SPEED_MIN_REQUESTS
     );
   }
   ```

   `speedOf` filters with `.filter(speedEligible)` and its `rc` becomes
   `use.reduce((s, e) => s + (e.stats!.throughput_request_count || 0), 0)`.
   Update the header comment: the floor is the *throughput* sample
   (`request_count` counts latency samples only — 047 step 01b), and the basis
   travels with the value as before.

6. **`src/components/Details.svelte`** — replace the local `use` derivation
   (currently `eps.filter((e) => e.stats && e.stats.p50_throughput > 0 &&
   (e.stats.request_count || 0) >= 30)`) with `eps.filter(speedEligible)`
   (import `speedEligible` from `../lib/speed`), sum
   `throughput_request_count` in the basis line, and take the window from
   `throughput_window_minutes`, honest when a model's endpoints disagree:

   ```ts
   const windows = $derived(
     [...new Set(use.map((e) => e.stats!.throughput_window_minutes ?? 30))]
       .sort((a, b) => a - b)
   );
   ```

   Basis string keeps its `(rc≥30)` label and becomes
   `... + " requests · " + (windows.length === 1 ? windows[0] : windows.join("/")) + "-min window"`.

7. **`src/lib/snapshots.svelte.ts`** — `SnapSpeed` becomes
   `{ p50_throughput: number; throughput_request_count: number }`; update its
   comment. Older snapshot files keep their `request_count` key (nothing reads
   it — verify with a grep before committing: the only reader is
   `.p50_throughput`).

8. **`tests/frontier_walk.py`** — its `speed_map` mirrors the rule over
   `endpoints.json`: switch the floor field to `throughput_request_count` and
   update its docstring.

## Tests

Adjust-expected (red until the logic lands — these are the review signal):

- `tests/test_provider_normalize.py`: the `_STATS_KEYS` expectation list
  (line ~16) gains `"throughput_window_minutes"`; the two stats fixtures
  (lines ~35, ~290) gain `"throughput_window_minutes": 30`.
- `tests/test_provider_validate.py`: the `stats()` helper gains
  `throughput_window_minutes: 30`; keep
  `test_non_monotonic_latency_percentiles_die` (a *mixed* latency series still
  dies); add `test_descending_throughput_percentiles_pass` (the real shape:
  `50, 40, 30, 20, 10`) and `test_mixed_latency_percentiles_die` is covered by
  the existing one — leave it as is.
- `tests/test_history.py`: `speed_map` fixtures move `request_count` →
  `throughput_request_count` and the expected maps carry the new key; add one
  test that an endpoint with a large `request_count` but
  `throughput_request_count < 30` is excluded.
- `src/lib/speed.test.ts`: fixture `ep()` gains
  `throughput_request_count`; add one test pinning that the floor reads it (an
  endpoint with `request_count: 5000, throughput_request_count: 20` is
  excluded; one with `request_count: 2, throughput_request_count: 500` is
  included). Re-pin every expected number from the code's actual output.
- `src/components/Details.test.ts`: the endpoint fixture gains
  `throughput_request_count: 1200` and `throughput_window_minutes: 30`; the
  pinned basis string stays `across 1 endpoint (rc≥30) · 1200 requests ·
  30-min window`.
- `src/lib/snapshots.test.ts`, `src/lib/trails.test.ts`,
  `src/components/ThresholdCtl.test.ts`: `speed` / `stats` fixtures rename
  `request_count` → `throughput_request_count` where they model the *speed*
  map, and stats fixtures gain `throughput_request_count` where the type
  requires it.

## Not touched in this step

`MATCH_*` / provider coverage floors (`MODELS_WITH_STATS_*`,
`JOIN_HIT_RATE_MIN`), the fetch layer, the RSC parsing, `endpoints.json`'s
entry shape outside `stats`, `meta.json`'s provider block, the chart seam, the
workflow.

## Verification

```sh
python3 -m unittest discover -s tests -v      # green
npm test                                      # green
npx tsc --noEmit                              # clean
python3 update.py                             # exit 0, no monotonic die
```

Passing `update.py`: `arena: ~418 entries`, join ~163 models, top-20 19/20 or
better, `provider layer: 163 models … 858+ endpoints with stats`, and the run
writes everything. Then:

```sh
python3 -c "import json;d=json.load(open('public/data/endpoints.json'));s=next(e['stats'] for v in d.values() for e in v if isinstance(e.get('stats'),dict));print(sorted(s));print(sum(1 for v in d.values() for e in v if isinstance(e.get('stats'),dict)))"
```

- the stats keys include `throughput_window_minutes`;
- no endpoint has a *mixed* direction series (spot-check the failing one):
  `python3 -c "import json;d=json.load(open('public/data/endpoints.json'));print([e['stats'] for e in d['anthropic/claude-fable-5'] if e.get('stats')][:2])"`
- the newest history snapshot's `speed` map carries `throughput_request_count`
  and no `request_count`.

## Seams under test

`validate_provider_layer`'s percentile rule, `speed_map`'s floor, `speedOf` /
`speedEligible` (js), the Details basis string — pure functions on both sides.
