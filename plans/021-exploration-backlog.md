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
