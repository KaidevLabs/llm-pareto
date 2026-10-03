# Step 02 — Per-board join: combined.json arena_elo_by_board + meta.json — OPEN

Depends on: step 01.

## Spec

`update.py` only:

1. **Per-board join (A6/A7)**: run the existing `join()` once **per qualifying board** on that board's entries. Identity stays normalized `(modelOrganization, modelDisplayName)`; `modelKey` is never used (A6). Config-variant collapse (max-Elo) happens **within each board**, so `arena_variants` semantics stay per-board.
2. **combined.json rows (A3)**: each row gains `arena_elo_by_board: {<slug>: {elo, upper, lower, rank, votes}}` — only boards where the model matched. The flat `arena_elo`/`arena_elo_upper`/`arena_elo_lower`/`arena_rank`/`arena_votes` fields become the **default board (code)** values; a model on no board (OR-only) keeps nulls as today. Document `default_board: "code"` in `meta.json`.
   - Note: today a row requires an arena match to exist at all; that stays true per model overall (it must match on ≥1 board). Models matching only on soft boards still get rows (their flat/default-board fields are null) — confirm the front end's null-elo handling covers this (it does: `d.arena_elo == null` paths exist throughout filters/charts) and record in the as-built.
3. **Per-board match report**: each board gets its own report section (counts, match rate, method breakdown, unmatched list with candidates). Hard thresholds (top-20 ≥ 90%, overall ≥ 40%) apply to text and code; soft boards print rates warn-only (A5).
4. **meta.json**: per-board section — entry count, joined count, match rate, `voteCutoffISOString` staleness per board, plus `default_board` and the `boards_seen`/`boards_excluded` discovery record from step 01.
5. **Snapshots/history** (`store_snapshots`, `write_history`): rows now embed the map — verify the history payload round-trip still works (rows are stored/compared as opaque dicts; expected to be no-change). Record the confirmation in the as-built.

## Not touched in this step

- All front end (the added map is invisible to it).
- endpoints/speed pipelines (unchanged), overrides.json schema, logos.

## Verification

- `python3 update.py` green; per-board report shows join rates per board (text should match today's ~numbers; code expected high — its names are close to text's).
- `git diff public/data/combined.json`: rows carry `arena_elo_by_board`; flat `arena_elo` == code board elo for multi-board models; text-only-model rows now have flat nulls + text map entry — this is the semantic flip, verify it reads correctly on a few known models (e.g. a text+code model, a code-only model).
- `git diff public/data/meta.json` first: per-board stats + default_board present.
- Python suite green (including any existing join tests).

## Seams under test

- Extend the update.py test modules: per-board join (same arena name on two boards → one row, two map entries; code-only match → row with null flat fields), per-board variant collapse within a board, soft-board warn path in the report builder.
