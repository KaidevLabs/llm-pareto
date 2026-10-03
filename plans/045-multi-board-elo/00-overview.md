# 045 — Multi-board Elo: hub-derived boards, per-board data, code as default view

> **Status:** OWNER REVIEW Supersedes `plans/009-multi-board-arena.md` (PROPOSED 2026-09-16, never executed; stale: webdev slug replaced by `code`, app.js era superseded by the 028 Svelte cutover). 009's still-valid decisions (per-board validation, cross-board identity, per-board arena.json sections) are absorbed here.

Date: 2026-10-03.

## Goal

The dashboard no longer shows only the text leaderboard. `update.py` ingests **every arena board that is Elo-scored and token-priced** — discovered from the hub page, not hardcoded — and `combined.json` rows carry per-board Elo/rank/votes. The explorer gains a board switcher (Seg control) that changes the Elo axis, bubble size, thresholds, Pareto frontier, crowns and counts; **Code is the default view**. URL deep-links carry the board (default omitted).

## Settled decisions

| A# | decision | rationale | date |
|----|----------|-----------|------|
| 1 | v1 board set: **all Elo+token-priced boards** — text, code, vision, search, document today — derived at runtime | All share the 18-field RSC schema (verified live on code: 178 entries, Elo 1075–1815, per-token prices, 2026-10-03); deriving the set from the source self-heals board drift (#504 instinct; #354 already went stale once) | 2026-10-03 |
| 2 | **Code is the default view** of the dashboard | Owner: "the main one is code" | 2026-10-03 |
| 3 | One `combined.json`; rows gain `arena_elo_by_board: {board: {elo, upper, lower, rank, votes}}` (009 D2 naming); flat `arena_elo`/`_upper`/`_lower`/`_rank`/`_votes` become the **default board's (code)** values | Single OR join, single history/endpoints/snapshots pipeline (those surfaces read flat rows); front-end keeps flat fields as the default fast path | 2026-10-03 |
| 4 | Board eligibility is **derived per fetch**: parse each hub-discovered board; ingest only boards whose entries carry `rating` (Elo) and per-token prices; boards failing classification are excluded and named in the match report + meta.json | Media boards price in `pricePerImage`/`pricePerSecond` — no $/Mtok axis; agent board is a schema outlier (score ≠ Elo). No hardcoded slug list | 2026-10-03 |
| 5 | Validation: **text keeps its current hard thresholds** (top-20 ≥ 90%, overall ≥ 40%); **code gets the same hard thresholds** (it is the new default/anchor, 178 entries); the remaining boards are **soft** — entry-count floor + per-board report section, warn-only | Text is the historical anchor; small boards OR-match poorly by nature (009 D6) and must not kill the 6-hourly bot run | 2026-10-03 |
| 6 | Cross-board identity stays `(modelOrganization, modelDisplayName)` normalized; `modelKey` is never an identity key | Measured 009 D7: modelKeys gain board suffixes or codenames on other boards | 2026-10-03 |
| 7 | Board entries that don't OR-match: excluded from the chart for that board (intersection), listed in that board's match-report section | Consistent with established text-board behavior (009 D8) | 2026-10-03 |
| 8 | Front-end board is a **view state dimension** like `mode`: `urlstate` serializes it as `board=<slug>`, default omitted; `filters.ts` visibility/thresholds read the active board's Elo via a shared `eloOf(d, board)` helper; every arena_elo read site goes through it | 027 URL rule (serializer + round-trip test); one shared helper instead of parallel channels (user's consolidate-duplication rule) | 2026-10-03 |

## Current state

- `update.py` fetches exactly one board: `ARENA_URL = "https://lmarena.ai/leaderboard/text"`; `parse_arena` (RSC chunks → `"entries":` array) is board-agnostic and parses any standard board unchanged.
- Live board slugs on the hub (verified 2026-10-03): `text`, `code`, `vision`, `search`, `document`, `image-edit`, `text-to-image`, `text-to-video`, `video-edit`, `image-to-video`, `agent`. `webdev`/`image-to-webdev` no longer exist.
- Code board verified: same 18-field schema, `rating` ∈ [1075.8, 1815.4], 178 entries, `inputPricePerMillion`/`outputPricePerMillion` present.
- `combined.json` rows are flat: `arena_elo`, `arena_elo_upper/lower`, `arena_rank`, `arena_votes`, … (checked row keys).
- `d.arena_elo` read sites: `src/lib/filters.ts`, `charts.ts`, `comparator.ts`, `trails.ts`, `ModelSearch.svelte`, `ModelCard.svelte`, `ThresholdCtl.svelte` (+ their tests).
- `pareto.ts` is already Elo-agnostic (operates on `[price, elo]` pairs) — only its callers need the per-board elo.
- urlstate views: `["general", "in", "out", "speed", "3d"]`; `Mode` state + `view=` serialization exist as the pattern to extend.
- The 6-hourly `update-data` bot gates on arena.json/openrouter.json/combined.json/endpoints.json diffs (#441); once the data steps land, the bot deploys the new data automatically — the additive `arena_elo_by_board` field is invisible to the current front end, so data steps land safely before UI steps.

## Design

- **Step 01** turns `update.py` into a board-driven pipeline: discover slugs from the hub, fetch+parse each, classify (Elo? token-priced?), write per-board `arena.json` sections, per-board match report with per-board validation (hard text+code, soft rest).
- **Step 02** joins per board into `combined.json` (`arena_elo_by_board` + flat default-board fields) and `meta.json` (per-board counts, staleness, join stats, `default_board`).
- **Step 03** adds the board dimension to the front end's logic layer: types, state, urlstate, `eloOf`, filters/comparator/trails read sites — all tested units.
- **Step 04** makes it visible: charts render per-board elo/axis/tooltip/frontier, a board Seg switcher, panel counts, footer staleness note, vision-filter relabel.
- **Step 05** closes: full suite + DoD audit + archive.

## Execution order

| Step | File | Depends on | Status | Commit |
|------|------|------------|--------|--------|
| 01 | [01-boards.md](01-boards.md) | — | OPEN | |
| 02 | [02-join.md](02-join.md) | 01 | OPEN | |
| 03 | [03-board-state.md](03-board-state.md) | 02 | OPEN | |
| 04 | [04-board-ui.md](04-board-ui.md) | 03 | OPEN | |
| 05 | [05-close.md](05-close.md) | 01–04 | OPEN | |

## Definition of done

- [ ] `python3 update.py` discovers boards from the hub, ingests every Elo+token-priced board, and prints a per-board match report; a green run exits 0, an anomalous board soft-fails into the report without killing the run (hard boards still fail it).
- [ ] `combined.json` rows carry `arena_elo_by_board`; flat fields = code (default) board; `meta.json` documents `default_board` + per-board stats.
- [ ] The explorer's default view is the code board; the switcher flips Elo axis, size, thresholds, frontier, crowns, counts fully client-side.
- [ ] `board=` deep-links round-trip (round-trip-tested in `urlstate.test.ts`); defaults omitted.
- [ ] `python3 -m unittest discover -s tests` + `npm test` + `npx tsc --noEmit` green; `npm run build` clean.
- [ ] Live-cookie probe untouched (no new runtime third parties, no storage).

## Not yet specified

- Per-board override entries in `overrides.json` (keys currently arena-name→or_id; per-board ambiguity may need board-scoped keys) — sharpens when a real unmatched case appears in a step's match report.
- Whether the text→code default flip changes the speed view's threshold parking behavior — only sharp once step 04 exercises it.

## Open branches

- **Composite/mixed-board view** ("mix of all those") — owner explicitly deferred ("that's for another time"); hangs on combining incomparable Elo scales; revisit as its own discovery.

## Out of scope

- The composite mix-of-boards view (A-branch above).
- Media boards (`pricePerImage`/`pricePerSecond` — no $/Mtok axis) and the agent board (schema outlier).
- Any redesign of speed view, thresholds UX, or the chart seam's imperative architecture.
- Subcategory boards outside the hub SSR payload (client-side lazy loads — separate transport problem, 009).

## Executor rules

- Standard repo flow; no formatter/linter — keep Python PEP 8-clean by hand, TS/Svelte in the existing strict style (no `any` outside the echarts seam).
- Behavior-changing steps run test-first (`tdd` skill) at the declared seams; suite after every cycle: `python3 -m unittest discover -s tests -v`, `npm test`, `npx tsc --noEmit`.
- Never commit a failed `update.py` run; a data step closes only on a reviewed, green data diff (`meta.json` first).
- Step close: owner's `staged` signal → code commit, then as-built record + plan-file commit (`plan: 045 — step NN`). No push (Push policy).
- Scratch/throwaway goes to `.tmp/`, never the repo root.
