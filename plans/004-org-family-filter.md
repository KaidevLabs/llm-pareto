# 004 — Org → family filter (dashboard)

Date: 2026-09-16. **Status: PROPOSED — not reviewed, not executed.**
Source: `plans/002-exploration-backlog.md` item B1 + its exploration findings.

Org → model-family hierarchy in the filter bar, as one `<select>` with
`<optgroup>` per org: pick an org, then the family within it. Hard-hide
semantics (same as the vision filter): frontier, bubble scale, and counts
recompute over the filtered set — "Pareto of OpenAI gpt-5.x".

## Proposed decisions (settled at owner review)

| # | decision | rationale |
|---|----------|-----------|
| D1 | Family grouping = curated `or_id`-keyed map for the 11 large orgs, using the groupings validated 1:1 against current data in the 002 findings (OpenAI: GPT-5.x / GPT-4.x / O-series / GPT-OSS / GPT-6; Alibaba: Qwen3 open-weights / Qwen3.5 / Qwen2.5 / Qwen3.6 / 3.7 / 3.8 / Qwen3-VL / legacy; Google: Gemini 3.x / 2.5 / Gemma 3 / 4 / 2; Anthropic: Opus / Sonnet / Fable / Haiku; Z.ai: GLM-4 / GLM-5; Meta: Llama 3 / Muse / Llama 4; Mistral: per line; MiniMax M; Grok 4; Kimi K2 / K3; DeepSeek V / R1) | Every mechanical rule measured in the findings fails on ≥half the top orgs (R1: OpenAI → 18 families incl. "o1-2024"; R3: catch-alls "gpt"=7, "minimax"=6); the curated map is the only grouping that matches human intuition |
| D2 | The 12 small orgs (1–3 models each): one family = the org name. New `or_id` not in the map: R1 fallback (first 2 `arena_model` tokens) | Zero-maintenance default; the map gets a touch-up when a new model line ships; the chart never breaks |
| D3 | UI: one `<select>` with an optgroup per org, family options inside, "All" on top + per-org "All <org>" (no optgroup-label selection in native selects) | Owner asked for "org, then family within org, with a dropdown that shows that info" — the hierarchy is visible in one control; ~75 options of native popup scroll is the accepted cost |
| D4 | Semantics: hard-hide — non-selected rows dropped in `filtered()` (app.js:68-71); frontier, bubble min/max, and counts recompute over the visible set | Consistent with the vision-filter precedent (app.js:68-71, 298-300); "Pareto of X" is the literal ask. Dimming is 010's language; 010 dims *within* the set 004 hides |
| D5 | Map lives as a const in app.js — no `update.py` or data change | "Filters work fully client-side" is 001's DoD; no new data file, no deploy-side change beyond the usual push |

Evidence (compressed; full measured tables in the 002 findings): 23 orgs /
154 models (OpenAI 28, Alibaba 26, Google 18, Anthropic 15, Z.ai 13, Meta 11,
Mistral 7, MiniMax 6, Moonshot 5, SpaceXAI 5, DeepSeek 5; 12 orgs ≤ 3);
R1/R2/R3 measured failures above; R4 validated 1:1; frontier degeneration
under hide — GPT-5.x (13 pts) → 4, orgs of 1–3 models → "frontier = everything"
(accepted: degenerate sets are honest).

## Steps (commit per step; owner stages each diff)

1. app.js: `FAMILIES` const (D1) + `familyOf(d)` (D2 fallbacks); `state.org`,
   `state.family`; `filtered()` conjunction. No markup yet.
   Commit: `chart: org/family filter logic (FAMILIES map, familyOf)`
2. index.html + CSS: build the `<select>` with optgroups in `main()` after
   fetch (option labels carry model counts); `change` listener in
   `bindFilters()`; dark-theme select styling (~15 lines).
   Commit: `chart: org → family dropdown in the filter bar`
3. Review pass: "All <org>" behavior, degenerate-set UX, composition with
   vision/frontier/spread/ratio filters, re-render performance sanity.
   Commit only if something changes.

## Out of scope

- Per-model multi-select / model search box (010 owns the search mechanic).
- Dim semantics (010), logo legend (007), per-board dimension (009).

## Definition of done

- [ ] Owner approves this plan (D1–D5).
- [ ] Org select filters the chart hard; family options nest inside each org.
- [ ] Unlisted `or_id`s render under an R1 family; the chart never breaks.
- [ ] No data-layer change (`python3 update.py` outputs byte-identical).
- [ ] Filter composes with the existing five controls; deployed per A10.
