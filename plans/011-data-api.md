# 011 — Data API endpoint (processed data)

Date: 2026-09-16. **Status: PROPOSED — not reviewed, not executed.**
Source: `plans/archive/003-exploration-backlog.md` item B8 + its exploration findings.

Expose the processed data (arena×OR join + meta) as a versioned API surface for
programmatic consumers, keeping A10 (zero build; Workers static site). The four
committed JSONs stay the same-origin de-facto surface; the app.js fetch paths
stay unchanged.

## Proposed decisions (settled at owner review)

| # | decision | rationale |
|---|----------|-----------|
| D1 | Shape: minimal worker `fetch()` handler (`worker.js`, plain JS, no imports) + `wrangler.jsonc` keys `main`, `assets.binding: ASSETS`, `assets.run_worker_first: ["/api/*"]`; routes `/api/v1/models` (combined), `/api/v1/meta`, `/api/v1/raw/arena`, `/api/v1/raw/openrouter` | dry-run-verified on wrangler 4.132.0 (0.51 KiB total, no build, `ls` no-op unaffected); a handler bug can 500 only `/api/*` — static paths never touch the worker; a versioned namespace decouples consumer URLs from the app's `./data/*.json` paths (003 B8 options b vs a/c) |
| D2 | Data via `env.ASSETS.fetch` subrequest; conditional headers forwarded, etag/304 pass-through from the asset layer | the handler cannot read files directly; the measured asset layer already serves etag + 304 (0-byte revalidation) |
| D3 | CORS: `Access-Control-Allow-Origin: *` on `/api/*` + OPTIONS preflight in-handler; cache `public, max-age=300, must-revalidate` | the measured gap (no ACAO on any live path) is the only real blocker for cross-origin consumers; the etag still guards against stale reads at 300 s |
| D4 | No Workers Cache opt-in | the opt-in changes billing for *all* requests, including static assets (003 B8 billing evidence); the free tier's 100 k/day worker-request budget would only be drawn by `/api/*` |

Evidence (compressed; full measured tables in the 003 findings): live headers
measured (etag + 304 on the data JSONs, `max-age=0, must-revalidate` CF
default, no ACAO on any path, OPTIONS → 405, 404 = empty body); payloads
89.7 KB combined / 3.5 KB meta; docs + dry-run verified the `main` + `assets`
routing semantics (default routing keeps asset-matched requests out of the
handler; `run_worker_first` patterns scope worker invocation); the live site
serves `/.wrangler/cache/*` 200 (local-deploy leak — see Out of scope).

## Open questions (settled at the examination session)

1. Primary consumer profile — same-origin / server-side (option (a) zero code
   could win) vs cross-origin browser JS (D1). The decisions assume
   cross-origin is wanted.
2. Free vs paid CF account (free: `/api/*` draws on the 100 k/day budget, 429
   beyond it).
3. Cache `max-age` for `/api/*` (300 s proposed).

## Steps (commit per step; owner stages each diff)

1. `worker.js` at repo root: route `/api/v1/{models,meta,raw/arena,raw/openrouter}`
   via `env.ASSETS.fetch` (CORS + preflight + D3 headers, etag pass-through);
   everything else falls through to `env.ASSETS.fetch`. No imports, no deps.
   Commit: `api: worker fetch() handler for /api/v1/*`
2. `wrangler.jsonc`: + `main`, `assets.binding`, `assets.run_worker_first`
   (D1/D4). Verify with `npx wrangler deploy --dry-run` (bundling + binding
   registration). Commit: `deploy: wire main + assets binding for the API worker`
3. README: document the API surface (paths, CORS, cache, etag/304, the
   same-origin `./data/*.json` de-facto surface).
   Commit: `docs: data API surface`
4. Post-deploy verification (see DoD).

## Out of scope

- App-side switch to `/api/v1/*` (dual surface on purpose; revisit if a second
  consumer needs it).
- `/.wrangler/` cache-leak cleanup (deploy flow — tracked in 013's open questions).
- Endpoints that compute (filtering, aggregation) — consumers get the
  committed data as-is.

## Definition of done

- [ ] Owner approves this plan (D1–D4) in a review session.
- [ ] Live: `GET /api/v1/models` → 200, `application/json`, `Access-Control-Allow-Origin: *`, etag; `If-None-Match` → 304.
- [ ] Live: `OPTIONS /api/v1/models` → 2xx with CORS headers.
- [ ] Live: the static site is byte-identical (`/`, `/app.js`, `/data/*.json` unchanged); `npx wrangler deploy --dry-run` passes.
- [ ] A handler bug cannot 500 a static path (code review of the fall-through).
- [ ] README documents the surface.
