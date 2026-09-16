# Arena Pareto

LMArena frontier models ranked by quality (Elo) against OpenRouter pricing, Pareto frontier highlighted. Fully static: `public/` is served as Cloudflare Workers assets — no backend, no build step. The only logic lives in `update.py`.

## Commands

- Data update (the only "build"): `python3 update.py` — fetches both sources, joins, validates; exits non-zero on any anomaly. A failed run is never committed.
- Deploy: `npx wrangler deploy` (after the data commit is pushed).

## Verification

No test suite exists. A change is verified by `python3 update.py` passing (sane match report — join counts, no unmatched regressions) plus a reviewed `public/data/` diff, `meta.json` first. If a change adds logic that deserves real tests, introduce a suite and drive it with the `tdd` skill before writing more code.

## Conventions

- No formatter or linter is configured — keep Python PEP 8-clean by hand.
- Commit style: `<type>: <message>` — data, chart, docs, deploy, init.
- Scratch and throwaway files go in `.tmp/`, never the repo root or source dirs.
