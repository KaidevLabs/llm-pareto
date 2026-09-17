# Arena Pareto

LMArena frontier models ranked by quality (Elo) against OpenRouter pricing,
with the Pareto frontier highlighted. Fully static site built from committed
JSON — no backend, no build step.

Live: <https://llm-pareto.kaidev.io>

## Update the data

### Scheduled (default)

The `update-data` GitHub Actions workflow
(`.github/workflows/update-data.yml`) runs `python3 update.py` every 6 h
(cron `15 */6 * * *` UTC) and can also be triggered by hand from the Actions
tab. If `arena.json`, `openrouter.json` or `combined.json` changed, it commits
the data straight to `main` (as `github-actions[bot]`, message
`data: scheduled refresh (<UTC stamp>)`) and pushes; a `meta.json`-only run
(timestamp bump, no data change) is a green no-op that commits nothing.
Fetch failures retry up to 3 attempts before the run goes red.

The push to `main` auto-deploys via the Cloudflare git integration (the
dashboard build command runs the wrangler deploy). Review surface: the data
commit's diff on `main` + the match report in the run log. A red run commits
nothing and deploys nothing — the site keeps serving last-good data.

### Manual

The manual flow stays available:

```sh
python3 update.py
```

The script fetches both sources, normalizes, joins, validates, and writes the
datasets under `public/data/`. It prints a match report and exits non-zero on
any anomaly (source format change, missing fields, match-rate collapse) — a
failed run must not be committed blindly.

Then review the diff of `public/data/` (especially `meta.json` — join counts
and the unmatched list) and commit:

```sh
git add update.py overrides.json logos.json public/data public/assets/logos && git commit -m "data: <date>"
```

Push to GitHub — the Cloudflare git integration auto-deploys `main` (Workers
static site, `wrangler.jsonc` serves `public/` as assets). Manual fallback if
the git integration is ever switched off: `npx wrangler deploy` from the repo
root.

### Deploy hygiene (`wrangler`)

Wrangler writes a local `.wrangler/` cache dir in its working directory. Run
it from the repo root so the cache lands in the gitignored root `.wrangler/`
— if it ever lands inside `public/` (e.g. wrangler was run from `public/`),
`npx wrangler deploy` uploads it as a public asset (measured on wrangler
4.133.0, which does not exclude dot dirs from assets). Before a manual deploy:
`rm -rf public/.wrangler`. The scheduled path is unaffected — Actions runs on
fresh checkouts with no local cache.

## How the join works

Arena leaderboard names and OpenRouter slugs diverge systematically. The join
is deterministic and auditable, in this priority order:

1. **override** — `overrides.json` (repo root): explicit `{"arena name": "org/slug"}`
   entries. Used when a bare arena name is genuinely ambiguous; the identity
   (and therefore the joined price) is fixed by owner decision. Applied
   overrides are recorded in `public/data/meta.json` and shown as a
   disclaimer on the site.
2. **exact** — after normalization (lowercase; parentheticals, config suffixes
   `-high`/`-xhigh`/`-max`, date tokens, `-beta`/`-preview`/`-exp`, `.` → `-`,
   `:batch`/`:free` stripped on both sides).
3. **prefix-base** — an OpenRouter model is the longest base of the arena name
   (e.g. `gpt-5.5-instant` → `openai/gpt-5.5`).
4. **prefix-variant** — the arena name is a prefix of exactly one OpenRouter
   model (e.g. `gemma-4-31b` → `google/gemma-4-31b-it`).
5. **fuzzy** — difflib similarity ≥ 0.95.

Multiple arena config-variants of the same model (e.g. `gpt-5.5` /
`gpt-5.5-high` / `gpt-5.5-instant`) collapse into one point, keeping the best
(most highly ranked) variant. Anything ambiguous falls through to the
unmatched list in the report and `meta.json` — reported, never guessed.

## Tests

The join logic in `update.py` (normalize, match, join, validate, arena
parse) is pinned by a characterization suite: `tests/`, stdlib `unittest`,
zero deps. Run from the repo root:

```sh
python3 -m unittest discover -s tests -v    # whole suite
python3 -m unittest tests.test_normalize    # one module
```

The tests document current behavior as-is: a red test after a logic change
is a review signal, not a failure — decide before changing either side.

## Data provenance

| File | Source | Notes |
|---|---|---|
| `public/data/arena.json` | `lmarena.ai/leaderboard/text` (server-rendered HTML, RSC payload) | no official API; scrape surface, fail-fast validated |
| `public/data/openrouter.json` | `openrouter.ai/api/v1/models` (public, no auth) | `:batch` variants and `~` aliases dropped |
| `public/data/combined.json` | join of the two | what the site renders |
| `public/data/meta.json` | updater | timestamps, counts, join summary, applied overrides |

## Layout

```
update.py        # the whole update mechanism (Python 3, stdlib only)
tests/           # characterization suite for update.py (stdlib unittest)
overrides.json   # explicit arena-name → openrouter-id pins
.github/workflows/update-data.yml  # scheduled data-update workflow (PR per changed run)
public/          # web root (deployed as-is)
  index.html     # the page
  app.js         # ECharts rendering + filters
  data/          # committed datasets
plans/           # plan docs (settled decisions live in the first one)
```

## Local preview

```sh
python3 -m http.server 8000 --directory public
# → http://localhost:8000
```
