# 009 — Multi-board arena data + board selector

Date: 2026-09-16. **Status: PROPOSED — not reviewed, not executed.**
Source: `plans/archive/002-exploration-backlog.md` item B6 + its exploration findings.

Scrape the standard arena boards (v1: text, vision, webdev, document, search)
with the existing `parse_arena` pipeline — all five share the exact
`self.__next_f` / `"entries":` surface, verified 2026-09-16 — carry per-board
Elo/rank/votes into `combined.json`, and add a "board" `<select>` to the
filter bar that switches the y-axis, bubble size, and frontier.

Note: `lmarena.ai` 301-redirects to `arena.ai` (identical pages); the scrape
URLs are the arena.ai board paths.

## Proposed decisions (settled at owner review)

| # | decision | rationale |
|---|----------|-----------|
| D1 | v1 board set: text, vision, webdev, document, search. Media boards (text-to-image, image-edit, text-to-video, image-to-video, video-edit) are v2; the agent board is out of scope (different schema: `score` ∈ [−0.3, 0.33], not Elo — route through 005 if ever wanted) | Measured: 108/154 combined models already carry ≥1 other-board Elo (76 vision, 77 webdev, 37 img2webdev, 33 document, 8 search; 26 on all five). Media boards OR-join 0/154 today (codename modelKeys, labeled display names) — real join/override maintenance for thin payoff |
| D2 | `combined.json`: keep `arena_elo` / `arena_rank` / `arena_votes` as the **text defaults** (app.js read sites unchanged) + `arena_elo_by_board: {board: {elo, upper, lower, rank, votes}}` map | Back-compat with the current site; the map is the single per-board source of truth |
| D3 | `arena.json`: single file, per-board sections `{text: [...], vision: [...]}`, raw entries at full fidelity | Keeps the 4-file data contract; per-board raw diffs stay reviewable in git |
| D4 | Frontier semantics: the non-dominated set **of the selected board**, recomputed per board (cross-board overlay is v2) | Consistent with the filtered-set frontier precedent (vision filter, 004). This is the one decision the owner must make at review |
| D5 | UI: a "board" `<select>` in the filter bar, default "text"; y = selected board's Elo, size = that board's votes (min/max renormalizes per board, existing behavior); the existing "vision" capability filter is relabeled "vision input" | One-word rename kills the naming collision (a *board* called vision vs a *capability* called vision) |
| D6 | Validation: text board keeps the current hard thresholds (50–2000 entries, top-20 ≥ 90%, overall ≥ 40%). The other four boards are **soft**: per-board relaxed rules (entry-count floor; top-10 matched ≥ 8 for boards ≥ 34 models; 10–20-model boards warn-only), all printed in a per-board match-report section | The text board is the anchor (A8 fail-fast); small boards OR-match poorly by nature and must not kill the run |
| D7 | Cross-board identity: per-board join on normalized `(modelOrganization, modelDisplayName)`; `modelKey` is **not** used as identity | Measured: modelKeys gain board suffixes (`claude-fable-5-text` / `-vision`) or internal codenames (`thunbergia-alpha-9e3w` = qwen3.8-max on vision) for newer models |
| D8 | Board entries that don't OR-match: excluded from the chart (intersection, per 001 branch 4), listed in the per-board match report | Consistent with the established behavior for the text board |

Board inventory measured 2026-09-16 (counts = parsed `entries`, cross-checked
against hub metadata): text 402 (8.1M votes), vision 152 (1.3M), webdev 128
(0.68M), document 44 (0.40M), search 34 (1.1M, stalest cutoff); img2webdev 50,
text-to-image 78, image-edit 55, text-to-video 48, image-to-video 48,
video-edit 10; agent 43 (different schema). Elo scales differ per board — not
comparable on one axis. Full tables in the 002 findings.

## Steps (commit per step; owner stages each diff)

1. update.py: `BOARDS = {slug: url}` dict; looped fetch + `parse_arena`
   reuse; per-board validation (D6) → per-board `arena.json` sections;
   per-board match-report section. Run; review the report.
   Commit: `data: multi-board arena scrape`
2. update.py: per-board join (D7) → `combined.json` (D2) + `meta.json`
   per-board section (counts, `voteCutoffISOString` staleness, join stats).
   Run; review the data diff.
   Commit: `data: per-board join (arena_elo_by_board)`
3. app.js + index.html: the "board" `<select>`; per-board y-axis label /
   size / frontier (D4, D5); "vision" → "vision input" relabel; footer
   per-board staleness note.
   Commit: `chart: board selector`

## Out of scope

- Media boards (v2), agent board, subcategory boards (not in the SSR payload —
  client-side lazy loads, a separate transport problem), per-board
  `pricePerImage` / `pricePerSecond` (net-new, v2 with the media boards).

## Definition of done

- [ ] Owner approves this plan (esp. D1 board set, D4 frontier semantics,
      D5 relabel).
- [ ] `python3 update.py` scrapes + validates all v1 boards; the match report
      is per-board.
- [ ] The board select switches y-axis / size / frontier fully client-side;
      "text" remains the default and the current view is unchanged at it.
- [ ] `meta.json` carries per-board stats + cutoff staleness.
- [ ] Deployed per A10.
