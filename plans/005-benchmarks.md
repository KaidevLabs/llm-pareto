# 005 — Benchmarks: Epoch AI data + benchmark filter

Date: 2026-09-16. **Status: PROPOSED — not reviewed, not executed.**
Source: `plans/002-exploration-backlog.md` item B2 + its exploration findings.

Add benchmark data to the data layer (Epoch AI as the single v1 source) and
expose it in the site: enriched tooltips + a benchmark picker with a score
threshold in the filter bar.

## Proposed decisions (settled at owner review)

| # | decision | rationale |
|---|----------|-----------|
| D1 | v1 source: Epoch AI `https://epoch.ai/data/benchmark_data.zip` only | Measured: 121/154 joined models covered (79%), 85 benchmarks (GPQA, FrontierMath, AIME, ARC-AGI, SWE-bench Verified, Terminal-Bench, HLE, …), latest eval 2026-09-03, daily-updated, CC-BY, one stdlib fetch. Runners-up measured and cut: LiveBench 43/154 + ~3 months stale + format-change risk (v2 candidate); SWE-bench 8/154, ~7 months behind the frontier; BFCL 33/154, ~9 months stale; aider/BigCode/HF/Helm/AA/Vals cut (full table in the 002 findings) |
| D2 | Storage: new committed `public/data/benchmarks.json` keyed by `or_id` — `combined.json` untouched | Keeps `combined.json` stable for 009's per-board dimension; the client does a plain lookup |
| D3 | Effort variants (`_high`/`_xhigh`/`_max`/`_none`…): store the max score per model×benchmark | v1 simplicity — one number per benchmark in tooltips/filters; a variant picker is v2 |
| D4 | UI v1: (a) tooltip enrichment (top 4–6 available benchmark scores with benchmark name) + (b) benchmark picker + threshold slider in the filter bar. Y-axis swap (Elo → benchmark score) deferred | The filter is the item's ask; the y-axis swap changes what "frontier" means and should wait for 009's per-board semantics |
| D5 | Models with no score on the selected benchmark are hidden while the threshold filter is active; tooltip shows "—" otherwise | Consistent with the hard-filter language (vision filter, 004) |
| D6 | Join: reuse `update.py`'s normalizer with `_`→`-` + a per-source suffix strip (`-effort`, `-thinking`, `\d+k`, date tails); a `benchmarks-overrides.json` at repo root (same convention as `overrides.json`) for the ~33 misses; unmatched model versions printed in the match report | The same auditable-join culture as arena→OR; frontier names are covered, the misses are mostly non-frontier |
| D7 | Validation (fail-fast, `update.py` style): row band 5k–50k; ≥60 benchmarks; per-benchmark row floor ≥3; join coverage ≥70% of the combined set; per-score sanity vs metadata `random_baseline ≤ score ≤ score_ceiling`; freshness: max `Release date` ≤ 90 days old | Mirrors the existing fail-fast block; the zip is the sole benchmark source, so a broken fetch fails the run like arena/OR do |
| D8 | Attribution: footer credit line ("Benchmarks: Epoch AI, CC-BY") + per-benchmark source field in tooltips | CC-BY obligation, measured cost ~one line |

## Steps (commit per step; owner stages each diff)

1. update.py: fetch the zip, parse the 85 benchmark CSVs + metadata, normalize
   identifiers, join (D6), validate (D7) → `benchmarks.json` + `meta.json`
   section + match-report lines (per-benchmark counts, unmatched list). Run;
   review report + data diff.
   Commit: `data: Epoch AI benchmarks (benchmarks.json)`
2. app.js + index.html: third fetch in `main()`; tooltip enrichment (D4a).
   Commit: `chart: benchmark scores in tooltip`
3. app.js + index.html: benchmark picker + threshold slider (D4b); hard-hide
   (D5); composes as a conjunction in `filtered()` with 004's controls.
   Commit: `chart: benchmark picker + threshold filter`

## Out of scope

- LiveBench / SWE-bench / BFCL ingestion (v2), y-axis swap, per-category
  sub-boards (009), OR's syndicated `benchmarks` object (owned here only as a
  v2 source candidate if the owner wants an Epoch vs OR-syndicated comparison).

## Definition of done

- [ ] Owner approves this plan (D1–D8).
- [ ] `python3 update.py` fetches, joins, and validates benchmarks; prints a
      per-benchmark match report; exits non-zero on anomaly.
- [ ] Tooltips show per-model benchmark scores.
- [ ] Benchmark filter (benchmark + threshold) works fully client-side and
      composes with the existing filters.
- [ ] Footer shows the benchmark data timestamp + CC-BY credit.
- [ ] Deployed per A10.
