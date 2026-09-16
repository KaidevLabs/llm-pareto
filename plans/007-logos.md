# 007 — Org logos on the frontier points

Date: 2026-09-16. **Status: PROPOSED — owner-approved 2026-09-16 (revised D1–D7), not executed.**
Source: `plans/archive/002-exploration-backlog.md` item B4 + its exploration findings.
Amended 2026-09-16 (owner directives, replacing old D1/D4): all non-frontier
bubbles keep a fixed size and the current per-org color; the org logo appears
only on the frontier points, each carrying a small permanent name label; the
frontier line stays a pure line.

Owner approved the revised plan 2026-09-16 (DoD item 1; org color + two-tier
sizing settled in review; execution in a separate session).

Every non-frontier bubble is a fixed-size org-colored circle (identity exactly
as today). Every frontier point is an org logo (ECharts
`symbol: 'image://…'`, committed asset) with a small permanent label showing
just the model name. The gold override ring and top-10 glow survive via
`itemStyle`; the frontier line is untouched (same path / width / glow). No
runtime hotlinking.

## Proposed decisions (settled at owner review)

| # | decision | rationale |
|---|----------|-----------|
| D1 | Non-frontier bubbles: fixed size (~10px), org color exactly as today (`ORG_COLOR`). Frontier points: org logo symbol (~18px) + small name label. Frontier line: `symbol: 'none'` — a pure line; logos and labels live as per-data items on the scatter series | Owner directive 2026-09-16. Measured: frontier = 10 of 154 points at the default 3:1 blend; at 10px a logo is a smudge (old D3), hence two size tiers |
| D2 | Identity: per-org, keyed by `orgOf` (~23 orgs); fallback glyph = initial-in-circle on the existing fallback gray — now only ever visible on frontier points | Per-model identity is v2; the fallback keeps the chart unbreakable |
| D3 | Assets: brand-color logos normalized to a square canvas at import (SVG where available, PNG otherwise), committed under `public/assets/logos/<org>.{svg,png}`; org→file map as a const in app.js; provenance (source URL + license per org) recorded alongside | Measured sourcing (002 findings): OpenRouter API has no logo field; OR page icons are per-author-slug with provider fallbacks and mixed formats (Minimax→Modular, Z.ai→SiliconFlow); simple-icons/worldvectorlogo/official og:images cover all top-11 orgs. Pre-squaring means `symbolSize` needs no per-item `[w,h]` (Mistral is 191×135, Gemini 16×16) |
| D4 | Two fixed sizes: 10px regular / 18px frontier logo (final values = step-3 A/B). `bubbleSize()`, the lo/hi votes computation in `chartOption()`, and the axis-note "bubble: arena votes" clause are deleted; votes survive only in the tooltip | Old D4 (10px floor) retires; the votes size-encoding is dropped by directive, so none of it becomes a dead-compat shim |
| D5 | Label: frontier points only. Text = cleaned `or_name` (parentheticals + "Org: " prefix stripped), ~10px font, position `top`, `labelLayout: { moveOverlap: 'shiftY' }` — shift, never hide. The extraction is shared with `familyOf` via a small `displayName(d)` helper | The frontier is recomputed per filter, so label overlap must be handled natively (ECharts 5.6 `labelLayout`), not manually; longest measured frontier name is 27 chars ("Qwen3 30B A3B Instruct 2507"); the helper has two real consumers (`familyOf` body, frontier label) |
| D6 | `update.py` validates the org→file map against the data on each run: a new org in `combined.json` without a logo → match-report warning + fallback glyph, not a hard fail | Graceful degradation; the chart never breaks on a new org (old D5, unchanged) |
| D7 | Tooltip: the "frontier" tag moves from the line series into the scatter formatter via a per-panel frontier set; the marker-less line keeps no tooltip. Legend rows keep the old plan's logo + org name row | A marker-less line tooltip only fires on the 2px path — unusable; 006's frontier-click then binds to a single series |

## Steps (commit per step; owner stages each diff)

1. Curation: source + square-normalize the ~23 logos; commit
   `public/assets/logos/` + a provenance file (source URL, license per org).
   Commit: `chart: org logo assets`
2. app.js + index.html: org→logo map (D3); `displayName()` helper (D5);
   two-tier fixed sizes (D4, delete `bubbleSize()`); per-data frontier logo +
   label + `labelLayout` (D1/D5); frontier line `symbol: 'none'` + tooltip
   move (D7); fallback glyph (D2); axis-note clause out (D4); legend rows gain
   logo + org name (D7).
   Commit: `chart: frontier logos + name labels`
3. Review pass: first-paint flash (zrender loads images async — documented
   behavior), dim states, ring/glow on image symbols, label
   legibility/overlap A/B, size A/B (10/18). 006's drawer header reuses the
   org logo when 006 lands.
   Commit only if something changes.

## Out of scope

- Per-model logos, monochrome/recolor mode, hotlinked assets, per-logo
  animation, labels on non-frontier bubbles.

## Definition of done

- [x] Owner approves this plan (incl. the logo set + step-3 A/B picks).
      (2026-09-16 — approved as revised D1–D7; the logo set + A/B picks settle
      at step 3.)
- [ ] All non-frontier bubbles render at the fixed size with the current org
      color; votes are no longer encoded in size (tooltip only, axis note
      updated).
- [ ] Frontier points render the org logo (fallback glyph when missing) plus
      the small name label; nothing else is labeled.
- [ ] Frontier line, override ring, top-10 glow, spread bars visually
      unchanged.
- [ ] Deployed per A10.
