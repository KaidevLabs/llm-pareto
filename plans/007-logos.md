# 007 — Org logos instead of colored bubbles

Date: 2026-09-16. **Status: PROPOSED — not reviewed, not executed.**
Source: `plans/archive/002-exploration-backlog.md` item B4 + its exploration findings.

Replace the org-color bubbles with per-org logo symbols (ECharts
`symbol: 'image://…'`, natively supported, per data item). Size stays =
votes, the gold override ring and top-10 glow survive via `itemStyle`, and
the frontier line is untouched (separate series). Logos are committed assets —
no runtime hotlinking.

## Proposed decisions (settled at owner review)

| # | decision | rationale |
|---|----------|-----------|
| D1 | Per-org logos as the point symbol; frontier markers stay 7px green circles; override ring + top-10 glow unchanged | `symbolSize` keeps the votes encoding (bubbleSize(), app.js:120-124); at 7px a logo is a smudge; the ring/glow are `itemStyle` and apply to image symbols unchanged |
| D2 | Identity: per-org, keyed by `arena_org` (reuses `orgOf`), 23 orgs; fallback glyph = initial-in-circle on the existing fallback gray for any org without a logo | Per-model identity (Qwen vs Alibaba, Gemini vs Google) is v2; the fallback keeps the chart unbreakable |
| D3 | Assets: brand-color logos normalized to a square canvas at import (SVG where available, PNG otherwise), committed under `public/assets/logos/<org>.{svg,png}`; org→file map as a const in app.js; provenance (source URL + license per org) recorded alongside | Measured sourcing (002 findings): OpenRouter API has no logo field; OR page icons are per-author-slug with provider fallbacks and mixed formats (Minimax→Modular, Z.ai→SiliconFlow); simple-icons/worldvectorlogo/official og:images cover all top-11 orgs. Pre-squaring means `symbolSize` needs no per-item `[w,h]` (Mistral is 191×135, Gemini 16×16) |
| D4 | Sizing: keep `bubbleSize()` with a 10px floor | 25/154 points are <8px today and would smudge; the floor preserves the votes encoding |
| D5 | update.py validates the org→file map against the data on each run: a new org in `combined.json` without a logo → match-report warning + fallback glyph, not a hard fail | Graceful degradation; the chart never breaks on a new org |

## Steps (commit per step; owner stages each diff)

1. Curation: source + square-normalize the ~23 logos; commit
   `public/assets/logos/` + a provenance file (source URL, license per org).
   Commit: `chart: org logo assets`
2. app.js: org→logo map (D3); per-data `symbol: 'image://…'`; 10px floor
   (D4); fallback glyph (D2); the legend row gains logo + org name (the first
   decodable org legend — today org color is only legible via tooltip, and 8 of
   23 orgs share the fallback gray).
   Commit: `chart: logo point symbols`
3. Review pass: first-paint flash (zrender loads images async — documented
   behavior), dim states, ring/glow interaction, legibility A/B at the real
   sizes. 006's drawer header reuses the org logo when 006 lands.
   Commit only if something changes.

## Out of scope

- Per-model logos, monochrome/recolor mode, hotlinked assets, per-logo
  animation.

## Definition of done

- [ ] Owner approves this plan (incl. the logo set + legibility A/B at step 3).
- [ ] Bubbles render as per-org logos; size = votes with the 10px floor.
- [ ] Unknown orgs fall back to the initial-in-circle glyph; the chart never
      breaks.
- [ ] Frontier line, override ring, spread bars visually unchanged.
- [ ] Deployed per A10.
