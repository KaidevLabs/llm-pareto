# Step 05 — Close — OPEN

## Spec

Closing procedure per plans skill:

1. Final verification: full no-arg run once more from a clean slate
   (`.tmp/refactor-bench/results/` wiped first) to prove reproducibility.
2. Definition-of-done audit in `00-overview.md` — each item checked only with
   evidence from the run.
3. A6: paste the full report (or its essential tables + link to the mirrored
   `.tmp/refactor-bench/report.md`) into this step's as-built record — the
   durable home for the writeup the cutover forgot.
4. Resolve the open branch's state for the record (promote-to-`tools/` stays
   parked unless the owner says otherwise at close).
5. Update overview status → `ARCHIVED (date)` with the plan's commit history;
   move `plans/029-refactor-bench/` → `plans/archive/029-refactor-bench/`;
   single closing plan commit, message suffixed ` (plan: 029-refactor-bench)`.

## Not touched in this step

All harness modules (read-only rerun); repo code; plan-025 files.

## Verification

- Clean-slate rerun exits 0 with a byte-different-but-shape-identical report
  (timings vary; tables/columns identical).
- `plans/archive/029-refactor-bench/` exists; no `plans/029-refactor-bench/`
  remains; overview status line reads `ARCHIVED (date)`.
- Closing commit contains only plan files.

## Seams under test

- no tests: closing procedure; verified by the checklist above.

## As-built

(to be written at close — carries the A6 report)
