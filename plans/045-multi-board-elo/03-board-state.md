# Step 03 — Board state dimension: types, state, urlstate, eloOf, filters — OPEN

Depends on: step 02 (data must carry the map first).

## Spec

Front end logic layer only — no UI chrome, no chart rendering changes:

1. **types.ts**: `Row` gains `arena_elo_by_board?: Record<string, {elo: number, upper: number | null, lower: number | null, rank: number | null, votes: number | null}>`; exported `BoardElo` type. Export `DEFAULT_BOARD = "code"` (single constant, shared — no string literals scattered).
2. **`eloOf(d, board)` helper** (home: `data.svelte.ts` next to `logoFor`, or a tiny `board.ts` if data.svelte.ts should stay store-only — executor's call, record it): returns the `BoardElo` for the board, falling back to the flat fields **only for the default board** (they are the default board's values by construction — not a compat shim, a documented identity). Returns `null` when the model has no Elo on that board.
3. **state.svelte.ts**: `ui.board: string` (slug), default `DEFAULT_BOARD`.
4. **urlstate.ts**: serialize as `board=<slug>`, default omitted (027 rule); parse with validation against the boards present in data (unknown slug → default, not an error). Round-trip cases added to `urlstate.test.ts`.
5. **history.svelte.ts**: board changes join the existing burst/replace semantics (a switcher click is a discrete input → push at burst-open like `mode`).
6. **Read-site migration**: `filters.ts` (`passThresholds` eloMin/Max branches + `isVisible`), `comparator.ts`, `trails.ts` switch from `d.arena_elo` to `eloOf(d, board)` — thread the active board through the existing `ctx`/argument patterns these modules already use (filters already takes `ctx`; follow it). `pareto.ts` itself is untouched (already takes `[price, elo]` pairs).
7. **Threshold semantics (settled here, record in as-built)**: eloMin/Max thresholds are **view-agnostic values applied to the active board's Elo** — they do not reset on board switch (consistent with how thresholds already survive data refreshes; the ThresholdCtl display naturally re-clamps via existing min/max renormalization).

## Not touched in this step

- `charts.ts`, all `.svelte` components (UI + rendering is step 04), `panels.svelte.ts`, data-loading, snapshots surface.

## Verification

- `npm test` green: new unit tests for `eloOf` (default-board fallback, map lookup, null for absent board), `filters.test.ts` extended (thresholds evaluate against the active board's elo), `urlstate.test.ts` extended (`board=` round-trip, default omitted, unknown-slug fallback).
- `npx tsc --noEmit` green.
- `npm test` run of the full suite after every TDD cycle.

## Seams under test

- `eloOf` (new), `filters.passThresholds`/`isVisible` with board-threaded ctx, `urlstate.parse/serialize` board param. No component tests in this step.
