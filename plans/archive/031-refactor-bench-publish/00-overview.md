# 031 — refactor-bench harness: promote, report, publish — OWNER REVIEW

> **Status:** ARCHIVED (2026-09-19; all five steps executed and committed).

Date: 2026-09-19.

## Goal

Promote the plan-029 benchmark harness out of scratch (`.tmp/refactor-bench/`) into a
committed, reusable repo tool that compares **any two git refs** and generates a
self-contained benchmark report — static/complexity, **per-function cyclomatic**,
load, interactions, and a new **test-coverage** dimension — plus a board-ready HTML
infographic. Generated artifacts land in a `benchmarks/` directory; the harness code
lives in `tools/refactor-bench/`. "Publishing" here means producing the portable
`report.html` (and a decision point on deploying it); it does **not** modify the app.

## Settled decisions

| A# | Decision | Rationale | Date |
|----|----------|-----------|------|
| A1 | Generated reports → `benchmarks/<slug>/`; harness code → `tools/refactor-bench/` (committed); scratch → `tools/refactor-bench/.run` (gitignored) | User: "reports o benchmarks directory" 2026-09-19 |
| A2 | Harness stays generic/two-ref parameterized (inherited from plan 029 A1); default refs preserved but overridable via `--old`/`--new` | plan 029 |
| A3 | Add a **per-function cyclomatic top-N** breakdown to the report (the analysis done this session: `data`=34 is the worst fn, `charts.ts`=42% of all cyclomatic) | User: "also make the cyclomatic complexity report" |
| A4 | Add a 5th dimension: **test-coverage** (vitest `--coverage`); record `null`/"no tests" when a ref lacks test infra | User: "maybe adding a test coverage and such things" |
| A5 | The board HTML becomes a **generated artifact** (`lib/page.mjs`) from results JSONs — port the hand-written page built this session, not a hand-maintained file | User: "publishing it" |
| A6 | Live publishing (CF `/aftermath` route) is an **Open branch** — this plan delivers a generated local `report.html`; deploy is a separate owner decision | deploy policy (#436, #349) |

## Current state

- Plan 029 built and verified the harness in `.tmp/refactor-bench/` (gitignored):
  `run.mjs` (CLI + worktree lifecycle), `lib/{serve,fair,build,static,load,interact,report}.mjs`.
- Verified old `7957602` (vanilla `app.js`) → new `e858d24` (pure svelte cutover),
  seven-run medians: load-neutral refactor, +33 MB heap, +3.5 s throttled `load`,
  chart-paint parity, drawer/3D parity.
- This session added a per-function cyclomatic extractor (one-off, `.tmp/`) proving
  `data` (34) is the worst fn and identical both sides; `charts.ts` holds 230/553 (42%)
  cyclomatic + all 25 `any`.
- A hand-written board infographic `report.html` exists (self-contained, no network)
  and was validated to render.
- The repo has **no `tools/` or `benchmarks/` dir** yet (verified 2026-09-19).

## Design

1. **Promote & parameterize** — move the harness to `tools/refactor-bench/`; replace
   hard-coded `.tmp/refactor-bench` paths with `--work-dir` (default
   `tools/refactor-bench/.run`) and `--out` (default `benchmarks/run-<date>`); add
   `.gitignore` entries; verify a default run exits 0 and writes to `benchmarks/`.
2. **Cyclomatic per-function report** — extend `static.mjs` to also emit top-N
   functions by cyclomatic (name, cyc, nesting, file) into `static.json`; surface it in
   `report.md` and the HTML generator as a "big offender" table.
3. **Test-coverage dimension** — add `lib/coverage.mjs`: run vitest `--coverage` in
   each ref worktree, parse `coverage/coverage-summary.json` (lines/branches/functions/
   statements % + file count); `null`/"no tests" when a ref has no test infra (old ref).
   Wire into `run.mjs` + both reports.
4. **Page generator** — `lib/page.mjs` ports the hand-written infographic into a
   data-driven generator (same design, embedded data from results JSONs, self-contained
   HTML/CSS/JS, no external requests); `run.mjs` emits `report.html` beside `report.md`.
5. **Close** — finalize, archive; live-publish left as Open branch.

## Execution order

| Step | File | Depends on | Status | Commit |
|------|------|------------|--------|--------|
| 1 | 01-promote.md | — | DONE | plan: 031 — step 01 |
| 2 | 02-cyclomatic.md | 1 | DONE | plan: 031 — step 02 |
| 3 | 03-coverage.md | 1 | DONE | plan: 031 — step 03 |
| 4 | 04-pagegen.md | 1, 2, 3 | DONE | plan: 031 — step 04 |
| 5 | 05-close.md | 4 | DONE | plan: 031 — step 05 (plan: 031-refactor-bench-publish) |

## Definition of done

- [x] Harness committed under `tools/refactor-bench/`; default `run.mjs` exits 0 and
      writes to `benchmarks/`; `.gitignore` covers `.run/` + generated outputs.
- [x] Per-function cyclomatic top-N present in `static.json` (`complexity.topFunctions`),
      `report.md` ("Cyclomatic offenders"), and the HTML.
- [x] Coverage dimension present: new side shows % (lines/branches/functions/statements +
      file count); old side `null`/"no tests at ref" gracefully.
- [x] `report.html` is generated from data (not hand-written), self-contained, no network.
- [x] Plan files committed; no app source (`src/`, `update.py`, `public/`) touched.

## Not yet specified

- Exact default `--out` slug format (`run-<date>` vs `<old>..<new>`).
- Whether a generated `benchmarks/` sample is committed or fully gitignored.
- Whether `npm test` at the old ref can run at all (no vitest there) — coverage step
  must guard this.

## Open branches

| Branch | Hangs on | Parked because | Forces revisit when |
|--------|----------|----------------|---------------------|
| Deploy the infographic to the live CF site as a `/aftermath` route | Owner publish decision | Cookieless/static-site constraints (#349, #436); not a code question | Owner wants it public |
| Commit a sample `benchmarks/` output vs fully gitignore | Owner preference | Generated artifacts churn | Owner decides at step 01/04 |

## Out of scope

- Modifying the svelte app (that is plan 030).
- SSR / app architectural changes (plan 030).
- The live deploy itself (Open branch).

## Executor rules

- Repo root; node ≥ 22 (stdlib) + `npx cloc`/`jscpd`/`chromium` (same as plan 029).
- No `src/`, `update.py`, `public/` edits — the harness only reads refs via worktrees.
- Each step commits code (plain message) + plan files (`plan: 031 — step NN`); no push.
- Verify a `--runs 1` smoke run exits 0 before any `--runs 7` full run.
