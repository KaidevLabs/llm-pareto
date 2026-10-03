# Plan 044 — Frontier walk: objective model selection without a static score

> **Status:** OWNER REVIEW

## Goal

Replace the idea of "one static index that names the best model for any task"
with an objective, reproducible analysis built on what the data can actually
support:

1. the **frontier walk** — walk the Pareto frontier step by step and publish
   each step's *local exchange rate* (how much Elo the next step buys, per
   price multiple, per speed gain), with honesty about which steps sit inside
   the Elo confidence interval (i.e. are statistically indistinguishable);
2. the **supported set** — which frontier points a linear score can reach
   (#1 for some weights) and which it provably cannot (the concave dips);
3. **task classes as gate + direction** — speed-critical, batch-cheap,
   frontier-quality: each class is a hard Elo floor plus an optimization
   direction (min price / max speed), never a weight vector, so no
   exchange-rate smuggling; each class names its champion(s) on current data;
4. **stability across time** — the same walk recomputed over the
   `public/data/history/` snapshots, so we know how much any of this moves
   per refresh.

Deliverable: a python module + tests in the repo's stdlib suite, plus a
complete findings report in `docs/reports/044-frontier-walk.md`. No site/UI
changes in this plan — this is analysis first; any UI surface graduates into
its own plan only if the report convinces the owner.

## Settled decisions

| # | decision | rationale | date |
|---|---|---|---|
| A1 | The frontier is the object; a single static score is **rejected** as the primary answer | Linear scalarization provably cannot rank #1 the non-supported frontier points — measured on current data: 3 of 9 frontier points unreachable (gemma-4-31b-it, mimo-v2.6-flash, deepseek-v4-pro); the concave-dip theorem, confirmed by our own data | 2026-10-03 |
| A2 | Task profiles are **gate + direction** (lexicographic), not weight vectors | Weights are an unstated exchange rate (a currency) that the data cannot supply; "must be ≥ Elo X, then cheapest/fastest" is how selection is actually stated and needs no currency. A weight vector enters only for a class that genuinely needs trading *inside* the gate — none yet | 2026-10-03 |
| A3 | Speed-first classes are **not** "speed at all costs" — the Elo gate is the objective constraint; within it the direction is max tok/s per the endpoint-derived speed (p50-throughput median, rc>=30 rule, same as `speed.ts`) | Owner explicitly rejected the "skip weights / speed at all costs" simplification; the gate+direction construction *is* the more-or-less objective way requested | 2026-10-03 |
| A4 | The frontier walk (per-step marginal rates) is the human-answerable framing | A profile states "steps beyond 9x per +35 Elo are not worth it" instead of an abstract weight; handles the curve's roughness natively instead of smoothing it with one global tangent | 2026-10-03 |
| A5 | Everything is derived from the sources inside the analysis code — no hand-curated constants (rule #504) | Groupings/thresholds that cannot be derived unambiguously are reported as ambiguous, not hardcoded | 2026-10-03 |
| A6 | Elo is treated as interval-scale (differences meaningful, ratios not); price and speed as ratio-scale (log transforms valid) | Mixing linear-Elo with log-price inside one linear index is geometrically inconsistent; the walk reports rates as "Elo points per price multiple", never a global linear blend | 2026-10-03 |
| A7 | Analysis only in this plan; site integration parked | No UI churn before the report convinces the owner; the analysis must first prove it survives data refreshes | 2026-10-03 |

## Current state

- `public/data/combined.json`: 161 joined models with `arena_elo`,
  `arena_elo_upper/lower` (the CI), `price_in/out_per_m` (string-stable,
  #466 — parse as float).
- `public/data/endpoints.json`: per-model endpoint stats;
  `src/lib/speed.ts` owns the canonical speed derivation (median
  `p50_throughput` over endpoints with `request_count >= 30`); the walk
  module must reproduce that rule exactly so its numbers agree with the site.
- `public/data/history/`: 19 timestamped snapshot files
  (`20260916T…json`) carrying the same combined payload over ~17 days —
  the stability probe's corpus.
- Probes already run (scratch, `.tmp/probe2.py`/`probe3.py`, 2026-10-03):
  2-D frontier = 9 points; upper-hull supported = 6/9; 3-objective frontier
  = 32 of 151 plottable; 6 weight vectors -> only 3 distinct winners at the
  top of the frontier (top cluster is Elo-noise-tied).
- Python suite: stdlib `unittest`, zero-dep, run from repo root
  (`python3 -m unittest discover -s tests -v`); characterization style
  (AGENTS.md Testing).

## Design

- **Step 01** builds the walk module: pure functions (frontier, convex hull /
  supported set, per-step marginal rates with CI-overlap flags, gate+direction
  champion selection, per-snapshot stability) over plain dicts, zero deps;
  `tests/test_frontier_walk.py` characterizes them; a small CLI prints the
  full report from the live `public/data/`.
- **Step 02** runs the module on current data + the 19 snapshots and writes
  `docs/reports/044-frontier-walk.md`: the walk table, the supported set, the
  task-class champions, the stability findings, and the open questions that
  graduate into a future UI plan.
- **Step 03** closes: full suite, definition-of-done audit, archive.

## Execution order

| Step | File | Depends on | Status | Commit |
|---|---|---|---|---|
| 01 | `01-walk-module.md` | — | OPEN | — |
| 02 | `02-report.md` | 01 | OPEN | — |
| 03 | `03-close.md` | 02 | OPEN | — |

## Definition of done

- [ ] `frontier_walk` module + `tests/test_frontier_walk.py` green in
      `python3 -m unittest discover -s tests -v`.
- [ ] The module's frontier/speed numbers agree with the site's
      (`pareto.ts` frontier logic, `speed.ts` rc>=30 median rule) on current
      data — same 9 frontier points, same toks/s values.
- [ ] Report published at `docs/reports/044-frontier-walk.md` with: walk
      table (per-step Elo gain / price multiple / tok/s delta / CI flag),
      supported vs unsupported set, champions for the three task classes,
      stability summary across the 19 snapshots.
- [ ] No hand-curated constants: class Elo gates come from the report's
      own derivation and are labeled as inputs, not as code constants.
- [ ] No site/front-end changes.

## Not yet specified

- Whether the walk should eventually render in the explorer (e.g. the
  drawer's "next step up costs X") — graduates into a UI plan only if the
  report justifies it.
- Whether additional task classes beyond the initial three earn their place
  (the report proposes; the owner disposes).

## Open branches

- **Revealed preference (fitting weights from past choices)** — parked: needs
  a history of the owner's own model choices, which does not exist as data
  yet. Would be revisited if the owner starts logging picks.
- **Per-board fronts (the 11 arena boards as task-conditioned Elo)** —
  parked: data for non-text boards is not currently fetched by `update.py`
  (#354); a future data plan would unlock task-class Elo per board. The
  report should note which classes it *cannot* compute today for this reason.

## Out of scope

- Any change to `update.py`, the site, or the data pipeline.
- A production "index" or score column anywhere in the UI.
- Converting time to money (latency/throughput x workload pricing) — the
  "time is money" conversion is acknowledged but deferred; classes stay
  gate+direction.
- Scraping non-text arena boards.

## Executor rules

- Zero-dep python only (stdlib), PEP 8 by hand, no formatter configured.
- Tests are characterization: pin expected values from actual module output;
  a red test after a logic change is a review signal (AGENTS.md).
- Scratch/probe scripts live in `.tmp/` and are never committed.
- Verification per step: `python3 -m unittest discover -s tests -v` green
  before close; no push at step close (Push policy — commits only).
