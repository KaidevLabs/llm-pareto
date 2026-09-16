# 012 — Kaidev footer + link preview

Date: 2026-09-16. **Status: PROPOSED — not reviewed, not executed.**
Source: `plans/archive/003-exploration-backlog.md` item B9 + its exploration findings.

A small brand notice announcing Kaidev and its services at the bottom of the
site, plus the link-preview surface (OG tags + favicon) that B9 explicitly
punted to B13 — one branding pass, two small commits.

## Proposed decisions (settled at owner review)

| # | decision | rationale |
|---|----------|-----------|
| D1 | Placement: static brand block inside `<footer>`, above the JS-filled content — restructure `<footer id="footer">` into `<div class="brand">` (static) + `<div id="footer-dyn">` (`renderFooter` target) | `renderFooter()` sets `innerHTML` on `#footer` (app.js:348, 362) and would wipe static children; the retarget is one line; the brand survives future JS-footer changes and is visible to crawlers (003 B9 options a–d) |
| D2 | Content: "Arena Pareto — a Kaidev project · software development & code refactoring" + link to `https://kaidev.io` (apex; `www` fails over HTTPS today) | the measured landing-page title/description; the three service pillars are too long for a footer line — the landing page answers them (003 B9 content options i–iii) |
| D3 | Epoch CC-BY credit rides along: the `Sources:` line gains `Epoch AI (CC-BY)` as a third link, pre-staging 002 B2 open question 6 | the footer's `Sources:` line (app.js:369-371) is the single home for brand + data attribution (003 B9 option iv) |
| D4 | Link preview: `og:title/description/url` + `og:image` (committed 1200×630 PNG, a static asset — no build) + `theme-color` + favicon + `<link rel="icon">` | measured: zero `og:`/`twitter:` tags, no favicon (live 404) — shared links render as text + a globe icon today; folding in avoids a second branding commit (003 B9 open question 5, B13 candidate #1) |

Evidence (compressed; full measured tables in the 003 findings): footer
anatomy (index.html:311, CSS 225-236, renderFooter app.js:347-379 — four dense
lines incl. the live gold overrides disclaimer; `#stamp` is in the header, not
the footer); `kaidev.io` is a live GitHub Pages landing (apex 200, www HTTPS
broken, measured 2026-09-16); the KaidevLabs org has no named services — the
landing page is the source of record; head inventory (index.html:3-10):
charset, viewport, title, description, fonts — nothing else.

## Open questions (settled at the examination session)

1. `og:image` policy: fixed branded card (D4) vs chart screenshot — the
   screenshot needs a regeneration step, which fights the no-build culture.
2. Logo mark: text-only (D2) vs a Kaidev SVG (kaidev.io hosts one — hotlink vs
   commit).

## Steps (commit per step; owner stages each diff)

1. index.html: `<footer>` restructure (brand block, D1/D2) + CSS; app.js:
   retarget `renderFooter` at `#footer-dyn`; `Sources:` line + Epoch link (D3).
   Commit: `site: Kaidev footer brand + Epoch attribution`
2. index.html head: OG + theme-color + favicon (D4); commit `public/og.png` +
   `public/favicon.svg`.
   Commit: `site: link preview (OG tags + favicon)`
3. Review pass: mobile wrap of the footer, no clash with the `.ov` gold line,
   link-preview check. Commit only if something changes.

## Out of scope

- Corner-badge / slim-section alternatives (rejected in the 003 B9 findings).
- A separate about/methodology page (016 candidate).
- `twitter:card` beyond `og:*` (OG tags cover the mainstream previews).

## Definition of done

- [ ] Owner approves this plan (D1–D4) in a review session.
- [ ] Footer shows the brand block above the existing fine print; the overrides disclaimer still renders (`.ov` line intact).
- [ ] `Sources:` line carries the Epoch (CC-BY) link.
- [ ] Live: favicon 200; OG tags present in the served HTML; link preview shows title + description + image.
- [ ] No `update.py`/data change; deployed per A10.
