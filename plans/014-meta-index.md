# 014 — Custom cross-index (weighted meta index)

Date: 2026-09-16. **Status: PROPOSED — not reviewed, not executed.**
Source: `plans/archive/003-exploration-backlog.md` item B11 + its exploration findings.

An owner-weighted composite index over the available quality components
(arena Elo + OpenRouter-syndicated benchmarks), computed in the data layer from
a committed recipe, displayed as a second panel mode. v1 uses components
available at zero new fetches; Epoch (005) and per-board Elo (009) join the
recipe later.

## Proposed decisions (settled at owner review)

| # | decision | rationale |
|---|----------|-----------|
| D1 | A committed recipe config (`index-recipe.json`): component list, source fields, normalization, weight, missing-policy; `update.py` computes the index per model → one scalar (+ per-component breakdown) in `combined.json`; the recipe version lands in `meta.json` | deterministic, diffable, fail-fast-able (coverage bands); the same culture as `overrides.json` (003 B11 findings) |
| D2 | v1 components: text Elo (anchor, 154/154) + AA intelligence/coding/agentic + design-arena web-design category mean — all from the OR `benchmarks` object, zero new fetches | measured coverage: AA-coding 91, AA-int 65, AA-ag 66, design-arena 87/154; the full 5-component intersection is 46/154 (003 B11 measured) |
| D3 | Normalization: rank-percentile within the 154 joined models, per component, at update time, over the models that carry that component | robust to the measured scale/outlier problem (coding 2.7 vs p50 49.3; design-arena range 667; per-board Elo scales not comparable — 003 B11 options); min-max changed mid-pack ordering in the measured sample; z-score adds nothing |
| D4 | Missing-component policy: partial mean over available components + an "n/N components" badge in the tooltip | require-all would define the index on 46/154 and even penalize the anchor's own top-10 (measured: Opus 4.6/4.7 and Muse Spark 1.3 lack AA indices); the partial mean with a badge is honest (003 B11 options) |
| D5 | Equal weights, single recipe, for v1; presets (quality/coding/agentic weight vectors) later | v1 keeps one committed number; presets are cheap once the recipe shape exists (003 B11 options) |
| D6 | Display: a new "meta" panel mode (y = meta score, x = price), reusing `state.mode` / `renderPanel`; `paretoFrontier` recomputes over (price, meta) — a second, documented frontier concept | the frontier function is axis-agnostic (app.js:99); the meta score is global (data layer) so 004-style filters re-render without re-deriving the index (003 B11 display options) |

Evidence (compressed; full measured tables in the 003 findings): the component
inventory (coverages + scales); a measured 5-component equal-weight sample
index over the 46-model intersection: Spearman 0.895 (min-max) / 0.908
(percentile) vs text Elo, top-10 overlap 7/10, identical top set across both
normalizations; every divergence is explainable per component (Grok 4.6: arena
#27 → meta #6 on AA coding 76.8 / agentic 53.4). Conclusion: with today's
components the meta index re-orders the mid-pack, not the frontier — Epoch
(121/154) and per-board Elo (108/154) are the frontier-moving components and
are not yet in the data layer.

## Open questions (settled at the examination session)

1. D4 missing policy: partial mean + badge (proposed) vs require-all with the
   index defined on 46/154 — measured sizes are in the evidence.
2. `design_arena` `agents` entries (39/154, strictly additive over `models`):
   in the v1 recipe or not.
3. Percentile population semantics: models that leave the join repercentile
   everyone — accepted, or snapshot the population in `meta.json`?
4. When 005 lands: which Epoch benchmarks enter the recipe — all 85, a curated
   shortlist, or `in_eci` only (002 B2 open question 1 also applies).

## Steps (commit per step; owner stages each diff)

1. 008 prerequisite: the OR `benchmarks` object is carried through `update.py`
   into the data layer (002 B5's one-line carry-through) if not already.
   Commit: `data: carry through OR benchmarks`
2. `index-recipe.json` (v1, D2/D5) + `update.py`: per-component extraction,
   percentile normalization (D3), composite + per-component breakdown into
   `combined.json`, coverage-band validation (die if a component's coverage
   drops >20 % in one run), recipe version in `meta.json` (D1/D4).
   Verification: `python3 update.py` green; diff review; counts match the
   measured coverages (91/65/66/87, intersection 46).
   Commit: `data: meta index (recipe v1, equal weights, percentile)`
3. app.js: the "meta" panel mode (D6) — axis, frontier, tooltip with the
   "n/N components" badge. Commit: `chart: meta panel mode`
4. B3 panel (006, if landed): the per-component breakdown; otherwise tooltip
   only. Commit: `chart: meta score breakdown`
5. Later (gated on 005/009): Epoch + per-board components into the recipe.

## Out of scope

- Owner-tunable sliders for the committed number (a preview at most).
- A second scatter tab (functionally the D6 panel mode).
- A meta index for non-joined models (arena-only / OR-only) — the joined set
  only, consistent with the anchor.
- Any new data source beyond the OR `benchmarks` object (v1).

## Definition of done

- [ ] Owner approves this plan (D1–D6) in a review session.
- [ ] `python3 update.py` green; `combined.json` carries the index + breakdown; `meta.json` carries the recipe version.
- [ ] Measured: the v1 sample index (46-model intersection) reproduces the 003 findings' values (top-10 set, Spearman 0.89–0.91).
- [ ] The meta panel renders with its own frontier + the "n/N components" tooltip badge.
- [ ] A recipe change is a data diff (weights / components visible in `public/data/`).
