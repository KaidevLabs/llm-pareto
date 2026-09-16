# 008 — Data enrichment: dropped OR fields + price history

Date: 2026-09-16. **Status: PROPOSED — not reviewed, not executed.**
Source: `plans/archive/002-exploration-backlog.md` item B5 + its exploration findings.

Two-phase enrichment of the joined dataset. **v1** (zero new fetches):
carry through the OpenRouter fields `update.py` currently drops — full
modalities, status/time fields, reasoning/tools flags, cache-read pricing —
plus two divergence flags (arena vs OR price, arena vs OR context). **v2**
(one new fetch family): Wayback Machine price history with a "price moved"
badge.

## Proposed decisions (settled at owner review)

| # | decision | rationale |
|---|----------|-----------|
| D1 | v1 scope, all from the existing OR fetch: `input_image` / `input_video` / `input_audio` / `input_file` / `image_output` (from `architecture.input_modalities` / `output_modalities`), `created` (epoch), `expiration_date`, `knowledge_cutoff`, `reasoning.mandatory`, `tools`, `response_format`, `input_cache_read` price. `vision` stays (it == `input_image`) for back-compat | Measured on 154 joined models: video-in 31, file-in 60, audio-in 16, image-out 1 (gemini-3-pro-image, currently invisible — its image-output capability is swallowed by the "gemini-3-pro" collapse); EOL only 4/351 catalog-wide (bonus column, not a dimension); zero new fetches |
| D2 | Derived flags in `combined.json`: `price_disagrees` (arena $/M vs OR, 27/154 today, some 2×) and `context_disagrees` (OR-served vs arena-claimed, 24/154 today, e.g. claude-sonnet-4.5 1M vs 200k), with both raw values kept | A cross-check is a signal, not an anomaly: vendor list price vs provider price legitimately differ, so warn in the report, do **not** fail-fast |
| D3 | OR's `benchmarks` object (LMArena `design_arena` category elos + Artificial-Analysis indices; 119/154 joined models; field appeared ~April 2026) is owned by 005 as an optional v2 source — not carried here | One benchmark pipeline, not two |
| D4 | v2: Wayback price history — CDX query + ~12 curated snapshots of `openrouter.ai/api/v1/models` → per-model `{date, in, out}` arrays in a new committed file; a "±X% since 2026-04" badge in tooltip/panel. Snapshot fetch failure = warn + skip (secondary data), not hard-fail | Measured: 187 snapshots 2023-07 → 2026-09, all HTTP 200 JSON; 33–53% of comparable prices moved per quarter; coverage is sparse early (32/154 by 2025-04, 117 by 2026-09), so the history is a soft layer |
| D5 | Deferred (revisit at v2 review, not in this plan): tokencanopy CSVs (1★, 2-week history — durability), HuggingFace param counts (third source, ~76 fetches, 76/154 ceiling) | Both measured in the findings; neither is worth the third-source maintenance for v1 |

## Steps (commit per step; owner stages each diff)

1. update.py: `parse_openrouter` + `join()` carry through the D1 fields;
   compute the D2 flags; match-report lines (disagreement counts). Run;
   review the data diff.
   Commit: `data: modality/status enrichment + divergence flags`
2. app.js: tooltips (and 006's panel, once it lands) consume the new fields;
   price/context disagreement badges.
   Commit: `chart: enriched tooltips + disagreement badges`
3. **v2, re-scoped at review**: update.py Wayback CDX + curated snapshot
   fetch → price-history file + meta section; app.js "price moved" badge.
   Commits: `data: Wayback price history` + `chart: price-moved badge`

## Out of scope

- OR `benchmarks` object (005), tokencanopy, HF param counts (D5), official
  release dates (no verified source found — OR `created` is list-date).

## Definition of done

- [ ] Owner approves this plan (v1 scope; v2 scoped in or cut).
- [ ] `combined.json` carries the D1 fields + D2 flags; `python3 update.py`
      validation still passes and the report surfaces the disagreement counts.
- [ ] Tooltips/panel show modalities + disagreement signals.
- [ ] (v2, if kept) price history committed with per-model arrays; the badge
      renders; snapshot failures warn, not fail.
- [ ] Deployed per A10.
