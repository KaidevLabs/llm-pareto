# 001 — LLM Arena × OpenRouter pricing explorer

Approved: 2026-09-15 (discovery session, Eureka protocol).

Web page: LMArena text leaderboard quality (Elo) vs OpenRouter pricing ($/M tokens),
Pareto frontier highlighted, slick ECharts dark UI, deployed on Cloudflare Pages.
Single repo; data updates by a committed script, manually triggered.

## Settled decisions (do not revisit)

| A# | decision | rationale | date |
|----|----------|-----------|------|
| A1 | Update mechanism: zero-dep Python script downloads both sources, writes normalized+joined JSON into the repo; static site; manual updates only | reproducible, diffable in git, fail-fast, zero moving parts | 2026-09-15 |
| A2 | Deploy: Cloudflare Pages, static assets, no build step, push → auto-deploy | owner: easy to deploy with Cloudflare Pages | 2026-09-15 |
| A3 | Site: single static page, vanilla JS + ECharts | owner chose ECharts for the slick look | 2026-09-15 |
| A4 | Universe: full join (LMArena text leaderboard ∩ OpenRouter), Pareto frontier highlighted | owner: "full join … and more" | 2026-09-15 |
| A5 | Price views: input $/M and output $/M, filter-driven; default "general" view shows both | owner: "by default Input / Output Price per Million Tokens depending on the filter" | 2026-09-15 |
| A6 | Vision filter from OR `architecture.input_modalities` | verified in live API (287/446 accept image input) | 2026-09-15 |
| A7 | Script: Python, stdlib only (urllib, json, re, difflib) | owner | 2026-09-15 |
| A8 | Trigger: manual — run script, review report, commit, push | owner | 2026-09-15 |
| A9 | `muse-spark` (arena rank #13) → `meta/muse-spark-1.3` via `overrides.json` | bare arena name is ambiguous (OR lists only numbered 1.1/1.2/1.3); all versions price identically ($1.25/$4.25 per M), bare name tracks the current release | 2026-09-15 |

## Data sources (evidence 2026-09-15)

- OpenRouter: `GET https://openrouter.ai/api/v1/models` — clean REST, 446 models,
  USD per-token pricing strings, `architecture.input_modalities`, no auth.
- LMArena: no official API. Full text leaderboard (402 entries: rank+CI, Elo rating,
  votes, org, license, context, LMArena $/M) embedded in the RSC `self.__next_f`
  payload of `https://lmarena.ai/leaderboard/text`. Scraping surface — parsing is
  anchored on `"entries":[` and validated fail-fast; if the page format changes the
  script dies loudly.
- Join reality (measured): arena appends config suffixes (`-high/-xhigh/-max`,
  `(xHigh)`), date tokens (`-0902`, `-latest-20260210`, `-beta1`) to OR slugs;
  OR has `:batch` variants and `~…-latest` aliases. Deterministic normalizer +
  explicit overrides + per-update match report. Measured with the normalizer:
  44/50 top models match, 180/402 overall.

## Data layer — `update.py`

- Fetch OR → normalize → `public/data/openrouter.json`. Drop `:batch` and `~` aliases;
  `:free` tier suffixes are normalized away (paid listing wins the key collision).
  Keep: id, name, org (id prefix), in $/M, out $/M (pricing.prompt/completion × 1e6),
  vision, context_length.
- Fetch LMArena → parse RSC payload → `public/data/arena.json` (raw entries, full fidelity).
- Join (deterministic, auditable): normalize names (lowercase; dot→hyphen; strip
  parentheticals, `:batch`, config suffixes `-high/-xhigh/-max`, date tokens
  `-0902`/`-latest-YYYYMMDD`/`-MM-DD`/`-beta\d`/`-preview`/`-exp`; repeated to
  fixpoint) → exact → prefix-base (an OR model is a prefix of the arena name,
  longest base wins, e.g. `gpt-5.5-instant` → `gpt-5.5`) → prefix-variant (the
  arena name is a prefix of exactly one OR model, e.g. `gemma-4-31b` →
  `gemma-4-31b-it`; multiple → reported, not guessed) → difflib fuzzy (auto only
  at ratio ≥ 0.95, else reported with top-3 candidates) → explicit
  `overrides.json` (repo root, optional: `{arena_name: "org/model"}`, wins over
  everything).
  Multiple arena config-variants of one model → one point, best (max) Elo variant,
  variant list recorded.
- Output `public/data/combined.json` + `public/data/meta.json` (fetched_at, counts,
  match summary, `overrides_applied` — which manual overrides fired this run, so
  the site can render a general disclaimer: where the arena name is ambiguous an
  explicit owner decision fixes the identity, and that price is final).
- Fail-fast (non-zero exit + report): fetch/parse fail; arena entries outside
  50–2000; OR models outside 100–5000; >5% arena entries missing required fields;
  <90% OR models missing pricing; top-20 arena models < 90% matched (≥18/20);
  overall arena match < 40%; combined empty.
- Every run prints a match report: counts by method, top-20 status, unmatched arena
  names with top-3 candidates, collisions, collapsed variants, OR side unmatched.

## Site — `public/` (web root)

- `index.html` + `app.js`, ECharts from CDN, dark slick theme. Loads
  `data/combined.json` (same-origin fetch) + `data/meta.json` for the footer.
- Chart: scatter, x = Arena Elo, y = price per selected view ($/M). Bubble size =
  votes; color = org (capped palette). Pareto frontier = non-dominated points
  (higher Elo AND lower price) over the currently filtered set, drawn as a glowing
  connected line.
- Slick top filter bar (v1): price mode [General (both, default) | Input $/M |
  Output $/M] · vision [All | vision-capable] · frontier [on/off]. "General"
  default = two side-by-side panels (input & output), each with its own frontier.
- Footer: data timestamp, model counts, source links, and the override disclaimer
  (data-driven from `meta.json` `overrides_applied`, with the affected models
  marked on the chart).

## Repo layout

```
update.py            # the whole update mechanism (stdlib only)
overrides.json       # optional: explicit arena-name → OR-id joins
public/
  index.html  app.js
  data/  openrouter.json  arena.json  combined.json  meta.json
plans/               # step-by-step plan docs
README.md            # update flow, provenance, join rules
```

## Steps

1. `update.py` + `.gitignore`; run it; review the match report and generated data.
2. Site: `public/index.html`, `public/app.js` (ECharts, filters, frontier).
3. `README.md` + Cloudflare Pages deploy (git integration, no build, output `public/`).

## Open branches (recorded)

1. Exact default-view layout: 2 side-by-side panels vs single chart with mode toggle —
   settle at review / first A/B in the running app.
2. Org & license filters, richer per-model tooltips — "and more", phase 2.
3. Validation thresholds (top-20 ≥ 90%, overall ≥ 40%) — proposed from measured
   numbers, confirmed at review.
4. Arena-only / OR-only models: excluded from the graph (intersection), listed in
   the update report + footer count.

## Not yet specified

- Historical snapshots (Elo/price drift over time).
- Other arena leaderboards (vision, webdev).
- Multiple arenas / more sources.

## Out of scope

- Any backend/server, auth, i18n, PWA, cron automation, other chart libraries.

## Definition of done

- [ ] `python3 update.py` fetches, normalizes, joins, validates; prints match report;
      exits non-zero on anomalies
- [ ] Page renders the scatter + glowing Pareto frontier from committed JSON, dark
      ECharts theme
- [ ] Filter bar works fully client-side (price mode incl. default "both", vision,
      frontier)
- [ ] Live on Cloudflare Pages; update = script → commit → push → live
- [ ] README documents update flow, provenance, join rules
