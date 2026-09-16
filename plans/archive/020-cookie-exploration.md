# 020 — Cookie injection exploration (cookieless guarantee)

Date: 2026-09-16. **Status: ARCHIVED (2026-09-17).** Owner approved execution
2026-09-17 ("Execute" + in-session step decisions: leave 019 unpushed and
close here; footer line lands as a one-line step here).
Commits: 434d25d (step 4 footer line).
Source: owner directive 2026-09-16: no cookies → nothing to show under GDPR;
at most a footer line ("we are cookieless"), that's it.
Research-only (002/003 precedent): no code; findings are appended to this doc
as uncommitted changes for owner review; a surviving fix item gets its own
plan (021+).

## Question

Prove the site sets no cookies — origin, Cloudflare edge/zone features,
third parties, in-page storage APIs — so no GDPR consent mechanism is
required, and lock a standing rule so it stays that way.

## Measured baseline (2026-09-16, this session)

- Zero `Set-Cookie` from the origin on `/`, `/app.js`, `/data/*.json` — both
  on `llm-pareto.kaidev.io` and `llm-pareto.kaidev.workers.dev`.
- Zero cookies from the three runtime third parties (fonts.googleapis.com
  CSS, fonts.gstatic.com woff2, cdn.jsdelivr.net echarts) under desktop
  browser UAs.
- No `document.cookie`, `localStorage`, `sessionStorage`, or `IndexedDB` in
  `app.js`/`index.html`.
- CF NEL is header-only (`report-to`/`nel`), no cookie.
→ The site is already cookieless today; plan 019 removes the last
  third-party risk surface.

## Findings (2026-09-17, plan 020 execution)

**Live re-verification (2026-09-17 — live still pre-019; 019 unpushed per
owner decision, closed here).** Cookie-accepting client (curl, cookie jar
shared across the request session), desktop Chrome + plain curl + mobile
Safari UAs:

| source | measured |
|---|---|
| `llm-pareto.kaidev.io`: `/` (200, `cf-cache-status: HIT`), `/favicon.ico` (404), `/app.js`, `/data/combined.json`, `/data/meta.json`, `/assets/logos/openai.svg` | zero `Set-Cookie`; jar empty after the whole session |
| pre-019 third parties: `fonts.googleapis.com` CSS, `fonts.gstatic.com` woff2, `cdn.jsdelivr.net` echarts | zero `Set-Cookie` under all three UAs |
| `llm-pareto.kaidev.workers.dev`: `/` + all assets | 404 `error code: 1042` (no Worker route) — zero `Set-Cookie` |
| response headers on `/` | `nel`/`report-to` only — header-only, no cookie |

No `__cf_bm`/`cf_clearance` on any client → no active challenge path.

**Worker topology change (owner-side, 2026-09-16 — recorded, not a cookie
issue).** `llm-pareto` is now a Workers **Service** (created 2026-09-16
01:40Z, last deploy 22:56Z — CF API), with no workers.dev route: the
workers.dev host 404s while the custom domain `llm-pareto.kaidev.io` still
serves. The 2026-09-16 baseline's "both hosts" is effectively one host now;
workers.dev sets no cookies either way.

**Zone audit (2026-09-17, CF API via the wrangler OAuth token).**

| feature | state | evidence |
|---|---|---|
| Email routing | disabled | API `email/routing` → `enabled: false` |
| Turnstile | 0 widgets in account | API `challenges/widgets` → empty |
| WAF / managed rules | scope-blocked (`zones:read` missing) | 403; empirical probe: no challenge / no `Set-Cookie` on any client |
| Cloudflare Web Analytics | scope-blocked | 403; cookieless by design if ever enabled |
| Transform Rules (Set-Cookie injection) | scope-blocked | 403/7003; empirical probe: no `Set-Cookie` on any origin response |

Recommendation (owner asked): no change — the only CF features that set
cookies are challenge actions (→ `__cf_bm`), Transform Rules injecting
`Set-Cookie`, and Turnstile on protected pages; none active today. When
enabling any of them, keep actions on `block`, never `challenge`, and
re-run the probe. (CF Web Analytics is the safe path if analytics is ever
wanted — out of scope here.)

**Repo audit (2026-09-17 — every `git ls-files public/` + `update.py`).**
- Zero `document.cookie`/`localStorage`/`sessionStorage`/`IndexedDB`/
  `sendBeacon`/XHR in `index.html` + `app.js` (the only runtime JS).
- Post-019 runtime is fully same-origin: 2 local `<script>` tags (vendored
  echarts, `app.js`), 1 self-hosted woff2, zero external `<link>`/`<img>`;
  2 same-origin `fetch` calls (`data/combined.json`, `data/meta.json`);
  `new Image()` preloads same-origin `assets/logos/*`.
- Data-driven DOM sinks (tooltip, footer, header stamp, error panel)
  interpolate data as text plus same-origin `<img>` only — no
  `<script>`/`<iframe>`/external images built from data; `arena.json` `url`
  fields are not fetched by app.js (link candidates for 006); `meta.json`
  source URLs render as `<a href>` text only.
- 18 SVG + 5 PNG logos: no `<script>`, no event handlers, no external refs
  (w3.org namespace URIs are XML identifiers, not fetches); PNGs inert.
- `update.py` writes only the four data JSONs + logo bytes — never edits
  HTML/JS.
- No favicon (live 404), no beacons.

**Verdict: cookieless — no GDPR consent mechanism required.** Nothing in
the repo can set a cookie (no storage APIs, no runtime third parties, no
data-driven external content); the CF edge sets none on any measured
client; the CF features that *could* set cookies (challenge actions,
Transform Rules `Set-Cookie`, Turnstile) are not active.

**Standing rule (settled → AGENTS.md Conventions):** no runtime third
parties (019); inline JS never reaches for `document.cookie`/
`localStorage`/`sessionStorage`/`IndexedDB` (grep before commit); CF
cookie-capable features stay off — or use `block`, never `challenge`;
re-run the cookie probe (cookie-jar curl over `/` + every asset the HTML
references, desktop + curl + mobile UAs) at every deploy.

**Footer line (step 4):** owner decision 2026-09-17 — land here as a
one-line step, not with 012. `renderFooter` (app.js) gains
`Cookieless — no cookies are set by this site; no GDPR consent required.`
after the overrides line. Verified via headless-Chromium DOM dump: footer
renders the line, 154 models joined, canvas present, no error panel.
Visual feel-out: owner.

## Steps (research-only + one-line step 4; owner reviews the findings diff)

1. Post-019 re-verification on live: every page request on both hosts
   (including `__cf_bm`/bot management), cookie-accepting client.
2. Zone audit of `kaidev.io` in the CF dashboard (owner operates the
   dashboard in parallel — verify live state before assuming): WAF/managed
   rules, Cloudflare Web Analytics, Transform Rules (Set-Cookie header
   injection), Turnstile, email routing. Record enabled/disabled per feature.
3. Findings appended to this doc: evidence table (source × measured cookie
   behavior), verdict ("cookieless — no GDPR consent mechanism required"),
   and the standing-rule candidate: "no runtime third parties (019); zone
   checklist; re-verify the cookie surface at every deploy" — candidate for
   AGENTS.md Conventions.
4. Optional footer line ("we are cookieless"): owner decides — land it with
   012-kaidev-footer (PROPOSED) or as a one-line step here.

## Out of scope

Consent banners, analytics, CSP, changing NEL behavior, new storage APIs.

## Definition of done

- [x] Owner approves this plan. (2026-09-17, "Execute")
- [x] Evidence table covers every current and potential cookie source.
      Live measured pre-019 (019 unpushed per owner); post-019 covered by
      the repo audit (strict subset) — re-probe at the next deploy per the
      standing rule.
- [x] Verdict recorded; standing rule settled in AGENTS.md Conventions.
- [x] Footer-line decision recorded: landed here as a one-line step
      (owner 2026-09-17), verified in a headless-Chromium DOM dump.
