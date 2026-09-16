# 010 — Search box: live highlight

Date: 2026-09-16. **Status: PROPOSED — not reviewed, not executed.**
Source: `plans/archive/002-exploration-backlog.md` item B7 + its exploration findings.

A search input in the existing filter bar; typing live-dims the non-matching
points (soft highlight — no hiding). Total change ~55–70 lines across
`app.js` + `index.html`, no data-layer or `update.py` changes.

## Proposed decisions (settled at owner review)

| # | decision | rationale |
|---|----------|-----------|
| D1 | Semantics: soft dim — non-matches at alpha ~0.25 (position / size / org color kept); the Pareto frontier stays global and bright | Measured: hide semantics degenerates family-level searches — "opus" → 1-point "frontier" (7 Claude Opus line, five at the same $10/M blended price, only 4.6 survives dominance), "grok" → 1, "sonnet" → 2 — and re-fits the log axis per query, losing positional context. Dimming is the app's first dimmed state by design: the categorical hard-filter language belongs to the vision/004 filters, keyword highlight to search |
| D2 | Match: case-insensitive substring over `or_name`, `or_id`, `arena_org`, `arena_model`, and `arena_variants` (findings options a+d) | Covers the likely queries ("opus" → 7, "gpt-5" → 13, "anthropic" → 15, "opus max" → Claude Opus 5 via its dated variant); multi-token AND is a v2 +2 lines if "claude anthropic" (currently 0 hits) matters |
| D3 | No-match feedback: an "n/154" count next to the box, computed over the visible set (after the 004 filter, once it lands) | The `.count` span is the in-repo precedent (index.html:276; app.js:324-325); the all-dimmed chart + "0/154" is a readable 0-state |
| D4 | Styling v1: matches keep their org color at full alpha, non-matches dimmed; no emphasis ring, no size bump | One-line `itemStyle` branch (app.js:236-242); ring / size bump are the manual A/B at step 3 (white ring at 2px is the in-repo precedent via the override-gold ring) |
| D5 | Frontier line + markers stay bright at all times; spread bars keep their fixed 0.55 alpha | Minimal v1 — both are one-line revisits if the A/B says otherwise |
| D6 | 006 interaction: clicking a dimmed point opens the details panel anyway | No chart click handler exists today (006 adds one); ignoring dimmed clicks is the extra state |

## Steps (commit per step; owner stages each diff)

1. app.js: `state.search`; `searchHit(d)` over the D2 surfaces; the dim
   branch in the models' per-point `itemStyle` (D1, D4); count update (D3);
   the `input` listener in `bindFilters()` (the ratio slider at app.js:407 is
   the precedent).
   Commit: `chart: search dim logic`
2. index.html: the input + count span in `nav.filters`; ~15 lines of
   dark-theme CSS (the `.ratio` container at index.html:118-143 is the
   precedent).
   Commit: `chart: search input in the filter bar`
3. Manual A/B feel-out: dim alpha 0.12 / 0.25 / 0.4, ring vs no ring,
   0-state treatment — owner picks by feel, then one commit if the pick
   differs from D1/D4.
   Commit (if changed): `chart: search highlight styling`

## Out of scope

- Multi-token AND matching (v2), per-point match chips, `/`-to-focus and
  Escape-to-clear shortcuts (trivial additions at review if wanted).

## Definition of done

- [ ] Owner approves this plan (incl. the step-3 A/B pick).
- [ ] Typing live-dims non-matches; the frontier stays global.
- [ ] The "n/154" count is correct and tracks the filtered set.
- [ ] The 0-match state reads as "0/154" + all dimmed.
- [ ] Composes with the existing filters (search dims within whatever the
      other filters show); deployed per A10.
