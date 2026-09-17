# 022 — Provider data foundation (per-provider layer, all models)

Date: 2026-09-17. **Status: EXECUTING (step 3/5). Owner approved by
execute trigger (2026-09-17). Step 1: `4b93918`. Step 2: `e4493ca`.**
Source: `plans/021-exploration-backlog.md` items B14/B15 + their exploration
findings + plan-decomposition round 2 (owner decision A: this is the shared
data plan; 023/024/025 consume it).

`update.py` gains a per-model provider fetch loop over the 154 joined models
and commits the full per-provider layer — provider list, complete pricing,
uptime, quantization, context, rate limits, data policy, capability flags,
and the 30-min speed percentiles — as one new file,
`public/data/endpoints.json`. No client changes: the data exists, is
validated, and is diff-reviewed in the data commits; 023 (speed axis) and
024 (provider table) are the display consumers.

## Proposed decisions (settled at owner review)

| # | decision | rationale |
|---|----------|-----------|
| D1 | Sources: the public endpoints API (`/api/v1/models/<or_id>/endpoints`) is the source of truth for the provider list + pricing + uptime; the model page SSR payload (`https://openrouter.ai/<or_id>`) is the source for the speed percentiles + the page-only rich fields; both are fetched per joined model, unauthenticated | measured inventory (021 round 2): the API is the complete endpoint set incl. dated variants (22 for ds4pro) with the full pricing subkey set and `uptime_last_1d` (94% populated) but null speed stats unauth (161/161); the page carries the populated stats (95% of endpoints / 97% of models) + `data_policy`, per-endpoint rate limits, `provider_info` (slug + baseUrl), `provider_region`, `is_hipaa_eligible`/`is_hidden`/`is_deranked`/`is_free` flags, `deprecation_date`, `created_at` — none of which the API exposes. The page covers only the canonical version's endpoints (16 of ds4pro's 22), so it cannot be the sole source |
| D2 | One committed file `public/data/endpoints.json`, keyed by `or_id` → provider entries (each entry carries its `stats` sub-object from the page); `meta.json` gains a provenance block (source URLs, endpoint count, stats coverage, joined-model count) | keeps `combined.json` stable (005/009/014 assume it); one fetch + one gate entry for the client plans (023/024 share a lazy fetch); the alternative (extend `combined.json`) churns the most-reviewed file with +~30 KB gz eager (021 B15 findings option c) |
| D3 | Cross-source join key: `(provider_name, tag)`; the API list is authoritative — page stats join onto API entries; a page endpoint that does not join is kept (stats only, flagged in the report); join-hit-rate is a validation band | the API endpoints carry no UUID (measured field census); the page endpoints do, but only the page side. Measured duplicate provider rows are 27% of endpoints — the join needs the tag, and the hit rate is reported every run |
| D4 | Speed kept per endpoint: `p50/p75/p90/p95/p99` latency (ms) + throughput (tok/s) + `latency_request_count`/`throughput_request_count`/`request_count` + `window_minutes`; per-model aggregation is the client's job (023 D2), this plan stores raw | the aggregation rule (median, rc threshold) is a display decision with its own review; storing raw keeps 022 honest to "everything we could have" and makes a re-aggregation cost zero |
| D5 | Churn policy: pricing kept as the API's exact strings (no float re-encoding — the API returns strings like `"0.00000095526"`); `uptime_last_1d` rounded to 0.1%; `uptime_last_5m/30m` dropped (measured: 41%/29% null, noisy); stats kept as received (page emits ints / 0.5-granular floats) | measured churn over 8 min: pricing 0/46, raw-precision uptime 30/46 → 8/46 at 0.1% (021 B15 findings); string prices make the API-side diff silent by construction |
| D6 | Duplicate rows: exact `(provider_name, tag, model_id)` duplicates are merged, keeping the entry with the more populated uptime (measured case: BaseTen ×2 identical tag + price, one with null uptime); the merged count goes in the report; dated-variant endpoints (same provider, different `model_id`) are distinct entries, not duplicates | the API returns both dated variants and true duplicates (17/38 sample models, 27% of endpoints); a provider table that lists the same provider twice at the same price reads as a bug |
| D7 | 013 D3 changed-gate: `endpoints.json` joins the gate (commit when it changes). Consequence accepted: the stats sub-objects churn every run (30-min rolling window — measured ±5% typical over 25 min), so a data commit will fire on most runs with a small diff (stats ± occasional price/uptime drift) | the alternative (exclude from the gate, like `meta.json`) leaves the committed speed data stale by days while the site's price/Elo data stays fresh — the opposite of the owner's "correct data" directive. Review surface = the endpoints.json diff (small, string-stable prices) + the match-report provider section in the run log |
| D8 | Fail-fast bands: hard-fail if any joined model has 0 API endpoints; hard-fail if <50% of models have ≥1 endpoint with stats; warn + report at <80% models-with-stats; structural floors (percentile monotonicity p50≤p75≤p90≤p95≤p99, throughput > 0, price > 0, join hit rate ≥90% of page endpoints) | measured coverage 97% of models / 95% of endpoints leaves headroom; zero-traffic legacy models (measured miss: claude-opus-4, 1 endpoint, 0 requests) are the known sparse case — "every model has speed" would hard-fail on what the site cannot fix (021 B14 OQ7) |
| D9 | Fetch mechanics: sequential over the 154 joined `or_id`s, 0.5 s spacing, the existing `fetch()` retry (1–3 attempts, backoff — 013 D5) for both sources, 60 s timeout; ~2.5 min added to a run (measured: 38 sequential page fetches = 33.8 s incl. sleeps; API 38 fetches = zero 429s, 0.05–0.2 s each); ~173 MB downloaded per run | the endpoints API proved polite to a 38-fetch burst (measured); 154 is an extrapolation, not a proof — a 429 storm under cron is the risk the retry + backoff absorbs; a rate-limit ceiling beyond 38 is not measured (021 B15 OQ6) |

## Current state (evidence)

- `update.py`: 969 lines, stdlib-only, zero-dep; `fetch()` with 1–3 retries +
  backoff (013 D5, `tests/test_fetch.py`); the `parse_arena` RSC primitives
  (`RSC_RE` chunk decode + bracket-matching extract) already parse one
  `self.__next_f` stream — the OR model pages are the same RSC surface, new
  anchor (021 B14 findings); 4 committed JSONs under `public/data/`
  (~387 KB raw / ~53 KB gz); atomic writes; fail-fast thresholds (top-20 ≥90 %,
  overall ≥40 %); the match report is the review surface.
- 013 cron: `15 */6 * * *` UTC + dispatch; D3 gate over
  arena/openrouter/combined.json; direct push to main (D2′), commit
  `data: scheduled refresh (<stamp>)` staging `public/data` + logos.
- The measured inventory (021 round 2) and all raw artifacts live in
  `.tmp/b14/` + `.tmp/b15/` (API field census, page endpoint object census,
  endpointStats payload, coverage log, churn snapshots).

## Steps (commit per step; owner stages each diff)

1. `update.py`: fetch layer. New `fetch_endpoints(or_id)` +
   `fetch_model_page(or_id)` (reuse `fetch()`/retry/timeout/UA), a
   `fetch_provider_layer(or_ids)` loop (0.5 s spacing) called after the
   join; raw payloads to `.tmp/provider/` (never committed). Prints
   per-source fetch counts. Not touched: join, validation, the 4 existing
   outputs. Commit: `update: fetch per-model endpoints + model pages`.
   Seams under test: the two fetch functions (urlopen mocked — retry,
       backoff, 404-vs-5xx fail-fast) in `tests/test_provider_fetch.py`.
    ✅ Complete — `4b93918` (2026-09-17). As-built: both fetchers delegate to
    the existing `fetch()` (retry/backoff/timeout/UA inherited); the layer
    loop runs in `main()` after `validate()` — a failing run then fetches
    nothing (~4 min / 182 MB saved); raw payloads land at
    `.tmp/provider/ep_<org>__<model>.json` + `page_<org>__<model>.html`.
    First 154-scale live probe of D9: 308/308 payloads (182 MB ≈ the ~173 MB
    estimate), zero 429s. Suite 122 green (8 new tests at the seam).
2. `update.py`: parse + normalize. Page RSC parse: the dehydrated endpoint
   object array + the `endpointStats` query (reuse `RSC_RE` +
   chunk-decode + bracket-match; new anchors — synthetic RSC fixtures,
   hand-written, minimal, per house discipline); API JSON parse; join on
   `(provider_name, tag)` (D3); duplicate merge (D6); trim/round (D5);
   schema = one entry per API endpoint: provider, tag, model_id, pricing
   (all subkeys, strings as received), context_length,
   max_completion_tokens, quantization, status, uptime_last_1d (rounded),
   supported_parameters, page fields (adapter, data_policy, rate limits,
   provider_info, provider_region, flags, created_at, deprecation_date,
   supports_reasoning, pricing_version_id), `stats` (D4, null when absent).
   Not touched: `combined.json`, `openrouter.json`, `arena.json`, `meta.json`
   (the provenance block lands in step 3). Commit:
   `update: normalize provider layer (endpoints.json schema)`. Seams under
   test: page parse (synthetic RSC), join + duplicate merge, rounding/trim
       (pure functions) in `tests/test_provider_normalize.py`.
    ✅ Complete — `e4493ca` (2026-09-17). As-built: the `endpointStats`
    queryKey array IS the dehydrated endpoint object array (stats embedded —
    the spec's two bullets are one structure, verified in the raw stream);
    the API `tag` appears on the page side as `provider_slug` OR
    `provider_info.slug` (measured both directions: baidu/fp8 vs alibaba), so
    the join tries provider_slug exact first, then info.slug, unique-match
    only. Duplicate page rows joining one merged API entry keep the
    max-`request_count` stats (real BaseTen×2: 2505 vs 2248). Unjoined page
    entries keep page-side context/quantization/pricing (uniform schema; 0
    of these in the live run). Live run: 797 entries, 806/806 joined, 9 dup
    groups merged, 756/797 with stats (95% — matches the 021 measurement).
    Suite 142 green (20 new tests at the declared seams).
3. `update.py`: validation + write + report. Bands D8 + structural floors;
   atomic write of `endpoints.json` (only when state changed — canonical
   form, like `logos.json`); `meta.json` provenance block (sources, counts,
   coverage); match-report section: endpoints per model (min/median/max),
   providers distinct, stats coverage (models + endpoints), join misses,
   duplicates merged, top providers by endpoint count. A band violation
   exits non-zero before any file is written. Commit:
   `update: validate + write endpoints.json (provider layer)`. Seams under
   test: the band functions + the report lines in
   `tests/test_provider_validate.py`.
4. `.github/workflows/update-data.yml`: add `endpoints.json` to the D3
   changed-gate (D7). actionlint + scratch-clone rehearsal (no-op path:
   meta-only → clean; changed path: forced stats drift → commit + push).
   Commit: `ci: gate endpoints.json in the scheduled refresh`.
5. First live run: dispatch the workflow, owner reviews the
   `endpoints.json` diff + the report section end-to-end, verify the deploy
   (live == main). No code commit unless the review changes something.

## Out of scope

- Any client change (023 speed axis, 024 provider table, 025 comparator
  rows — all separate plans).
- Per-model speed aggregation (023 D2, client-side).
- OR API-key support: the auth-only `latency_last_30m`/`throughput_last_30m`
  API fields — a small v1.1 add-on if the owner provides a key (fetch with
  the key, keep under `api_stats`, no merge).
- The full OR catalog endpoint layer (352 models) — the 154 joined only;
  membership re-derives from the join each run, so a model leaving the join
  drops its entries (no stale rows).
- The site-wide provider table (rows = providers) — 024's surface decision.

## Not yet specified

- The final field whitelist of the committed schema — default is the full
  set above; the first `endpoints.json` diff review may trim.
- Exact stat rounding (default: as received) — revisited only if the D7
  diffs prove noisier than measured.

## Definition of done

- [x] Owner approves this plan (D1–D9) in a review session — execute
      trigger + staged step 1 (2026-09-17).
- [ ] `python3 update.py` green with the new provider report section
      (endpoint counts, stats coverage, join misses, merged duplicates);
      full suite green incl. the three new seams.
- [ ] `endpoints.json` committed + owner-reviewed diff; `meta.json`
      provenance block present; the file is the joined-154 only.
- [ ] A scheduled run exercises the D7 gate: a green commit when the
      provider layer changed, a green no-op when only `meta.json` moved.
- [ ] The live site is unchanged by this plan (same HTML/JS; no new client
      fetch — `app.js` still loads only `combined.json` + `meta.json`).
