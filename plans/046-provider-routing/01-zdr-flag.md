# Step 01 — `zdr` flag in `endpoints.json` — OPEN

## Spec

`update.py` + tests:

1. **Fetch**: new `ZDR_URL = "https://openrouter.ai/api/v1/endpoints/zdr"`; one call per run through the existing `fetch()` (retry/fail-fast). Parse `{"data": [...]}`; die on missing/empty data or rows lacking `model_id`/`tag` (schema drift). Note: the OpenAPI declares apiKey/bearer, but it answers unauthenticated today (2026-10-05); a 401/403 would fail the run loudly.
2. **Join** (pure seam): `join_zdr(entries, zdr_rows) -> (entries_with_zdr, counts)` — key set `(model_id, tag)` (natural dedupe), `zdr: true/false` per endpoint; missing `tag` → false; ZDR rows for models outside the join are ignored. Called once per run (not per model) from `build_provider_layer`/`main`.
3. **Report + meta**: counts in the printed report (e.g. `zdr endpoints: N (M models)`) and in `meta.json` following the `provider_rep` pattern (`zdr_endpoints`, `zdr_url`); die if zero joined endpoints match (join-key drift).
4. **Validation**: `validate_provider_layer` gains the "≥1 ZDR match" floor on top of the current checks.

## Not touched in this step

- Model-page scrape, speed stats, logos, snapshots/history, front end, `combined.json`/`openrouter.json`.
- The workflow gate (endpoints.json is already in the bot's commit list).

## Verification

- `python3 update.py` green; report shows the ZDR counts; `git diff public/data/meta.json` (first) and `git diff public/data/endpoints.json` — flag per endpoint.
- Spot-check: pick 3 endpoints and compare against `/api/v1/endpoints/zdr` (e.g. `novita/fp8` for glm-5.3-flash → true; `streamlake/fp8` → false).
- `python3 -m unittest discover -s tests -v` green.

## Seams under test

- `tests/test_zdr.py` (new, stdlib unittest): `join_zdr` — match by `(model_id, tag)`, no-match → false, duplicate rows dedupe, missing `tag` → false, rows from models outside the join ignored; fixtures synthetic and hand-written (never real snapshots, per repo fixture rules).
