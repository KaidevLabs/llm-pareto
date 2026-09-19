# Step 03 — Test-coverage dimension — OPEN

## Spec

Add a 5th comparison dimension: JavaScript test coverage, via vitest, for each ref.

- New `tools/refactor-bench/lib/coverage.mjs`: `coverageAnalysis(oldRef, newRef, ctx)` →
  for each ref worktree, run `npm test -- --coverage --run --reporter=json
  --coverage.reporter=json` (or `npx vitest run --coverage`), then parse
  `coverage/coverage-summary.json` for `{ lines, branches, functions, statements }`
  percentages + the number of files. Return `{ old: {...} | null, new: {...} | null }`.
- **Guard for refs without test infra:** the old ref `7957602` has no vitest. If the
  coverage run (or reading the summary) fails, record `null` with
  `note: "no test infra at ref"` — do not let the harness abort. This is the expected
  old-side result and is itself a finding ("refactor added a test suite").
- Wire `coverageAnalysis` into `run.mjs` (after static), persist `coverage.json`, and
  add a `coverageTables` section to `report.md` + the HTML generator (step 04).

**Not touched in this step:** static/load/interact modules; the page generator file.

## Verification

- `run.mjs` with default refs exits 0; `coverage.json` has `new` populated (%) and
  `old: null` with the note.
- `report.md` "Coverage" section shows new-side % and old-side "no tests at ref".
- A manual `cd` into the new worktree + `npm test -- --coverage --run` reproduces the
  parsed numbers.

## Seams under test

- `no tests`: new module + report wiring; verified by `coverage.json` shape + the
  graceful `null` path (the old ref exercises it). The `npm test` command is the repo's
  own, so it needs no new test code here.
