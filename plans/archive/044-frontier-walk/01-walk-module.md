# Step 01 — Frontier-walk module + tests — ✅ COMPLETE (committed 2deeef1, 2026-10-03)

## As-built

- Module lives at `tests/frontier_walk.py`, imported by the tests as
  `from tests import frontier_walk` — a plain `import frontier_walk`
  does not resolve under the suite's dotted-name discovery (`tests/`
  is not on `sys.path`; py3 namespace-package form works, and matches
  how `python3 -m unittest tests.test_frontier_walk` addresses it).
- `speed_map` returns the flat `{or_id: toks}` the spec's seam list
  states, not update.py's `{p50_throughput, request_count}` bundle —
  the walk only needs tok/s; rc stays in the snapshot's own speed map.
- `load(*paths)` infers the file kind by shape (list → combined,
  dict-with-"rows" → snapshot, other dict → endpoint layer), so the CLI
  needs no per-file flags. Snapshot speed maps feed the `speed` field
  directly (already derived by update.py under the same rc≥30 rule).
- The hull pops on `cross >= 0`, so collinear points land in the
  unreachable set — they are only ever tied #1, never strictly
  reachable (documented in the docstring, pinned by a fixture test).
- Dogfood cross-check (A1/A3, 2026-10-03 data): module frontier = the
  same 9 points as the exploration probes (6 supported / 3 unreachable:
  mimo-v2.6-flash, gemma-4-31b-it, deepseek-v4-pro); speed spot-check
  against the actual `speed.ts` `speedOf` (scratch vitest probe, removed
  after the run) — glm-5.3-flash 41, gemini-3.8-flash 103.5,
  opus-4.6 38, identical on both sides.
- The class gates in the CLI (1450/1470/1500) are explicitly
  placeholders pending step 02's derivation; the library functions take
  gate as an argument and embed no constants (A5).
- 19 characterization tests; full suite 198 green.

## Spec

Create `tests/frontier_walk.py` (or a sibling module the tests import —
follow the existing `tests/` layout; if the suite currently only imports
`tests.test_*` modules, keep the library module next to them so discovery
stays simple) with pure, zero-dep functions operating on plain dicts:

1. `frontier(rows)` — 2-D price/Elo frontier over rows shaped
   `{"id", "price" (float, $/M out), "elo", "elo_lo", "elo_hi"}`; lower
   price wins, higher Elo wins; same dominance rule as `pareto.ts`
   (strict-better on at least one axis, worse on none); sorted price-asc.
   Rows with price 0/None or Elo 0/None are dropped before the walk.
2. `supported(front)` — upper convex hull of the frontier in
   (log10 price, elo); returns the subset of frontier points reachable as #1
   by SOME linear index `a·elo − b·log10(price)` (a,b>0), plus the
   complement: the points provably unreachable (the concave dips).
3. `walk(front)` — the frontier walk: consecutive frontier pairs; per step:
   price multiple (ratio), Elo gain (difference, interval-scale — never a
   ratio), tok/s delta, and `inside_ci: bool` — True when the two points'
   `[elo_lo, elo_hi]` intervals overlap, i.e. the "gain" is within noise.
4. `champions(rows, gate, direction)` — gate+direction selection (A2/A3):
   keep rows with `elo >= gate`, then pick the best by direction
   (`"min_price"` or `"max_speed"`). Speed per row comes precomputed by the
   caller using the `speed.ts` rule so the module stays endpoint-agnostic:
   median `p50_throughput` over endpoints with `request_count >= 30` and
   `p50_throughput` present; even/odd median exactly as `src/lib/format.ts`
   `median` does it.
5. `speed_map(endpoints)` — applies rule 4's derivation to the
   `endpoints.json` shape, returning `{"or_id": toks}`.
6. `load(paths...)` — thin readers for `combined.json`, `endpoints.json`
   and one `public/data/history/<stamp>.json` snapshot (same combined
   schema).
7. A `main()` printing the full report (walk table, supported set, champions
   for the three task classes, per-snapshot stability summary) — the CLI the
   step-02 report is generated from.

Class gates are **inputs** to `champions`/`main`, defined once in the CLI
with a comment that they are analysis parameters, not derived constants
(A5): the module itself must not embed them.

Create `tests/test_frontier_walk.py` — stdlib `unittest`, characterization
style, one class per function, one behavior per test; pin expected values
from actual output of hand-written minimal fixtures (synthetic, like the
existing suite; never real page/data snapshots).

Not touched in this step: `update.py`, anything under `src/`, the report
(step 02), any plan file other than this step's as-built updates.

## Verification

- `python3 -m unittest tests.test_frontier_walk -v` green.
- `python3 -m unittest discover -s tests -v` green (full suite unharmed).
- Cross-check against the site's own numbers on live data (dogfood, A1/A3
  agreement requirement): the module's frontier set on current
  `public/data/` equals the 9 points and the speed values match
  `speedOf`'s medians for a spot-checked sample of models
  (e.g. glm-5.3-flash, gemini-3.8-flash, claude-opus-4.6) — record the
  spot-check in the as-built.

## Seams under test

- `tests/frontier_walk.py` public functions: `frontier`, `supported`,
  `walk`, `champions`, `speed_map`. The tests exercise only these
  boundaries plus the fixture loaders.
