# Step 01 — Publish command + registry — OPEN

## Spec

- **`tools/refactor-bench/lib/publish.mjs`** — pure logic, exported:
  - `validateRun(runDir)` → `{ ok: true }` or `{ ok: false, error }` — requires
    `static.json` + `provenance.json`; refuses a partial run.
  - `entryFrom(runDir, prov)` → `{ id, date, label, side, files }` — id =
    run-dir basename; date/label from `provenance.json` (`runDate`,
    `headShort` + `refB`); side = `"new"` (A7 — a two-ref run publishes its
    new side; a `--single` run has only that side).
  - `publishRun(runDir, benchRoot)` → validates, creates
    `<benchRoot>/<id>/`, copies the run's own artifacts **verbatim** (A10:
    `static.json`, `coverage.json`, `load.json`, `interact.json`,
    `provenance.json`, `report.html` — whichever exist), reads
    `<benchRoot>/index.json` (missing → empty registry), **fails on a
    duplicate id**, appends the entry, writes `index.json` (pretty-printed).
  - Fail-fast: any error → thrown with a clear message; non-zero CLI exit.
- **`tools/refactor-bench/publish.mjs`** — CLI wrapper: one positional
  `<run-dir>` (default: latest dir in `benchmarks/`), benchRoot =
  `<repoRoot>/public/bench`; prints what was published (id, label, files).
- **`package.json`** — add `"bench:publish": "node tools/refactor-bench/publish.mjs"`.
- **`README.md`** — extend the `npm run bench` section with the publish flow
  (publish a run → it lands in `public/bench/` → compare page + footer link).

**Not touched in this step:** `run.mjs` (publish is not a measuring phase),
`page.mjs`, the compare page (step 02), `Footer.svelte`, any app source.

## Seams under test

`tools/refactor-bench/lib/publish.test.ts` (vitest, tmp dirs):

- `validateRun` — accepts a complete dir; rejects missing `static.json` /
  `provenance.json` with the reason.
- `entryFrom` — id/label/side derived from a real `provenance.json` fixture
  (typed fixture, hand-written — never a real page snapshot).
- `publishRun` — copies present artifacts verbatim; appends to `index.json`;
  duplicate id → throws, registry unchanged; missing registry → created.

TDD: red → green at these seams before the step closes.

## Verification

```sh
node --check tools/refactor-bench/lib/publish.mjs
node --check tools/refactor-bench/publish.mjs
npx vitest run tools/refactor-bench/lib/publish.test.ts
npm run bench:publish -- benchmarks/<an existing complete run dir>   # → public/bench/<id>/ + index.json updated
npm run bench:publish -- benchmarks/<same dir>; echo $?              # duplicate → non-zero, registry unchanged
```
