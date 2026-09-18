# 021 — Exploration backlog (speed, providers, comparator)

Date: 2026-09-17. **Status: PROPOSED.**

Source: owner's post-020 ideas (2026-09-17). Third exploration backlog; it
**continues the B-ID space** of the first two backlogs (B1–B7 in
`plans/archive/002-exploration-backlog.md`, B8–B13 in
`plans/archive/003-exploration-backlog.md`) so item references stay unique
across backlogs. Plan numbers 001–021 are taken; surviving items graduate
from **022** up.

## Process (how this backlog gets worked)

Same process as 002/003:

1. **Explore** — per item, one sub-agent task (research only, no code) maps the
   possibilities: feasibility on the current stack (Workers static assets,
   vendored ECharts, committed JSON, zero-dep `update.py`, no backend, `ls`
   no-op build, cookieless site), evidence measured not assumed, design
   options as a consequences ledger, rough effort + dependencies on other
   items (B1–B16, any backlog). Output: a findings section appended to this
   doc (uncommitted, for owner review).
2. **Plan** — each item that survives exploration graduates to its own
   numbered plan doc `plans/00N-<slug>.md` (001 style: settled-decisions
   table, steps, DoD), grounded in that item's findings. Items are not merged
   into a shared plan; a merge is an explicit owner decision at review.
3. **Review** — owner reviews each plan by hand; nothing is implemented until
   a plan is agreed in a review session. Execution in owner-chosen order.

## Backlog (order below is not priority)

### B14 — Third axis: speed (price × Elo × speed)

Add model speed as a third comparison axis alongside price and Elo. Owner's
pointer: "look for median speed on openrouter per provider and per model".

**Preliminary evidence (in-session, 2026-09-17):**

- The public list API (`https://openrouter.ai/api/v1/models`, fetched live:
  444 models) carries **no speed fields** on the model object (keys measured:
  architecture, benchmarks, canonical_slug, context_length, created,
  default_parameters, description, expiration_date, hugging_face_id, id,
  knowledge_cutoff, links, name, per_request_limits, pricing, reasoning,
  supported_parameters, supported_voices, top_provider). The `benchmarks`
  object (design_arena + artificial_analysis) has no speed either.
- The public per-model endpoints API
  (`/api/v1/models/<canonical_slug>/endpoints`) **has** the fields
  `latency_last_30m` and `throughput_last_30m` per endpoint — but measured
  **null on all 41 endpoints sampled unauthenticated** (claude-fable-5.1 ×4,
  glm-5 ×8, deepseek-v4-pro ×22, gemini-3.8-flash ×6, llama-4-maverick ×5,
  gpt-5.2 ×4). `uptime_last_1d` is populated on some. Auth hypothesis
  unverified.
- The OpenRouter **model page HTML** (1.4 MB for deepseek-v4-pro) embeds
  populated per-endpoint stats in its SSR payload: `p50/p75/p90/p95/p99`
  latency (ms) and throughput (tok/s), plus `request_count` (39,657 in the
  30-min window) and `window_minutes: 30`. So populated speed stats are
  publicly reachable today — but per-model-page, not from the list API, and
  the catalog page embeds none (0 occurrences measured).
- Per-provider **price spread is real** (same model): deepseek-v4-pro in
  $0.70–1.65/M across 22 endpoints (2.4×); glm-5 $0.60–1.00/M across 8;
  gpt-5.2 $0.875–3.50/M. Providers: Azure/Anthropic/Amazon Bedrock/Google
  (claude), StreamLake/GMICloud/Baidu/SiliconFlow/Bedrock/Venice/Novita/Z.AI
  (glm-5), etc.
- Raw artifacts in `.tmp/b14/` (`or_models_raw.json`, `endpoints_sample.json`,
  `ep2_*.json`, `model_page.html`, `frontend_ep.json`, `catalog.html`).
- Chart today: 2D scatter price×Elo + Pareto frontier (#335); speed as a
  third axis has no natural slot on a 2D chart — axis toggle / bubble size /
  color are the candidate encodings; a 3-axis frontier (dominated = not
  better in all three) is a semantic change to the explorer's core highlight.

**Findings (2026-09-17, explore sub-agent, research only).** Bottom line:
speed is feasible today with no auth: every OpenRouter model page embeds
per-endpoint 30-min latency/throughput percentiles in its SSR payload, parsed
with the same `self.__next_f` RSC mechanism `update.py` already uses for
arena.ai — measured coverage **38/39 sampled joined models (97%, extrapolated
~150/154, rank-spread 1–355)** at a cost of ~2 min and ~170 MB per run. The
within-model reality is the real design problem, not the data: p50 throughput
across one model's provider endpoints spreads 3.6× (median), up to 31.7×, so
"per-model speed" needs an explicit aggregation rule. Separately, the docs
state the public endpoints API's `latency_last_30m`/`throughput_last_30m`
populate "when authenticated with an API key or cookie" — an owner-provided
OpenRouter key would flip the path from 154 × 1.4 MB page scrapes to 154
small JSON calls and should be verified/tested before committing to a scrape
path. Chart-wise, a speed axis-toggle reusing the existing mode tabs is cheap
and keeps the 2D frontier line; a true 3-axis frontier is a semantic change —
the 3-objective Pareto set is not a chain and cannot render as the current
single line.

**Feasibility.** Data: yes, publicly, per-model-page (list API has no speed
fields; unchanged). Parse: yes — model pages are Next.js RSC flight data; the
stats live in an embedded TanStack-Query dehydration payload under the query
key `["model-page","endpointStats",{permaslug, variant:"standard",
perfWorkload:"text_generation", …}]`; extraction reuses `RSC_RE` +
chunk-decode + bracket-matching (the `parse_arena` primitives, new anchor).
Client: all four encodings are renderable in vendored ECharts 5.6 without new
libs. Constraints respected: no backend, no runtime third parties (fetching
stays in `update.py`), committed JSON.

**Evidence.** (all measured 2026-09-17; in-session pass 06:47–06:50 UTC, this
pass 06:57–07:14 UTC; commands/scripts + raw artifacts under `.tmp/b14/`)

- **Coverage (decisive): 38/39 sampled models (97%) have ≥1 endpoint with
  populated throughput+latency; endpoint-level 189/198 (95%). Extrapolated
  ~150/154.** Sample = every 4th of the 154 rank-sorted `combined.json`
  models (ranks 1, 5, 11, … 355); 39 bare-id page fetches
  (`https://openrouter.ai/<or_id>`, 0.5 s sleep), parser reusing
  `update.py`'s RSC regex; all 39 pages parsed (log:
  `.tmp/b14/coverage_results.json`, pages: `.tmp/b14/pages/`). The one miss:
  `anthropic/claude-opus-4` (rank 107, 1 endpoint, zero traffic in window) —
  legacy-model failure mode.
- **Within-model spread (decisive): p50 throughput across one model's
  endpoints spreads max/min 3.57× (median), 8.05× (p75), 31.7× (max)** —
  gemma-4-31b 3→95 tok/s, deepseek-v4-pro 5→95, gemini-2.5-flash-lite 9→127.
  Aggregation rule matters: median vs request-count-weighted median differ 6%
  typical / 61% max (20/25 multi-endpoint models differ); median vs
  fastest-endpoint +71% typical (a "fastest" number would be marketing).
- Distribution: per-model median p50 throughput 11–177.5 tok/s, median 47,
  p10 21, p90 100 (tok/s). Per-model median p50 latency 203–6340 ms.
- Null semantics: `stats` is null exactly when the endpoint had **zero
  requests in the 30-min window** — measured: an endpoint with
  `request_count: 2` still carries stats; the no-stat endpoints
  (claude-opus-4.8 Azure×2, Bedrock dup) have `uptime_last_30m/5m: null` in
  the unauth endpoints API while the with-stat ones don't. Not an auth
  artifact on the page path.
- Auth (docs, webfetch 2026-09-17): `GET
  /models/{author}/{slug}/endpoints` is documented
  (docs/api/api-reference/endpoints/list-all-endpoints-for-a-model);
  `latency_last_30m`/`throughput_last_30m` (PercentileStats p50/p75/p90/p99)
  and `perf_last_30m_by_workload` are documented "**Only visible when
  authenticated with an API key or cookie; returns null for unauthenticated
  requests**" — matches our measured unauth nulls. A regular API key (not
  management) should suffice; unverified — we hold no key. No public
  global-stats API exists beyond this (analytics endpoints are
  per-workspace, management-key).
- Slug resolution: endpoints API + page URL accept the bare id
  (`z-ai/glm-5` worked; 291/444 catalog ids differ from their
  `canonical_slug`) and valid dated slugs; invalid dated slugs 404. Bare-id
  page renders the canonical permaslug (`queryKey` permaslug = list API's
  `canonical_slug`); canonical-URL fetch produced identical stats (14/15
  endpoints, 1 window-edge). Page endpointStats covers the canonical
  version's endpoints only (ds4pro: 16 of the 22 the API returns for a dated
  variant).
- Metric semantics: API spec — latency = **time to first token** (ms),
  throughput = **output token generation speed** (tok/s). Page UI legend —
  "Latency is total round-trip time", TTFT described separately. **The two
  sources conflict**; measured p50 magnitudes (203–6340 ms) fit round-trip
  better than TTFT. Unresolved.
- Volatility: 30-min rolling window ⇒ data is a snapshot, not a property.
  Same model refetched 06:49 → 07:06 → 07:10 → 07:13 UTC: 12/15 providers'
  p50 throughput changed over ~25 min, ratios 0.86–1.20 (median −2.6%;
  typical ±5%; worst ±20% on a ~2.4k-request endpoint). 2–3 h drift not
  measured (session too short) — expect larger moves from window rolls;
  numbers are **non-idempotent by nature** (every run yields a committed
  diff).
- Cost: 39 fetches = 33.8 s wall incl. 0.5 s sleeps, 43.5 MB → 154 models ≈
  2.2 min and ~170 MB per run (page path). Key path ≈ 154 × 5–22 KB JSON ≈
  1.5–2.5 MB.
- Size: lean per-model payload (p50 tok/s + p50 ms + n_eps, ~71 B/model) ≈
  **11 KB** for 154; per-endpoint detail ≈ **26 KB** (vs `combined.json`
  90 KB today). Full percentiles would add ~40 B/endpoint — trivial.
- Chart today (public/app.js, public/index.html): segmented mode tabs
  (general/in/out) each render one 2D scatter, log-$x × Elo-y, 2D Pareto
  frontier as a single line (007 D1/D7), 10 px org-colored circles + 24 px
  logo badges for frontier, per-panel frontier sets; votes-as-size was
  deliberately removed (D4 — precedent against size encoding).

**Options.**

1. **Axis toggle — 4th mode "speed" in the existing seg control** (x = speed
   log, y = Elo; frontier recomputed per view, direction flips:
   faster-is-better dominance).
   - Simplifies: reuses mode tabs, per-panel frontier, fit/zoom, filters
     wholesale; frontier stays a line; ~one new panel config.
   - Complicates: price disappears from that view (and vice versa) — no
     single-glance 3-way story; two frontier notions coexist across views;
     needs a second speed metric decision if latency is shown.
2. **Bubble size encoding** (symbolSize ∝ speed).
   - Simplifies: one chart, all three dims; small `symbolSize` mapper change.
   - Complicates: D4 precedent removed size encoding (votes); frontier logo
     badges are fixed 24 px images — size can't apply to them; 10→40 px
     bubbles wreck the dense mid-chart overlap; weakest encoder, no precise
     reading.
3. **Color-scale encoding** (continuous speed → color via ECharts
   visualMap).
   - Simplifies: vendored 5.6 supports it; size/geometry untouched.
   - Complicates: replaces the org-color identity system (logos stay only on
     frontier); color is also weak for precise reading; mid-chart becomes a
     gradient wash.
4. **Separate view/tab**: same as (1) if "separate view" = a mode segment
   (the existing pattern); a fully separate page beyond the explorer
   duplicates filters/search/zoom plumbing for little gain.
5. **3-axis frontier** (dominated = ∃ model cheaper AND higher-Elo AND
   faster).
   - Simplifies: honest answer to "cheap, good, fast"; one definition
     everywhere.
   - Complicates: the 3-objective Pareto set is not a monotone chain — it
     cannot render as the current single line on any 2D projection; the
     frontier-line highlight (the site's core identity, 007 D1) degrades to
     a scattered-set highlight; tooltip/frontier-tag/spread interactions all
     need rethinking; each 2D view's frontier would under-report 3D
     dominance and the two notions silently disagree.
6. **Data placement**: (a) `public/data/speed.json` (own provenance/
   freshness, app fetches in the existing `Promise.all`) vs (b) extend
   `combined.json` records (+~90 B/model; zero client fetch changes). (a) is
   B15-forward-compatible (per-endpoint arrays serve the provider table too);
   (b) is the smallest client diff. `meta.json` is the wrong place.

**Open questions.**

1. API key: will the owner provide an OpenRouter API key for `update.py`
   (env var, never committed)? One test call settles whether the JSON path
   populates speed — it decides scrape (170 MB/fragile HTML) vs key (clean
   JSON, documented).
2. Aggregation rule per model: equal-weight median across endpoints,
   request-weighted median, or "the default/canonical provider's endpoint"?
   (6% typical / 61% max difference measured.)
3. Frontier semantics: keep per-view 2D frontier lines (speed×Elo in a speed
   view), or move to a 3-objective frontier set? (Changes the core
   highlight; see Option 5.)
4. Metric choice + labeling: throughput as the headline number, latency as
   tooltip? And which latency story is true — API spec says TTFT, page
   legend says round-trip; needs one resolving check before any axis label
   is written.
5. Min `request_count` for an endpoint to enter the aggregate (rc=1–2
   endpoints yield noisy p50s; sample p25 rc=189, so a ~30 threshold drops
   little)?
6. Diff-churn tolerance: speed numbers change every run (rolling window) —
   accept `speed.json` churn in every data commit, or round (2 sig figs) to
   mute it?
7. Fail-fast policy for sparse stats: warn-only + report (like logos) with a
   structural-validation hard floor (parse OK, p50≤p75≤p90≤p99, tok/s > 0),
   plus maybe a coverage die-threshold (~70–80%)? Hard-failing on "every
   joined model has speed" will break runs for zero-traffic legacy models
   the site can't fix.

**Effort & deps.** update.py fetch+parse+schema: **med** (page path) /
**low-med** with a working key (JSON path; simpler parser); both need a new
test seam with synthetic RSC fixtures per house discipline. Client axis
toggle: **med**; tooltip/bubble/color variants: **low–med**; 3-axis frontier:
**med–high** (semantics, not just rendering). Deps: **B15** — same per-model
fetch infra, and B15's per-endpoint dataset is a superset of what B14 needs
(if B15 lands first, B14 collapses to an aggregation + chart step; if B14
lands first, keep its file shape B15-compatible). **B16** consumes B14's
per-model speed as a comparator row. No deps on 005/008/009.

### B15 — Provider comparison table

A provider comparison table (or equivalent view) cross-referencing provider
info with the model — the per-provider layer (prices, uptime, throughput,
quantization) that OpenRouter routes over but this site currently drops.

**Preliminary evidence (in-session, 2026-09-17):**

- `update.py` collapses each model to **one price** from the list API's
  canonical endpoint; the provider dimension (N endpoints per model, each
  with own pricing/context/uptime/quantization/stats) is discarded today.
- Public endpoints API per endpoint (unauthenticated, measured): provider
  name + tag, full `pricing` (incl. cache read/write tiers, discount),
  `context_length`, `quantization`, `max_completion_tokens`,
  `max_prompt_tokens`, `supported_parameters`, tool-choice support, `status`,
  `uptime_last_30m/5m/1d`, `supports_implicit_caching`, and the (currently
  null, unauth) `latency_last_30m`/`throughput_last_30m`. The model-page SSR
  payload carries the same plus populated latency/throughput percentile stats
  (see B14).
- Endpoint counts per model vary widely: 22 (deepseek-v4-pro), 8 (glm-5), 6
  (gemini-3.8-flash), 5 (llama-4-maverick), 4 (gpt-5.2, claude-fable-5.1);
  duplicate provider names exist within one model (GMICloud ×2, BaseTen ×2,
  OpenAI ×3 at different prices) so the row semantics need dedup/display
  rules.
- Data-source cost shape: the list API covers all models in one fetch; any
  per-provider layer requires one fetch **per model** (~154 joined models →
  ~154 extra fetches per `update.py` run, JSON if endpoints API, ~1.4 MB
  HTML each if page scrape).
- Adjacent: B14 shares the same per-model fetch infrastructure; the chart's
  point price semantics (which provider's price is the point today) and the
  override-disclaimer "price is final" semantics (#347) interact.

**Findings (2026-09-17, explore sub-agent, research only).** Bottom line:
feasible on the current stack with one new committed JSON and a per-model
fetch loop in `update.py` — the endpoints API accepts the bare `or_id` we
already store (3/3 verified) and returns everything a provider table needs
except speed stats (null unauthenticated, 161/161 measured); the payload is
trimmable to ~455 KB raw / ~31 KB gz committed for all 154 joined models, and
the real design problems are semantic, not mechanical: today's chart point
price is OpenRouter's model-level list price, which sits **strictly inside**
the provider spread for 12/27 multi-endpoint models (median spread 2.0×, max
5.0×), so any provider-range display collides with both the
Pareto-over-point-prices semantics and the override "that price is final"
rule (#347); plus 6-hourly endpoints.json diffs are churny unless uptime
floats are rounded (30/46 → 8/46 changed endpoints measured) and the 013
changed-gate (D3) is amended.

**Feasibility.** Data layer: `update.py` gains a sequential fetch of
`https://openrouter.ai/api/v1/models/<or_id>/endpoints` per joined model (no
new deps — the existing `fetch()` + retry applies verbatim), normalize-trim,
one new committed file. Site: another same-origin `data/*.json`, fetchable
lazily on first drawer/section open (static assets, cookieless — nothing
changes there). No new chart library, no backend, no build step touched.

**Evidence.** (all measured 2026-09-17 UTC; commands recorded; raw artifacts
in `.tmp/b15/`)

- **Endpoint coverage of our models** — sample of 38/154 joined `or_id`s
  spread across ranks 1–384 (`python3 .tmp/b15/fetch_endpoints.py`, ~06:58,
  0.5 s sleep, all HTTP 200). Endpoints-per-model distribution: 1×11 models,
  2×4, 3×1, 4×6, 5×4, 6×6, 7×3, 8×1, 9×1, 21×1 (161 endpoints, mean 4.24 /
  model → ~650 extrapolated). **27/38 (71%) have ≥2 endpoints; 11/38 (29%)
  have exactly 1** (for those a provider table is one trivial row). 40
  distinct provider names across the sample. `uptime_last_1d` populated on
  151/161 (94%); `uptime_last_5m` null 41%, `uptime_last_30m` null 29%;
  `latency_last_30m`/`throughput_last_30m` **null on 161/161
  unauthenticated** (worse than B14's 41/41). Quantization: 'unknown' 107,
  fp8 34, fp4 8, int4 6, bf16 6. `status` ≠ 0 on 13/161 (−5 ×6, −2 ×7 —
  semantics unmapped).
- **Bare id vs canonical_slug** — `/endpoints` returned 200 for the bare
  `or_id` on 3/3 tested (claude-fable-5, glm-5, kimi-k2.6); B14's 404
  samples (`ep_deepseek_deepseek-v4.json` etc.) were ids absent from the
  current catalog (verified against `or_models_raw.json`), not a bare-id
  limitation. Our `or_id`s work directly; `canonical_slug`
  (`.tmp/b15/slugmap.json`) is unnecessary.
- **What today's single price is** — `update.py` takes the **list API's
  model-level `pricing`**, not any endpoint's. Compared live: it matches the
  min-endpoint price on 13/27 multi-endpoint models, the max on 2, and sits
  **strictly between on 12** (gemini-3.7-flash 0.75 vs 0.375–1.35; gpt-5.5
  5.0 vs 2.5–12.5; kimi-k2.6 0.95 vs 0.471–1.09; glm-5 0.6 vs 0.6–1.0). It
  equals the first-listed endpoint in 24/38. So the chart point is neither
  "cheapest provider" nor "official provider" — it is OpenRouter's own list
  price. (Owner-side recheck on the wider 32-model sample: list price
  strictly inside the spread on 20/32 — same finding, sample-dependent
  fraction.) Consequence: a provider table will regularly show prices well
  below the chart point (up to 2.2× below in-sample), and the spread
  interacts with the existing in/out spread bars (a *different* spread
  concept — those bars show the $in→$out mix, not provider variance).
- **Sizes** (161 measured endpoints): full fidelity ~1,005 B/endpoint;
  trimmed of `supported_parameters`+`supports_tool_choice` (mean 175 B +
  65 B, p95 259 B) → ~713 B; minimal keep-list
  (provider/tag/pricing/quantization/context/max_completion/status/uptime_1d)
  → ~461 B. Extrapolated committed file for 154 models × 4.24 eps: **~640 KB
  full / ~455 KB trimmed / ~295 KB minimal** raw; measured gzip on a
  38-model trimmed assembly: 83 KB raw → 5.6 KB gz (14.8×) → ~31 KB gz
  extrapolated. Context: today's four committed files total ~387 KB raw /
  ~53 KB gz. `endpoints.json` roughly doubles raw data size; lazy-loading
  keeps page-transfer unchanged.
- **Per-run cost & politeness** — 38 sequential fetches at 0.5 s spacing:
  zero 429s, latency 0.05–0.2 s (one 1.68 s outlier). Extrapolation: +154
  fetches ≈ +77 s sleep + ~18 s fetch ≈ **~95 s added to a run that is 1.76 s
  today** (013 D1); ~3 MB downloaded per run. Fine for GH Actions; the
  154-fetch rate-limit ceiling is extrapolated from 38, not proven.
- **Churn over 8 min** (snapshots 07:02:44Z vs 07:10:57Z, 5 models × ~9
  endpoints, `.tmp/b15/churn{A,B}_*.json`): **pricing churn 0/46; uptime
  churn 30/46** endpoints (raw-precision floats —
  `98.82410888527268 → 98.82792318944321`), status churn 5/46. Rounding
  `uptime_last_1d` to 0.1% cuts churn to **8/46**; dropping the 5m/30m
  windows removes the other two noisy fields. Consequence: with raw floats,
  endpoints.json diffs every 6-hourly run; 013's changed-gate (D3) currently
  covers only arena/openrouter/combined.json, so endpoints.json must either
  join the gate (commit per run — review-surface burn) or be excluded
  (unreviewed drift); rounding decides how loud that trade is.
- **Duplicate rows** — 17/38 models carry duplicate provider names (43
  duplicate rows of 161, 27%): e.g. BaseTen ×2 for kimi-k2.6, identical tag
  `baseten/fp4` and price, one with null uptime. Display/dedup rules are not
  optional.
- **Surfaces** (`public/index.html`, `public/app.js`): three chart panels +
  footer, orgs&families dropdown panel, search, spread toggle; app.js
  fetches only combined.json + meta.json. `plans/006-model-details-panel.md`
  is **PROPOSED, not executed** — a ~340px overlay drawer with
  combined.json content; B15's natural per-model home. No table component
  exists anywhere yet.

**Options.**

1. **(a) New `public/data/endpoints.json` keyed by `or_id`, trimmed fields,
   lazily fetched by the client** — *Simplifies:* keeps combined.json stable
   (005/009/014 all assume that); lazy fetch keeps page weight flat; a
   single-file diff is one blob per cron run; the 013 gate question is
   explicit and contained. *Complicates:* one more committed file + gate
   decision; join-drift pruning (endpoints for models that leave the join);
   churn policy (rounding) must be settled up front.
2. **(b) Extend `openrouter.json` entries with an `endpoints` array** —
   *Simplifies:* no new file; the endpoints layer lives where OpenRouter
   data already lives. *Complicates:* openrouter.json covers 352 models vs
   154 joined (≈2.3× the payload and fetches — or per-join filtering that
   muddies what the file means); the client doesn't fetch openrouter.json
   today, so a lazy consumer still needs a new fetch; bloats the file that
   tests and every data-diff review reads.
3. **(c) Extend `combined.json`** — *Simplifies:* client already loads it;
   no new fetch path. *Complicates:* +~30 KB gz eager on every page load for
   data most visitors never open; churns the most-reviewed file every run;
   grows the file 009/014 want to keep small. Weakest option.
4. **UI placement** — (i) *Section inside the 006 details drawer* (per-model
   provider table): *Simplifies:* right context (a model's providers are
   looked up from a model), reuses 006's drawer without new navigation;
   table of 5–7 cols fits 340px if columns are chosen tightly.
   *Complicates:* hard dependency on 006, which is unapproved — B15 alone
   has no surface until it lands; 21-endpoint models need inner scroll.
   (ii) *Standalone site-wide provider table (rows = providers, columns =
   models offered/price spread):* *Simplifies:* independent of 006; answers
   a different, legitimate question ("who sells what cheaply").
   *Complicates:* new page section + sort/filter UI; ~100+ distinct
   providers extrapolated — the table is big; answers it at provider
   granularity, not per-model, so it doesn't serve the "which provider for
   *this* model" intent well. (iii) *Expandable chart tooltip:*
   *Simplifies:* smallest diff. *Complicates:* transient and cramped —
   useless at 21 endpoints; no comparison affordance. Recommended: (i) with
   (ii) as a later independent add-on.
5. **Chart/frontier semantics** — *Display-only* (table shows the range;
   chart unchanged): keeps Pareto computed over point prices and the #347
   "price is final" disclaimer coherent if provider rows are labeled as
   routing alternatives (and the model-level price is pinned/highlighted
   when it matches an endpoint). *Semantic* (recompute frontier over
   cheapest-provider price): would flip several points into/out of the
   frontier (12/27 models have cheaper providers than their point price) — a
   core-highlight change of B14's magnitude; also collides head-on with the
   override disclaimer (a table showing a cheaper provider for an overridden
   model contradicts "that price is final" unless scoped as "the chart price
   is final; provider prices are OpenRouter routing variants").

**Open questions.**

1. **B14/B15 merge:** both need the same per-model fetch loop; B14
   additionally needs the model-page SSR payload for latency/throughput
   percentiles (endpoints API gives null unauth, 161/161). One shared
   plan/step with two consumers, or two plans with a shared
   `fetch_endpoints()` seam? Explicit owner decision requested — it changes
   which of the two ships first and whether endpoints.json is born with a
   second consumer.
2. Does B15 wait for 006 (drawer section), or is the standalone provider
   table the v1 surface?
3. Chart semantics: confirm display-only (provider range never feeds the
   frontier), or is a min-provider-price frontier wanted?
4. Override interplay: does the provider table render for overridden models
   (with a "chart price is final" caveat), or hide/skip them?
5. 013 D3 gate: include endpoints.json in the changed-gate (commit noise if
   churny) or exclude (unreviewed drift)? And the uptime rounding policy
   (0.1% measured: churn 30/46 → 8/46).
6. Is a +154-fetch burst every 6 h acceptable against OpenRouter (measured
   polite only to 38)? Fall back to: endpoints refreshed once daily within
   the same script?
7. Duplicate-row rule: dedupe by (provider_name, tag), merge, or show all
   rows?

**Effort & deps.** Data layer **med** (fetch loop + trim/normalize +
validate bands + write + churn/rounding policy; test seams: endpoint
trimming, rounding, gate). UI **low-med** inside an existing drawer (006),
**med** standalone (new section + table render + filters). Deps: 006
(proposed) for the natural surface; B14 (shared per-model fetch
infrastructure — merge question 1); 013 D3 amendment for the gate. Blockers:
none technical; the semantic decisions (point price vs provider range,
override wording) are the review-critical ones.

### B16 — Two-model comparator

A comparator: pick two models, compare them attribute-by-attribute — the
typical hardware/spec-comparison layout, adapted to the attributes this site
has.

**Preliminary evidence (in-session, 2026-09-17):**

- Available per-model attributes today (`combined.json`, 154 models, 18
  fields measured): price in/out per M, vision, context length, arena rank,
  arena Elo (+ upper/lower CI), votes, org, license, arena model name +
  variants + context length, match method/ratio; `meta.json` adds the org
  logo map. Future attribute sources: speed (B14), benchmarks (005), other
  arena boards (B6/009 line), AA indices (008 line).
- Pure client-side per the established pattern (#364: filters/search are
  client state + full re-render, no data-layer changes); the app already
  has a click-through details surface precedent to position against
  (`plans/006-model-details-panel.md`).
- No new chart library (#363): a comparator is DOM/table work — vanilla JS
  consistent with app.js, two selects + attribute rows + per-row winner
  highlighting/delta bars are all renderable with existing patterns.

**Findings (2026-09-17, explore sub-agent, research only).** Bottom line:
fully feasible client-side today with zero data-layer changes — the
comparator's natural columns already exist in `combined.json` (18 fields
measured per row, all comparison-grade ones 154/154 non-null), the render
architecture (plain-object state + full re-render, `.hidden`/`.on` class
toggles, no chart coupling needed) absorbs it as pure DOM work, and the
site's cookieless guarantee is unaffected (no storage APIs anywhere in app
code, measured). It is not a duplicate of 006's one-model drawer — 006
answers "what is this model", the comparator answers "which of the two, and
by how much" — but the smallest shape is a fourth `.panel` section with two
`<select>`s and a table-driven row spec, ~120–180 lines total, with future
attributes (B14 speed, 005 benchmarks, 008 modalities, 009 boards) landing
as one-line row additions.

**Feasibility.** All client-side per the established pattern (#364): two
`state` fields + a render function; no `update.py` changes, no new fetches,
no chart-library involvement (#363). Select options are collision-free
(or_id/or_name/arena_model all 154/154 distinct, measured); all 23 orgs have
a logo on disk for column headers (23/23 map entries ↔ files). The only
shape with real friction is any overlay, because the codebase has zero
`@media` queries — a modal needs the first small-screen rules; a stacked
panel section inherits the existing `flex-wrap`/`grid 1fr` responsiveness
for free.

**Evidence.** (all measured 2026-09-17 06:57–07:03 UTC; file:line per repo
claim)

- Field inventory, `combined.json` 154 rows × 18 fields (writer:
  update.py:322-343). Always present & non-null 154/154: `or_id`, `or_name`,
  `price_in_per_m` ($0.027–30), `price_out_per_m` ($0.08–75), `vision`
  (93 true / 61 false), `context_length` (8,191–2,000,000), `arena_elo`
  (1110.8–1505.7), `arena_elo_lower`/`arena_elo_upper` (CI width 4.9–24.5,
  mean 10.8 — band always renderable), `arena_rank` (1–384), `arena_votes`
  (2,420–129,278), `arena_org` (23 distinct), `arena_license` (18 values;
  "Proprietary" 75), `arena_model` (154 distinct), `arena_variants` (sizes
  1–5, 210 total, 41 models with >1), `match_method` (exact 123,
  prefix-base 20, prefix-variant 8, fuzzy 3). Partial:
  `arena_context_length` 134/154 (20 null), `match_ratio` 3/154 non-null
  (the 3 fuzzy rows). Classification: comparison-grade = price in/out,
  elo(+CI), rank, votes, context, vision, license, org(→logo), blended
  price (derived, app.js:148-154); identity/display = or_name, or_id,
  arena_model, arena_variants; internal join fields = match_method,
  match_ratio; dead weight = `arena_context_length` — **0 refs in app.js**
  (measured census), never surfaced.
- UI surface census (grep counts in app.js): tooltip shows rank, elo ± CI,
  votes, in/out + blended price, org, license, ctx, vision, match
  method/ratio, logo (app.js:255-290); search reads
  or_name/or_id/arena_org/arena_model/arena_variants (app.js:134-144);
  filters read vision + org|family (app.js:123-128); footer reads
  META.join/fetched_at (app.js:858-891). Logo derivation: `logoFor` =
  `assets/logos/` + `META.logos[org]` (app.js:17-20), org key via `orgOf`
  (app.js:41-45); 23/23 orgs covered, 23 files in `public/assets/logos/`
  (18 svg + 5 png).
- Render architecture: single plain-object `state` (app.js:27-35); every
  control change calls `render()` (app.js:838-856) which re-renders only the
  active mode's panel; charts lazy-init per mode, memoized (app.js:784-788).
  Show/hide = CSS `main[data-mode=…]` rules (index.html:195-200) + `.hidden
  {display:none !important}` (index.html:254) + `classList.toggle`.
  Controls: `.seg` segmented buttons with `.on` state (index.html:82-106,
  binding app.js:1106-1114), `.pill` toggles (app.js:1125-1130), absolute
  `.ofpanel` dropdown with Escape close + outside-click (index.html:121-134,
  app.js:1053-1080), `<select>` precedent planned in 009 D5 (board
  selector). No chart click handler exists today (only wheel/dblclick/pan/
  mouse listeners, app.js:593-742) — a click-to-compare flow would be new
  machinery (006's).
- Winner-highlight/delta-bar CSS precedent to reuse: `.on` states =
  `background: var(--accent-dim)` + inset accent ring (index.html:102-106,
  183-185); delta bars = the spread swatch gradient
  `linear-gradient(90deg,#60a5fa,#f59e0b)` with `.ink`/`.outk` tokens
  (index.html:255-271) and its chart-side sibling, the LinearGradient spread
  bar (app.js:330-367); panel chrome `.panel`/`.panel-head`/`.badge`/
  `.count` (index.html:273-312). "—" for missing values is established
  (fmtPrice app.js:108-115, fmtVotes app.js:117-121); CI formatting
  precedent `±round(upper−elo)` (app.js:257-259).
- Persistence: grep for `localStorage|sessionStorage|document.cookie|
  indexedDB` over `app.js`, `index.html`, `js/` → **0 matches**, 0 even in
  the vendored echarts; no `location.*`/`URLSearchParams`/`history.*` usage
  either. Footer asserts "Cookieless by design" (app.js:887). So a
  comparator is state-only (resets on reload, like every existing control —
  nothing persists today) or URL-hash-keyed (`#a=<or_id>&b=<or_id>`) as the
  only cookieless-safe shareable option; the AGENTS.md pre-commit grep stays
  clean either way.
- Positioning: 006 (PROPOSED, unexecuted) D2's content list ≈ the
  comparator's row set + two proposed carry-throughs (modelUrl, arena-side
  $/M — not in `combined.json` today, 18-field writer confirms); 006 D1 pins
  a 340px drawer. 005 (PROPOSED) adds per-benchmark scores (D2: separate
  `benchmarks.json`, plain client lookup); 008 (PROPOSED) adds
  modalities/reasoning/tools + divergence flags (D1/D2); 009 (PROPOSED) adds
  per-board elo/rank/votes map (D2); B14 explores speed (null unauth today).
  All slot into a table-driven comparator as row additions.

**Options.**

- (a) **Fourth `.panel` section below the chart** (two `<select>`s in its
  panel-head, table body, winner highlight via `.on`-style accent, delta
  bars via the swatch gradient): *simplifies* — zero chart/006 coupling, no
  new interaction machinery, inherits panel chrome and mobile flex-wrap with
  no `@media`, ~20 lines HTML + ~40–60 CSS + ~60–90 JS
  (`state.cmpA/cmpB` + `renderComparator()`); *complicates* — below the fold
  (chart min-height 620px), two 154-option selects are clunky unless
  search-seeded (of-search precedent exists), becomes a second detail
  surface if 006 also lands.
- (b) **Overlay/modal comparator** (ofpanel-style: absolute, z-index 30,
  `#0a0e16`, border+shadow, index.html:121-134): *simplifies* — focus +
  Escape/outside-click close already precedented, reachable from any scroll
  position, small CSS diff; *complicates* — two-column table needs ~600px+
  vs the 340px dropdown precedent → first real `@media` work in the
  codebase; outside-click close fights long reading; more CSS than (a) for
  the same rows.
- (c) **Fold into 006's drawer as a pin-&-compare mode**: *simplifies* — one
  details surface, D2's list is the row spec directly, eventually the most
  natural pick interaction (click bubble → compare with…); *complicates* —
  hard dependency on an unreviewed PROPOSED plan; 006 D1's 340px drawer must
  be widened/stacked for two columns (a reviewed-decision change); two
  selection state machines in one small component; delays a buildable-now
  item.
- (d) **Defer until 005/008/B14/009 land**: *simplifies* — ships once with a
  fuller row set; *complicates* — blocks a pure client feature on four
  unexecuted plans; with a table-driven row spec, later attributes are
  one-line additions, so deferral saves almost no rework.

**Open questions.**

1. Surface: (a) panel section, (b) overlay, or (c) 006 fold-in — and if (c),
   does B16 wait for 006's review?
2. Pick interaction: two selects only, search-seeded selects, or
   bubble-click "compare" (introduces the first chart click handler)?
3. Persistence: in-memory (reset on reload, consistent with all current
   controls) or URL hash (shareable, cookieless-safe)?
4. Winner directions per row: price ↓, elo ↑, context ↑, vision boolean —
   include rank ↓ and votes ↑ at all, and does CI-band overlap count as an
   elo tie?
5. Price rows: in + out as two rows (tooltip precedent), or also/instead a
   blended row at the current `state.ratio` (which lives outside the
   comparator)?
6. Delta bars: per-row normalization (log for price — 3 orders of magnitude,
   linear for elo) vs single divergent bar; render elo CI bands or the `±N`
   text only?
7. Row set v1: include identity rows (or_id link, variants list, match info)
   or comparison attributes only?

**Effort & deps.** Low-med: ~120–180 lines (HTML+CSS+JS), no data-layer
changes, no update.py, testable logic (row spec + winner function) once the
ESM split lands (017 A2). Deps: none to build now; benefits from B14 (speed
row), 005 (benchmarks rows), 008 (modality/divergence rows), 009 (per-board
elo rows), 006 (modelUrl + arena-price carry-throughs as extra rows) — each
is additive afterward, not a blocker.

### B17 — Fetch cost & blocking resilience

Owner's question (2026-09-17, verbatim): "every time you run the python
update does a lot of real requests, could we get blocked eventually? Should
we controll what to donwload and what not? Should we limit the calls in any
way? or controll when we are bloqued?"

**Context (measured 2026-09-17, during 022 step 3):**

- Per `update.py` run: 1 arena page + 1 OpenRouter list + 2 × 154 provider
  layer fetches (154 endpoints-API + 154 model pages) + logo fetches (0 at
  steady state) ≈ **310 requests, ~185 MB, ~5 min**, sequential at 0.5 s
  spacing (~1/s), unauthenticated, from GH Actions runner egress IPs.
- Cadence: 013 cron `15 */6 * * *` UTC = 4×/day ≈ **1,250 provider
  requests/day** (~37k/month), plus the 2 shared fetches × 4.
- First 154-scale live run: **zero 429s** (308 fetches, ~5 min) — the 0.5 s
  spacing (022 D9) held at scale today.
- Blocking containment today: `fetch()` is fail-fast — 429/5xx → 3 attempts
  (2 s/4 s backoff) → die → non-zero exit → no commit, no deploy; the site
  keeps serving last-good data. Runner egress IPs rotate, so a per-IP block
  is usually ephemeral for us.

**Measured constraints (2026-09-17):**

- Neither source sends cache validators: the endpoints API returns a bare
  200 (no ETag/Last-Modified/Cache-Control); the model page sends
  `cache-control: public, max-age=0, must-revalidate`. Server-side 304
  conditional fetch is out.
- The bulk `/api/v1/models` carries **no** per-model endpoints (0/444) — no
  1-call replacement for the 154 per-model API calls.
- `fetch()` treats 429 exactly like 5xx: 2 s/4 s backoff, no `Retry-After`
  parsing, ~6 s total budget. A rate-limit 429 typically means "wait ~60 s";
  the current ladder exhausts its budget inside one short limit window.
  (This is the "hardening" the owner asked about: parse `Retry-After` and
  sleep that long, else a 429-specific longer base, plus a 429 count in the
  run log. Parked with the rest per owner: explore first.)

**Candidate options (unexplored):**

1. **429 hardening in `fetch()`** — `Retry-After`-aware, 429-specific
   backoff, 429 count in the run log. Small and structural; benefits all
   fetches (arena/OR/provider/logos).
2. **TTL skip (client-side state)** — refetch a model's endpoints+page only
   if the last fetch is older than N hours. Complicates: where the state
   lives (committed file vs `.tmp`), and freshness semantics — `stats` is a
   rolling 30-min window (any TTL > 30 min means stats are always
   stale-by-TTL; pricing/provider-list/uptime are the slow fields the
   display plans actually show). Cross-ref: B15 open question 6 (daily
   endpoints refresh as fallback).
3. **429 budget** — max N rate-limit responses per run, then die with a
   clear message (don't burn 5 min through a limit storm).
4. **Deeper probe** — any bulk provider/endpoints or stats API we haven't
   found; OpenRouter's documented limits for the public surfaces.

**Findings (2026-09-18, explore sub-agent, research only).** Bottom line:
at the current shape — ~310 requests / ~5 min / 4×/day at 0.5 s spacing —
getting blocked is unlikely and nothing measured today argues for rationing:
zero real 429s in every saved run log (re-verified today), a 20-request
no-spacing burst drew only 200s, and every heavy surface already serves from
edge caches (model pages and the arena page are `x-vercel-cache: HIT`, the
models list is `cf-cache-status: HIT`) — only the 154 endpoints-API calls hit
origin, and OpenRouter's only documented GET-path limiter is Cloudflare DDoS
protection for traffic that "dramatically exceed[s] reasonable usage". The
cheap insurance lives in `fetch()`, not in fetching less: honor `Retry-After`
(documented for OpenRouter 429s, absent on 200s) with a 429-specific backoff
plus a run-level 429 budget and count, keeping the die-on-persistent-failure
contract intact — and send `Accept-Encoding: gzip`, which cuts the run's
~185 MB to ~20 MB measured (pages 11×, list 9.9×, endpoints 5.3×) with zero
request-count change. The deeper probe closed: the OpenAPI spec enumerates no
bulk endpoints/stats surface (all analytics GETs are apiKey/bearer-only), the
bulk list still carries 0/445 per-model endpoints, and TTL skip stays a B15
open-question-6 decision — its state-location and freshness semantics make it
the most complicated option, on current evidence for little gain.

**Feasibility.** All options are `update.py`-only (stdlib `urllib`), no
backend, no deps, committed JSON untouched. `fetch()` (update.py:65-85) is the
single chokepoint for arena + OR list + endpoints + pages (logos use the soft
`fetch_logo`, update.py:958-967, which never retries and never dies), so one
hardening touches every surface; `urllib.error.HTTPError` already exposes
`e.headers`, so `Retry-After` is readable today. gzip needs only an
`Accept-Encoding: gzip` request header + a `gzip.decompress` branch (stdlib)
— urllib does not decompress, but all three big surfaces send
`vary: accept-encoding` and compress when asked. TTL skip is feasible two
ways: state in `.tmp/provider/` (gitignored — works locally only; GH Actions
checkouts are fresh every run, so 0% hit there) or a committed state file,
which must join the 013 D3 changed-gate file list (update-data.yml:39-41) or
commits stall while the state advances. Server-side conditional fetch stays
out — re-measured today: endpoints API sends `cache-control: private,
no-store`, pages `max-age=0, must-revalidate`, no ETag/Last-Modified anywhere.
A 429 budget is a module-level counter + `die()` — it *is* fail-fast with a
better message.

**Evidence.** (re-measured live 2026-09-18 08:28–08:55 UTC, residential
egress, ~45 requests; scripts + raw artifacts under `.tmp/b17/`; inherited
2026-09-17 numbers marked)

- **robots.txt allows everything but `/seo/`**: `User-agent: * / Allow: / /
  Disallow: /seo/` + sitemap (curl → `.tmp/b17/robots.txt`). Model pages and
  API paths are not disallowed.
- **Edge-cache decomposition (the decisive load picture):** endpoints API
  `z-ai/glm-5/endpoints` → 200, 6,979 B, `cf-cache-status: BYPASS` (origin
  hit, every time), `cache-control: private, no-store`, no ETag/Last-Modified,
  no x-ratelimit on 200, sets `__cf_bm` (30-min cookie)
  (`.tmp/b17/ep_headers_full.txt`). Model page → 971,144 B, 5/5 fetches with
  the updater UA = `x-vercel-cache: HIT` (age 6–38 s), `x-nextjs-prerender: 1`,
  `x-nextjs-stale-time: 300`, `vary: accept-encoding`
  (`.tmp/b17/page_headers.txt`). Arena page → 2,973,966 B, 301→200, `HIT`
  (`.tmp/b17/arena.html`, `hdr_arena_final.txt`). OR list → 737,656 B,
  `cf-cache-status: HIT`, `cache-control: public, max-age=120,
  stale-while-revalidate=3600` (`.tmp/b17/hdr_orlist.txt`). So of ~310
  requests/run only ~154 origin hits are ours to manage.
- **Update vs the 09-17 notes:** the endpoints API today sends
  `cache-control: private, no-store` (09-17 said "bare 200 (no
  Cache-Control)") — conclusion unchanged, conditional fetch still out.
  Bare-id form `glm-5` (no author) 404s today: `{"error":{"message":"Not
  Found","code":404}}` — author/slug required (`.tmp/b17/ep_body_bare.json`).
- **gzip measurement (new):** page 971,144 → 87,939 B (11.0×)
  (`.tmp/b17/page_headers_gzip.txt`, `page_gzip.html`); list 737,656 → 74,693
  (9.9×); endpoints 6,979 → 1,329 (5.3×). `update.py` sends no
  Accept-Encoding today → per-run ~185 MB (inherited) is ~85–90% compressible
  → ~20 MB.
- **Burst probe (new):** `.tmp/b17/burst.py` — 20 sequential no-spacing
  requests, one endpoints URL, updater UA → 20/20 × 200 (0.04–1.55 s), no
  429, no `Retry-After`, no x-ratelimit surfaced even under burst; cf-ray
  colo alternated (MAD/BCN/MRS). Output recorded in-session; the
  rate-limit threshold was deliberately not hunted past this.
- **Zero real 429s in history:** the only "429" rg hits in
  `.tmp/step5_run_log.txt` are timestamp-digit coincidences — no saved local
  or Actions run log contains a 429 (consistent with the inherited
  zero-429 308-fetch run of 09-17).
- **UA behavior:** updater UA / curl UA / Firefox UA on the endpoints API →
  identical 200s, same headers, all set `__cf_bm`
  (`.tmp/b17/ep_curlua.json` etc.); no UA discrimination at this intensity.
  `urllib` never echoes `__cf_bm` back (no cookie jar) — no observed
  consequence; noted as a bot-scoring unknown, not a measured problem.
- **Bulk list re-check:** 445 models (444 on 09-17), 0/445 with an
  `endpoints` key → still no 1-call replacement (`.tmp/b17/models_list.json`).
- **OpenAPI enumeration (deeper probe, decisive):** openrouter.ai/openapi.json
  (2.16 MB, 92 paths / 61 GETs) — every stats/analytics GET (`/activity`,
  `/analytics/meta`, `/endpoints/zdr`, `/models/user`) declares
  apiKey/bearer; `/models/{author}/{slug}/endpoints` is the per-model call we
  already use; no bulk endpoints surface exists. Two new public GETs found:
  `/api/v1/providers` (25,353 B provider directory) and `/api/v1/models/count`
  (22 B, `{"data":{"count":445}}`) — canaries, not replacements
  (`.tmp/b17/openapi.json`).
- **Documented limits (webfetch 09-18, openrouter.ai/docs/api-reference/limits):**
  OpenRouter-platform 429s carry `X-RateLimit-Limit/Remaining/Reset`;
  `Retry-After` appears "when every attempted provider returned a retry
  hint"; guidance = "Retry with exponential backoff… honor the `Retry-After`
  header". Documented rate limits target inference (free-model 20 rpm /
  50–1000 rpd) — none cover catalog GETs; "DDoS protection: Cloudflare's …
  will block requests that dramatically exceed reasonable usage". Limits are
  global ("additional accounts or API keys will not affect your rate
  limits") — an owner key buys no quota headroom.
- **GH runner egress (api.github.com/meta + docs.github.com hosted-runners
  reference):** `actions` key = **6,926 IPv4 CIDR ranges**, updated weekly;
  "Windows and Ubuntu runners are hosted in Azure and subsequently have the
  same IP address ranges as the Azure datacenters"; GitHub itself discourages
  allowlisting these ranges; static IPs only on larger runners (Team/
  Enterprise Cloud) (`.tmp/b17/gh_meta.json`). Honest risk read: per-IP
  blocks are ephemeral for us (IPs rotate per job), but the ranges are shared
  with every GH Actions customer and Azure tenant — if others abuse
  OpenRouter from the same ranges, any throttling they earn, we inherit;
  unfixable on standard runners.
- **Parser compatibility:** today's fetched page parses with the current
  `parse_provider_page` (8 endpoints, 8 with stats) — the scrape path is
  healthy.
- Inherited (09-17, doc): ~310 req / ~185 MB / ~5 min per run; 4×/day cadence
  ≈ 1,250 provider requests/day; first 154-scale run zero 429s.

**Options.**

1. **429-aware `fetch()` (doc options 1+3 merged: Retry-After-aware ladder +
   429 base + run budget + count).** Exact change to update.py:65-85: on an
   HTTP 429 read `e.headers.get("Retry-After")` (int seconds, cap ~120 s),
   else use a 429-specific base (e.g. 30 s → 60 s, vs today's
   `RETRY_BASE_DELAY * 2**(attempt-1)` = 2 s/4 s shared with 5xx); keep a
   run-wide 429 counter printed in the report ("N rate-limit responses");
   still die on the 3rd attempt with "rate-limited" in the message. Fail-fast
   preserved: `die()` exits 1 → the workflow's commit step never runs.
   *Simplifies:* the documented 429 shape says the headers will be there when
   OR limits us; benefits all four fetch surfaces; no state, no schema,
   no cadence change; ~6 s → ~2 min worst-case for one limited fetch is still
   far under the 10-min workflow cap. *Complicates:* longer sleeps inside a
   10-min job (owner must pick the Retry-After cap); `fetch()` currently
   isn't unit-testable without network — needs a tiny pure seam
   (`_retry_delay(code, retry_after, attempt)`) to fit the 017
   characterization discipline.
2. **`Accept-Encoding: gzip` in `fetch()`** (new option, found in probe).
   Header + a `gzip.decompress` branch on `content-encoding: gzip` (stdlib,
   bytes → same text path with `errors="replace"`). *Simplifies:* −85–90%
   run bandwidth measured (185 MB → ~20 MB), faster runs, good-neighbor
   toward OpenRouter egress — the strongest "control what we download" lever
   found, with zero request-count change; today's page parses identically
   after decompress. *Complicates:* one content-encoding branch to maintain;
   compression is only *observed* when requested (vary present on all three
   surfaces) — a server could drop it silently, so the code must handle both.
3. **TTL skip / daily endpoints refresh** (doc option 2, same knob as B15 q6
   "endpoints refreshed once daily within the same script"). Refetch a
   model's endpoints+page only if last fetch > N hours. *Simplifies:* at
   N = 24 h with the 6 h cadence, ~3/4 of runs skip the whole 154×2 loop
   (~310 → ~6–12 requests those runs); locally implementable in
   `.tmp/provider/` state with zero gate impact. *Complicates:* Actions
   runners are fresh every run → needs a *committed* state file to work
   there, which must join the 013 D3 gate (update-data.yml:39-41 gates only
   arena/openrouter/combined/endpoints.json) or commits stall while state
   advances; `stats` is a 30-min rolling window → any TTL > 30 min makes
   speed stats stale-by-TTL for skipped models and `endpoints.json` a
   heterogeneous-age snapshot; commit cadence barely improves (arena
   elo/votes still move ~every run, so `combined.json` keeps committing);
   pricing/provider-list/uptime — the fields display plans actually show —
   are the only TTL-friendly ones. **Recommendation: defer behind the B15 q6
   decision; on current evidence (no 429s, edge-served pages) request
   rationing buys little.**
4. **Deeper probe — CLOSED by measurement.** No bulk endpoints/stats API for
   unauthenticated callers (OpenAPI enumeration); documented limits don't
   cover catalog GETs beyond Cloudflare DDoS protection; robots.txt allows
   our paths; GH egress situation documented above. Nothing to adopt.
   `/api/v1/models/count` is available as a 22-byte canary if ever wanted.

**Recommendation:** land 1 + 2 together as one small `fetch()`-seam change
(failsafe + bandwidth, no cadence or data change); keep 3 parked behind the
B15 q6 decision; 4 closed. Micro-hygiene optional: small jitter on
`PROVIDER_FETCH_SPACING` (0.5 s constant → 0.4–0.8 s) — near-zero value given
zero 429s; cookie echo (`__cf_bm` via `http.cookiejar`) explicitly not
recommended (real complexity, no measured benefit; the site's 020 cookieless
rule governs the site, not the scraper, either way).

**Open questions.**

1. Retry-After cap and 429 backoff base: proposal honors `Retry-After` up to
   120 s, else 30 s → 60 s — owner number needed (10-min workflow cap is the
   hard bound).
2. Adopt gzip now (recommended) or batch with the next `update.py` touch?
3. TTL skip: park behind B15 q6, or decide the daily-refresh shape now
   (N = 24 h, committed state joining the 013 D3 gate)?
4. Spacing jitter: worth the nondeterminism? (default: no).

**Effort & deps.**

- Option 1: low — ~25–40 lines in `fetch()` + a pure `_retry_delay` helper
  (unit-testable today, no network). Deps: none; the fail-fast contract and
  013's changed-gate behavior are unchanged (a died run never commits);
  benefits every future fetch surface (B15, 022 follow-ups).
- Option 2: low — ~10–15 lines in `fetch()` + one branch test. Deps: none.
- Option 3: med — state file + gate amendment (013 D3 file list) + freshness
  decision + mixed-age `endpoints.json` semantics. Deps: B15 open question 6
  (same decision, coarser granularity); 013 D3 amendment for committed state;
  interacts with 022 (provider layer) and any B15 `endpoints.json` consumer
  (B16 table).
- Options 4 (budget) is inside 1; deeper probe closed — no follow-up work.

### B18 — Frontend framework?

Owner's question (2026-09-18, verbatim): "More and more im thinking on
should we add a propper front end framework for all this? i see reactivity
here, now routes, then what? Could this framework help us? At least lets
open a exploration plan for it to be explored?"

**Context (why now, 2026-09-18):** plan 027 (demo mode — DRAFT, in
discovery) adds a URL state serializer to `public/app.js`: the whole
`state` (mode/3D, search, vision, org-families, ratio, spread, frontier)
read from the URL on load, `replaceState` + `pushState`/`popstate` history
participation on every change (027 A4/A5). The owner reads the accumulating
machinery — manual plain-object state + full re-render per change
(#364), now hand-rolled URL/history sync — as classic framework territory
(reactivity, routing, "then what?") and wants the framework question
explored before the pattern grows further.

**Standing constraints the exploration must weigh (current-stack facts):**

- Fully static, no build step: `public/` served as Workers assets as-is;
  the CF dashboard build command is a no-op `ls` (#331, #336). A framework
  that needs a bundler/compiler changes the deploy story fundamentally;
  no-build-capable options (htm+Preact, Lit, vanilla signals…) differ in
  this dimension.
- Cookieless rules (plan 020, settled): no runtime third parties — any
  framework is vendored like echarts/echarts-gl/Inter (#019); no storage
  APIs. Bundle weight lands on page load (echarts + gl already ~250 KB gz).
- Existing app: `public/app.js` 2093 lines vanilla (mode seg, panels,
  drawer + provider table, of-panel, search, 2D pan/zoom capture layer,
  3D scene, pending 027 URL state), `public/index.html` 627 lines with
  static-shell CSS state rules (`main[data-mode=…]`); no modules/ESM split
  yet — 017 A2 parked the ESM split as the prerequisite for runnable JS
  tests.
- Verification reality: no JS test suite yet (#017 A2); CDP structural
  assertions are the harness — a framework rewrite must keep that harness
  meaningful.
- Precedent questions the exploration should answer, not assume: does the
  vanilla state/render pattern actually hurt yet (pain inventory per
  feature: 006 drawer, 024 provider table, 010 search, 027 URL state), or
  is the pain only anticipated? What is the honest rewrite-risk ledger for
  2k lines of working, deployed code? Which options keep zero-build? What
  does each option do to the ECharts integration (charts are imperative —
  a reactive wrapper around `setOption` needs a deliberate seam)? Does
  027 step 1 (vanilla URL state) land first, or does this exploration gate
  it?

**Status: SETTLED 2026-09-18 — adopt Svelte 5 (round-2 final position,
owner go same day). Execution via `plans/028-svelte-rewrite.md`. Two
findings rounds below (round 2 is the final evidence base).**

**Findings (2026-09-18, explore sub-agent, research only).** Bottom line: the
vanilla pattern does not hurt yet where it counts — the line budget is ~45%
imperative ECharts/echarts-gl seam (app.js:352-1400) that no framework
abstracts, ~28% string-HTML surfaces a framework would merely re-express, and
~12% pure logic the 017 A2 ESM split already makes testable without any
framework; the duplication that does exist is small and concentrated (five
hand-rolled DOM-class mirrors of `state`, one delegated-listener convention,
three async stale-guards), and the owner's "reactivity, routes, then what"
is anticipation of 027, not a measured ache — 027's URL state is a ~60-100
line pure serializer plus one `popstate` handler, and a router solves
nothing on a one-page, four-panel site. Recommendation: stay vanilla, land
027 step 1 vanilla first (its serializer is framework-portable pure logic),
do the ESM split as the real testability unlock, and hold
@preact/signals-core (1.9 KB gz, zero imports, runs unbundled — measured) as
the pre-approved escape hatch if the re-render fan-out ever becomes
measurable cost; a full framework rewrite buys the least (the framework-
addressable share is ~28% of the file) and risks the most (CDP harness,
echarts-gl, 2,093 working deployed lines).

**Feasibility.** On the current stack (static, no-build, vendored,
cookieless, CDP harness) a no-build framework is *possible* — measured dist
files confirm Preact+hooks+htm (UMD, 3 script tags), Lit (ESM chunks + an
import map), Alpine (single UMD), and @preact/signals-core (single ESM file,
no imports) all run without a bundler/compiler, and all are storage-free
(grep for `localStorage|sessionStorage|document.cookie|indexedDB` over every
fetched build: 0 hits — the 020 rule is satisfiable with any candidate; each
new vendored file re-runs the pre-commit grep). The two hard constraints no
option escapes: (1) the charts stay imperative — `setOption`/`dispatchAction`
(app.js:9 call sites), the capture-phase wheel/pan layer (app.js:792-1016),
and echarts-gl's load-order invariant (app.js:1197-1201) are unaffected by
reactivity, so a framework wraps them in lifecycle code rather than removing
them; (2) verification is the CDP harness — `.tmp/*.mjs` structural
`querySelector` assertions (46 passing per 023) keep working under light-DOM
frameworks (Preact/Alpine) and **break under Lit's default shadow DOM**
(document.querySelector does not cross shadow boundaries). The compiler-class
candidates (Solid, Svelte, Angular) are out by construction: the CF build
command is a no-op `ls` (#331, #336) and a compile step changes the deploy
story fundamentally.

**Evidence.** (all measured 2026-09-18; fetches via `curl -sL URL` +
`gzip -9 | wc -c`, raw artifacts in `.tmp/b18/`; line refs at current HEAD)

- **Doc claims verified, no drift:** app.js is 2,093 lines and index.html
  627 lines — exactly the doc's figures. Grep census (app.js): 23
  `addEventListener`, 44 `getElementById|querySelector`, 6 `.innerHTML`
  assignments, 11 `render()` call sites, 34 `classList` ops, 9 `setOption`;
  `location.|history.|URLSearchParams|localStorage|sessionStorage|
  document.cookie|indexedDB` over public/ → **0 hits** — confirms both 027's
  "no URL state exists" and the cookieless rule.
- **Line budget (the decisive number):** chart machinery (chartOption
  518-761, zoom/pan capture 763-1016, 2D panels 1018-1157, 3D 1159-1400,
  badges 352-412, fit bounds 486-516) ≈ **950 lines ≈ 45%** — imperative
  ECharts/echarts-gl, untouched by any framework. String-HTML surfaces
  (tooltipHTML 414-484, drawer + provider table 1418-1691, of-panel
  1757-1967, footer 1722-1755) ≈ **590 ≈ 28%** — the part a framework's
  templating would replace. Pure logic (filters/search/price 150-181, pareto
  293-350, speed aggregation 183-291, formatting 114-148, familyOf 67-105) ≈
  **250 ≈ 12%** — the node:test prize 017 A2 unlocks framework-free.
  Controls/wiring (bindFilters 1969-2057) ≈ 90.
- **Pain inventory, per feature:**
  - *006 drawer* (1675-1691): `state.selected` + `renderDetails()` full
    innerHTML rebuild on every render; close has 4 paths (× 2029, chart click
    863-876, zrender empty-area 878-885, pan-timestamp guard 855/864/972);
    late-settle re-render idempotence by convention (1690).
  - *024 provider table* (1418-1591): `PROV_SORT` module state (1426)
    survives innerHTML wipes **by convention**; sort headers delegated on the
    static drawer shell (2035-2042) precisely because the tbody is rebuilt —
    the codebase has already paid and fixed the "innerHTML wipes listeners"
    tax once, structurally.
  - *search/filters*: **five hand-rolled DOM-class mirrors of `state`**
    (seg-mode 1974-1976, seg-vision 1994-1997, tgl-3d 1985, tgl-spread 2004,
    tgl-frontier 2024) plus the ratio-val text (2010) — every new control
    repeats "toggle class + set state + render()". This is the real, present
    duplication; it is ~10 lines per control.
  - *render() fan-out* (1693-1720): every change re-runs pointsFor + O(n²)
    paretoFrontier + full not-Merge `setOption(true)` + restoreZoom + drawer
    innerHTML rebuild + search count. One search keystroke = full chart +
    drawer rebuild. At 154 rows this is measured-cheap — the ache is
    architectural (undifferentiated re-render), not a perf number.
  - *2D pan/zoom capture layer* (763-1016): `ZOOM` map (25) + captureZoom/
    restoreZoom (763-785, 1002-1016) exist because not-Merge setOption resets
    windows; capture-phase wheel/mousemove (816-850, 935-975) chosen against
    zrender's stopPropagation — deliberate, documented, framework-irrelevant.
  - *3D scene* (1159-1400): glPromise lazy-inject (260-274), the load-order
    invariant ("echarts-gl must register BEFORE the chart instance is
    created", 1197-1201), stale-state guards (`if (!state.three3d) return`,
    1203) — hand-rolled async machinery, ~30 lines of it.
  - *Async state conventions*: ENDPOINTS/ENDPOINTS_ERROR/ENDPOINTS_DONE/
    endpointsPromise quadruple (190-221) distinguishes loading/empty/error by
    convention; three `.then()` re-render guards (1089-1091, 1191-1194, 1690).
  - *027 URL state* (pending): zero URL/history usage today; A4/A5 specify a
    pure state↔params serializer + read-once seed + `replaceState`/
    `pushState`/`popstate` with debounce — ~60-100 lines, no dependency.
- **"Routes" (owner's word) grounded:** index.html is one document with four
  chart panels + a 3D overlay switched by CSS state rules
  (`main[data-mode=…]`, index.html:196-214) and `state.mode`/`state.three3d`;
  the drawer is an `<aside>` overlay. A URL here = view + filters — exactly
  027 A4's `view` param. There are no distinct documents, no route tree, no
  params beyond the state bag; router machinery (patterns, nested views,
  guards) has zero job. **Routing is a perceived requirement; 027 A4/A5 is
  the whole of it.**
- **Bundle sizes** (unpkg/jsDelivr dist, raw / `gzip -9`):
  - Preact 10.27.2 UMD 11,242 / 4,787 + hooks (ships **inside** the preact
    package at `preact@10.27.2/hooks/dist/hooks.umd.js` — `@preact/hooks` is
    not a separate npm package; unpkg 404) 3,906 / 1,611 + htm 3.1.1 UMD
    1,364 / 712 → **16.5 KB raw / 7.1 KB gz**, 3 script tags, no build.
  - @preact/signals-core 1.14.4 ESM 5,533 / 1,950 — **0 `import` statements
    (grep-verified)** → runs unbundled as one vendored `<script
    type="module">` file. Framework-free reactivity.
  - Lit 3.3.3: **no single-file dist**; 6 minified ESM chunks (lit-html
    7,300/3,214, reactive-element 6,306/2,381, css-tag 1,585/885,
    lit-element 1,124/576, directive-helpers 1,259/704, async-directive
    1,389/733) ≈ **20 KB raw / ~8.5 KB gz** + an import map for 3 bare
    specifiers (jsDelivr `+esm` is a chain of 4+ files, not one bundle).
  - Alpine 3.15.0 cdn.min.js 44,799 / 16,190 — directives on static HTML,
    mutates DOM in place (no re-render model).
  - React 18.3.1 UMD 142,586 / 47,056 (react + react-dom); **React 19 UMD →
    404 measured**; react.dev upgrade guide ("UMD builds removed"): React 19
    dropped UMD and recommends ESM CDNs (esm.sh) — a runtime third party
    forbidden by 020. 18.x is therefore a dead-end dependency.
  - Vue 3.5.22: global build w/ runtime template compiler 159,632 / 58,444;
    runtime-only 101,646 / 38,505 — technically no-build-capable, but only
    via runtime template compilation (the anti-pattern variant).
  - Solid 1.9.9: chunked ESM/CJS dist (51,089 B ESM measured), no global
    build, JSX needs its compile step → out. Svelte 5: components are
    compiled ahead of time from .svelte files; no runtime component path →
    out. Angular: `@angular/core@13/bundles/core.umd.js` → **404 measured**
    (UMD removed v13; fesm2022 + CLI-compiled templates) → out.
  - **Context:** current page-critical JS is echarts 1,034,102 / 334,357 gz9
    + echarts-gl (lazy) 639,846 / 174,715 gz9 = **509 KB combined gz9** — the
    doc's "~250 KB gz" claim is ~2× understated (served brotli is lower but
    nowhere near 250 KB combined). endpoints.json 2.2 MB raw / 150 KB gz
    (lazy); combined.json 111 KB / 15.4 KB gz. Any candidate framework is
    noise (1.9-47 KB) against this.

**Options.**

1. **Stay vanilla; land 027 step 1 vanilla; do the 017 A2 ESM split when
   first triggered.**
   - *Simplifies:* zero new bytes, zero deploy/verification churn; the URL
     serializer is pure logic — directly node:test-able after A2; CDP
     harness, echarts seam, cookie grep all untouched.
   - *Complicates:* the five class-mirrors and convention-enforced
     invariants stay and multiply roughly linearly with controls (005
     benchmark picker, 008 fields, 009 board select each add one); the
     re-render fan-out stays undifferentiated.
2. **@preact/signals-core as a vendored ESM (or a ~50-line hand-rolled
   signal + microtask renderer) — reactivity without a framework.**
   - *Simplifies:* 1.9 KB gz, no build, no rewrite — `render()` stays, only
     the hottest paths (search → panel, ratio → blend) get
     dependency-tracked; kills the fan-out where it ever matters; node:test
     unaffected.
   - *Complicates:* two mental models (plain `state` + signals) during a
     partial migration; no templating win (string-HTML remains); discipline
     needed not to reinvent half a framework.
3. **Preact 10 + hooks + htm (UMD, 3 script tags, 7.1 KB gz).**
   - *Simplifies:* the strongest no-build full-framework option — htm
     replaces hand string-HTML, control state centralized, light DOM keeps
     the CDP harness meaningful, smallest measured footprint, panel-by-panel
     migration possible (drawer/of-panel first).
   - *Complicates:* a partial adoption = two paradigms, so the honest cost
     is a full-surface rewrite to matter; the 45% chart seam gains lifecycle
     wrappers instead of shrinking; 2,093 working lines re-verified by CDP
     re-assertion + owner A/B; classic-script globals sit awkwardly with the
     future ESM split (preact also ships ESM — resolvable).
4. **Lit 3 (ESM chunks + import map, ~8.5 KB gz).**
   - *Simplifies:* standards-based custom elements; panel-as-element fits
     the mode-panel structure; static index.html shell mostly survives.
   - *Complicates:* **default shadow DOM breaks the CDP querySelector
     harness** (must pierce or force light DOM); multi-file vendoring + an
     import map; tagged-template ergonomics without a compiler; least team
     familiarity.
5. **Alpine 3 (16.2 KB gz).**
   - *Simplifies:* zero templating migration on the control chrome —
     attributes on existing index.html markup; no re-render model to adopt.
   - *Complicates:* paradigm mismatch with the drawer/provider table
     (innerHTML string building stays anyway); 16 KB for the least
     coverage; two paradigms in one file.
6. **React 18 UMD (47.1 KB gz)** — out for the record: React 19 removed
   UMD (404 measured; react.dev), the recommended esm.sh path violates 020's
   no-runtime-third-parties, and it is the heaviest option for no measured
   benefit here.
7. **Solid / Svelte / Vue / Angular** — out: each needs a build step in its
   practical path (Solid: JSX compile + chunked ESM, no global build;
   Svelte: per-component ahead-of-time compile; Angular: CLI/AOT, UMD gone
   since v13; Vue: no-build only via runtime template compilation).

**Recommendation: option 1 now, option 2 as the pre-approved escape hatch,
option 3 as the ceiling.** Rationale from the ledger: the framework-
addressable share is ~28% of app.js while 45% is immutable imperative
ECharts; the trigger pain (027) is anticipated, not measured, and 027 A4/A5
already specifies it in ~2 portable functions; every candidate costs more in
verification (CDP re-assertion, cookie probe re-run, vendored-file review)
than the ~10-lines-per-control duplication it removes at today's scale.
Revisit triggers, concretely: (a) the render() fan-out becomes *measurable*
(profile, not vibes); (b) the 005/008/009 pipeline doubles the control count
(each adds a hand mirror); (c) a second page/view appears (the first real
routing need). If a framework is ever chosen, Preact+htm is the measured
pick (light DOM preserves the CDP harness; Lit's shadow DOM does not).

**Open questions.**

1. Gate 027 on this? Recommendation: no — step 1 lands vanilla; the
   serializer is framework-portable pure logic. Owner decides.
2. Is the reactivity desire about the *code* (duplication → 017 A2 ESM split
   is the cheaper unlock) or the *capability* (URL/history → 027 delivers it
   without a framework)?
3. Adopt a reactivity floor now (signals-core, ~2 KB, option 2) or strictly
   on a measured trigger?
4. Rewrite-risk appetite: re-verify all 46 CDP assertions + A/B the whole
   surface for a framework that touches ~28% of the code — acceptable?
5. If a framework ever lands: is the CDP constraint (light DOM) a
   pre-commitment? It eliminates Lit's default configuration up front.

**Effort & deps.** Option 1: no-op (0 bytes); 027 step 1 is its own step;
017 A2 split ~1 session when triggered. Option 2: small (~0.5-1 session:
vendor 1.9 KB, wire 2-3 paths). Option 3: med-large (3-5 sessions: controls
+ drawer + of-panel rewrite, ECharts effect seam, CDP re-assertion, cookie
probe re-run; the gradual path roughly doubles total cost). Option 4:
med-large + harness rework. Option 5: med, capped at the chrome. Deps: 027
step 1 (recommended first, any option compatible with its serializer); 017
A2 (the actual testability unlock — framework-independent, and option 3's
ESM variant depends on it); 005/008/009 (the "then what" — each adds a
control with a hand mirror; this is the revisit trigger, not a blocker).

**Findings — round 2, final (2026-09-18, explore sub-agent, research only).**
Bottom line: if the goal is the framework end-state — component tests,
structure, "it's done" — the honest all-in cost is **3-5 sessions of rewrite
+ a permanent build-based deploy surface**, it buys a **real but modest**
testability/structure win (component tests verified live: Svelte 3/3, Solid
4/4, and the suite caught a genuine fidelity bug inside a 183-line sketch), a
**token wash** (Svelte sketch −12%, Solid +1% vs current), and **zero bundle
benefit** (framework bytes 8.9-17.3 KB gz against 357 KB gz of page-critical
echarts+app). The "do it now, forget the when" argument is half-true: waiting
to +18 months adds only **≤10% to the rewrite surface** (pipeline ≈ +105-200
lines on 2,093) — the pain grows slowly — but adopting now means 027 and the
005/008/009 pipeline never write vanilla mirrors first and the test suite
grows with the features instead of after them. Of the three, only **Svelte 5**
is defensible on this stack today: stable line (5.57, monthly cadence), runes
map 1:1 onto the current plain-object state model, tests verified. **Solid**
is disqualified by timing (2.0.0-rc.8 shipped 2026-09-11 with a package
architecture split to `@solidjs/*` — adopting 1.9.15 now guarantees a second
migration inside the first year); **Qwik** is disqualified by fit
(resumability defers at most the ~23 KB app.js share while the 334 KB echarts
chart is eager by definition; qwik-city required for SSG; 1.x stalled 4
months, 2.0 in beta for 22 months; smallest ecosystem, 193k dl/mo) and the
weakest testing story. Final position: **adopt Svelte 5 now if the owner
accepts the deploy-surface change as the price of closure — otherwise stay
vanilla with the concrete triggers below. Never Qwik. Solid only after 2.0
settles.**

**Feasibility.** All three compile to a static `dist/` — the static-assets
boundary holds in every case (Svelte/Solid: `vite build`; Qwik: qwik-city
static adapter, exports `./adapters/static/vite` + `./static` measured). The
deploy story changes identically for any adoptee: dashboard build command
`npm ci && npm run build && npx wrangler deploy`; `wrangler.jsonc`
`assets.directory` `"./public"` → `"./dist"` (measured current value);
`public/` becomes source; local dev becomes `vite dev` (edit-refresh →
dev-server workflow; `update.py` untouched — it writes `public/data/*.json`,
vite serves `public/` as-is). CF build-based integration makes npm ci +
bundler run on every deploy — the #349/#358 failure class (deploy
misconfiguration, stray artifacts) gains a dependency layer: lockfile
(measured 1,932-2,021 lines / 66.8-70.3 KB), peer-dep pinning (measured
traps: qwik 1.20 caps `vite >=5 <8` while the ecosystem is at vite 8; Svelte
needs the `browser` resolve condition under vitest or `mount()` throws
server-internals errors — both reproduced today), node engines. Cookieless
holds: grep of compiled Svelte and Solid bundles for
`localStorage|sessionStorage|document.cookie|indexedDB` → **0 hits**; all
three render light DOM → the CDP `querySelector` harness keeps working
(Svelte/Solid verified structurally in the passing tests; Qwik SSG emits
static HTML). The 45% chart seam is immutable under all three: `setOption`
(9 call sites), the capture-phase pan/zoom layer, and echarts-gl's
load-order invariant stay imperative — frameworks wrap them in lifecycle
code, none remove them. **echarts stays a vendored global script in every
scenario** (019 intact: byte-pinned audit, 9 call sites unchanged, gl
ordering a script-tag fact; npm-echarts would unpin the audit, churn all 9
call sites, and add build-time coupling for no measured gain).

**Evidence.** (all measured 2026-09-18; npm registry JSON, GitHub API, dist
tarballs, real vite 8.3 builds, vitest 5 runs; artifacts under `.tmp/b18r2/`
— tarballs `solid.tgz` `svelte.tgz` `qwik.tgz` `qwikcity.tgz` + extracted
`solid/ svelte/ qwik/ qwikcity/`, demos `sveltedemo/ soliddemo/`, sketches
`sketch/`)

- **Versions / health (registry + api.github.com, fetched today):** solid-js
  **1.9.15** latest, `beta` 1.10.0-beta.0, `next` **2.0.0-rc.8** (RC cadence
  weekly: rc.1 08-11 → rc.8 09-11; release assets show the 2.0 split into
  @solidjs/signals, web, html, h, compiler, element, diagnostics, universal,
  babel-plugin). Svelte **5.57.0** (12 releases May→Aug 2026, monthly+).
  Qwik: `@builder.io/qwik` **1.20.0** published **2026-05-22** (no 1.x
  release in ~4 months); `@qwik.dev/core` **2.0.0-beta.43** (2026-09-01) —
  first 2.x publish 2024-11-15, **22 months in beta**. GitHub: solid
  36,042★/41 open issues, svelte 88,131★, QwikDev/qwik 22,067★/119 — all
  `pushed_at` today. Downloads last month: solid 15.6M, svelte 20.8M,
  **qwik core 193k + city 145k**, preact 123.6M (baseline from round 1).
- **Qwik governance (primary sources):** official post "Qwik's Next Leap —
  Moving Forward Together" (qwik.dev/blog/qwik-next-leap, **2024-03-26**):
  repo moved builderio→QwikDev, Builder.io "keeps supporting and
  sponsoring", v2 to publish under a new org. Measured 2026 reality: the
  last 30 commits on main are by the community team (maiieul, Varixo/
  Michał Popek, gioboa, woutmertens, Xia Chao) — **Miško Hevery / Adam
  Bradley / Manu Martínez-Almeida absent**; no FUNDING.yml (404 measured);
  3,499 commits in the last 52 weeks (active) but the shipped line (1.x) has
  stalled 4 months while 2.0 stays beta. Honest read: alive but in a long
  community-handoff with the stable release train paused.
- **Solid no-JSX path verified:** `solid-js/html` export exists in 1.9.15
  (package exports + `solid/html/dist/html.js` 21,675 / 5,750 gz9,
  tagged-template implementation read); official README (raw.githubusercontent
  solidjs/solid packages/solid/html/README.md): "useful to use Solid in
  non-compiled environments… as replacement for JSX" — caveats verbatim:
  reactive expressions must be **manually wrapped in functions**, refs
  callback-only, "slightly less efficient than JSX", runtime "not
  treeshakeable". Solid dist uses bare imports (3 total: `solid-js` ×2,
  `solid-js/web` ×1 — grep) so a no-build vendored path is a 2-line sed, but
  the caveats make it a fallback, not the adoption path. Solid sizes: core
  52,464/12,284 + web 30,877/8,629 (gz9).
- **Qwik resumability ceiling (decisive for this app):** page-critical JS
  today is echarts **334,378 gz9** + app.js **22,976 gz9** ≈ **357 KB gz**
  (gl 174,715 gz9 lazy). Qwik's floor is qwikloader 3,100/1,657 gz9 (inline)
  + core.min.mjs 71,549/27,500 gz9 (deferred). The chart renders on load in
  every variant, so qwik core + the chart QRL load eagerly regardless;
  resumability can defer only the ~23 KB app.js share — the "zero JS on
  load" headline has **no target here**. Also measured: `@builder.io/qwik`
  1.20 peers `vite >=5 <8` (vite 8 unsupported on the shipped line; my demos
  ran 8.3 for svelte/solid).
- **Compiled-output model (real builds, vite 8.3):** Svelte 5 ships
  **source, no prebuilt runtime** (`dist/` absent from the package —
  components import `svelte/internal/client` which the plugin
  compiles+treeshakes in). Measured: hello-world floor ($state+button)
  **25.17 KB / 10.11 KB gz**; the full drawer+provider-table sketch build
  **44.49 KB / 17.33 KB gz**. Solid (vite-plugin-solid): same sketch
  **23.68 KB / 8.91 KB gz**. Both are noise against 357 KB gz page-critical
  JS (2.5-4.9% of it).
- **Sketch measurement (app.js:1418-1691, 274 lines / 9,558 chars ≈ 2,389
  tokens, plus its wiring: PROV_SORT module state 1426, delegated sort
  headers 2035-2042, renderDetails call in render()):**
  - **Svelte 5** (`sketch/Details.svelte` + `endpoints.svelte.js`): **183
    lines / 8,365 chars ≈ 2,090 tokens (−12%)** — `{#each}/{#if}` denser
    than string concat; `$state`/`$derived` replace the module-state + manual
    re-render conventions.
  - **Solid** (`sketch/DetailsSolid.jsx` + `endpoints.solid.js`): **184
    lines / 9,667 chars ≈ 2,417 tokens (+1%)** — `Show/For` + `createMemo`
    ceremony ≈ the string concatenation it replaced.
  - **Tooling-file tax (one-time, every adoptee):** package.json (~2 lines) +
    vite.config (3) + vitest.config (8) + **lockfile 1,932-2,021 lines /
    66.8-70.3 KB ≈ ~17k tokens** committed and re-reviewed on every dep
    bump.
  - Honest AI-analyzability read: less tokens is **not** the win — parity is.
    The real win is idioms over bespoke invariants: the vanilla surface's
    conventions exist precisely because there is no framework (PROV_SORT
    survives innerHTML wipes *by convention*; sort headers delegated on the
    static shell *because* tbody is rebuilt; the
    ENDPOINTS/ENDPOINTS_ERROR/ENDPOINTS_DONE/endpointsPromise quadruple +
    the `fetchEndpoints().then(renderDetails)` re-render guard; three async
    stale-guards). All four vanished naturally in both sketches (component
    state persists; resource loading/error states are framework
    primitives). Counterweight: the app-global data flow (`state` ↔
    `filtered()` ↔ chart ↔ drawer ↔ search) stays app-global under any
    framework — "local component state" is partly fictional here; shared
    state needs a store/context, so cross-component reasoning doesn't get
    simpler, only per-component rendering does.
- **Testing, verified live:**
  - **Solid: 4/4 pass** — `@solidjs/testing-library` 0.8.10 + vitest 5.0.1 +
    happy-dom; tests: renders head+arena row with CI, sort order by $/M in,
    marked chart-price row, no-provider-data state
    (`soliddemo/src/Details.test.jsx`). Config: happy-dom env +
    `resolve.conditions: ["development","browser"]`. Friction found and
    fixed: a module-level `createResource` auto-fetches **at import time**,
    before test stubs — the sketch moved to a gated resource (also more
    faithful to vanilla's lazy fetch).
  - **Svelte: 3/3 pass** — `@testing-library/svelte` 5.4.2 + vitest 5 +
    jsdom (`sveltedemo/src/Details.test.js`); footgun reproduced: without
    `resolve.conditions: ["browser"]` svelte resolves its **server**
    internals and `mount()` throws `lifecycle_function_unavailable`
    (documented pattern, real trap). The suite immediately caught a real
    fidelity bug in the sketch (`class:marked` vs vanilla `pmarked`) — the
    exact class of regression component tests exist for. Module-level store
    state needs `vi.resetModules` between tests (noted).
  - **Qwik:** documented path = `@builder.io/qwik/testing` `createDOM` +
    vitest (`qwik add vitest`; docs read today; `testing/` export measured
    in dist) — real but lighter-weight (outerHTML/querySelector assertions,
    no testing-library queries); `@builder.io/qwik-city` 1.20 **dropped its
    `./vitest` export** (measured — absent from package exports), leaving
    QwikCityMockProvider only; historical timer/useVisibleTask$ friction in
    createDOM is a known complaint. Maturity: adequate, weakest of the
    three.
  - What becomes WRITABLE per row (vs today): vanilla+017-A2 → pure-logic
    node:test only (plus jsdom innerHTML smoke tests of the string-HTML
    functions — writable without a framework, medium ergonomics);
    signals-core → same + signal unit tests; Preact+htm →
    @testing-library/preact (mature); Solid/Svelte → full mount-level
    component tests with events + reactive settle (verified above); Qwik →
    createDOM component tests (verified-by-docs only). Chart seam under ALL
    rows: only the pure config/logic extractors are unit-testable; rendering
    itself stays CDP/Playwright. **Playwright E2E is framework-independent**
    — addable to vanilla too; it is not a framework argument.
- **Pipeline growth path quantified:** 027 step 1 ≈ **60-100 lines**
  (doc-pinned, A4/A5 — pure serializer, framework-portable per round 1);
  005 benchmark picker + rows ≈ 20-40; 008 modalities/tooltip rows (+v2
  history) ≈ 10-30; 009 board `<select>` + rows ≈ 15-30. **+6 months ≈
  +80-160 lines (+4-8% on 2,093); +18 months ≈ +105-200 (+5-10%).** The
  hand-mirror tax each new control pays is ~10 lines (round-1 measured, five
  already exist) → ~40-60 lines accumulated by +18 months — exactly what a
  framework absorbs. The rewrite cost itself is **flat in time**: the 45%
  chart seam dominates and does not grow with the pipeline. Verdict: *later
  is not materially harder — the pain grows slowly.*

**Options.**

1. **Stay vanilla; 027 step 1 vanilla; 017 A2 ESM split on trigger**
   (round-1 baseline, unchanged by this round's evidence).
   - *Simplifies:* zero deploy/verification churn; no lockfile; the measured
     window analysis shows waiting costs ≤10% extra surface later.
   - *Complicates:* the framework question recurs with every plan;
     component tests stay unwritable (jsdom smoke tests are the ceiling);
     the four bespoke conventions multiply with each pipeline control.
2. **Adopt Svelte 5 now** — vite + @sveltejs/vite-plugin-svelte 7.3,
   panel-by-panel rewrite to .svelte components, tests as the rewrite lands,
   echarts stays vendored global, CDP harness re-asserted, cookie probe
   re-run, wrangler assets → dist.
   - *Simplifies:* closes the question permanently; pipeline features land
     as components with tests from day one; runes map 1:1 to the current
     plain-object state model (smallest mental-model delta); token/line wash
     measured (−12% on the sketch); trivially healthy maintenance (monthly
     releases, 20.8M dl/mo, no pending major); scoped styles migrate the
     single global stylesheet per panel.
   - *Complicates:* permanent build-based deploy (npm ci + bundler every CF
     build; the #349/#358 class gains a dependency layer); +~2k-line
     lockfile; runtime floor 10.1 KB gz (noise here); local dev becomes
     vite dev; one config footgun already reproduced (browser condition
     under vitest); 2,093 working lines re-verified.
3. **Adopt SolidJS now.**
   - *Simplifies:* smallest measured bundle (8.9 KB gz full-sketch demo);
     tests 4/4 verified; signals close to the current model.
   - *Complicates:* **2.0.0-rc.8 shipped 2026-09-11 with a package re-scope**
     — adopting 1.9.15 now schedules a second migration (imports →
     @solidjs/*) within the first year; sketch token parity not a win (+1%);
     smaller ecosystem (15.6M dl/mo). The honest move is Solid 2.0 when it
     settles, not 1.9 today.
4. **Adopt Qwik now.**
   - *Simplifies:* nothing measurable for this app.
   - *Complicates:* resumability has no target (echarts eager by definition
     — ceiling measured above); qwik-city mandatory for SSG; peer-capped at
     vite <8 on the shipped line; 1.x stalled + 2.0 beta-limbo + community
     handoff = the riskiest maintenance story; weakest testing story; 193k
     dl/mo ecosystem. **Not adoptable on this stack.**
5. **Partial adoption (framework for new surfaces only).**
   - *Simplifies:* smaller rewrite.
   - *Complicates:* two paradigms in one app — round 1 rejected this for
     Preact and nothing here changes it; the conventions the frameworks
     eliminate are global.
6. **Adopt later with triggers.**
   - *Simplifies:* defers the deploy-surface change until the end-state
     demand is real.
   - *Complicates:* ≤10% extra rewrite surface at +18 months (measured),
     plus ~40-60 lines of accumulated mirrors — cheap defer, not a
     compounding debt.
   - **Triggers (concrete):** (a) 005+008+009 have all landed (hand-mirror
     count ~8-10, measured ~10 lines/control); (b) a second page/view is
     scheduled (first real routing need); (c) the JS test demand exceeds
     node:test + jsdom smoke tests; (d) Solid 2.0 has shipped and settled
     (if the pick is Solid).
7. **Round-1 no-build options (Preact+htm, signals-core) as baseline:**
   unchanged — they remain the low-cost reactivity ceiling (7.1 KB gz,
   CDP-safe, tests via @testing-library/preact) but do not deliver the
   component-test/structure end-state the owner is now explicitly weighting.

**Three-way synthesis:** (a) **Adopt now** — defensible and closing:
Svelte 5, sequenced 027-in-framework, pipeline after; cost 3-5 sessions +
the deploy surface. (b) **Adopt later** — the measured-defensible default:
vanilla now, triggers above, Svelte 5 as the pre-selected pick (Solid
re-evaluated after 2.0 settles). (c) **Never** — Qwik on this stack (fit +
governance + testing); and under no option does bundle/perf justify a
framework (framework bytes are 2.5-4.9% of page-critical JS, measured).

**Recommendation.** The owner's two arguments, answered with numbers:

- *"It will already be done — we forget about the when."* **Half-true.** The
  rewrite costs 3-5 sessions whenever it happens and the surface grows only
  ≤10% by +18 months — so "later is materially harder" is false. But doing
  it **now** is the only sequencing in which 027 (+60-100 lines) and the
  005/008/009 controls are written once, as components with tests, instead
  of vanilla-first-then-reexpressed — and it retires a question that has now
  cost two exploration rounds and would otherwise recur per plan. If that
  closure value is real to the owner, now is the cheapest moment it will
  ever be; if it isn't, deferring is measurably cheap too.
- *"More structure, easy for AI to analyze — less tokens? or maybe more."*
  **Measured: token parity, not less** (Svelte sketch 2,090 vs current 2,389
  tokens, −12%; Solid +1%; plus a one-time ~17k-token lockfile). The
  structure claim is **true where it counts**: both sketches naturally
  eliminated four bespoke vanilla invariants (module sort state surviving
  innerHTML wipes, delegated-on-static-shell listeners, the ENDPOINTS
  quadruple, manual settle re-renders) — known idioms replace conventions —
  and component tests became writable (verified: 7 passing tests, 1 real
  bug caught in a 183-line sketch). But app-global data flow stays
  app-global under any framework, and the 45% chart seam stays imperative —
  the analyzability win is real and modest, not transformative.

**Final position: adopt Svelte 5 now, as one dedicated rewrite window** — IF
the owner accepts the build-based deploy surface (npm ci + vite in every CF
build, committed lockfile, #349/#358-class risk widened, vite dev replacing
edit-refresh) as the price. Svelte 5 defends against Solid on timing (2.0 RC
re-scope = guaranteed second migration; Solid re-enters when 2.0 settles)
and against Qwik on fit, governance, and testing (every measured category).
Sequencing if adopted: rewrite window first, **027 lands in-framework** (its
serializer is portable pure logic — do not write it vanilla first),
005/008/009 after as components; echarts stays vendored-global; CDP harness
+ cookie probe gate the swap. If the owner does not accept the
deploy-surface price: stay vanilla (option 1/6) — nothing measured this
round contradicts round 1's cost picture.

**Open questions.**

1. The one decision everything hangs on: does the owner accept the permanent
   build-based deploy surface (build command `npm ci && npm run build && npx
   wrangler deploy`, `assets.directory` → `./dist`, lockfile committed) in
   exchange for the end-state?
2. If adopting: 027 in-framework (skip the vanilla step-1 write) — confirm
   sequencing.
3. If staying: confirm the trigger list (pipeline landed / second view /
   test demand / Solid 2.0 settled) as the standing answer to "when".
4. echarts stays a vendored global under every option — confirm (keeps 019's
   byte-pin audit and the gl load-order invariant; npm-echarts measured as
   pure downside here).
5. If adopting Svelte: TypeScript or JS components? (TS is first-class in
   Svelte 5 and strengthens the AI-analysis argument; unexplored this round
   — one open session item.)

**Effort & deps.**

- **Adopt Svelte 5 now:** **3-5 sessions** — (1) scaffold + deploy re-plumb
  (vite, plugin, vitest, lockfile, wrangler assets→dist, build command,
  first panel), (2) panels + controls + 027-in-framework, (3)
  drawer/provider-table + of-panel (the sketch is the working seed), (4)
  chart-seam lifecycle wrappers + CDP re-assertion of the 46 + cookie probe
  re-run, (5) buffer / test porting. Deps: none hard; **027** folds into
  session 2; **005/008/009** land after, as components (~unchanged effort
  each); 017 A2 is superseded (vite+vitest replaces node:test as the JS test
  seam).
- **Adopt later:** same 3-5 sessions at trigger time + the marginal surface
  (≤10%).
- **Stay vanilla:** 0 framework cost; 027 step 1 ~1 session as planned; 017
  A2 ~1 session when triggered; jsdom smoke tests of string-HTML functions
  ~0.5 session once ESM.
- **Solid/Qwik:** Solid = revisit after 2.0 stable + settle (a future round,
  ~1 session to re-cost); Qwik = closed on this stack.

*Bridged from round 1: line budget (45/28/12), no-build dists, CDP harness,
cookieless — not re-derived; this round adds registry/GitHub health, real
toolchain builds, live component tests, sketch token measurements,
deploy-story costing, and the window analysis.*

## Plan decomposition — round 2 (2026-09-17)

Owner directive (2026-09-17): split the items into separate linked plans;
the first plan guarantees the provider data layer — "correct provider data,
model providers, prices, speeds, … everything we could have"; the display
plans link to it and consume it. Doubt flagged by owner: is B15 just that
first (data) step, or two steps (get the info / show the info)?

**The "everything we could have" inventory (measured from artifacts,
2026-09-17).** Two public sources per model, each with value the other
lacks:

- **Public endpoints API** (JSON, 1 fetch/model; ~3 MB for all 154): the
  complete endpoint set incl. dated variants (22 for ds4pro); the full
  pricing subkey set (prompt, completion, web_search, input_cache_read,
  input_cache_write, input_cache_write_1h, discount, overrides, image/audio/
  input_audio_cache/internal_reasoning tiers); context_length,
  max_completion_tokens, quantization, status, supported_parameters,
  uptime_last_1d (94% populated). **No UUID on endpoints** — join identity
  is (provider_name, tag). `latency_last_30m`/`throughput_last_30m` are the
  one speed source that populates *only* with an API key (161/161 null
  unauth).
- **Model-page SSR payload** (HTML ~1.4 MB, 1 fetch/model; ~170 MB for all
  154): a 48-field endpoint object — superset of the API's core minus
  uptime — plus API-invisible fields: `data_policy` (training /
  retainsPrompts / canPublish), per-endpoint rate limits
  (`limit_rpm`/`limit_rpd`/`capacity_tpm`), `provider_info` (slug +
  baseUrl), `provider_region`, `is_hipaa_eligible`, `is_hidden`/
  `is_deranked`/`is_disabled`/`is_free`/`is_byok` flags, `created_at`,
  `deprecation_date`, `supports_reasoning`, `moderation_required`,
  `pricing_version_id`, `display_pricing` UI strings; UUID endpoint ids.
  Plus an embedded `endpointStats` sub-query in the same fetch: p50–p99
  latency + throughput percentiles, request counts, 30-min window (95% of
  endpoints / 97% of models populated, B14). Covers only the canonical
  version's endpoints (16 of ds4pro's 22) — the API covers all.
- **Strategy**: the API is the source of truth for the provider list +
  prices + uptime; the page is the source for speed stats + the rich
  fields; cross-joined on (provider_name, tag), with join-hit-rate
  validated by the data plan. An owner-provided OR key would make the API
  alone carry uptime + speed (clean, ~1.5 MB) — the page-only fields above
  would still require the page fetch to keep "everything".
- Note: this makes B14's data needs and B15's data needs the *same* fetch
  loop with a superset field set — the "first plan" is genuinely shared,
  not B15-only.

**Decomposition options** (consequences ledger):

1. **A — four plans, table standalone** (022 data / 023 speed axis /
   024 provider table / 025 comparator). *Simplifies:* clean data/UI seam —
   the data plan is a pure data commit with its own fail-fast bands and its
   own diff review (013-style), consumable by any later feature (tooltips,
   boards, …); the two display plans run in any order, in parallel; B16 is
   independent and buildable now with zero deps; the owner's B15 doubt
   resolves as "B15 = data half in the shared plan + display half in its
   own". *Complicates:* four plan docs/reviews; the data plan ships
   "invisible" value until 023/024 land (a data commit with no visible UI
   change on the live site).
2. **B — three plans, B15 as a two-step plan** (022 = B15: step 1 data,
   step 2 provider table / 023 = B14 speed axis / 024 = B16 comparator).
   *Simplifies:* one plan per original item; B15 ships data + table in a
   single review and execution; step commits keep the data/UI commit
   boundary clean anyway. *Complicates:* the "data-first" plan carries UI
   scope in its doc; 023 depends on *step 1 of another plan* (a cross-plan
   step dependency — "execute 022 through step 1 before 023"); if the table
   gets deprioritized, the data still ships via step 1 (fine) but the plan
   doc stays open.
3. **C — three plans now, comparator later** (022 data / 023 speed /
   024 table; B16 graduates when scheduled). *Simplifies:* the linked
   triple is exactly the owner's described structure. *Complicates:* B16
   is the only zero-dependency, buildable-now item in the set — parking it
   while three dependent plans get reviewed first; it still graduates as
   025.

**Recommendation: A.** It is the owner's described structure with the seam
placed at the true data/UI boundary, and it keeps the shared plan
independent of any display decision.

**Decision (owner, 2026-09-17): A — four plans, table standalone.**
`022` provider data foundation (shared, no UI) / `023` speed axis (B14's
display) / `024` provider table (B15's display) / `025` two-model comparator
(B16). All four graduate as PROPOSED plan docs the same day; execution order
is the owner's, with 022 before 023/024.

**State note (2026-09-17, post-findings):** 006 moved to EXECUTING (step
3/3) — the details drawer landed (`5fc1368`, review pass outstanding), so
the B15/B16 findings' "006 PROPOSED, not executed" characterization is
superseded: 024's "drawer section" surface is now the viable default, and
025's "fold into 006" option is live.
