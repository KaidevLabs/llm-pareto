# 003 — Exploration backlog (API, ops, indexes, branding)

Date: 2026-09-16. **Status: ARCHIVED (2026-09-16)** — commits: f3bf58f (doc +
preliminary evidence); step-1 findings appended the same day; all items
graduated to their own plans (011–016) and archived in the closing commit.
This doc is the evidence base, linked from each plan.

Source: owner's post-002 ideas (2026-09-16). Second exploration backlog; it
**continues 002's ID space** (B1–B7 live in `plans/archive/002-exploration-backlog.md`)
so item references stay unique across the two backlogs.

## Process (how this backlog gets worked)

Same process as 002, with the graduation rule stated explicitly
(owner clarification 2026-09-16):

1. **Explore** — per item, one sub-agent task (research only, no code) maps the
   possibilities:
   - feasibility on the current stack (Workers static assets, ECharts,
     committed JSON, zero-dep `update.py`, no backend, `ls` no-op build)
   - evidence: measured, not assumed — live fetches, data counts, file:line
   - design options as a consequences ledger (what it simplifies / complicates),
     not a pre-baked solution
   - rough effort (low/med/high) and dependencies on other backlog items
     (B1–B13, either backlog)
   - output: a findings section appended to this doc
2. **Plan** — each item that survives exploration graduates to **its own
   numbered plan doc** `plans/00N-<slug>.md` (001/002 style: goal, settled
   decisions table, steps, DoD), grounded in that item's findings. One plan per
   examination — items are not merged into a shared plan; if two items turn out
   to be better built together, that merge is an explicit owner decision at
   review and the merged doc says so. Numbering continues the repo-wide plan
   sequence: 004–010 are already taken by 002's B1–B7 (as of 2026-09-16), so
   this backlog's items graduate from 011 up.
3. **Review** — owner reviews each plan by hand; nothing is implemented until a
   plan is agreed in a review session. Plans execute in owner-chosen order;
   items may be dropped, merged, or reordered at review.

## Backlog (order below is not priority)

### B8 — API endpoint returning the processed data

Expose the processed data (arena×OR join + meta) as an API endpoint for
programmatic consumers.

**Preliminary evidence (in-session, 2026-09-16):**

- The four committed JSONs (`public/data/{arena,openrouter,combined,meta}.json`)
  are already public, stable URLs — a de-facto same-origin API; the app itself
  fetches `combined.json` + `meta.json` (app.js:428-429).
- Measured live (curl, 2026-09-16): `/data/combined.json` returns
  `content-type: application/json`, an `etag`, `cache-control: public,
  max-age=0, must-revalidate`, but **no `Access-Control-Allow-Origin`** —
  cross-origin consumers (other origins, a JS client on a different host) cannot
  fetch the data today.
- Stack constraints (001 A10): Workers static site, `wrangler.jsonc` assets =
  `public/`, dashboard build command `ls` (no-op). Any change must keep the
  zero-build property.
- The main open mechanical question: whether a plain-JS worker `main` entry
  (`export default { fetch }`, assets via `env.ASSETS.fetch` pass-through)
  coexists with the current assets-only config and the `ls` no-op build —
  verify against the installed wrangler, and verify a handler bug can't 500 the
  whole static site (every path goes through `fetch()` first).
- Endpoint-shape candidates for the exploration: (a) zero code — document the
  committed JSONs as the API; (b) minimal worker `fetch()` handler exposing
  `/api/v1/models`, `/api/v1/meta`, … with `ACAO:*` and real cache headers;
  (c) a single `/api/v1/data` bundle `{meta, combined}`. Plus: ETag/304
  behavior, preflight, and whether the handler should serve anything beyond the
  four committed files.

**Findings (2026-09-16, explore sub-agent, research only).** Bottom line: fully
feasible on the current stack, and the core mechanical question resolves
favorably — the four committed JSONs are already a same-origin API with working
ETag/304 revalidation (measured), the only real gap is cross-origin access (no
`Access-Control-Allow-Origin` anywhere, measured), and a plain-JS `main` +
`assets` coexists with the current `wrangler.jsonc` and the `ls` no-op build
(dry-run-verified + doc-verified) such that a handler bug can 500 only the
`/api/*` paths, never the static site.

**Feasibility.** All three shapes keep A10 (no build). (a) Zero code: the
surface already exists — app.js:428-429 fetches `./data/combined.json` +
`./data/meta.json` (relative, same-origin); README.md:67-70 documents all four
files; cross-origin consumers additionally need a zone Transform Rule
(dashboard state, outside the repo). (b) A ~25-40 line `worker.js` (no imports,
no deps) plus three `wrangler.jsonc` keys (`main`, `assets.binding`,
`assets.run_worker_first`) — a dry-run deploy verified bundling and `env.ASSETS`
registration on wrangler 4.132.0 / compat 2025-09-01. (c) is a sub-case of (b):
one route that re-wraps the two committed files.

**Evidence.** (all measured 2026-09-16, UTC)
- Live headers (curl -sI, 07:36): `/` 200 text/html (no etag);
  `/data/combined.json` 200 application/json etag
  `"0f1b4f48cdf3fe4a26aa14e6569170c2"`; `/data/meta.json` 200 application/json
  etag `"fc5834ddfe3b713bd5ec0a3c3bc6b6e9"`; `/app.js` 200 text/javascript.
  All: `cache-control: public, max-age=0, must-revalidate`,
  `cf-cache-status: HIT`, and **no `Access-Control-Allow-Origin`** on any path
  (re-confirmed via GET with `Origin: https://example.com` — no CORS header
  returned). The four JSONs are the de-facto API: app.js:427-433 is a two-file
  `Promise.all` fetch, and README.md:67-70 already tabulates all four.
- Conditional requests: `If-None-Match` with combined.json's etag → **HTTP
  304** (etag echoed, edge HIT) — revalidation works today; `max-age=0,
  must-revalidate` forces a revalidation per client request but the 304 is
  cheap (edge-served, no body). `OPTIONS` on `/data/combined.json` → **405**,
  0 bytes, no ACAO. `/nope.json` → 404 with an **empty body** (0 bytes, no
  content-type, no etag); `/data/` (dir) → 404.
- Payloads (content-length, 08:30): combined 89,720 B (154 models), meta 3,465
  B, arena 224,363 B (402 entries), openrouter 69,626 B (351 models);
  combined.json fetched in 118 ms from this host. `meta.json` carries
  `fetched_at`, per-source URLs/counts, join counts + per-method breakdown
  (verified with python3).
- Tooling: `npx wrangler --version` → 4.132.0. `wrangler.jsonc` (15 lines):
  `name: llm-pareto`, `compatibility_date: 2025-09-01`,
  `assets.directory: ./public`, observability-logs block; no `main`, no
  `binding`, no `build` key.
- Dry-run deploys (scratch config in `.tmp/b8/wtest/`, no repo file touched):
  current config → "Read 11 files", 0.34 KiB, "No bindings found" — passes.
  Config with `main: ./worker.js` (plain JS, no imports) +
  `assets.binding: ASSETS` + `run_worker_first: ["/api/*"]` → passes, 0.51 KiB
  total, `env.ASSETS` binding registered. A plain-JS entry needs no build
  output — wrangler bundles at deploy time — so the dashboard `ls` no-op is
  unaffected: Workers Builds = build command (optional; docs:
  workers/ci-cd/builds/configuration/) + deploy command (default
  `npx wrangler deploy`, which bundles `main`).
- Docs (developers.cloudflare.com, fetched 2026-09-16): static-assets/ +
  static-assets/binding/ — `main` + `assets` is the documented pattern;
  **default routing serves asset-matched requests without invoking worker
  code** (only unmatched paths, or `run_worker_first` pattern paths, reach
  `fetch()`); `env.ASSETS.fetch(request)` is the pass-through;
  `run_worker_first` accepts up to 100 glob patterns. wrangler/configuration/
  Assets — the only `assets` sub-keys are `directory`, `binding`,
  `run_worker_first`, `html_handling`, `not_found_handling`: **no declarative
  `headers`/`extra_headers`** (that is a Pages feature), so CORS headers cannot
  be set in `wrangler.jsonc` alone. Compatibility — static assets GA long
  predates 2025-09-01 (full-stack frameworks GA 2025-04-08 per changelog RSS;
  the live deployment already serves assets on 2025-09-01 — 200s measured
  today); our 7 assets (max 224 KB) sit far below any vintage of the limits
  (currently 20k files / 25 MiB per file, platform/limits). Billing
  (static-assets/billing-and-limitations/) — static-asset requests are free and
  unlimited; worker requests bill at Workers rates; on the free tier,
  `run_worker_first`-matched requests always invoke the worker and **429** when
  the request quota is exhausted (no asset fallback) — with a `["/api/*"]`
  scope, only API calls draw on the free 100k/day budget and site traffic stays
  free. Workers Cache (workers/cache/, opt-in `cache.enabled`) — without
  opt-in, `fetch()` responses are **not** edge-cached (the worker runs per
  request; client-side `Cache-Control` still applies); with opt-in, *all*
  requests — including static-asset requests — bill at the Workers request rate
  (a free-plan gotcha). CORS without code — rules/transform/examples/
  add-cors-header/: a zone Transform Rule adds a static `ACAO: *` for a
  host/path expression; a simple cross-origin GET fetch does not preflight, so
  the measured OPTIONS→405 only matters for non-simple requests.
- Failure modes (routing semantics, docs + above): `run_worker_first:
  ["/api/*"]` → a handler bug 500s only `/api/*`; static paths never touch the
  worker and stay byte-identical. Default routing with `main` set → unmatched
  paths (e.g. `/nope.json`) go through the handler: a throwing handler 500s
  them instead of today's 404; a handler that falls through to
  `env.ASSETS.fetch` preserves the 404 (`not_found_handling` defaults to
  `"none"`). `run_worker_first: true` → every path goes through the handler
  (site-wide 500 risk).
- Bonus (de-facto-surface finding): the live site returns **200** for
  `/.wrangler/cache/wrangler-account.json` (application/json, etag, measured
  08:45) — wrangler's local account cache (account id + name, no secret) that a
  local `npx wrangler deploy` uploaded as a static asset; it is gitignored
  (`.gitignore:6`), so a fresh Workers-Builds git clone would not contain it —
  the de-facto API surface includes a path the repo doesn't track, consistent
  with the local-deploy flow in AGENTS.md.

**Options.**
- (a) **Zero code — document the committed JSONs as the API.**
  - Simplifies: nothing to deploy/test/maintain; 100% A10; ETag/304 already
    battle-tested (measured); README.md:67-70 is a head start; same-origin and
    server-side consumers (curl/scripts) work today with zero changes.
  - Complicates: no ACAO today → cross-origin browser fetches blocked; CORS
    needs a zone Transform Rule (dashboard/API/Terraform — state outside the
    repo, invisible in PRs); cache-control stays `max-age=0, must-revalidate`
    (304s are cheap, but a longer `max-age` needs a Transform Rule header
    rewrite too); no versioned namespace and no JSON error body (404 = 0
    bytes); the contract is "whatever `update.py` writes", enforced by
    convention only.
- (b) **Minimal `fetch()` handler, `/api/v1/*` routes** (models/meta,
  optionally raw arena/openrouter pass-through).
  - Simplifies: self-contained CORS + OPTIONS preflight in-repo (no dashboard
    state); a versioned `/api/v1` namespace decouples consumer URLs from the
    app's `./data/*.json` paths (app.js:428-429 unchanged); per-path cache
    headers (longer `max-age`, `immutable` for etag-carrying data) and JSON
    404/405 bodies; etag/304 pass-through is available by forwarding to
    `env.ASSETS.fetch` and re-attaching headers; headroom for later enrichment
    (filters, field selection).
  - Complicates: every `/api/*` request invokes the worker (free-tier request
    budget, 429 at the cap — site traffic unaffected, static assets remain
    free/unlimited); the handler cannot read files directly, so data comes via
    `env.ASSETS.fetch` subrequests; handler ↔ `update.py` schema drift is a
    second maintenance surface; a handler bug 500s only `/api/*` under
    pattern-scoped `run_worker_first` (the key answer to the core question); no
    edge caching without the opt-in Workers Cache (and its static-asset billing
    change).
  - A10: kept — plain JS, no imports, `ls` no-op still valid (dry-run: 0.51
    KiB total upload).
- (c) **Single `/api/v1/data` bundle `{meta, combined}`.**
  - Simplifies: one URL, one round trip, one cache decision for consumers; ~93
    KB payload, trivial to re-serialize.
  - Complicates: the handler fetches two assets (2 subrequests — trivially
    within the free-tier 50-subrequest default); a bundle etag (hash of the two
    asset etags) is needed for 304; freshness is bounded by the underlying
    assets' edge cache; excludes raw arena/openrouter — the moment a consumer
    wants those, (c) grows into (b).

**Open questions.**
1. Who is the consumer — same-origin / server-side (curl, scripts, the site
   itself) or cross-origin browser JS? This picks (a) vs (b).
2. If cross-origin: in-repo worker code (b) vs out-of-repo Transform Rule
   (a+CORS) — where should the CORS state live (git vs dashboard)?
3. Is the CF account free or paid? (Free: `/api/*` draws on the 100k/day
   worker-request quota, 429 beyond it.)
4. Surface scope: just `/api/v1/data` (c) or
   `/api/v1/{models,meta,arena,openrouter}` (b)?
5. Cache policy for `/api/*` (client `max-age`, etag/304 pass-through) and
   whether to opt in to Workers Cache (note the static-asset billing change).
6. Does the app itself switch to `/api/v1/*` (app.js:428-429) or keep
   `./data/*.json`, leaving two coexisting surfaces?
7. Do we want JSON 404 bodies under `/api/*` while the site's 404s stay empty?
8. Housekeeping from the evidence: the local `npx wrangler deploy` flow leaks
   `/.wrangler/cache/*` into the public surface (200 measured live) — keep it
   or move to a cleaner deploy path, and document the committed JSONs as the
   canonical surface either way?

**Effort & deps.** (a) Low — README section; optional dashboard Transform
Rule, no code. (b)/(c) Low — 25-40 line `worker.js` + 3 `wrangler.jsonc`
lines; validate with `wrangler deploy --dry-run` and a non-production-branch
preview URL (Workers Builds runs `wrangler versions upload` for non-main
branches). No hard deps on B1-B7 (client-side, 002). Touches: B10 — cron
deploys make data updates API updates; content-hash etags on the assets handle
invalidation naturally, but an opt-in Workers Cache layer would need an
explicit purge; B11 — future index fields land in the bundle and a versioned
`/api/v1` namespace absorbs them; B13 — the "export of the current filtered
set" candidate is the client-side sibling; B9's footer could link the API
URLs. Ordering is free.

### B9 — Kaidev footer / brand notice

A footer line or little section at the bottom announcing Kaidev and our
services.

**Preliminary evidence (in-session, 2026-09-16):**

- The footer exists and is JS-populated: `index.html:311` `<footer id="footer">`,
  filled by `renderFooter()` (app.js:347-372) with the spread-bar legend, source
  links (LMArena, OpenRouter), `fetched_at`, join counts/methods, and the
  overrides disclaimer; a separate `#stamp` line carries "N models · updated …".
  Footer CSS at index.html:225-236 (dark theme, gold `.ov` disclaimer).
- Brand surface today: zero — no logo, no `kaidev.io` link anywhere on the site
  (the only `kaidev` mentions in-repo are the README/plan deploy URLs).
- Open for the owner: what "our services" means (KaidevLabs org, `kaidev.io`
  domain — list named services or just link the domain and let it answer);
  placement (footer line vs corner badge vs a small section above the footer);
  size (owner's own word: "little section notice").
- Synergy to check in exploration: 002 B2's Epoch CC-BY attribution (002 B2 open
  question 6) has no home yet — one footer could carry brand + data attribution;
  OG/meta tags for link previews are the adjacent branding surface (see B13).

**Findings (2026-09-16, explore sub-agent, research only).** Bottom line: the
site's brand surface is zero today (no kaidev link/logo in `public/`), and the
whole ask is an HTML/CSS/JS-only change — no `update.py`, no data, no build
step. The existing footer is a single empty `<footer id="footer">`
(index.html:311) that `renderFooter()` fills entirely via `innerHTML`
(app.js:362) with 4 already-dense lines (spread legend, sources, join stats,
gold overrides disclaimer — the last is live today, 1 override), so a brand
line is a ~5-line JS diff, a static brand block a 1-line retarget, and a
"little section" ~40 lines of markup. `kaidev.io` is a live GitHub Pages
landing page ("Kaidev | Software Development & Code Refactoring", Kaizen
consultancy, three named service pillars) on the apex domain — `www` is broken
over HTTPS today, so any link should target `https://kaidev.io`. The
KaidevLabs org has 9 public repos but nothing product-shaped worth naming in a
footer; the landing page is the authoritative "our services" source. The
footer's existing `Sources:` line is the natural single home for brand + Epoch
CC-BY attribution (002 B2 open question 6). Adjacent: the `<head>` has no
OG/Twitter tags and no favicon (`/favicon.ico` 404s live), so link previews
resolve to title + meta description only — ~15 lines + one committed image
fixes that.

**Feasibility.** Trivially feasible on the static Workers stack; every option
is zero-build, zero-dependency. One structural fact binds the placement
options: `renderFooter()` sets `f.innerHTML` on the empty `#footer`
(app.js:348, 362), so any static markup placed *inside* `<footer>` is wiped on
load — a static block requires either restructured `<footer>` children with the
JS retargeted to an inner `<div>` (one-line change), or the block placed
outside the JS write path. A fixed corner badge is the only option needing a
genuinely new visual pattern (no `position: fixed` element exists on the page
today). OG tags + favicon are pure `<head>` additions plus one committed image
file.

**Evidence.**
- Footer anatomy (all 2026-09-16): `<footer id="footer"></footer>` at
  index.html:311; footer CSS index.html:225-236 (12px, `line-height: 1.7`,
  muted color, `border-top`, padding `16px 28px 26px`; link style 233-234;
  `.ov` gold 235-236). `renderFooter()` (app.js:347-379) renders: (1)
  spread-bar legend paragraph, ~2 wrapped lines incl. swatch + `<br>`
  (app.js:363-368); (2) `Sources: LMArena text leaderboard · OpenRouter models
  · data 2026-09-16T07:35:21Z` with two `target="_blank"` links
  (app.js:369-371); (3) `154 models joined (arena ∩ openrouter) · join: 162
  exact · 31 prefix-base · 10 prefix-variant · 6 fuzzy · 1 override`
  (app.js:373-374, from `meta.json` `join`); (4) gold `.ov` line, present today
  because `meta.json` `join.overrides_applied` = 1 entry (`muse-spark →
  meta/muse-spark-1.3`), ~2 wrapped lines (app.js:354-361). Rendered total ≈
  5–6 lines ≈ 110–125px of text + 42px padding. `#stamp` is *not* in the
  footer — it's in the header (index.html:246), CSS at index.html:56-62, filled
  at app.js:376-378 (`154 models · updated …`).
- Head inventory (index.html:3-10): L4 `<meta charset>`, L5 viewport, L6
  `<title>Arena Pareto — quality vs price</title>`, L7 `<meta
  name="description">`, L8-9 font preconnects, L10 Inter stylesheet. Missing:
  `<link rel="icon">`, `og:title/description/url/image/site_name`,
  `twitter:card`, canonical, theme-color. Measured live on
  llm-pareto.kaidev.io (2026-09-16): zero `og:`/`twitter:`/`rel="icon"`
  occurrences; `/favicon.ico` → 404 → current link preview = title +
  description, no image, no icon.
- kaidev.io (curl, 2026-09-16): apex HTTPS → 200, served by GitHub.com
  (GitHub Pages), 85 KB, Next.js static export, `last-modified: Fri, 17 Jul
  2026`. `<title>Kaidev | Software Development &amp; Code Refactoring</title>`;
  description "Consultancy specializing in software development and code
  refactoring, inspired by the Japanese philosophy of Kaizen (continuous
  improvement)". Nav: Home/About/Services/Philosophy/Testimonials/Contact/
  Blog. Three service pillars with sub-services: **Foundation & Scale**
  (Complex System Architecture & Development; Strategic Technology &
  Architecture Advisory), **Optimization & Health** (Performance & Codebase
  Optimization; High-Risk Legacy System Transformation), **Future-Proofing &
  Intelligence** (Business Process Automation; Data Mining & Custom ML Model
  Integration). `https://www.kaidev.io` fails today (HTTP 000 in ~0.04s);
  `http://www.kaidev.io` → 301 to apex. Site hosts `/favicon_Kaidev.svg` and
  `/images/logo_horizontal_flat_color_dark_bg.svg` (hotlinkable, same-origin on
  Pages).
- KaidevLabs org (github.com/KaidevLabs, fetched 2026-09-16): display name
  "Kaidev", 4 followers, Spain, website kaidev.io, info@kaidev.io, no org
  description line. 9 public repos: `llm-pareto` (this site),
  `kaidev-landing-page` (the landing itself, TypeScript), `auto-merge-workflow`,
  `aleia-privacitat`, `laravel-once-benchmark` (PHP, 2★),
  `nova-image-gallery-field` (fork, 23★), `torker` (GPL-3.0), `tech-test-2024`,
  `.github` — nothing reads as a marketable named service; the landing page is
  the service source of record.
- Attribution (002 B2 open question 6, verbatim: "Epoch requires credit
  (CC-BY) — footer note or per-benchmark source badge?"): the footer's
  `Sources:` line (app.js:369-371) already enumerates data sources as links,
  so Epoch slots in as a third link (`Epoch AI (CC-BY)` →
  `epoch.ai/data/benchmarks`) with zero restructure; LMArena/OpenRouter links
  stay untouched — brand line is a separate claim and does not clash with
  "sources".
- Brand presence today: zero — `grep -il kaidev` over the repo matches only
  README.md and plans/; `public/` contains no kaidev link or logo.

**Options.** *Placement.*
- **(a) One line appended in the JS footer** (extra string in the
  `renderFooter` template, app.js:362-375, next to or below the Sources line).
  - Simplifies: single write path, inherits all footer styles (12px muted,
    link hover underline at index.html:233-234), no new CSS, wraps naturally on
    mobile, one ~5-line diff.
  - Complicates: the footer already renders ~5-6 lines incl. the gold
    overrides disclaimer — the brand line competes for the last-line slot;
    brand text lives in a JS string (less discoverable in the markup); every
    future footer tweak touches app.js.
- **(b) Separate small static block in the HTML footer** (restructure `<footer>`
  to a static `<div class="brand">` + `<div id="footer-dyn">`; retarget
  `renderFooter` at app.js:348).
  - Simplifies: markup visible to crawlers/owner, independently styleable
    (larger text, logo, own color), zero JS string to maintain, brand survives
    future JS-footer changes.
  - Complicates: one-line id retarget in app.js; `<footer>` gains two children;
    still adds a line to footer height.
- **(c) Corner badge, fixed bottom-right pill** ("Kaidev →" linking to
  https://kaidev.io).
  - Simplifies: visually decoupled from the dense footer; persists on scroll;
    smallest visual footprint (~24px pill); footer content untouched.
  - Complicates: introduces a fixed-positioning pattern that doesn't exist on
    the page (new z-index/hover CSS, ~25-30 lines); overlaps the footer's
    bottom padding area (26px) on short pages; on mobile the pill collides with
    wrapped footer text; a floating element on an otherwise flat scroll layout.
- **(d) Slim section between chart and footer** (new element between `</main>`
  at index.html:309 and `<footer>` at index.html:311).
  - Simplifies: its own visual zone (border/background) — room for logo +
    tagline + links without crowding the footer; natural reading order (last
    thing before the fine print); the most literal match to the owner's
    "little section notice".
  - Complicates: adds one page-height band (~60-80px) before the footer; most
    markup/CSS of the four (~40 lines); full-width band on mobile.

*Content.*
- **(i) Bare**: "Arena Pareto — a Kaidev project" + link to https://kaidev.io.
  Minimal, no claims to maintain.
- **(ii) Tagline**: "Kaidev — software development & code refactoring" + link
  (measured kaidev.io title/description). One line, self-explaining.
- **(iii) Named services**: "Kaidev · Foundation & Scale · Optimization &
  Health · Future-Proofing & Intelligence" + link — the three measured pillars;
  borderline-long for a footer line (fits (d), marginal in (a)/(b));
  sub-services (BPA, custom ML…) too granular for the footer — landing page
  answers them.
- **(iv) Attribution merge**: extend the Sources line to `Sources: LMArena text
  leaderboard · OpenRouter models · Epoch AI (CC-BY) · data <fetched_at>`
  (app.js:369-371, +1 link) and put the brand line adjacent — one footer
  carries brand + data attribution and pre-empts 002 B2 open question 6. No
  clash: LMArena/OpenRouter already satisfy "sources"; Epoch is additive; brand
  is a separate claim.

**Open questions.**
1. Placement: (a) JS line, (b) static block, (c) corner badge, or (d) slim
   section? The owner's "little section notice" leans (b)/(d); "a footer line"
   reads as (a).
2. Content density: bare (i), tagline (ii), or the three named pillars (iii)?
   And link target: apex `https://kaidev.io` (www HTTPS is broken today) vs
   `/#services` anchor?
3. Does this item absorb the Epoch CC-BY credit (002 B2 open question 6) —
   i.e. pre-stage the third `Sources:` link now and let B2's plan just confirm
   wording — or stay purely brand?
4. Text-only, or a Kaidev mark (kaidev.io hosts `/favicon_Kaidev.svg` +
   horizontal logo SVG — hotlink vs commit)?
5. Scope: fold the OG tags + favicon (item 6) into this item as one "branding
   surface" commit, or keep them as the separate B13 candidate?

**Effort & deps.** Low for any combination. (a) ~5 lines in app.js; (b) ~10
lines HTML + 1 line JS; (c) ~30 lines CSS + 5 HTML; (d) ~40 lines HTML/CSS.
Content (iv) is +1 link in the same diff. OG tags + favicon: ~15 `<head>` lines
+ one committed image (e.g. `public/og.png` 1200×630 for `og:image`,
`favicon.svg`/`.ico` + `<link rel="icon">`) — all static, zero-build preserved.
Deps: **B2 (Epoch)** — if Epoch lands, the `Sources:` line gains a third link
regardless; doing (iv) here is the cheap ordering. **B13** — OG/meta tags are
listed as a B13 candidate; merging avoids two branding commits (owner call).
**B4 (logos)** — a Kaidev mark in the footer would reuse the same
asset commit-vs-hotlink decision; no hard dep. Nothing touches `update.py`, the
data JSONs, or the deploy config.

### B10 — Automated update + deploy (cron)

A cron job that runs `update.py` and then deploys — on GitHub Actions or on a
local Linux server — replacing (or shadowing) the manual-only flow.

**Preliminary evidence (in-session, 2026-09-16):**

- Current flow (settled, 001 A1/A8/A10 + project memory): manual
  `python3 update.py` → review `public/data` diff + `meta.json` → commit → push
  to main → CF git auto-deploy (build command `ls`). A failed run (exit ≠ 0) is
  never committed. This plan **amends the "manual only" convention** — that is
  the decision the owner makes at review, not a silent drift.
- `update.py` is unattended-friendly by construction: zero-dep (stdlib), two
  URL fetches, fail-fast thresholds (top-20 match ≥ 90%, overall ≥ 40%, count
  bands), prints a match report, writes atomically (temp+rename), seconds of
  runtime. One transient upstream 5xx fails the whole run (no retry today).
- GitHub Actions candidate facts to verify in exploration: free for public
  repos; `schedule:` cadence vs arena vote-cutoff freshness (text cutoff moves
  ~daily, OR prices less often); `GITHUB_TOKEN` needs `permissions: contents:
  write` to push from a scheduled workflow; a push from Actions to main **does**
  trigger the CF git deploy (verify — that would need **no CF secrets at all**);
  failure visibility (email on red run) and the slow-failure mode: arena name
  drift over weeks → match rate decay → override backlog grows silently until a
  threshold trips.
- Local Linux server candidate: cron + clone + `python3` + git push (SSH key);
  same flow, self-hosted; failure visibility is worse unless something mails
  the owner.
- The core design question is review semantics, not transport: auto-commit to
  main (hands-off, drops the diff-review step) vs cron opens a PR per run
  (owner merges after reviewing the data diff — preserves the discipline, costs
  a click; CF deploys on merge) vs hybrid (auto-commit only when the match
  report is clean by policy, else PR). Cadence, failure alerting, and
  `overrides.json` maintenance over time are the secondary questions.

**Findings (2026-09-16, explore sub-agent, research only).** Bottom line: a
cron is low-risk to run `update.py` unattended — it is zero-dep, fail-fast,
atomic, ~1.8 s, two unauthenticated fetches, and exits non-zero on any
anomaly. The real design questions are not the transport (Actions vs local
server — both trivial) but **review semantics** (auto-commit to main vs PR vs
hybrid) and a subtle **`git diff` gate flaw**: `meta.json`'s `fetched_at`
changes on *every* run, so a naive "commit only if `public/data` changed" gate
always fires. On the current Cloudflare **git-integration** setup, a push to
main auto-deploys, so the Actions job needs **no Cloudflare secrets**. Free on
a public repo with standard runners.

**Feasibility.** Both transports are feasible on the current stack (Workers
static assets, committed JSON, zero-dep `update.py`, `ls` no-op build, CF
git-deploy watching `main`).
- **Actions**: new `.github/workflows/update-data.yml` (none exists yet).
  `schedule:` cron + `workflow_dispatch`; `permissions: contents: write`;
  checkout → `setup-python` → `python3 update.py` (match report lands in the
  log; non-zero exit = red run) → commit+push only if data changed. No CF
  secrets (git-integration deploys on push). Cost: $0 (free minutes, public
  repo, standard `ubuntu-latest`).
- **Local server**: cron line + repo clone + `python3` (any modern 3.x;
  `update.py` has no version-specific stdlib features — local runs 3.14.7) +
  push credential. The remote is already SSH
  (`git@github.com:KaidevLabs/llm-pareto.git`), so a deploy key with
  push-to-`main` is the credential. No repo code change. The owner already has
  this machine class (this session runs on a Linux box at `/home/pacific`).
- **Shared precondition**: the CF git-integration "push → auto-deploy" is the
  deploy trigger for *all* review-semantics options (auto-push, PR-merge,
  hybrid), so the choice of semantics directly controls deploy timing.

**Evidence.** (all measured/fetched 2026-09-16)

`update.py` (478 lines, read in full):
- `validate()` thresholds (update.py:33-39, 337-376): arena entries 50–2000;
  OR models 100–5000; top-20 ≥18/20 matched (`TOP20_MATCH_MIN=18`); overall
  match ≥40% (`OVERALL_MATCH_MIN=0.40`); >5% arena entries missing
  `rank/modelDisplayName/rating/votes` → die; <90% OR models with pricing →
  die; fuzzy auto-join only at difflib ratio ≥0.95; empty `combined` → die.
- `fetch()` (update.py:50-62): `urllib.request.urlopen`, `TIMEOUT=60` s per
  request (line 26), UA `…llm-arena-pareto-updater/1.0`; **no retry** — any
  exception (transient 5xx, or >60 s slow) → `die()` → exit 1. **Two HTTP
  requests total** (`lmarena.ai/leaderboard/text` 301→arena.ai;
  `openrouter.ai/api/v1/models`), both unauthenticated.
- Unattended-safe: yes — atomic writes (`tempfile.mkstemp` same-dir +
  `os.replace`, update.py:381-391), deterministic join, fail-fast, idempotent.
- Match-report surface (update.py:455-474) — the human-review surface:
  `match report`; `top-20 arena models matched: N/20 (missing: […])`;
  `unmatched arena: N` + up to 30 names with top-3 candidates; `OR key
  collisions (N)`; `unmatched openrouter (not on arena): N`; `done.`
- `overrides.json` (update.py:193-202): optional, repo root; bad JSON or
  non-dict → die; returns `{normalize(k): v}`; an override wins over every
  match method (update.py:229). Currently **1** entry (`muse-spark →
  meta/muse-spark-1.3`).

Timed real run (`time python3 update.py`, 2026-09-16T07:35:20Z):
- **1.759 s wall** (0.15 s user, 0.03 s sys, ~10 % CPU — network-bound). Both
  fetches OK.
- Result: 402 arena entries; 351 OR models; **154 combined**; top-20 **20/20**;
  overall **210/402 = 52.2 %** (`by_method` exact 162 / prefix-base 31 /
  prefix-variant 10 / fuzzy 6 / override 1); 192 arena unmatched; 37 OR key
  collisions; 41 variant groups collapsed.
- Disk delta vs committed HEAD: `arena.json` byte-identical; `combined.json`
  byte-identical; `meta.json` changed (**`fetched_at` only**,
  02:51:32Z→07:35:21Z); `openrouter.json` changed (one price:
  `deepseek/deepseek-v4-flash-0731` in 0.055→0.06, out 0.11→0.12). **Left in
  the working tree, not committed** (`public/data/meta.json` +
  `public/data/openrouter.json` modified at that point; a later B13
  measurement restored `public/data` to HEAD — verified clean 07:50Z).
- Subtlety 1: the only price drift was on a **non-canonical** OR variant the
  join does not use (join uses canonical `deepseek/deepseek-v4-flash` @
  0.0886/0.1772, joined to arena `deepseek-v4-flash-high-preview`), so
  `combined.json` (the file the site renders) was correctly unchanged. →
  `openrouter.json` can change while `combined.json` does not.
- Subtlety 2 (the gate flaw): `meta.fetched_at` (update.py:426) is
  `datetime.now(UTC)` → **`meta.json` changes every run** →
  `git diff --quiet public/data` is always non-empty → "commit only if
  changed" effectively **always commits**.

Data freshness:
- Committed `meta.fetched_at` was 2026-09-16T02:51:32Z (~4.7 h before the 07:35
  run). **No `voteCutoff` field** in committed `arena.json` (keys: `rank,
  modelDisplayName, rating(+Upper/Lower), votes(+rank Upper/Lower),
  modelOrganization, license, contextLength, input/outputPricePerMillion,
  pricePerImage/Second, releaseType, modelKey, modelUrl`) — freshness is
  visible only via `meta.fetched_at` + `votes`.
- Arena Elo/votes byte-identical over ~4.7 h → consistent with 002 B6
  ("voteCutoff moves ~daily"). OR showed one (non-visible) intra-day price
  drift → OR can move intra-day but usually not in the join.

GitHub Actions (verified against live docs, 2026-09-16):
- **(a) `schedule:`** free for public repos on standard GitHub-hosted runners
  ("GitHub Actions usage is free for … public repositories that use standard
  GitHub-hosted runners"; "Public repositories: minutes remain free"; larger
  runners still charged). Runs on the **latest commit on the default branch**.
  Shortest interval **5 min**. "Can be delayed during periods of high load …
  High load times include the start of every hour. … some queued jobs may be
  dropped." Public repos: scheduled workflow **auto-disables after 60 days**
  of no repo activity. *Not fully verified:* an explicit "missed schedule is
  not backfilled" sentence (inherent from delay+drop; not stated in the section
  fetched).
- **(b) `GITHUB_TOKEN`:** default = the repo's default workflow-permission
  setting (docs: "set the default permission for the GITHUB_TOKEN to read
  access only for repository contents"). `permissions: contents: write`
  permits push/commit. Gotcha: "The token's permissions are limited to the
  repository that contains your workflow" (**same-repo only**). A GITHUB_TOKEN
  push does **not** re-trigger other `on:push` Actions workflows (no
  recursion). Token lifetime ≤6 h (irrelevant for a ~2 s job).
- **(c) Push from Actions → CF deploy:** YES. CF Workers "Git integration"
  (docs, updated 2026-05-29): the integration "will **automatically deploy your
  code every time you push a change**" and surfaces build status in the git
  provider as PR comments / check runs / commit statuses. The current setup
  *is* that direct git-integration (dashboard wizard, watching `main`, build
  `ls`) → the Actions job needs **no CF secrets; the push is the only deploy
  action**. (CF's *other* path — external CI/CD running `wrangler deploy` —
  would need `CLOUDFLARE_API_TOKEN`+`CLOUDFLARE_ACCOUNT_ID`; not required
  here.)
- **(d) Failure visibility:** scheduled-workflow notifications go to "the user
  who last modified the cron syntax"; a red run appears in the Actions tab with
  logs. **No staleness alert today** (no dead-man's switch; `meta.fetched_at`
  shows in `#stamp`/footer but no "data is N h old" badge — see B13). *Not
  re-verified:* the exact default-on email behavior for the owner, and whether
  the workflow's own runs count as "repo activity" against the 60-day
  auto-disable.
- **(e) Minimal workflow shape** (sketch, not a file):
  ```yaml
  name: update-data
  on:
    schedule: [ { cron: '15 * * * *' } ]   # hourly; offset off :00 (high-load peak)
    workflow_dispatch: {}
  permissions: { contents: write }
  jobs:
    update:
      runs-on: ubuntu-latest
      timeout-minutes: 10
      steps:
        - uses: actions/checkout@v4
        - uses: actions/setup-python@v5
          with: { python-version: '3.12' }   # any modern 3.x; zero-dep
        - run: python3 update.py             # match report → log; exit≠0 = red
        - run: |
            git config user.name "github-actions[bot]"
            git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
            git pull --rebase
            if git diff --quiet <changed-gate>; then echo "no change"; else
              git add public/data; git commit -m "data: auto-update $(date -u +%FT%TZ)"; git push; fi
  ```
  (Cadence `hourly`/`6h`/`daily` + the `<changed-gate>` are the open decisions
  below.)

Slow-failure mode:
- Arena renames over weeks → fuzzy/prefix drift → match rate decays → a
  threshold trips (overall <40 % or top-20 <18) → run exits non-zero. Current
  headroom: overall 52.2 % (~12 pp above the 40 % floor), top-20 20/20
  (2-model margin over 18). The 192 unmatched are mostly stale/deprecated
  models not on OR (ernie-5.1, grok-4.1, old grok/mistral/deepseek) — some
  unmatched is normal.
- The **dangerous** slow-failure is a still-**green** run whose join quality
  silently degrades (a top model unmatched but top-20 stays ≥18; or a model
  fuzzy/prefix-joined to the wrong OR id) — the "bad-but-validating join ships
  silently" risk.
- Observables: auto-commit (a) → red run = no commit/push/deploy, site keeps
  last-good data, only signal is the red Actions run + match report in the
  log; data goes stale silently. PR (b) → red run = no PR opened (if
  PR-only-on-success); same red-run signal, plus unmerged-PR churn if cadence >
  review frequency.
- `overrides.json` review cadence: the match report lists unmatched names +
  top-3 candidates; a human reviews periodically (weekly/monthly, or when
  unmatched grows / a top model appears) and adds overrides. No automated
  trigger today; `meta.join.overrides_loaded` (=1) is the only standing count.
  A "new unmatched names vs last run" signal would operationalize it (feeds the
  machine-readable summary below).

Collision handling:
- Actions checks out latest `main`, runs, commits, pushes. Owner's unpushed
  local commits → owner's next push needs a rebase; owner's dirty working tree
  is untouched by the cron push but integrated on the next `git pull --rebase`.
  A concurrent local `update.py`+commit+push racing the cron push →
  non-fast-forward → one side must `git pull --rebase`. Since the 4 data JSONs
  are regenerated wholesale, rebase = last-writer-wins on those files
  (acceptable). The job should `git pull --rebase` before push. **Live
  example:** the working tree right now is 1 commit ahead of `origin/main`
  (unpushed `f3bf58f` docs) + dirty `wrangler.jsonc` + plan files — exactly the
  "owner mid-edit" state.

Cadence + cost:
- $-cost ≈ 0 (free minutes, ~2 s run). Real cost = **1 commit per run** (noise)
  + **1 CF deploy per push** (`ls` rebuild + asset re-upload) + start-of-hour
  schedule-delay risk. Arena ~daily; OR intra-day but usually non-visible. →
  **daily (or a few×/day)** is the sweet spot; hourly is overkill (no-op commit
  + CF churn); 6 h is the middle ground; offset cron off `:00`.

**Options.** (review semantics — the core design question; each amends the
A1/A8 "manual-only" convention)
- **(a) Auto-commit + push to main on every green run.** Simplifies: fully
  hands-off; no merge click; CF deploys on each push; simplest workflow (no PR
  API). Complicates: drops the human diff-review; a bad-but-validating join
  ships silently; one commit (+ one CF deploy) per run incl.
  `fetched_at`-only runs; a red run leaves data stale with only a log to notice
  it.
- **(b) Cron opens a PR per changed run; owner merges.** Simplifies: preserves
  the data-diff + match-report review; CF deploys only on merge (review-gated
  deploy); PR history = audit trail. Complicates: a merge click per run;
  stale-PR churn if cadence > review frequency; needs `pull-requests: write` +
  PR-create logic (or `gh`); a red run opens nothing (same silent-stale
  signal); PRs from `GITHUB_TOKEN` need "Approve workflows to run" for any
  follow-on `pull_request`-triggered CI.
- **(c) Hybrid: auto-merge only when the match report is "clean" by measurable
  policy, else PR.** Simplifies: hands-off for the steady state, human gate
  exactly when something looks off. Complicates: **requires `update.py` to emit
  a machine-readable summary** (JSON to stdout or a committed
  `public/data/…` file) so the workflow can test the policy and diff "new
  unmatched names / match-rate delta vs last run"; the policy itself (e.g.
  top-20 == 20/20 AND no new unmatched names AND match-rate within X pp of
  last) is a new standing decision; most moving parts of the three.

**Open questions.**
1. Which review semantics — (a)/(b)/(c)? (Owner decision; amends A1/A8
   "manual only".)
2. The "changed" gate: commit on any of the 4 files (noisy — `fetched_at`
   always changes) vs only `combined.json` (user-visible) vs a
   machine-readable "did the joined data change" signal from `update.py`?
   (Drives option (c) and the commit step.)
3. Cadence: hourly / 6 h / daily, and offset off `:00` to dodge the high-load
   peak.
4. If hybrid: the exact "clean" policy and where the machine-readable summary
   lives (stdout JSON vs committed file) + how "last run" is stored for the
   delta.
5. Failure alerting: is the GitHub red-run email (to the last cron editor)
   enough, or add a dead-man's switch / "data is N h old" badge (overlaps
   B13)?
6. Collision policy: does the cron `git pull --rebase` before push; is
   last-writer-wins on the 4 JSONs acceptable; how to treat an owner's
   mid-edit local update.
7. Scope: does the cron also maintain `overrides.json` (auto-suggest from the
   unmatched list) or only refresh data?
8. Transport: Actions vs local server vs both (Actions for CI visibility +
   free logs, server for exact timing / no schedule-drop).

**Effort & deps.**
- **Actions path: low–med.** Low for (a) (one ~30-line workflow, no CF
  secrets, free minutes). Med once (c) + a real "changed" gate are wanted,
  since that touches `update.py` (emit a machine-readable summary) — a
  behavior change to drive test-first per repo convention.
- **Local-server path: low.** Cron line + deploy key + clone; no repo code
  change.
- **Deps / interactions:** amends the A1/A8 "manual updates only" convention
  (owner decides at review). (c) + the changed-gate depend on a small
  `update.py` change. Complements **B13** (staleness badge / dead-man's switch
  — the operational shadow) and **B8** (API). Pre-existing fragility cron
  exposes: `update.py` fetch resilience — single fetch, no retry, one 60 s
  timeout (B13 "update.py fetch resilience"); a transient 5xx fails the whole
  run, so optional retry-on-5xx hardening is worth doing before/with cron.

### B11 — Custom cross-index (weighted meta index)

Owner's idea (verbatim intent): once many indexes are implemented, build our own
cross-index — a custom-weighted meta index across all of them; analyze which
indexes go in, which don't, and the weighting.

**Preliminary evidence (in-session, 2026-09-16):**

- This item is downstream of **B2** (Epoch AI: 85 benchmarks, 121/154 models,
  zero new fetch beyond one zip), **B5** (OR-syndicated `benchmarks` object,
  currently dropped by `update.py`: LMArena `design_arena` per-category elos on
  119/154 + Artificial Analysis intelligence/coding/agentic indices on 91/154 —
  zero fetches), and **B6** (11 arena boards; 108/154 models have ≥1 other-board
  Elo). Nothing is buildable until at least two of those exist.
- The hard problem is settled by B6's findings: per-board Elo scales are **not
  comparable on one axis** (text #1 ≈ 1505.7, vision #1 ≈ 1309.5, webdev #1 ≈
  1800.3, search #1 ≈ 1257.3) — any meta index must normalize components first
  (rank-percentile vs min-max vs z-score), and benchmark scores carry their own
  scales (Epoch metadata has `scale`/`random_baseline`/`score_ceiling`).
- Candidate component inventory to analyze in the exploration: text Elo
  (154/154, the anchor), per-board elos (5 chat boards, 108/154), Epoch
  benchmarks (85, 121/154, multiple effort variants per model×benchmark —
  002 B2 open question 1), AA indices (3, 91/154), design-arena category elos
  (up to 18 categories, 119/154).
- Open design space for the exploration: normalization method; which components
  and what weights (equal / owner-tunable sliders / presets like "quality",
  "coding", "agentic"); missing-component policy (coverage is 91–121/154, so
  partial vs require-all matters); where it displays (new panel mode? y-axis
  swap? B3 panel content?); whether the Pareto frontier recomputes over the meta
  score or stays Elo-based; provenance (per-component scores visible in
  tooltip/panel); and the index recipe as a committed config (weights editable
  in one file, recipe versioned into `meta.json`).
- Sequencing: exploration can be design-only now; the plan doc graduates after
  the anchor (text Elo) plus at least one additional index is in the data layer.

**Findings (2026-09-16, explore sub-agent, research only).** Bottom line: a
meta index is buildable **now, with zero new fetches** — the live OpenRouter
API (fetched and saved today) carries the dropped `benchmarks` object with AA
indices (91/154) + design-arena category elos (87/154 non-empty) on top of the
text-Elo anchor; the measured 5-component equal-weight meta index (both
min-max and rank-percentile variants) correlates **0.89–0.91 Spearman** with
text Elo, agrees **7/10 on top-10**, and its divergences are few and each
explainable by component values (Grok 4.6: arena #27 → meta #6 on strong AA
coding/agentic) — so with today's available components the meta index mostly
re-orders the mid-pack, not the frontier; the components that *could* move the
frontier (Epoch's 85 benchmarks, 121/154; per-board elos, 108/154) are not in
the data layer yet. The hard problems — normalization, missing-component
policy, provenance — are all tractable, and the measurement below settles most
of the sub-questions with numbers. Recommended shape: index computed in
`update.py` from a committed recipe config, deterministic and diff-able, with
a per-component breakdown exposed client-side.

**Feasibility.** Feasible on the current stack, and the design space is
exercised by a concrete measured artifact (below), not by argument. Data
layer: one recipe config file (component list, source field, normalization,
weight, missing policy) + ~100–150 lines in `update.py` (normalize per
component, compute index, validate coverage bands, version recipe into
`meta.json`) — stdlib only, fits the existing fail-fast/override culture.
Client: the index is a plain scalar per model in `combined.json`, so every
`app.js` path that reads `arena_elo` can read it (pointsFor, frontier,
tooltip); no new fetch, no new runtime dep. The one genuinely new design work
is *semantics* — what the number means when components are missing — which the
measured coverage below forces us to settle (46/154 have all five components;
35/154 have none of the four non-anchor components).

**Evidence.** All fetched/measured 2026-09-16. Raw artifacts in `.tmp/b11/`
(`or_models_raw.json`, `epoch_benchmark_data.zip`, `sample_index.json`).

*Component inventory (measured):*

| Component | Coverage | Scale (measured) | Units comparable? |
|---|---|---|---|
| Text Elo (anchor) | 154/154 | 1110.8–1505.7, p10 1293.1, p50 1418.1, p90 1481.4 (top-heavy; all top-10 within ~15 pts) | — |
| Per-board elos (B6) | 108/154 have ≥1, 26 have all 5 | #1 per board: text 1505.7, vision 1309.5, webdev 1800.3, document 1516.3, search 1257.3, img2webdev 1733.3 (re-verified from saved `.tmp/b6/` entries) | No — 4+ different scales |
| Epoch benchmarks (B2) | 121/154 (B2 join); zip re-verified: 83 CSVs, 9,682 rows, 927 model versions; metadata 81 rows w/ scale/random_baseline/score_ceiling | Per-benchmark range spans **0.153 to 11213** (arc_agi 0–0.985 fraction; vending_bench −31 to 11182 $; lmca 2.8–63.3 pts); score column name differs per file | No — heterogeneous units |
| design_arena category elos (OR-syndicated) | **119/154 carry the field, 32 are empty `[]` → 87/154 non-empty** | Entry elo 763–1430; per-model mean over its categories 811.2–1354.6 | No (and ≠ B6's direct webdev scrape, #1 1800.3 — syndicated snapshot) |
| AA indices (OR-syndicated) | 91/154 carry all three keys; non-null: intelligence 65, coding 91, agentic 66 (26/25 null) | intelligence 3.8–53.4 (p50 25.8, p90 44.4); coding 2.7–81.6 (p50 49.3, p90 76.2); agentic 0.1–58.0 (p50 22.1, p90 51.0) | No — 0–100-ish, heavy left tail |

design_arena has two sub-boards: `models` (web-design, 8 categories, all 87
non-empty models) and `agents` (13 categories, 39 models — every one of which
also has `models` entries, so `agents` is strictly additive). Entry schema:
`{arena, category, elo, win_rate, rank}`.

*Sample meta index (the key measured artifact).* Fetched
`https://openrouter.ai/api/v1/models` (443 models; all 154 joined models
present, 0 missing), joined to `combined.json`, extracted `benchmarks` per
model. Non-anchor coverage: da 87, aa-coding 91, aa-int 65, aa-ag 66; **full
5-component intersection (text Elo + all 3 AA non-null + da non-empty) =
46/154**. Distribution of non-anchor components across the 154: **79 models
have ≥2, 40 have exactly 1, 35 have zero**. Two equal-weight variants computed
over the 46-model intersection, each component normalized over the models that
carry it:

- **(a) min-max mean.** Top 10: Claude Fable 5.1 (.996, elo #5), Claude Opus 5
  (.957, #10), Claude Fable 5 (.930, #1), GLM 5.3 (.902, #19), Kimi K3 (.899,
  #17), Grok 4.6 (.883, **#63**), GLM 5.3 Flash (.872, #29), Gemini 3.8 Flash
  (.847, #9), Muse Spark 1.2 (.838, #4), Claude Opus 4.8 (.835, #21). Bottom
  10: Gemini 2.5 Pro (.440, #77), GPT-5 Mini (.375, #163), Trinity Large
  Thinking (.331, #176), Mercury 2 (.310, #211), gpt-oss-120b (.308, #201),
  Qwen3 235B (.308, #149), gpt-oss-20b (.211, #252), Llama 4 Maverick (.199,
  #236), Ministral 3 8B (.180, #312), Llama 4 Scout (.133, #245).
- **(b) rank-percentile mean (percentile within the 154).** Top 10: **identical
  set to (a), 10/10** (values 0.995…0.845). Bottom 10: Haiku 4.5 (.366, #129),
  GPT-5 Mini (.277), Qwen3 235B (.221), Mercury 2 (.213), gpt-oss-120b (.211),
  Trinity Large (.205), gpt-oss-20b (.124), Maverick (.109), Ministral 3 8B
  (.078), Scout (.062).
- **Ordering agreement:** Spearman vs raw text Elo = **0.895 (a) / 0.908 (b)**;
  top-10 overlap with the within-intersection Elo top-10 = **7/10** for both.
  The raw 154-model Elo top-10 itself only intersects the sample on 7/10 —
  Opus 4.6 (#2) and Muse Spark 1.3 (#8) lack all three AA indices, Opus 4.7
  (#3) lacks AA-int + da, and Nano Banana Pro (Elo #16) lacks all four
  non-anchor components: **the anchor's own top-10 is coverage-penalized under
  a require-all policy.**
- **Divergences (b, within-intersection meta-rank vs elo-rank):** Grok 4.6
  elo#27→meta#6 (AA coding 76.8, agentic 53.4, da 1281 — benchmark-strong,
  arena-mid: sensible), Muse Spark 1.2 arena#2→meta#9 (mid on AA), Gemini 3.1
  Pro Preview elo#8→meta#23 (agentic 10.3 drags it), GLM 5.3 Flash #15→#7.
  Every case is explainable by the per-component values. Min-max vs percentile
  differ most mid-pack (Gemini 2.5 Pro: bottom in (a), not in (b)) — a
  measured instance of min-max outlier sensitivity, given the measured tails
  (coding 2.7 vs p50 49.3; da range 667 vs Elo range 395; Epoch
  per-benchmark ranges to 11213).
- **Answer to "does a meta index add information over arena Elo alone":** with
  the components currently available (3 AA + design-arena mean), it adds a
  *documented, multi-source composite* and mid-pack re-ordering, **not
  frontier information** — AA/design-arena are too correlated with arena Elo
  (ρ≈0.9) to displace the top-10. Epoch (121/154, 85 heterogeneous benchmarks)
  and per-board elos (108/154, 5 scales) are the components that could actually
  move the frontier, and both are not yet in the data layer.

**Options.** *Normalization* (ledger): (1) **rank-percentile within the 154 at
update-time** — robust to scale and outliers (settles the B6
non-comparable-scales problem in one stroke); loses absolute magnitude and
gaps (a 20-Elo lead and a 200-Elo lead can both be "95th percentile");
population is the joined set, which drifts as models come/go, so any given
model's percentile slowly shifts with the population — mitigated by computing
it in `update.py` and committing it (stable per deploy, visible in the diff).
(2) **min-max per component** — keeps relative gaps; measured tails (above)
mean one outlier rescales a whole component; (a)/(b) above show it changes
mid-pack ordering. (3) **z-score** — same population-stability issue as
percentiles, plus a single far outlier (vending_bench's 11182) inflates the σ
and compresses everyone; no advantage over (1) here. (4) **no
normalization** — only valid on a shared scale; refuted by measurement (text
#1 1505.7 vs webdev #1 1800.3 vs search #1 1257.3; Epoch units
0.153–11213). *Weighting:* (1) **equal weights** — defensible, zero
maintenance, but an implicit, unstated theory of "quality"; (2)
**owner-tunable UI sliders** — transparent and interactive, but every visitor
sees a different number, breaking the semantics of "*the* meta index" and the
deterministic-data-layer culture; fine as a *preview* of a committed recipe;
(3) **committed recipe** (weights in a config file, versioned into
`meta.json`, editable in `update.py`) — deterministic per deploy, every change
visible in the data diff, consistent with `overrides.json` curation;
recommended default; (4) **presets** (e.g. "quality", "coding", "agentic" =
different weight vectors over the same components) — cheap once the recipe
shape exists; makes the implicit quality-theory explicit. *Missing-component
policy* (measured intersections: require-all-5 = 46/154; elo+da = 87;
elo+AA-coding = 91; elo+da+AA-coding = 59): (a) **require all components** —
cleanest semantics (equal footing), but the index only exists for 46/154 and
even the anchor's top-10 loses 3; (b) **partial mean over available
components** — index defined for ~150/154, but a 2-component model is compared
against a 5-component model on different denominators — the number's meaning
shifts per model; needs the tooltip/breakdown to be honest; (c) **impute
missing = component median** — hides coverage, inflates mid-pack models, and
is a second silent convention on top of normalization; (d) **coverage badge +
recompute the frontier only over the intersection** — most honest; costs a
client-side badge and a second frontier concept. Recommendation to test in the
plan: (b) with a visible "n/5 components" badge, or (a) if the owner wants the
number to mean one fixed thing. *Display* (grounded in `app.js`): (a) **new
"meta" panel mode** (y = meta score, x = price) — coherent: the whole chart is
price-vs-quality, `state.mode` already drives `renderPanel` (app.js:14-20,
328-341), `paretoFrontier` (app.js:99) is axis-agnostic so the frontier
recomputes over (price, meta) for free; the meta score stays *global*
(data-layer), so B1-style filters re-render without re-deriving the index —
the right contrast with percentile semantics, which must not be recomputed
over a filtered subset; (b) **y-axis swap inside existing panels** — one fewer
panel, but changes what "frontier" means in the general/in/out panels and the
hardcoded "Arena Elo" axis label (app.js:277) must become dynamic; must be
documented; (c) **tooltip line + B3 detail-panel breakdown only** — cheapest,
no new axis, provenance-first; but the score isn't *chartable*, so no meta
frontier; (d) **second scatter in a new tab** — functionally (a). The frontier
question resolves per option: meta panel = meta frontier (a different,
measurable frontier set); swap = the *existing* panels' frontier silently
changes semantics; tooltip-only = Elo frontier untouched. B6 interaction: if
B6 lands, a board selector and the meta panel coexist (board = which Elo axis;
meta = the composite), and per-board elos become *additional recipe
components* — the recipe config is what keeps that additive. *Provenance:*
per-component scores as a tooltip line ("meta 0.87 — elo .92 · AA-code .78 ·
AA-int .41 · da .91 · n/5") plus the B3 panel's breakdown; the recipe as a
committed `index-recipe.json` read by `update.py` (data layer: deterministic,
diffable, fail-fast-able — coverage bands per component, recipe version in
`meta.json`) rather than client-side derivation (sliders can preview it, but
the committed number lives in the data). Given "the data layer is deterministic
and auditable", the data-layer option is the first measurement target, which
this exploration effectively did end-to-end on live data.

**Open questions.**
1. Does the recipe include design_arena's `agents` sub-board entries (39/154)
   alongside `models` (web-design), or only `models`? (Measured: all 39
   `agents` models also have `models` entries, so including `agents` only
   raises their category-mean.)
2. Missing policy: partial-mean + "n/5 components" badge (b) vs require-all
   with the index defined on 46/154 (a) — the owner's call, now with measured
   sizes.
3. Is the meta index a chart axis (meta panel / y-swap) in v1, or tooltip +
   B3-panel content only? (Charting it implies a second frontier concept;
   tooltip-only keeps one frontier.)
4. Presets in v1 (quality/coding/agentic weight vectors) or a single
   equal-weight recipe first?
5. Percentile population: the 154 joined models at `update.py` run time
   (recommended, matches the committed set) — and what happens to a model's
   percentile when it drops out of the join (recomputed for everyone, visible
   in the diff)?
6. When B2 lands, which Epoch benchmarks enter the recipe — all 85 (equal
   weight, heterogeneous scales already handled by normalization), a curated
   shortlist, or only `in_eci` benchmarks? (83 CSVs, 9,682 rows measured;
   effort-variant policy from B2 open q1 also applies.)
7. Does the meta score cover the 154 joined models only (recommended,
   consistent with the anchor), or also unmatched arena-only/OR-only models in
   a later board-overlay mode?

**Effort & deps.** Data layer: low-med — one `index-recipe.json`, ~100–150
lines in `update.py` (per-component extraction, normalization, index,
coverage-band validation, recipe version in `meta.json`); this exploration
already ran the full computation on live data end-to-end, so the plan is a
port, not a discovery. UI: low for tooltip line + B3 breakdown (~0.5 day,
`tooltipHTML` app.js:126 + B3 panel); low-med for a full "meta" panel mode
(reuses `state.mode`/`renderPanel`/`paretoFrontier`; ~0.5–1 day). Deps:
**B5's one-line carry-through of the `benchmarks` object is the enabler**
(zero new fetch — everything measured above came from the existing models
endpoint); nothing else is required for a first buildable meta index (text Elo
+ 3 AA indices + design-arena mean). **B2** (Epoch) and **B6** (per-board
elos) are the later components that would actually change the frontier, and
the recipe config is designed to absorb them as new entries without UI rework.
No A-item decision is reopened; `combined.json` gains one scalar (plus
optionally the per-component breakdown) per model.

### B12 — Open-models selector (open weights / fully open source)

A selector/filter for open models. Owner's explicit question: **how many
licenses are there?**

**Preliminary evidence (measured in-session from committed data, 2026-09-16):**

- **Arena license strings: 39 distinct values** over the 402 arena entries;
  **18 distinct values** over the 154 joined models. The vocabulary is
  long-tail and inconsistent: two Apache spellings ("Apache 2.0" ×32 and
  "Apache-2.0" ×1 joined), two Gemma spellings ("Gemma" ×3, "Gemma license" ×1),
  six Llama-family spellings ("Llama 3 Community", "Llama 3.1 Community",
  "Llama 3.2", "Llama-3.3", "Llama 4", "Llama"), plus org-branded licenses
  ("Qwen", "Kimi K3 license", "MiniMax Community License", "Modified MIT",
  "MRL", "Gemma", …). Raw string equality is not a filter — a curated
  classification map over the 18 joined values is the unit of work (override-
  style: new values surface in the match report).
- Joined-set distribution (154 models): Proprietary 75, Apache 2.0 32, MIT 21,
  Modified MIT 7, Gemma 3, CC-BY-NC-4.0 3, one each of the other 12 → a binary
  open/proprietary split is 79/75; a three-tier permissive/community/NC split
  needs the map.
- Sources: arena `license` is the only license field committed today (18 values
  on the joined set; 402/402 non-null in `arena.json` per 002 B3). The
  OpenRouter API has **no** license field (002 B5 measured the full key union).
  OR's `hugging_face_id` (76/154, open-weight models only) is dropped by
  `update.py` today; the HF API is verified live this session —
  `huggingface.co/api/models/{id}` `tags` carry a clean machine-readable
  `license:apache-2.0` (plus parameter counts, 002 B5 item 7) — a cross-check
  source for the 76 models with an HF id.
- Taxonomy for the owner: "open weights" (weights public, any license — includes
  NC and community licenses) vs "fully open source" (permissive, OSI-style:
  Apache/MIT/CC-BY) vs the middle (community: Llama Community, Gemma, Qwen,
  NVIDIA Open Model — non-OSI, often commercially usable). The selector could be
  a 3-state control or a multi-select.
- Feasibility shape: client-side filter following the vision-filter precedent
  (hide + frontier recompute, 002 B1); data-side = one curated license-class
  map (18 values, maintained like `overrides.json`) plus an optional one-line
  `hugging_face_id` carry-through in `update.py` (002 B5 plumbing) for
  cross-checks and HF links.

**Findings (2026-09-16, explore sub-agent, research only).** The 18 joined
license values tier cleanly: **Proprietary 75 / Permissive 61 / Community 14 /
NC 4** (open = 79, confirms the preliminary 79/75). Every ambiguous value was
verified against actual license texts (sources below). The arena strings are
the finest-grained license data available — finer than HF tags (cross-check
below) — so the arena string is the system of record and a curated 18-entry
class map (override-style) is the unit of work. "Fully open source" is 54
(strict OSI) or 61 (counting the 7 "Modified MIT" models) depending on one
judgment call (open q.1). OR API confirmed license-free (20-key union). HF
cross-check ceiling is 76/154; the 78 without `hugging_face_id` are 73
proprietary + 5 known open models.

**Feasibility.** Small and low-risk on either side. Data layer: one curated
class map (18 keys, next to `overrides.json`) + `update.py` join writes
`license_tier` per model into `combined.json` + unknown raw strings surface in
the match report (~30 LOC, ~2 KB, verify by run + diff). Client side: `app.js`
map + `filtered()` extension, zero data change. Both are days, not weeks; data
layer recommended because the tier becomes auditable, tooltip/B3-visible,
B8-consumer-visible, and a new arena license string degrades loudly (match
report) instead of silently (client "unknown" until JS ships).

**Evidence.**
1. Tier table — 18 joined values, counts re-measured from
   `public/data/combined.json` (2026-09-16):

   | value | tier | basis (license texts verified 2026-09-16) | joined n |
   |---|---|---|---|
   | Proprietary | PROPRIETARY | closed API-only weights | 75 |
   | Apache 2.0 | PERMISSIVE | OSI | 32 |
   | Apache-2.0 | PERMISSIVE | OSI; muse-glimmer-30b (spelling dup) | 1 |
   | MIT | PERMISSIVE | OSI | 21 |
   | Modified MIT | PERMISSIVE | MIT + display-attribution clause only above 100M MAU / $20M-mo (Kimi K2/K2.5/K2.6/K2-thinking, MiniMax M2.5/M2.7, Mistral Medium 3.5 — all verified) | 7 |
   | Gemma | COMMUNITY | Gemma ToU: free commercial use + Prohibited Use Policy, non-OSI (ai.google.dev/gemma/terms, rev 2026-04-01, Gemma 1–3; Gemma 4 has its own license — arena's "Apache 2.0" on gemma-4 is consistent) | 3 |
   | Gemma license | COMMUNITY | same ToU, gemma-2-27b (spelling dup) | 1 |
   | Llama 3.2 | COMMUNITY | Llama 3.2 Community License: free commercial use, separate Meta agreement only if >700M MAU at release (full text verified) | 2 |
   | Llama 3.1 Community | COMMUNITY | Llama 3.1 Community License (same family) | 1 |
   | Llama 3 Community | COMMUNITY | Llama 3 Community License (same family) | 1 |
   | Llama-3.3 | COMMUNITY | Llama 3.3 Community License (same family) | 1 |
   | Llama 4 | COMMUNITY | Llama 4 Community License Agreement (eff. 2025-04-05), same 700M-MAU term (verified) | 1 |
   | Llama | COMMUNITY | sloppy string; llama-4-scout → Llama 4 (verified) | 1 |
   | Qwen | COMMUNITY | Qwen LICENSE AGREEMENT (2024-09-19, Alibaba Cloud): commercial OK, >100M MAU needs separate license (verified — the Qwen2.5 line, not the Apache-2.0 Qwen3 generation) | 1 |
   | Kimi K3 license | COMMUNITY | MIT-style; commercial >$20M/yr revenue or 100M MAU needs separate contract + attribution (verified) | 1 |
   | MiniMax Community License | COMMUNITY | non-commercial base; commercial use via one-time notice (verified) | 1 |
   | CC-BY-NC-4.0 | NON-COMMERCIAL | OSI NC (Cohere Command A / R / R+) | 3 |
   | MRL | NON-COMMERCIAL | Mistral Research License MRL-0.1: research purposes only (non-profit/non-commercial); commercial use needs separate agreement (full text verified via mistral.ai/licenses/MRL-0.1.md — it is *stricter* than the expected MAU clause; the MAU-style clauses live in the Modified-MIT licenses) | 1 |

   Tier totals: 75 + 61 + 14 + 4 = 154. Open-weights (non-proprietary) = 79.
   "Fully open source" = 54 strict OSI (Apache 33 + MIT 21) / 61 incl. Modified
   MIT (open q.1).
2. Raw inventory — 39 distinct values over 402 `arena.json` entries
   (re-measured): Proprietary 180, Apache 2.0 60, MIT 47, Apache-2.0 13,
   CC-BY-NC-4.0 10, Llama 2 Community 10, Modified MIT 9, Qianwen LICENSE 8,
   Gemma license 7, Non-commercial 7, Gemma 4, Llama 3.1 Community 4,
   Llama 3.1 4, NVIDIA Open Model 3, DeepSeek 3, CC-BY-NC-SA-4.0 3, OpenMDW-1.1
   2, Qwen 2, MRL 2, Jamba Open 2, Llama 3 Community 2, DeepSeek License 2,
   Llama 3.2 2, plus 16 singletons (Kimi K3 license, MiniMax Community
   License, tencent-hunyuan-community, Nvidia Open Model, Nvidia Open, Nvidia,
   Llama 4, Llama, Llama-3.3, Mistral Research, NexusFlow, DBRX LICENSE, Other,
   Yi License, AI2 ImpACT Low-risk, Falcon-180B TII License). Spelling mess
   confirmed and worse than preliminary: 4 NVIDIA variants (6 entries),
   MRL/"Mistral Research", Qwen/"Qianwen LICENSE" (10), 8 Llama-family
   variants (24), DeepSeek/"DeepSeek License" (5). Context (raw-only, not
   joined): NVIDIA Open Model License (open weights, commercial clauses), DBRX
   open-model license, Jamba Open (AI21), Yi, AI2 ImpACT Low-risk (commercial
   with conditions), Falcon-180B TII — all open-weights/community-flavored.
3. HF cross-check (2026-09-16): 76/154 carry `hugging_face_id` (confirms 002
   B5's 76/154); 76/76 `huggingface.co/api/models/{id}` queries succeeded
   (0.3 s sleep, 0 failures). HF vocabulary: 8 tags — apache-2.0 31, mit 19,
   other 16, gemma 4, llama3.1 2, llama3.2 2, llama3.3 1, cc-by-nc-4.0 1.
   Agreement vs the arena string: 56/76 exact (case/spelling-normalized), +2
   family-level (gemma-2-27b "Gemma license" vs `gemma`; llama-3.1-8b "Llama 3
   Community" vs `llama3.1`), 18 disagree: 15 are "arena precise custom name
   vs HF `other`" (Kimi K2×4 + K3, MiniMax M2/M2.1/M2.5/M2.7/M3, GLM-5.3,
   Trinity, Llama-4×2, Qwen2.5-72B — arena is more granular; `other` is
   uninformative) and 3 substantive: `qwen/qwen2.5-vl-72b-instruct` (arena
   "Proprietary" via prefix-variant join of arena's proprietary
   "qwen2.5-max"; HF repo open, `other`), `rekaai/reka-flash-3` (arena
   "Proprietary" via reka-flash-20240904; HF `apache-2.0`),
   `mistralai/ministral-8b-2512` (arena "MRL" carried from
   ministral-8b-2410; the 2512 HF repo is `apache-2.0`). Verdict: arena
   strings = system of record; HF tags = good audit cross-check (surfacing
   disagreements in the match report is cheap value), too coarse to be a second
   source (16/76 `other`). Coverage ceiling: 78 without hfid = 73 Proprietary
   + 5 open (Mistral Medium 3.5, Mistral Large, MiniMax M1, Command R, Command
   R+ — all known open-weight with public HF repos; Mistral-Medium-3.5-128B and
   MiniMax-M1 verified live). Absence of hfid ≈ proprietary (73/78) but not
   exact.
4. OR API: 443 models, per-model key union is 20 keys with **no license
   field** (live fetch 2026-09-16): `alias_target, architecture, benchmarks,
   canonical_slug, context_length, created, default_parameters, description,
   expiration_date, hugging_face_id, id, knowledge_cutoff, links, name,
   per_request_limits, pricing, reasoning, supported_parameters,
   supported_voices, top_provider` (5 distinct key-sets across models).

**Options.** Consequence ledgers (grounded in the measured tiers):
1. **Binary open/proprietary toggle** — adds: trivially simple (one boolean in
   `filtered()`), 79/75. Complicates: collapses the owner's explicit "fully
   open source" distinction (open-weights 79 vs OSS 54–61); the 4 NC models
   ride along as "open".
2. **Three-state segmented control: All 154 / Open-weights 79 / Open-source
   54|61** — adds: matches the owner's words exactly ("open weights *and*
   fully open source"), one control, hide + frontier recompute makes "Pareto
   of open models" the literal semantics (vision-filter precedent).
   Complicates: the Modified-MIT call lands inside a visible number (open
   q.1); NC (4) is inside open-weights with no way to reach it.
3. **Four-state (Permissive 61 / Community 14 / NC 4, +Proprietary 75
   implicit)** — adds: fully honest taxonomy, NC reachable. Complicates: a
   4th control state on a bar that already has 5 controls (002 B1 measured the
   crowding; flex-wrap absorbs it but it's the least defensible option); NC is
   4 models, so a whole state for ~2.6% of rows.
4. **Multi-select checkboxes** — adds: maximal flexibility. Complicates: most
   UI area, no default story, labels can't carry a clean count per state.

Classification location: **data layer** (recommended): `license_tier` in
`combined.json` from a curated map maintained like `overrides.json`; new raw
license strings surface in the match report; deterministic + auditable + feeds
tooltip/B3/B8. Client side: no data change, but the tier isn't in the JSON and
a new license string renders "unknown" until JS ships — silent drift. Hide vs
dim: **hide + recompute** (categorical, either passes or it doesn't; the
vision-filter precedent at app.js:68-71/298-300; 002 B7's dim pattern is for
degree, not category). UI: one more `nav.filters` control (the 6th; the bar
flex-wraps); segmented buttons with **counts in the labels** (e.g. "All 154 ·
Open 79 · OSS 54") beat a select or checkboxes — counts answer the owner's
literal question and prevent "why is OSS smaller than I expected" surprises.
Interactions: B1 composes as a conjunction in `filtered()` (org × license); B3
gets license + tier + (with hfid carried, open q.7) an HF link for the 76; B11
gets "open models only" as a natural pre-computed frontier; B8 consumers get
`license_tier` in the JSON for free; the match-report disagreement surfacing
(item 3 above) is a bonus audit for B3's join-quality work.

**Open questions.**
1. Modified MIT (7 models: Kimi K2 family ×4, MiniMax M2.5/M2.7, Mistral
   Medium 3.5): count it as open-**source** (practical — OSI-like MIT with a
   clause that only binds products 100M MAU / $20M-mo) → OSS = 61, or Community
   (strict OSI — the added clause is non-OSI) → OSS = 54?
2. NC as its own state (4-state) or merged into open-weights (3-state)? NC is
   4 models (Cohere ×3 + ministral).
3. MiniMax Community License: COMM (commercial allowed via notice/authorization)
   or NC (non-commercial base wording)? Flips COMM 14/NC 4 → COMM 13/NC 5.
4. `ministral-8b-2512`: arena "MRL" (NC) arrived via a base-name join from
   ministral-8b-2410, but the OR model's own HF repo is Apache-2.0 — fix the
   join (NC 4→3, PERM 61→62) or keep the arena string authoritative?
5. Two "Proprietary" rows whose OR models are public open weights:
   `qwen/qwen2.5-vl-72b-instruct` (join of arena's proprietary "qwen2.5-max")
   and `rekaai/reka-flash-3` (join of reka-flash-20240904) — join fixes (open
   79→81, PERM +1) or keep the arena license string as-is?
6. Should the control labels carry per-tier counts ("Open 79 · OSS 54")?
7. Carry `hugging_face_id` through into `combined.json` (002 B5 plumbing) so
   B3 can show HF links for the 76 and `update.py` can run the license
   cross-check as a match-report line?
8. Does the class map key on the 18 raw joined strings verbatim, or normalize
   spellings ("Apache-2.0"→"Apache 2.0", "Gemma license"→"Gemma",
   "Llama"→Llama 4) at map time? (Recommend: verbatim keys, normalization
   documented in the map — keeps the audit trail exact.)

**Effort & deps.** Data layer: 18-entry class map + ~30 LOC in `update.py`
(join, match-report surfacing of unknown raw strings, `meta.json` note) + ~2
KB JSON; verified by `python3 update.py` + `public/data/` diff — half a day.
Client: `filtered()` conjunction (1 line, app.js:68-71) + one `nav.filters`
control wired through the app.js:381-423 binding pattern + tooltip/tier
display — ~1 day with UI polish. If 3-state data-layer lands, the segmented
control is the UI; B3's panel content is then mostly free. Deps: B1
(conjunction), B3 (panel + HF link, needs q.7), B5 (hfid source), B7 (dim
alternative, rejected here), B8 (JSON field for consumers), B11 (pre-computed
open-only frontier). No blocking dependency; the Modified-MIT and NC-state
calls (q.1–q.3) are the only owner decisions before build.

### B13 — Open survey: other considerations

Owner's question: what other considerations, like the ones opened in 002, should
we consider? The exploration should produce a ranked candidate list, each with
value/effort, deduplicated against B1–B12.

**Preliminary candidates (context for the exploration, not findings):**

- Data-freshness surface: `meta.fetched_at` shows in `#stamp` and the footer,
  but there is no staleness signal — if B10 lands, a "data is N h old" badge
  becomes user-visible value; per-source vote-cutoff dates are not in `meta.json`
  today.
- Shareable state: mode/filters/search are not in the URL — "Pareto of OpenAI
  gpt-5.x" is currently shareable only as a screenshot; composes with B1/B7.
- Export of the current filtered set (CSV/JSON via client-side Blob) — cheap,
  and the human-facing half of B8's "API" ask.
- OG/meta tags + favicon for link previews (what the title currently resolves to
  is unverified); adjacent to B9's branding.
- Monitoring / dead-man's switch on data freshness — the operational shadow of
  B10.
- `update.py` fetch resilience: single fetch, no retry, no timeout budget —
  fine by hand, annoying under cron (feeds B10).
- Cache headers on the data JSONs: live responses carry `max-age=0,
  must-revalidate` — deliberate or default? Longer `max-age` + ETag revalidation
  is the standard static-CDN shape.
- Accessibility / mobile (chart + filter bar on a phone).
- i18n (ruled out in 002's out-of-scope — revisit only if the audience grows).

**Findings (2026-09-16, explore sub-agent, research only).** Bottom line: the
un-parked gaps that matter are the link-preview surface (no og:\*/favicon — B9
explicitly punted this to B13), shareable URL state (app.js has zero URL
state), mobile (zero `@media` rules), and the site's explanation surface (no
methodology page, no staleness alarm, no per-update changelog); the ops-side
findings are small but real — default `max-age=0, must-revalidate` headers
(ETag/304 already works), zero security headers, empty-body 404, no-retry
single fetches in `update.py` — and one worry is *resolved* by measurement: a
no-op re-run of `update.py` produces a 1-line diff (only `meta.json`
`fetched_at`), so B10's diff-review discipline stays clean under cron.

**Evidence.** (Measured 2026-09-16; repo + live site.)

*Head / link preview* (index.html:1-239). Title (line 6), meta description
(7), viewport (5) exist; no og:\*, no twitter:card, no theme-color; no
`<link rel="icon">` and no favicon file in `public/` — live `/favicon.ico` →
404. A shared link renders title + description text only, no image, generic
globe icon. Two external runtime deps: Google Fonts Inter (preconnected) and
ECharts 5.6.0 pinned from jsdelivr (live 200, 1,034,102 B); the CDN
`<script>` (index.html:313) has no `onerror`, but app.js:440-444 checks
`window.echarts` after the data fetch and shows a message — only if the data
fetch succeeded first.

*HTTP surface* (live, curl). All assets (index.html, app.js, data/\*.json):
`cache-control: public, max-age=0, must-revalidate` — the CF static-assets
default; `wrangler.jsonc` has no `assets` cache config, so it is not
deliberate. Weak ETags on app.js and data files (index.html has none — GET on
/ returns no ETag, so HTML re-downloads fully every visit; 9.9 KB,
negligible). Conditional GET works: `If-None-Match` on combined.json → 304, 0
bytes. Compression: `content-encoding: br` on app.js/combined.json/index.html.
No security headers at all (no CSP, X-Content-Type-Options, Referrer-Policy,
X-Frame-Options, Permissions-Policy — only CF `report-to`/`nel`). 404: bare CF
404 with an empty body (0 bytes, no content-type) — no custom page. `/data/`
→ 404 (no directory listing, nothing leaked). No `Access-Control-Allow-Origin`
(B8's known fact). `public/.wrangler/` (wrangler local cache) sits inside the
web root, gitignored, not served by CF static assets.

*update.py resilience* (read in full). `TIMEOUT = 60` (update.py:26); one
`urlopen` per URL, `die()` on any exception (update.py:61-62) — no retry, no
backoff; one transient hiccup exits 1 and writes nothing. Single-threaded
sequential arena → OR (update.py:398, 402). Writes: four sequential per-file
atomic writes (tempfile + `os.replace`, update.py:381-391) after validation —
a failed fetch leaves committed data untouched, but a process death
mid-sequence (update.py:446-449) leaves a window where arena.json is newer than
combined.json (rare by hand; cron with timeouts raises it). A failed run
updates nothing in meta.json → the only staleness signal is `fetched_at` in
#stamp/footer going old; no threshold, no alarm, and no per-source cutoff in
meta.json (arena's `voteCutoffISOString` — 2026-09-13 for text per B6's
measurement — is not persisted; `meta.sources.arena` is url+count only).
Quirk: `mkstemp` leaves data files mode 0600 on disk after each run
(git-invisible).

*Determinism* (measured: ran `python3 update.py` twice back-to-back, 07:43Z +
07:46Z; restored with `git checkout -- public/data` afterward — recorded). Run
2 vs run 1 (same upstream): only meta.json `fetched_at` changed;
arena/openrouter/combined byte-identical (insertion-order dict keys;
`fetched_at` is the only timestamp). Noise per no-op run = a 1-line meta.json
diff, so a cron diff-review sees only real data movement. (Run 1 vs last commit
showed a genuine upstream OR price change,
`deepseek/deepseek-v4-flash-0731` 0.055→0.06, plus `fetched_at` — first run
since the last commit, not run-to-run noise.)

*UI/UX* (index.html + app.js read in full). Responsive: zero `@media` rules;
the only adaptivity is flex-wrap on header (index.html:41) and filter bar
(line 69); at ~390 px the filter bar stacks 3-4 lines and the chart plot is
~300 px wide (grid left 58/right 24, app.js:251) with 154 bubbles — dense but
touch-capable (canvas renderer). A11y: `role="tablist"` + `aria-label` on the
two seg groups (index.html:250, 262) but inner buttons lack `role="tab"`/
`aria-selected` (half-done ARIA); ratio slider has aria-label (258);
#tgl-frontier/#tgl-spread have no `aria-pressed`; `.count` spans no
`aria-live`; no `<noscript>`; ECharts `aria` option unset (opt-in; present in
the 5.6.0 bundle — `focusInBlank` is not in 5.6.0) → the chart exposes no
screen-reader labels. Resize: the loops (app.js:342-344, 418-422) resize only
visible charts (`offsetParent !== null`); hidden-panel charts are created
lazily (app.js:312-314) and re-`setOption`+resized when shown — the
hidden-panel case is in fact covered by create-on-demand. URL state: zero
`location.*`/`history` usage (grep) — mode/vision/frontier/spread/ratio are
in-memory only; filtered views are shareable only as screenshots.
Loading/failure: no loading state (empty 480 px panels until fetch resolves);
the data-404 message is dev-facing, shown to visitors: "Failed to load data
(HTTP …). Run `python3 update.py` and commit `public/data/`" (app.js:434-439).
Count surfaces exist: per-panel `.count` ("154 models · N skipped (no price)")
+ `#stamp` ("N models · updated …").

*Ops.* Zero monitoring/health mentions in the repo (grep across py/js/html/
jsonc/json/md, excluding plans/ and scratch). `wrangler.jsonc` is assets-only
+ the recently added `observability.logs` (enabled, invocation_logs, persist)
— free request logs, no alerting. `.gitignore`: `__pycache__`, `*.pyc`,
`.DS_Store`, `.cortexkit/`, `.tmp/`, `.wrangler/`. README documents the manual
flow + the five join tiers + provenance well; no monitoring, no cache behavior,
no cutoff concept. `fetched_at` is shown at #stamp (app.js:376-378) and footer
(app.js:371).

*Data layer.* Prices: min in joined set $0.027/M in, $0.08/M out; no
sub-$0.01 prices, no zeros → `fmtPrice` (app.js:53-60) and `round(·, 6)`
(update.py:141) are adequate today. `:free`: 20 variants committed in
openrouter.json, 0 in combined; normalize strips `:batch/:free`
(update.py:186) and the lookup keeps the shorter id on collision
(update.py:214-216) — 37 collisions in meta.json, mostly `X vs X:free`;
documented in the README but invisible on the site (tooltip shows
match_method only). Unmatched: 192 arena / 197 OR (meta.json:15-16) — the
footer shows combined count + by_method + overrides (app.js:373-374), but
by_method sums to 210 matches vs 154 models (variants collapse) with no
on-site explanation, and the 192 arena names appear only in the match report's
stdout; update.py:468 points at "see public/data/meta.json" for the overflow,
yet meta.json stores only the count — the pointer is misleading.
`variants_collapsed`: 41 — invisible on the site (B3's panel will carry it).

**Ranked candidates.** (Value/effort; deduped against B1–B12 and 003's parked
B13 candidates.)

1. **OG/meta + favicon link preview.** No og:\*/twitter/theme-color in
   `<head>`, no favicon (404 live); every shared link is text + a globe icon
   today. B9 explicitly punted this ("see B13"). Value: high for a site whose
   circulation unit is a shared link. Effort: low (og:title/description/url +
   one committed 512 px og:image + favicon). Deps: none; shares B9's branding
   session. Rec: **own item (low)** — can ship alongside B9.
2. **Shareable URL state** (mode/filters/ratio → `location.hash`, search
   later). Zero URL state today; "Pareto of OpenAI gpt-5.x" (B1's ask) is
   shareable only as a screenshot. Value: high once B1/B7 land. Effort:
   low-med (~40-60 lines; hash schema must anticipate B1's org/family and B7's
   search keys). Deps: composes with B1, B7 (design the schema jointly). Rec:
   **own item (low-med)**, sequenced after B1 (or as B1's URL step).
3. **Mobile/responsive pass.** No `@media` rules; filter bar stacks 3-4 lines
   on a phone; ~300 px plot with 154 bubbles. Value: med (owner's own phone;
   every future filter-bar item adds to the stack). Effort: low-med (mostly
   CSS + device check). Deps: none; interacts with B1/B6 — do it before or
   with the next filter-bar item. Rec: **own item (low-med)**.
4. **Methodology/about surface.** Footer explains only overrides; the join +
   frontier definitions live in the README visitors never read; `:free`/
   variant-collapsing behavior is invisible on the site. Value: med (the "why
   is this point here?" question recurs with every share; natural home for
   B2's Epoch CC-BY attribution and B9's brand). Effort: low-med (a
   `public/about.html` or footer section; content ~90% exists in README.md).
   Deps: none; synergy with B9, B2. Rec: **own item (low-med)**.
5. **Data-freshness surface.** meta.json carries no per-source cutoff (arena's
   `voteCutoffISOString` unpersisted) and no staleness alarm; the UI shows only
   the raw `fetched_at`. Value: med now, high once B10 lands. Effort: low
   (persist cutoffs in update.py + an amber #stamp/footer badge past a
   threshold). Deps: data half standalone (low); alarm half feeds B10;
   per-board cutoffs are B6's Q8. Rec: **own item (low)**, alarm step after
   B10.
6. **Accessibility pass.** Half-done ARIA (tablist without tab roles, no
   `aria-pressed`, no `aria-live`), zero chart SR labels (`aria` unset, opt-in
   in 5.6.0), no `<noscript>`. Value: med. Effort: low (attributes + noscript)
   to med (ECharts `aria` labels + real keyboard flow). Deps: none. Rec:
   **own item (low-med)**; folds candidate 12 in as a step.
7. **Per-update data changelog.** What changed since the last commit (models
   added/removed, price moves, elo/rank moves) → meta.json section + one UI
   line. Value: med (turns the diff-review discipline into user-visible value;
   doubles as a freshness signal). Effort: med (a diff step in update.py
   against the previously committed combined.json — determinism verified, so
   the diff is clean — plus the UI line). Deps: B10 synergy (every cron run
   publishes a change). Rec: **own item (med)** — the strongest "new" item in
   this list after 1-2.
8. **Security + cache headers** (CSP, X-Content-Type-Options,
   referrer-policy; data-JSON max-age vs revalidate). Zero security headers
   live; `max-age=0, must-revalidate` is the CF default (ETag/304 already
   works — 0-byte revalidations). Value: low-med (small static surface; CSP
   mainly pins the two CDN origins, and the inline `<style>` block + generated
   tooltip styles will need `style-src 'unsafe-inline'`). Effort: low — but the
   mechanism overlaps B8's open question (assets-only config can't add headers
   without a pass-through `fetch()` worker). Deps: B8 (headers ride the same
   worker). Rec: **fold into B8** — if B8 ships zero-code (a), this is the
   driver for B8's shape.
9. **Export of the current filtered set** (CSV/JSON via client-side Blob).
   Value: low-med (A/B comparison, offline sharing; the human-facing half of
   B8). Effort: low (~30-40 lines). Deps: composes with B1/B7 (export respects
   active filters). Rec: **own item (low)**, after B1.
10. **Monitoring / dead-man's switch.** No health surface in the repo; wrangler
    observability logs exist but no alerting; the failure mode is silent
    staleness. Value: med (owner is hands-on, so risk is lower today; B10
    raises it). Effort: low (free-tier freshness ping on `meta.fetched_at` +
    email). Deps: B10 (cron-failure alert + data-freshness alarm are two halves
    of one monitoring decision). Rec: **fold into B10**, but the
    data-freshness ping can ship standalone first.
11. **Custom 404 page.** Live 404 = empty body (0 bytes) → blank page for a
    stale deep link. Value: low. Effort: low (`public/404.html`; CF serves it
    on 404). Deps: none; pairs with #1. Rec: **own item (low)** or fold into
    the link-preview/branding item.
12. **Visitor-facing error copy.** "Run `python3 update.py` and commit
    `public/data/`" is shown to visitors on a data 404 (app.js:434-439); no
    `<noscript>`. Value: low. Effort: low (few lines). Rec: **fold into #6**
    (a11y pass).
13. **update.py fetch resilience** (1-3 retries + backoff). `TIMEOUT=60`, no
    retry, first hiccup kills the run — fine by hand, annoying under cron.
    Value: low by hand / med under cron. Effort: low (~15-25 lines). Deps:
    B10. Rec: **fold into B10** as a pre-step, not an own item.
14. **meta.json completeness: unmatched list + cutoffs.** update.py:468 points
    at meta.json for the unmatched overflow but only the count is stored
    (192/197); cutoffs unpersisted (see #5). Value: low (auditability; the
    owner's diff review). Effort: low. Rec: **fold into #5** (cutoffs) and #7
    (changelog can report the unmatched delta).

**Cut explicitly:** i18n (already out of scope in both backlogs — revisit only
if the audience grows); PWA (003's out-of-scope list); theme toggle (no
measured gap); per-model deep links (subsumed by #2 + B3's panel);
price-precision rework (measured fine: no sub-$0.01/M prices, no zeros); the
0600 file-mode quirk (git-invisible); visibility of the 192 unmatched / 41
variants (variants → B3's panel; unmatched → #14).

**Open questions.**
1. og:image content policy: fixed branded card vs chart screenshot regenerated
   per update (manual regen conflicts with the no-build culture — what
   cadence)?
2. URL-state schema: hash vs query; reserve B1's org/family and B7's search
   keys now, before they exist?
3. Staleness threshold: what tolerance (arena text cutoff moves ~daily per
   B10's measurement; OR prices less often) — and where does the alarm live
   (email? badge only)?
4. Changelog baseline: diff against the previously committed data
   (update.py reads current files before overwriting) — last run only, or an
   N-run history in meta.json?
5. CSP scope: allow fonts.googleapis.com + fonts.gstatic.com +
   cdn.jsdelivr.net + self with `style-src 'unsafe-inline'` — and is hashed
   app.js + longer max-age worth a no-build exception?
6. Methodology surface: separate `/about.html` vs footer expansion; primary
   reader — owner or shared-link visitors (drives depth and language)?
7. A11y target: SR labels only (attributes + ECharts `aria`) vs a real keyboard
   flow (tab to a bubble, arrow-key navigate — needs an ECharts capability
   check beyond 5.6.0, where `focusInBlank` is absent)?

**Effort & deps.** B13 itself was research-only (done). The ranked list: six
low items (#1, #3, #5-data, #6, #9, #11), two low-med (#2, #4), one med (#7),
and four sub-decisions folding into existing items (#8→B8, #10+#13→B10,
#12→#6, #14→#5/#7). No hard cross-deps among the own items; the only
sequencing constraints are #2 after B1 (schema) and #10's alarm after B10.
Scratch: hashes + run log in `.tmp/b13/`, gitignored; `public/data` restored
to HEAD via `git checkout -- public/data` (nothing committed).

## Graduated plans (step 2, 2026-09-16)

Per the process, each item graduated to its own plan doc — one plan per
examination, to be implemented or examined with the owner in separate future
sessions:

| item | plan | status |
|------|------|--------|
| B8 data API | `plans/011-data-api.md` | PROPOSED |
| B9 Kaidev footer | `plans/012-kaidev-footer.md` | PROPOSED |
| B10 cron | `plans/013-auto-update.md` | PROPOSED |
| B11 meta index | `plans/014-meta-index.md` | PROPOSED |
| B12 open models | `plans/015-open-models.md` | PROPOSED |
| B13 open survey | `plans/016-survey-candidates.md` | PROPOSED |

Execution order is owner-chosen at review; items may be dropped, merged, or
reordered there.

## Out of scope (for this backlog)

- Backend beyond a minimal same-worker `fetch()` handler (B8), new deploy
  target, new chart library, i18n, PWA.
- Reopening 001's settled decisions (A1–A11) — except where an item explicitly
  amends one (B10 amends the "manual updates only" convention; that amendment is
  an owner decision at review, not a silent change).

## Definition of done

- [x] Owner reviews and approves this doc (process + item scoping).
- [x] Exploration findings appended per item (2026-09-16; one research-only
      sub-agent per item; scratch under `.tmp/b8`–`.tmp/b13`, gitignored).
- [x] Each surviving item graduated to its **own** `plans/00N-*.md` plan doc
      (011–016, PROPOSED — see Graduated plans; one plan per examination,
      merges only by explicit owner decision).
- [ ] Each plan is owner-reviewed; implementation starts only after agreement,
      in the owner-chosen order, following 001's commit-per-step discipline
      (tracked per plan; deferred to future sessions).
