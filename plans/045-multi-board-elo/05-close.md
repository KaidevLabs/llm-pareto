# Step 05 — Close: full verification, DoD audit, archive — OPEN

Depends on: steps 01–04.

## Spec

Verification-only (no code expected):

1. Full suite: `python3 -m unittest discover -s tests -v`, `npm test`, `npx tsc --noEmit`, `npm run build`, `python3 update.py` (green, sane per-board match report).
2. Definition-of-done audit on the overview — each item checked only with verifiable evidence.
3. Not-yet-specified / open-branches sweep: resolve or move each explicitly.
4. Archive: set overview status → `ARCHIVED (date)` with the plan's commit history; move `plans/045-multi-board-elo/` to `plans/archive/`; also move the superseded `plans/009-multi-board-arena.md` into `plans/archive/` (superseded-by-045 noted in the as-built).
5. Remind the owner: push is theirs (Push policy); the 6-hourly bot will pick up the new data pipeline on its own schedule once landed.

## Verification

- All the suite commands above green in one pass.
- `git status` clean after the archive commit.

## Seams under test

- no tests: verification-only close step.
