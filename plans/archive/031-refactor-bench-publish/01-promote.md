# Step 01 — Promote & parameterize — DONE (2026-09-19)

## Spec

Move the plan-029 harness out of scratch into the repo and make its paths
configurable. No behavior change to the measurement logic — this is relocating +
parameterizing.

- `git mv` is not possible (source is in gitignored `.tmp/`); instead copy
  `.tmp/refactor-bench/{run.mjs,lib}` → `tools/refactor-bench/` and delete the
  `.tmp` copy.
- Replace every hard-coded `.tmp/refactor-bench` path in `run.mjs` / `lib/*` with
  options resolved from CLI flags: `--work-dir` (default `tools/refactor-bench/.run`,
  holds the two git worktrees `old`/`new` + `results`) and `--out` (default
  `benchmarks/run-<YYYYMMDD-HHMM>`). Keep `--old`, `--new`, `--runs`, `--live`.
- Add to `.gitignore`: `tools/refactor-bench/.run/` and `benchmarks/` (generated
  artifacts). Confirm the harness code itself is tracked.
- Keep `package.json` untouched unless the owner later wants an `npm run bench` script
  (out of scope here).

**Not touched in this step:** `lib/static.mjs` cyclomatic detail (step 02), coverage
(step 03), page generator (step 04), and all app source.

## Verification

- `node tools/refactor-bench/run.mjs --old 7957602 --new e858d24 --runs 1` exits 0 and
  writes `benchmarks/run-<date>/{static,load,interact,provenance}.json` + `report.md`.
- `git status --short` shows `tools/refactor-bench/` tracked and `benchmarks/` ignored.
- A second run with `--work-dir /tmp/bench-test` (throwaway) also works, proving paths
  are not hard-coded.

## Seams under test

- `no tests`: relocation + path parameterization; verified by the two smoke runs above
  and `git status`. The measurement logic is unchanged from plan 029 (already verified).
