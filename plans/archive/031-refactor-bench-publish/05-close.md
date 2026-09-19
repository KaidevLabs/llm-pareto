# Step 05 — Close — DONE (2026-09-19)

## As-built

The harness is committed under `tools/refactor-bench/` and promoted out of scratch per
plan 029. Default `node tools/refactor-bench/run.mjs --old 7957602 --new e858d24`
exits 0 and writes `benchmarks/run-<YYYYMMDD-HHMM>/{static,load,interact,coverage,provenance,meta}.json`,
`report.md`, and `report.html`. Paths are fully parameterized via `--work-dir` (default
`tools/refactor-bench/.run`) and `--out` (default `benchmarks/run-<stamp>`); verified with
a throwaway `--work-dir /tmp/bench-test` run.

### Execution-order rows
| Step | File | Status | Commit |
|------|------|--------|--------|
| 1 | 01-promote.md | DONE | plan: 031 — step 01 |
| 2 | 02-cyclomatic.md | DONE | plan: 031 — step 02 |
| 3 | 03-coverage.md | DONE | plan: 031 — step 03 |
| 4 | 04-pagegen.md | DONE | plan: 031 — step 04 |
| 5 | 05-close.md | DONE | plan: 031 — step 05 (plan: 031-refactor-bench-publish) |

### DoD audit
- [x] Harness in `tools/refactor-bench/`; default run exits 0 → `benchmarks/`; `.gitignore`
      covers `tools/refactor-bench/.run/`, `benchmarks/`, and `coverage/`.
- [x] Per-function cyclomatic top-15 in `static.json` (`complexity.topFunctions`),
      `report.md` ("Cyclomatic offenders"), and `report.html` (big-offender card).
      Verified: worst new fn = `data` (34) in `src/lib/charts.ts`; `charts.ts` holds
      ~41.6% of new-side cyclomatic.
- [x] Coverage dimension present. New side populates (e.g. lines 94.17% / branches 79.21%
      / 15 files); old side `null` with note "vitest coverage provider
      (@vitest/coverage-v8) not installed at ref". A coverage provider
      (`@vitest/coverage-v8` devDependency) was added to `package.json` so the dimension
      actually measures — the old ref still lacks test infra and reports null gracefully.
- [x] `report.html` generated from data by `lib/page.mjs` (genPage). Verified: 0 external
      http(s) `<script>`/`<link>`, 0 `document.cookie`, and 3 spot-checked numbers
      (94.17 / 79.21 / cyclomatic Σ 553) equal `report.md`.
- [x] No app source (`src/`, `update.py`, `public/`) touched.

## Open branch (explicitly left open)
- **Live publishing** to the CF site as a `/aftermath` route is deferred to an owner
  decision (cookieless/static-site constraints #349/#436). This plan delivers only the
  portable, generated `report.html`; deploy is a separate owner call.

## Closing procedure
- Plan moved to `plans/archive/031-refactor-bench-publish/`.
- Single closing commit (this step) suffaced `(plan: 031-refactor-bench-publish)`.
- No push (per plan executor rules / #467 push policy).
