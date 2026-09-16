# 015 — Open-models license selector

Date: 2026-09-16. **Status: PROPOSED — not reviewed, not executed.**
Source: `plans/archive/003-exploration-backlog.md` item B12 + its exploration findings.

A license-tier selector in the filter bar (All / Open-weights / Open-source) on
an auditable, curated 18-entry class map in the data layer. Answers the owner's
original question — "how many licenses are there?": 39 raw arena values, 18 on
the joined set; tiers verified against the actual license texts.

## Proposed decisions (settled at owner review)

| # | decision | rationale |
|---|----------|-----------|
| D1 | The class map lives in the data layer: a curated 18-key map (verbatim raw strings, maintained like `overrides.json`); `update.py` writes `license_tier` per model into `combined.json`; unknown raw strings surface in the match report | deterministic, diffable, feeds tooltip / B3 / B8 consumers; a new license string fails loudly instead of silently rendering "unknown" (003 B12 findings) |
| D2 | Tiers, measured and verified against the license texts: Proprietary 75 / Permissive 61 / Community 14 / NC 4 → open-weights = 79 | full per-value basis in the 003 B12 tier table (Llama 3.x/4 Community = commercial OK, 700M-MAU clause; Gemma ToU; Qwen 2024-09-19 >100M MAU; Kimi K3 MIT-like; Modified MIT = MIT + attribution above 100M MAU; MRL = research-only — verified stricter than expected) |
| D3 | UI: a 3-state segmented control in the filter bar with counts in the labels ("All 154 / Open 79 / OSS 54"); hard-hide + frontier recompute (the vision-filter precedent, app.js:68-71) | matches the owner's words exactly; the counts prevent "why is OSS smaller than I expected" surprises (003 B12 options) |
| D4 | "Open-source" = 54 strict OSI (Apache 33 + MIT 21) or 61 incl. the 7 Modified-MIT models — owner call at review | the Modified-MIT clause (display attribution above 100M MAU / $20M-mo) is OSI-like but not OSI (003 B12 open question 1) |
| D5 | The arena license string stays authoritative for the 3 measured join-vs-HF disagreements (`qwen2.5-vl-72b-instruct`, `reka-flash-3`, `ministral-8b-2512`); HF tags are an audit cross-check surfaced in the match report | measured: 58/76 HF agreement (exact or family-level), 15 "arena precise vs HF `other`", 3 substantive; arena is finer-grained and the system of record (003 B12 findings) |

Evidence (compressed; full measured tables in the 003 findings): the 18-value
tier table (counts + per-value basis); 39 raw values over 402 arena entries
(NVIDIA 4 spellings, Llama 8 variants, MRL / "Mistral Research", Qwen /
"Qianwen LICENSE"); the OR API's 20-key union has no license field (measured);
the HF cross-check (76/76 `huggingface.co/api/models/{id}` queries: 8 license
tags, ceiling 76/154 — the 78 without `hugging_face_id` are 73 proprietary +
5 known open).

## Open questions (settled at the examination session)

1. D4: Modified MIT in "open-source" (61) or not (54).
2. NC as a 4th control state (4 models: Cohere ×3 + ministral) vs merged into
   open-weights (the 3-state D3).
3. MiniMax Community License: COMMUNITY (commercial via one-time notice) vs
   NON-COMMERCIAL (flips 14/4 → 13/5).
4. The 3 join fixes (open 79 → 81, NC 4 → 3, PERM 61 → 62) or keep the arena
   strings verbatim (D5).
5. Carry `hugging_face_id` through into `combined.json` (002 B5 plumbing) for
   B3's HF links + the D5 cross-check line.

## Steps (commit per step; owner stages each diff)

1. The class map (18 entries, D1/D2) + `update.py`: the join, `license_tier`
   in `combined.json`, match-report line for unknown raw strings (D5
   cross-check line if open question 5 is yes).
   Verification: `python3 update.py` green; the tier counts in the diff match
   the measured 75/61/14/4.
   Commit: `data: license tier map (18 values, curated)`
2. app.js: `state.licenseTier`, the `filtered()` conjunction, the segmented
   control in `nav.filters` with counts (D3).
   Commit: `chart: open-models license selector`
3. Tooltip (and the B3 panel if 006 has landed): license string + tier (+ HF
   link if the hfid is carried). Commit: `chart: license in tooltip / panel`

## Out of scope

- Per-model license browsing / detail (B3 panel territory).
- A new license data source beyond arena strings + the HF audit cross-check.
- License filtering inside other selectors (composition only).

## Definition of done

- [ ] Owner approves this plan (D1–D5) in a review session.
- [ ] The selector hard-hides; frontier + counts recompute over the visible set (vision-filter semantics).
- [ ] `python3 update.py` green; the tier counts in `public/data/` match the measured 75/61/14/4.
- [ ] A new arena license string surfaces in the match report (no silent "unknown").
- [ ] The filter composes with 004's org filter + the existing controls; deployed per A10.
