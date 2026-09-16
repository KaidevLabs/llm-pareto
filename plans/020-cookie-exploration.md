# 020 — Cookie injection exploration (cookieless guarantee)

Date: 2026-09-16. **Status: PROPOSED — pending owner review.**
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

## Steps (research-only; owner reviews the findings diff)

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

- [ ] Owner approves this plan.
- [ ] Evidence table covers every current and potential cookie source
      (post-019, both hosts).
- [ ] Verdict recorded; standing rule settled (AGENTS.md or this doc).
- [ ] Footer-line decision recorded.
