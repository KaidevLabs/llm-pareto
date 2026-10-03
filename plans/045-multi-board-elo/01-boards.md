# Step 01 — Hub-derived board discovery + per-board arena.json — OPEN

## Spec

`update.py` only:

1. **Board discovery**: fetch `https://arena.ai/leaderboard` (hub, USER_AGENT as today) and extract board slugs from the SSR payload (the hub embeds all boards' links — verified 2026-10-03: `leaderboard/<slug>` occurrences). No hardcoded slug list. Cache the discovery result in `meta.json` (boards_seen) so the data diff shows what was discovered.
2. **Per-board fetch + parse**: for every discovered slug, fetch `https://arena.ai/leaderboard/<slug>` (reuse `fetch()` retry logic; boards can fetch concurrently — the OpenRouter/endpoints fetches already use `ThreadPoolExecutor`) and parse with the existing `parse_arena`. A board whose page 404s or lacks RSC chunks is **skipped with a report line**, not fatal.
3. **Classification (A4)**: a board is ingestible iff its entries carry `rating` (Elo) and per-token prices (`inputPricePerMillion`/`outputPricePerMillion` — same probe on entries, not a slug list). Non-qualifying boards (media, agent) are excluded and named in the match report with the reason (no-rating / not-token-priced). The qualifying set may be empty only if text is also gone — that stays fatal.
4. **Per-board `arena.json` sections (009 D3)**: replace the flat entries array with `{boards: {<slug>: {fetched_at, voteCutoffISOString?, entries: [...]}}}` — raw entries at full fidelity, per-board raw diffs reviewable in git. Keep top-level `fetched_at` for the whole file.
5. **Per-board match report skeleton**: for now, per-board entry counts + classification results printed in the report (the per-board *match* sections arrive in step 02; this step prints per-board *ingest* results).
6. **Validation (A5)**: text board: current hard thresholds unchanged (count 50–2000, `TOP20_MATCH_MIN` applies at join time, `OVERALL_MATCH_MIN` 0.40). Code board: identical hard thresholds applied to its counts. Other qualifying boards: soft — entry-count floor of 10 (warn+report below, not fatal), no top-20 gate. A soft-failing board's section is still written and reported.

## Not touched in this step

- The OpenRouter fetch, join, endpoints, speed, snapshots/history pipelines — untouched until step 02 wires the join.
- `combined.json`/`meta.json` shape (except the boards_seen discovery cache note in the report print), `public/data/openrouter.json`, all front end.
- `overrides.json` schema.

## Verification

- `python3 update.py` green (exit 0); the report prints per-board discovery (all 11 slugs), classification (5 qualifying: text, code, vision, search, document — 5 excluded: agent, 5 media, with reasons), and per-board entry counts (code ≈ 178, per the 2026-10-03 probe).
- `git diff public/data/arena.json` — per-board sections present, text entries at full fidelity.
- The front end still boots on the new arena.json (additive `boards` wrapper — confirm `loadData()` tolerates it or keep arena.json shape stable this step and switch the shape in step 02 alongside the join; pick one, record it in the as-built).
- `python3 -m unittest discover -s tests -v` green.

## Seams under test

- `tests/test_boards.py` (new, stdlib unittest): classification (rating+token-priced probe → ingest / no-rating / not-token-priced), slug extraction from a fixture hub payload (synthetic, hand-written — never a real page snapshot, per repo fixture rules), soft-vs-hard validation boundaries.
- Fixture hub payload is synthetic minimal RSC-shaped HTML, not the live page.
