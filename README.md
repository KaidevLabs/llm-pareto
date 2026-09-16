# Arena Pareto

LMArena frontier models ranked by quality (Elo) against OpenRouter pricing,
with the Pareto frontier highlighted. Fully static site built from committed
JSON — no backend, no build step.

Live: <https://lm-pareto.kaidev.io>

## Update the data

Manual, by design:

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
git add update.py overrides.json public/data && git commit -m "data: <date>"
```

Push → Cloudflare Pages deploys automatically.

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
overrides.json   # explicit arena-name → openrouter-id pins
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
