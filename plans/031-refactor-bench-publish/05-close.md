# Step 05 — Close — OPEN

## Spec

Closing procedure per the plans skill:

1. Finalize plan files — this step's as-built, every execution-order row, the
   Definition-of-done audit, and the overview status → `ARCHIVED (date)`.
2. Confirm the live-publish Open branch is left explicitly open (deploy is the owner's
   decision; the plan delivers the portable `report.html` only).
3. Move `plans/031-refactor-bench-publish/` → `plans/archive/031-refactor-bench-publish/`;
   single closing plan commit, message suffaced ` (plan: 031-refactor-bench-publish)`.

**Not touched in this step:** no app source; the harness code is already committed in
prior steps.

## Verification

- Archived plan exists; `plans/031-refactor-bench-publish/` no longer present.
- Closing commit contains only plan files; `tools/refactor-bench/` + `benchmarks/`
  outputs are as left by steps 01–04.
- DoD items all evidenced (harness exits 0 → `benchmarks/`, cyclomatic top-N in reports,
  coverage dimension present, `report.html` generated + offline/cookieless).

## Seams under test

- `no tests`: closing procedure; verified by the checklist above.
