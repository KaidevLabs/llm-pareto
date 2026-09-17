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

### B16 — Two-model comparator

A comparator: pick two models, compare them attribute-by-attribute — the
typical hardware/spec-comparison layout, adapted to the attributes this site
has.

**Preliminary evidence (in-session, 2026-09-17):**

- Available per-model attributes today (`combined.json`, 154 models, 17
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
