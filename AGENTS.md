# Arena Pareto

LMArena frontier models ranked by quality (Elo) against OpenRouter pricing, Pareto frontier highlighted. Fully static, no backend. Two halves: `update.py` (data) and the Svelte 5 explorer (front end, plan 028) — built by vite into `dist/`, served as Cloudflare Workers assets.

## Commands

- Data update: `python3 update.py` — fetches both sources, joins, validates; exits non-zero on any anomaly. A failed run is never committed.
- Front end (node ≥22): `npm ci` once; `npm run dev` (vite dev server, serves `public/data` + `public/js` at root); `npm run build` (vite → `dist/`, gitignored); `npm test` (vitest); `npx tsc --noEmit` (types; `.svelte` files need svelte-check, deliberately not wired — vitest is the gate).
- Deploy: push to main → the CF git-integration build runs `npm ci && npm run build && npx wrangler deploy` and ships `dist/`. Manual fallback: `npm run build && npx wrangler deploy` from the repo root (`rm -rf public/.wrangler` first, #440).

## Testing

- Python suite: `tests/` (stdlib `unittest`, zero-dep), run from repo root:
  `python3 -m unittest discover -s tests -v`; single module:
  `python3 -m unittest tests.test_normalize`; single test:
  `python3 -m unittest tests.test_normalize.TestNormalize.test_strips_config_suffixes_high_xhigh_max`.
- JS suite: colocated `src/**/*.test.ts` (vitest + @testing-library/svelte,
  jsdom): pure-logic units (format/family/filters/pareto/speed/colors/
  urlstate) + component tests (Details, OfPanel, SearchBox, RatioCtl).
  `npm test`; single file: `npx vitest run src/lib/pareto.test.ts`.
  Supersedes plan 017 A2's node:test seam (028 A7).
- Layout/discipline (both suites): one class/describe per function, one
  behavior per test; tests are characterization — they document current
  behavior as-is, expected values pinned from actual code output. A red
  test after a logic change is a review signal, not a failure: decide
  before changing either side. Drive behavior-changing work test-first
  with the `tdd` skill.
- Fixtures: synthetic, hand-written (minimal RSC-shaped payloads for
  `parse_arena`; typed Row fixtures for components); never real page
  snapshots — schema drift is `update.py` fail-fast's job, not the
  fixture's.
- Browser-level: headless-Chromium CDP probes per step live in `.tmp/`
  (scratch): chart/GL rendering, drawer, deep-links, cookie probe against
  a static serve of `dist/`. They are not a committed suite — rerun the
  relevant probe when touching the seam it covers.
- Verification hierarchy: python suite + `npm test` + `npx tsc --noEmit`
  green → `npm run build` clean → `python3 update.py` passing (sane match
  report — join counts, no unmatched regressions) → reviewed `public/data/`
  diff, `meta.json` first → probes when the touched seam has one.

## Conventions

- No formatter or linter is configured — keep Python PEP 8-clean by hand;
  TS/Svelte follows the existing strict style (no `any` outside the
  echarts seam).
- Commit style: `<type>: <message>` — data, chart, docs, deploy, init.
- Scratch and throwaway files go in `.tmp/`, never the repo root or source dirs.
- Cookieless (plan 020, settled 2026-09-17): the site sets no cookies, so
  no GDPR consent mechanism is required — and must stay that way. Rules:
  no runtime third parties (019 vendored echarts + self-hosted Inter);
  front-end code never reaches for `document.cookie`/`localStorage`/
  `sessionStorage`/`IndexedDB` (grep `src/` + `index.html` before commit);
  CF zone features that can set cookies (challenge actions → `__cf_bm`,
  Transform Rules `Set-Cookie`, Turnstile) stay off — or use `block`,
  never `challenge`; re-run the cookie probe at every deploy (cookie-jar
  curl over `/` plus every asset the HTML references, desktop + curl +
  mobile UAs — recipe in plans/archive/020-cookie-exploration.md).
- URL state (027 A4/A5): the full view state is deep-linkable via
  `src/lib/urlstate.ts` + `src/lib/history.svelte.ts` — defaults omitted
  from the URL; one history entry per settled change. New user-facing
  state must join the serializer (round-trip-tested), not grow a parallel
  channel.
