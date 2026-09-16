# Arena Pareto

LMArena frontier models ranked by quality (Elo) against OpenRouter pricing, Pareto frontier highlighted. Fully static: `public/` is served as Cloudflare Workers assets — no backend, no build step. The only logic lives in `update.py`.

## Commands

- Data update (the only "build"): `python3 update.py` — fetches both sources, joins, validates; exits non-zero on any anomaly. A failed run is never committed.
- Deploy: `npx wrangler deploy` (after the data commit is pushed).

## Testing

- Suite: `tests/` (stdlib `unittest`, zero-dep), run from repo root:
  `python3 -m unittest discover -s tests -v`; single module:
  `python3 -m unittest tests.test_normalize`; single test:
  `python3 -m unittest tests.test_normalize.TestNormalize.test_strips_config_suffixes_high_xhigh_max`.
- Layout: `test_<unit>.py` per seam (normalize, match/join, validate,
  parse_arena); one class per function, one behavior per test.
- Discipline: tests are characterization — they document current behavior
  as-is, expected values pinned from actual code output. A red test after a
  logic change is a review signal, not a failure: decide before changing
  either side. Drive behavior-changing work test-first with the `tdd` skill.
- Fixtures: synthetic, hand-written (minimal RSC-shaped payloads for
  `parse_arena`); never real page snapshots — schema drift is `update.py`
  fail-fast's job, not the fixture's.
- JS: `app.js` pure logic (Pareto, filters, formatting) is testable with
  node:test once the ESM split lands — not before (plan 017, A2); DOM and
  rendering stay manual A/B in the browser.
- Verification hierarchy: suite green → `python3 update.py` passing (sane
  match report — join counts, no unmatched regressions) → reviewed
  `public/data/` diff, `meta.json` first.

## Conventions

- No formatter or linter is configured — keep Python PEP 8-clean by hand.
- Commit style: `<type>: <message>` — data, chart, docs, deploy, init.
- Scratch and throwaway files go in `.tmp/`, never the repo root or source dirs.
- Cookieless (plan 020, settled 2026-09-17): the site sets no cookies, so
  no GDPR consent mechanism is required — and must stay that way. Rules:
  no runtime third parties (019 vendored echarts + self-hosted Inter);
  inline JS never reaches for `document.cookie`/`localStorage`/
  `sessionStorage`/`IndexedDB` (grep before commit); CF zone features that
  can set cookies (challenge actions → `__cf_bm`, Transform Rules
  `Set-Cookie`, Turnstile) stay off — or use `block`, never `challenge`;
  re-run the cookie probe at every deploy (cookie-jar curl over `/` plus
  every asset the HTML references, desktop + curl + mobile UAs — recipe in
  plans/archive/020-cookie-exploration.md).
