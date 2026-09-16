# 016 — Survey candidates (B13 follow-up)

Date: 2026-09-16. **Status: PROPOSED — not reviewed, not executed.**
Source: `plans/archive/003-exploration-backlog.md` item B13 + its exploration findings.

Work through the 003 B13 ranked candidate list in a dedicated examination
session: for each candidate — own plan (017+), fold into an existing plan, or
drop. Selected candidates implement in their own plans (one plan per item);
this plan owns the examination, not the implementation.

## The ranked list (003 B13 findings, compressed)

Own-item candidates (deduped against B1–B12):

| # | candidate | value | effort | deps / notes |
|---|-----------|-------|--------|--------------|
| 1 | Shareable URL state (mode/filters/ratio → URL) | high once 004/010 land | low-med | design the schema jointly with 004/010; sequence after 004 |
| 2 | Mobile / responsive pass | med | low-med | zero `@media` rules today; do before the next filter-bar item |
| 3 | Methodology / about surface (join + frontier definitions, `:free` / variant-collapsing) | med | low-med | synergy with 012 (brand) + 005 (Epoch credit) |
| 4 | Data-freshness surface (persist per-source cutoffs; staleness badge) | med now, high post-013 | low (data half) | the alarm half feeds 013 |
| 5 | Accessibility pass (half-done ARIA, no chart SR labels, no `<noscript>`) | med | low-med | folds the visitor-facing error copy in |
| 6 | Per-update data changelog (what changed since the last commit) | med | med | the strongest "new" item; 013 synergy (every cron run publishes a change) |
| 7 | Export of the current filtered set (CSV/JSON, client-side Blob) | low-med | low | after 004 (export respects active filters) |
| 8 | Custom 404 page (live 404 = empty body) | low | low | the visitor-facing error copy folds here or into #5 |

Folded candidates (tracked in the target plan, not here): security + cache
headers → 011; monitoring / dead-man's switch + `update.py` retry → 013;
`meta.json` unmatched list + cutoffs → #4/#6 above. Cut (revisit only if the
audience grows): i18n, PWA, theme toggle, price-precision rework.

## Proposed decisions (settled at owner review)

| # | decision | rationale |
|---|----------|-----------|
| D1 | One examination session walks the list; each candidate gets exactly one of: own plan (017+), fold into a named existing plan, or drop — recorded in this doc's decision table | the owner's one-plan-per-item rule; the examination is the session this plan exists for |
| D2 | Recommendation: implement in batches — batch A (low effort, independent): #8 404 page + error copy, #1 URL state (post-004), #7 export; batch B (post-013): #4 freshness, #6 changelog; #3 methodology and #2 mobile when next needed | measured value/effort in the 003 B13 findings; keeps the review cadence small |
| D3 | Nothing here touches the data layer except #4 (cutoffs in `meta.json`) and #6 (a changelog section) — both ride the `update.py` + diff-review flow | the 003 B13 measured determinism (no-op run = 1-line meta.json diff) keeps the diffs clean |

## Steps (commit per step; owner stages each diff)

1. Examination session: walk the ranked list, settle D2's batches, create the
   chosen plans (017+) / record the folds in the target plans.
   Commit: `docs: 016 examination decisions (plans 017+ created)`
2. (Optional, same session) the 2–3 line hygiene items (404 page, error copy)
   if the owner wants them in-place rather than as a 017 plan.
   Commit: `site: 404 page + visitor-facing error copy`

## Out of scope

- Implementing any candidate inside this plan (except the D2 optional hygiene
  step) — one plan per item.
- Re-opening 002's out-of-scope (i18n, PWA) without an owner trigger.

## Definition of done

- [ ] Owner walks the ranked list in the examination session.
- [ ] Every candidate has a recorded disposition (own plan / fold / drop).
- [ ] Chosen candidates have their plan docs (017+) or their fold is recorded in the target plan.
- [ ] This plan is marked SETTLED and archived with its decision table.
