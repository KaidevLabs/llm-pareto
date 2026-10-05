# 046 — Provider routing: `zdr` flag + site-wide filterable view + recipe + local check

> **Status:** OWNER REVIEW — eureka 2026-10-05.

Date: 2026-10-05.

## Goal

The provider layer gains a per-endpoint `zdr` flag (joined from `/api/v1/endpoints/zdr`), the explorer gains a **site-wide provider view** (filters: model/quant/ZDR/price) that **exports an OpenCode `providers.openrouter` block**, the filtering recipe is documented for consumers, and an **on-demand local `.sh`** (`~/.config/opencode/`) checks the owner's OpenRouter block against the published raw and proposes an update (`--apply` with backup).

## Settled decisions

| A# | decision | rationale | date |
|----|----------|-----------|------|
| 1 | Public clean list = `endpoints.json` + per-endpoint `zdr` flag (+ documented filtering recipe). No derived artifact. | Canonical layer already published/consumed (022/024); `data_policy.retainsPrompts` does not substitute the ZDR list (7 mismatches measured 2026-10-05). | 2026-10-05 |
| 2 | The filterable list + export is a **new site-wide view**; `024` closes as-is. | 024 is the per-model drawer table; its out-of-scope already deferred the site-wide table. | 2026-10-05 |
| 3 | The "API" is the **published static raw** (`data/*.json`); no compute endpoint in the worker (011 stays parked). | Parsing `endpoints.json` measured ~17 ms vs the Workers free tier's 10 ms CPU; the worker is orthogonal. | 2026-10-05 |
| 4 | Local script = **check + propose**: diff on drift; `--apply` writes with backup. | Owner's review gate. | 2026-10-05 |
| 5 | Cadence **on-demand** via `.sh` in `~/.config/opencode/`. | No daemons; the raw is 6 h fresh. | 2026-10-05 |

## Current state

- `update.py` (plan 022) builds `public/data/endpoints.json` — 161 models, one record per endpoint with `provider/tag/pricing/quantization/uptime_last_1d/stats/data_policy/…` (`fetch_provider_layer` update.py:419, `build_provider_layer` 663, `validate_provider_layer` 748, `write_endpoints` 837); `meta.json` carries the provider report counts.
- GH Action every 6 h (`15 */6 * * *`) runs `update.py` and commits when arena/openrouter/combined/endpoints/history change.
- `https://llm-pareto.kaidev.io/data/endpoints.json` → 200 (measured 2026-10-05); the published JSONs are the de-facto API.
- `/api/v1/endpoints/zdr` answers unauthenticated today: 926 entries, 916 unique `(model_id, tag)`, ~900 KB (measured 2026-10-05; the OpenAPI declares apiKey/bearer — B17 — a discrepancy step 01 must keep an eye on). The `(model_id, tag)` join against `endpoints.json` fits; 571 of the 916 fall inside the 161 joined models.
- `data_policy.retainsPrompts` (already present) ≠ ZDR: 878 agree, 7 disagree (6 `false` outside ZDR, 1 `true` inside) — hence the dedicated fetch.
- `011-data-api.md` (worker API for raw data, PROPOSED, no compute) stays parked/orthogonal.
- `024-provider-table.md` EXECUTING step 1/2 (per-model drawer table); its out-of-scope defers the site-wide table.
- Front end (Svelte 5): `App.svelte` (panels + `Comparator` as a below-chart section), stores in `src/lib/*.svelte.ts` (incl. `endpoints.svelte.ts` `ensureEndpoints()`), serializer `urlstate.ts` (AGENTS.md rule: new user-facing state joins the serializer, round-trip-tested).
- Owner config `~/.config/opencode/opencode.jsonc` is plain JSON; the `providers.openrouter.models` block was hand-built (3 models; fp8; ZDR; cheapest-first; `allow_fallbacks:false`; `limit.output:32768`).

## Design

- **Step 01** — `update.py` fetches `/api/v1/endpoints/zdr` once per run and joins `zdr: true/false` onto every endpoint in `endpoints.json`; counts in report + `meta.json`; pure seam tested.
- **Step 02** — site-wide provider view in the explorer: filterable table (model, quant, ZDR, price) + export of the `providers.openrouter` block; view state in `urlstate`; pure logic in `src/lib/routing.ts` with tests.
- **Step 03** — consumer recipe: the `zdr` field + how to build a routing whitelist from the raw (README/docs).
- **Step 04** — local `.sh` (`~/.config/opencode/`): check + propose + `--apply` with backup against the published raw.
- **Step 05** — close: full suite, DoD audit, archive.

## Execution order

| Step | File | Depends on | Status | Commit |
|------|------|------------|--------|--------|
| 01 | [01-zdr-flag.md](01-zdr-flag.md) | — | OPEN | |
| 02 | [02-provider-view.md](02-provider-view.md) | 01 | OPEN | |
| 03 | [03-docs-recipe.md](03-docs-recipe.md) | 01 | OPEN | |
| 04 | [04-local-check-script.md](04-local-check-script.md) | 01 (live: deploy) | OPEN | |
| 05 | [05-close.md](05-close.md) | 01–04 | OPEN | |

## Definition of done

- [ ] `endpoints.json` carries `zdr` per endpoint, validated on every run (counts in report/meta; fail-fast if the ZDR source fails or the join breaks).
- [ ] The ZDR join seam is covered by tests (python suite green).
- [ ] Site-wide view filters by model/quant/ZDR/price and exports the `providers.openrouter` block (pure-module vitest + CDP probe; state in urlstate with round-trip).
- [ ] `curl https://llm-pareto.kaidev.io/data/endpoints.json` shows the flag (post-deploy, owner push).
- [ ] Filtering recipe documented for consumers.
- [ ] Local `.sh` detects drift against the raw and `--apply` updates `opencode.json` with backup (fixture-proven; live run after deploy).
- [ ] Full suite green: `python3 -m unittest discover -s tests -v`, `npm test`, `npx tsc --noEmit`, `npm run build`, `python3 update.py` (sane report) + cookie probe untouched.

## Not yet specified

- Exact v1 view filters/columns and export format (`body.provider` only vs full entry with `limit`) — settles at step 02 review.
- Precomputed raw views (per model / per provider / with filters) vs fact table + on-the-fly derivation — explored when the task opens (owner's "y si hacemos ambas" is the hypothesis).
- Sharing the selection/export logic between the web view (TS) and the `.sh` (bash/python) — depends on the raw-views exploration.
- Whether the `.sh` gets a skill wrapper or stays a bare script.
- Cost/CPU of any future compute (if the dynamic API is ever reconsidered).

## Open branches

- **011** (versioned raw-data API): stays parked; revisit only if a consumer needs the versioned CORS surface. Forcing condition: cross-origin/browser consumers.
- **Precomputed raw views**: graduate to a step if the in-task exploration justifies them (cost/benefit).
- **`.sh` in the repo vs the OpenCode folder**: v1 lives in `~/.config/opencode/` (owner decision); revisit if it should be shared with others (it would become a repo artifact).

## Out of scope

- Compute endpoint in the worker (A3).
- Changes to `024` (A2).
- Extending `011` for this feature.
- Extending the flag to models outside the join (161 models).
- Chart/frontier or drawer redesign.

## Executor rules

- Standard repo flow (AGENTS.md); no formatter/linter — Python PEP 8 by hand, TS/Svelte in the existing strict style (no `any` outside the echarts seam).
- Behavior-changing steps run test-first (`tdd` skill) at the declared seams; suite after every cycle: `python3 -m unittest discover -s tests -v`, `npm test`, `npx tsc --noEmit`.
- `update.py` fail-fast: a failed run is never committed; step 01 closes on a reviewed data diff (`meta.json` first).
- Step close: owner's `staged` signal → code commit, then as-built + plan commit (`plan: 046 — step NN`). No push (Push policy).
- Scratch/throwaway goes to `.tmp/`, never the repo root or source dirs. Cookieless: no storage/cookies in the front end (grep before commit).
