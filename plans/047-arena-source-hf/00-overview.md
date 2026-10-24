# 047 — Arena source: HF dataset + loud failures

> **Status:** OWNER REVIEW — drafted 2026-10-24.

Date: 2026-10-24.

## Goal

`update.py` reads the Arena text board from the official HuggingFace dataset
`lmarena-ai/leaderboard-dataset` instead of scraping `arena.ai`, and the
6-hourly workflow reports its own failures as a GitHub issue so a dead
pipeline can never go unnoticed for 11 days again.

## Why

- Since **2026-10-13 ~18:00 UTC** every `/leaderboard*` route on arena.ai
  answers `403` with `cf-mitigated: challenge` (Cloudflare managed challenge)
  — from residential IPs, from GitHub runners, with a browser UA, over any
  encoding. Last good snapshot: `2026-10-13T12:44:03Z`. Every scheduled run
  since then exits 1 and nobody was told.
- The page is the *only* data surface: the leaderboard is server-rendered
  (no client fetch), the only unauthenticated JSON (`/nextjs-api/model-catalog`)
  carries ranks but no Elo, and `api.arena.ai` needs a WorkOS bearer token
  (access request submitted 2026-10-24, no answer yet).
- `lmarena-ai/leaderboard-dataset` is Arena's own HF org: 787 commits, daily
  at ~03:05 UTC, never missed a day since 2026-04-02. `config=text`,
  `split=latest` carries `model_name, organization, license, rating,
  rating_lower, rating_upper, variance, vote_count, rank, category,
  leaderboard_publish_date` — same Elo scale (Gemini 4 Argon (High) 1525.73
  there vs 1525.40 in our Oct-13 snapshot).

## Settled decisions

| A# | decision | rationale | date |
|----|----------|-----------|------|
| 1 | Arena source = `lmarena-ai/leaderboard-dataset`, `config=text`, `split=latest`, rows with `category == "overall"`. | Official org, daily, machine-readable; the only free fresh source left. Owner decision 2026-10-24. | 2026-10-24 |
| 2 | Access via the HF `datasets-server` JSON API (`/rows`, 100 rows/page), **no new dependency**. | `update.py` is zero-dep by rule; the parquet path would need `pyarrow`. Measured: `overall` is the first category, rows 0–417, so 5 pages with a stop rule. | 2026-10-24 |
| 3 | `modelDisplayName` = slugified HF `model_name`; names that are already lowercase slugs pass through unchanged. | HF mixes display names (`Gemini 4 Argon (High)`) and slugs (`claude-3.5-haiku-20241022`). The rule reproduces 343 of the 414 names in the Oct-13 snapshot; the rest are genuine model renames on Arena's side. | 2026-10-24 |
| 4 | `modelOrganization` = HF `organization` resolved against the logo registry's display keys (case- and punctuation-insensitive); unknown orgs keep the HF slug. No hand-written org table. | Keeps all 20 logo keys attached, keeps `arena_org` readable, and derives the display name from an artifact the pipeline already owns (rule #504). | 2026-10-24 |
| 5 | Fields HF does not carry go **null**, not fabricated: `arena_model_url`, `arena_context_length`, `arena_price_in_per_m`, `arena_price_out_per_m`. `modelKey`/`releaseType` leave `arena.json` (nothing in `src/` reads them). | The front already renders all four nulls (`ModelCard.svelte`); inventing or carrying stale values would be worse than an absent hint. | 2026-10-24 |
| 6 | Cadence unchanged: cron `15 */6 * * *`. `meta.json` gains `sources.arena.publish_date`. | HF publishes once a day; the 6-hourly run simply commits a history snapshot until the next publish. Provenance must say which Arena date the ratings are. | 2026-10-24 |
| 7 | Failure alerting = the workflow opens/reopens a GitHub issue on failure and closes it on the next green run, proven by a `force_fail` dispatch input. | Zero secrets, durable, survives schedule drift; `force_fail` is the only honest way to test an alert without breaking real data. | 2026-10-24 |
| 8 | A percentile series may be monotone in **either** direction; the tripwire dies only on a mixed one. | OpenRouter's throughput percentiles flipped to descending on ~2026-10-13 (856/858 endpoints); that is upstream semantics (p99 = slow tail), not corrupt data. Drift detection stays. | 2026-10-24 |
| 9 | The speed floor and its summed basis read `throughput_request_count`, not `request_count`. | `request_count` counts latency samples (3, 10 on a failing endpoint) while the throughput median comes from `throughput_request_count` (1803, 2354) — the floor never described the number it guards. | 2026-10-24 |
| 10 | `throughput_window_minutes` is stored, not filtered on. | 30 min on 723 endpoints, 24 h on 137; filtering to 30-min-only would cost 16 models their speed and move 47 numbers, for a metric that is a rough signal. | 2026-10-24 |
| 11 | `endpoints.json` keeps `p50..p99` as received plus the window field. | Dropping the unused tail saves 180 KB of 2.12 MB and loses the slow-tail data; the inversion is documented instead. | 2026-10-24 |
| 12 | `Details.svelte`'s copy of the speed rule folds into `speed.ts` (`speedEligible`, `SPEED_MIN_REQUESTS`). | Two copies of the floor drift apart the moment its field changes. | 2026-10-24 |
| 13 | Every run fingerprints the field set of all five upstream surfaces into `meta.json`; a delta is reported and, in the workflow, opens/comments on one `data: upstream schema drift` issue. Never fatal. | An added field is invisible today (whitelisted parsers); a fatal fingerprint would freeze the pipeline on a benign addition and leave no way to accept the new shape. | 2026-10-24 |

## Current state

- `update.py:30` `ARENA_URL = "https://lmarena.ai/leaderboard/text"`; `main():1584`
  `parse_arena(fetch(ARENA_URL))`. `parse_arena` (140) decodes the RSC chunks
  (`RSC_RE`, `_decode_chunk`, `_extract_json_array`) — those helpers are still
  used by `parse_provider_page` (449) for OpenRouter model pages and must stay.
- Entry shape consumed downstream (`join`, 289): `modelDisplayName`, `rank`,
  `rating`, `ratingUpper`, `ratingLower`, `votes`, `modelOrganization`,
  `license`, `contextLength`, `inputPricePerMillion`, `outputPricePerMillion`,
  `modelUrl`. Only the first eight survive the swap.
- Validation (`validate`, 1522): count 50–2000, required fields
  `rank/modelDisplayName/rating/votes`, top-20 ≥ 18 matched, overall ≥ 40 %.
- Measured with the Oct-13 OpenRouter snapshot: today's 414 arena names match
  212 (51 %), top-20 19/20; slugged HF names match 216 of 418 (52 %), top-20
  19/20 (the single miss is `gemini-4-argon-high`, absent from the stale OR
  snapshot). The swap does not degrade the join.
- Logo registry (`logos.json`) has 23 display keys (`Google`, `OpenAI`,
  `Z.ai`, `arcee-ai`…). HF orgs are lowercase slugs (`google`, `openai`,
  `zai`, `xai`, `allenai`, `''` for one row). `orgOf()` (`src/lib/family.ts:14`)
  displays `arena_org` straight into `ModelCard`, and `logoFor()` needs an
  exact key.
- Workflow `.github/workflows/update-data.yml`: one job, `contents: write`,
  runs `update.py` with `set +e`/`exit $status`, commits when the gated files
  changed. A failing run is silent to the owner.
- **Second wall, measured 2026-10-24** (step 01 executed): with the Arena
  outage gone the run reaches the provider layer and dies there —
  `provider: anthropic/claude-fable-5: Claude Platform on AWS: throughput
  percentiles not monotonic: [58, 40, 25.2, 23, 18]`. OpenRouter inverted the
  throughput percentiles (856/858 endpoints descend; latency still ascends) and
  added `throughput_window_minutes` (30 min × 723, 1440 × 137). Untouched
  plan-022 code, independent of the source swap — that is step 01b. Live
  measurements at that point: HF 418 `overall` rows (`publish_date
  2026-10-22`), OR catalog 375 models, 216 arena names matched → 163 combined,
  202 unmatched, top-20 20/20, provider join 939/939, stats coverage 156/163.
- `public/data/history/` gets one snapshot per run (`store_snapshots` dedupes
  by `ts`, not by content) — unchanged by this plan.

## Design

- **Step 01** — swap the arena source: `arena_name`, `parse_arena_rows`,
  `fetch_arena_rows` (paged, stop at the first non-`overall` row), org
  resolution, provenance in `meta.json`, `parse_arena` + its RSC test deleted,
  new fixture-based tests.
- **Step 02** — alerting in the workflow: issue open/reopen on failure with
  the report tail and the run URL, comment + close on recovery,
  `force_fail` dispatch input, `issues: write` permission.
- **Step 01b** — provider stats after OpenRouter's percentile flip: direction-
  agnostic tripwire, the speed floor moved onto `throughput_request_count`,
  `throughput_window_minutes` stored, `Details.svelte` folded into
  `speed.ts`. It lands on the source swap's heels because it is what turns
  step 01 into a green run.
- **Step 02b** — upstream schema fingerprint: five payload shapes recorded in
  `meta.json`, delta printed in the report, workflow opens/comments on one
  `data: upstream schema drift` issue.
- **Step 03** — close: full verification, `update.py` end to end, DoD audit,
  `AGENTS.md`/`README.md` wording, archive.

## Execution order

| Step | File | Depends on | Status | Commit |
|------|------|------------|--------|--------|
| 01 | [01-hf-source.md](01-hf-source.md) | — | DONE (512d00c) | 512d00c |
| 01b | [01b-provider-stats.md](01b-provider-stats.md) | 01 | OPEN | |
| 02 | [02-failure-alert.md](02-failure-alert.md) | — | OPEN | |
| 02b | [02b-schema-drift.md](02b-schema-drift.md) | 01b, 02 | OPEN | |
| 03 | [03-close.md](03-close.md) | 01, 01b, 02, 02b | OPEN | |

The table is the order: **01b lands before 02b** (the fingerprint baseline can
only be established by a run that reaches the write step), and **03 — the
closing step — runs last**.

## Out of scope

- The `full` split (1.22 M rows, 2024→today): the real Arena rating history.
  A backlog item of its own — it would replace the hand-accumulated
  `history/` snapshots with sourced series.
- Any Cloudflare workaround (headless browser, challenge solving, encoding
  tricks) — all measured dead or adversarial on 2026-10-24.
- The `api.arena.ai` key path: parked until the access request is answered.
  If it is granted, a later plan can make it a fallback source with the HF
  dataset as the always-available default.
- Multi-board Arena data (`config` per board) — 045's territory.
- `ntfy.sh` push: blocked on the owner picking a topic name.

## Definition of done

- [ ] `update.py` builds `arena.json`/`combined.json` from the HF dataset; no
      request to arena.ai/lmarena.ai remains in the codebase.
- [ ] Paged fetch stops at the first non-`overall` row, dies on ordering
      drift, on an empty first page, and on exceeding the page cap.
- [ ] Tests cover `arena_name`, the row→entry mapping, org resolution and the
      pagination stop rule; python suite green.
- [ ] `python3 update.py` runs green end to end with a sane report (entries
      ~418, 216 arena names matched → **163 combined models**, top-20 ≥ 18/20,
      overall ≥ 40 %), and the `public/data` diff is reviewed `meta.json`
      first.
- [ ] Provider stats survive the percentile flip: the tripwire accepts a series
      monotone in either direction, the speed floor reads
      `throughput_request_count`, and `endpoints.json` carries
      `throughput_window_minutes`.
- [ ] Every run records the field set of all five upstream surfaces in
      `meta.json`; a delta is printed in the report and opens/comments on one
      `data: upstream schema drift` issue.
- [ ] `meta.json` carries `sources.arena.publish_date`; the site still shows
      org logos for every org it showed before.
- [ ] A failing run opens exactly one GitHub issue (no duplicates), with the
      report tail and a run link; the next green run comments and closes it.
- [ ] `AGENTS.md` / `README.md` describe the source as the HF dataset.
