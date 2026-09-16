# 004 — Org → family filter (dashboard)

Date: 2026-09-16. **Status: EXECUTING — steps 1–3 executed (step 3 review pass: no code changes needed); deploy per A10 pending.**
Source: `plans/archive/002-exploration-backlog.md` item B1 + its exploration findings.
Amendment 2026-09-16 (owner directive mid-step-1): families must be 100%
source-derived — generated from the OpenRouter display name, nothing hand-fixed
(no curated map, no per-org policy, no exceptions). If the source changes,
families move with it on the next data refresh.

Org → model-family hierarchy in the filter bar, as one `<select>` with
`<optgroup>` per org: pick an org, then the family within it. Hard-hide
semantics (same as the vision filter): frontier, bubble scale, and counts
recompute over the filtered set — "Pareto of OpenAI gpt-5.x".

## Proposed decisions (settled at owner review)

| # | decision | rationale |
|---|----------|-----------|
| D1 | Family grouping = derived mechanically from the OpenRouter display `name` (`or_name`, already in combined.json), one uniform rule for all orgs: strip parentheticals + "Org: " prefix + date/size tokens; single letter+digit token → letter ("o1" → O); word+digit token → letters + major version ("Qwen3.5" → Qwen3, "GPT-5.6" → GPT-5); otherwise leading word + following word ("Claude Opus"). Version granularity: **major** (owner choice over full-version; full would split Qwen 3.5–3.8 but fragment OpenAI into ~15) | Owner directive: zero hand-maintained grouping; new model lines auto-group on the next refresh (GPT-5.7 → GPT-5, Claude Opus 6 → Claude Opus). Accepted artifacts measured on the 154: Qwen3 lumps 3.5–3.8 (22), Kimi K2+K3 lump (5), gpt-3.5-turbo alone as "GPT-3", Nano Banana Pro outside Gemini 3, Muse split Spark/Glimmer, "Claude 3" (claude-3-haiku) split from Claude Haiku, "Ministral 3" label |
| D2 | (obsolete, superseded by D1') the rule is total: every model gets a family from its OR name; fallback on empty/missing name = the org name. Former R1 `arena_model` fallback and small-org special case dropped | One mechanism instead of map + two fallbacks; arena names are the messier source (002 findings) |
| D3 | UI (amended 2026-09-16, owner directive before the select shipped): multi-select accordion — a pill in the filter bar opens a popover panel; per org a row (chevron expands, row toggles) with its families as children, each family its own toggle; union semantics: state = set of active `org\|family` leaves, an org row toggles all its children (no exclusions, "OpenAI minus GPT-4" dropped); chips aggregate on/part; pill badge shows active model count; searcher input on top filters tree nodes only (org/family labels — model search stays 010); closes on outside click / Escape, keyboard operable (Enter/Space) | Owner: "select many at a time… accordion with sub children and active and unactive org families at every level" + "add a searcher on top of the accordion"; union over tri-state exclusion for a single flat Set and no ambiguous state |
| D4 | Semantics: hard-hide — non-selected rows dropped in `filtered()` (app.js:68-71); frontier, bubble min/max, and counts recompute over the visible set | Consistent with the vision-filter precedent (app.js:68-71, 298-300); "Pareto of X" is the literal ask. Dimming is 010's language; 010 dims *within* the set 004 hides |
| D5 | Map lives as a const in app.js — no `update.py` or data change | "Filters work fully client-side" is 001's DoD; no new data file, no deploy-side change beyond the usual push |

Evidence (compressed; full measured tables in the 002 findings): 23 orgs /
154 models (OpenAI 28, Alibaba 26, Google 18, Anthropic 15, Z.ai 13, Meta 11,
Mistral 7, MiniMax 6, Moonshot 5, SpaceXAI 5, DeepSeek 5; 12 orgs ≤ 3);
R1/R2/R3 measured failures above; R4 validated 1:1; frontier degeneration
under hide — GPT-5.x (13 pts) → 4, orgs of 1–3 models → "frontier = everything"
(accepted: degenerate sets are honest).

## Steps (commit per step; owner stages each diff)

1. app.js: `familyOf(d)` rule engine (D1'); `state.org`, `state.family`;
   `filtered()` conjunction. No markup yet.
   Commit: `chart: org/family filter logic (familyOf rule)`
2. index.html + CSS: org/family accordion panel — `buildOfPanel()` after fetch
   (rows carry model counts); `bindOfPanel()` bindings (open/close, click
   delegation, Escape, searcher input); dark-theme panel styling.
   Commit: `chart: org → family multi-select accordion + searcher`
3. Review pass: "All <org>" behavior, degenerate-set UX, composition with
   vision/frontier/spread/ratio filters, re-render performance sanity.
   Commit only if something changes.

## Out of scope

- Per-model multi-select / model search box (010 owns the search mechanic;
  the panel's searcher filters org/family tree nodes, not models).
- Dim semantics (010), logo legend (007), per-board dimension (009).

## Definition of done

- [x] Owner approves this plan (D1–D5; D1 amended in-session to the source-derived rule, owner directive 2026-09-16).
- [x] Accordion panel multi-selects orgs/families; active leaves hard-hide the chart (frontier, scale, counts recompute); searcher filters tree nodes.
- [x] Any model gets a family from its OR name (D1'; fallback: org name); the chart never breaks.
- [x] No data-layer change (`python3 update.py` outputs byte-identical; update.py and `public/data/` untouched — git status evidence).
- [ ] Filter composes with the existing five controls; deployed per A10.
