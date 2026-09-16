# 019 — Self-host runtime assets (out with the Google Fonts + jsdelivr CDNs)

Date: 2026-09-16. **Status: EXECUTING (step 1/3 — step 1 committed f4ffd2a, 2026-09-17).**
Source: owner directive 2026-09-16 ("no CDNs if I can"); measured baseline below.

Owner approved execution 2026-09-17 (DoD item 1; "Execute" + step-level
staging during the session).

## Amendments (owner-settled during execution — do not revisit)

| # | amendment | rationale |
|---|-----------|-----------|
| D1′ | **Single variable-font file** — one `public/fonts/inter-var.woff2` (48,256 B) with a single `@font-face` `font-weight: 400 700`, instead of D1's four per-weight static files | Measured in step 1: Google's css2 serves the same gstatic `inter v20` file (variable font, `fvar` wght 100–900) for all four weights — the browser already fetches one 48 KB file today; four duplicate files would cost 193 KB in git and ~145 KB on the wire (3× today's). Owner picked single file 2026-09-17 |

The page makes three external runtime requests today: Google Fonts Inter
(`index.html` L8–10) and ECharts 5.6.0 from jsdelivr (`index.html:393`). After
this plan: zero external requests — everything same-origin.

## Measured baseline (2026-09-16)

- Inter is served by Google as per-subset woff2 to browsers (7 subsets × 4
  weights); `latin` = 48,256 B per weight (400/500/600/700); `latin-ext` =
  85,068 B per weight; non-browser UAs get full TTF ~325 KB/weight.
- ECharts 5.6.0 from jsdelivr: 1,034,102 B,
  `cache-control: public, max-age=31536000, immutable`.
- `app.js` checks `window.echarts` after the data fetch — the vendored file
  keeps the same load order (echarts before app.js).

## Proposed decisions (settled at owner review)

| # | decision | rationale |
|---|----------|-----------|
| D1 | Inter self-hosted: 4 × `public/fonts/inter-{400,500,600,700}.woff2` (subset `latin` only, 48,256 B each ≈ 193 KB total), inline `@font-face` in the `index.html` `<style>`, `font-display: swap` + the same `unicode-range` as Google's CSS; the three `<link>` lines (L8–10) are deleted. `latin-ext` only if tofu ever appears (+85,068 B/weight) | Owner pick A (2026-09-16: self-host over system-stack). `latin` covers EN/ES/CA fully (ñ, accents); look intact, zero third-party. Full TTF (325 KB/weight — what old UAs get) rejected |
| D2 | Provenance: comment block next to the `@font-face` (source gstatic `inter v20` URLs, fetch date, weights, subset, byte sizes) and source URL + sha256 for the echarts file (commit message) | 007 D3 precedent (provenance recorded alongside); re-vendoring stays auditable |
| D3 | ECharts vendored to `public/js/echarts-5.6.0.min.js` (1,034,102 B from `cdn.jsdelivr.net/npm/echarts@5.6.0/dist`), `<script src>` swap at `index.html:393`, version in the filename | Owner decision (2026-09-16): same kind of change, one plan; with D1+D3 the site reaches zero external requests, shrinking plan 020 to the CF edge only |

## Consequence ledger

Simplifies: first paint with no external fetches; future CSP = `self` only
(B13 sub-item 5); cookieless posture (plan 020). Complicates: ~1.22 MB of
vendored binary assets in git; manual re-vendoring on upgrades (pinned:
Inter `v20`, echarts `5.6.0`).

## Steps (commit per step; owner stages each diff)

1. Fonts: download the four `latin` woff2 files (gstatic `inter v20`, browser
   UA — plain curl UA gets TTFs) → `public/fonts/`; replace L8–10 with the
   inline `@font-face` blocks (D1) + provenance comment (D2). — **✅ COMPLETE
   (committed f4ffd2a, 2026-09-17)**
   As-built: D1′ settled mid-step (owner) — single variable-font file
   `public/fonts/inter-var.woff2` (48,256 B, sha256
   `3100e775e8616cd2611beecfa23a4263d7037586789b43f035236a2e6fbd4c62`); one
   `@font-face` (`font-weight: 400 700`, `font-display: swap`, Google's
   `unicode-range` verbatim) at the top of the `<style>`; the three `<link>`
   lines (old L8–10) deleted; provenance comment per D2. Site CSS uses only
   400/600/700. Local check: font served 200 as `font/woff2`, 48,256 B.
   Seams: `no tests: asset swap + @font-face, no app.js logic — owner manual
   A/B` (017 A2, ESM split pending).
   Commit: `chart: self-host Inter font (drop Google Fonts CDN)` (f4ffd2a)
2. ECharts: download echarts 5.6.0 dist → `public/js/echarts-5.6.0.min.js`;
   sha256 into the commit message (D2); swap the `src` (D3).
   Commit: `chart: vendor echarts 5.6.0 (drop jsdelivr CDN)`
3. Review pass: fresh visit, Network tab — zero external requests; look A/B
   (Inter identical, no FOUT); asset paths 404-free on the custom domain and
   workers.dev.
   Commit only if something changes.

## Out of scope

Variable fonts, `latin-ext`, CSP, cache headers (B13 #5), other subsets.

## Definition of done

- [x] Owner approves this plan. (2026-09-17 — "Execute", D1′ amendment settled
      in step 1)
- [ ] Fresh visit: Network tab shows zero external requests (fonts/CSS/JS all
      same-origin).
- [ ] Rendering A/B unchanged (Inter look, no FOUT regression).
- [ ] Deployed per A10.
