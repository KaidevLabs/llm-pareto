# Step 01 — Harness skeleton + static analysis — OPEN

## Spec

Create `.tmp/refactor-bench/`:

- `run.mjs` — CLI entry: arg parsing (refA, refB, `--single`, `--live`,
  `--runs N`, `--port-base`), orchestration skeleton calling each module,
  worktree lifecycle: `git worktree add .tmp/refactor-bench/old <refA>` at
  start, `git worktree remove --force` + `git worktree prune` in a `finally`.
- `lib/serve.mjs` — zero-dep static server (A5): content types, zlib
  gzip/brotli chosen by `Accept-Encoding`, 404s; one instance per side.
- `lib/fair.mjs` — fairness copy (A4): copy current `public/data`,
  `public/assets`, `public/fonts` over the old worktree's `public/` after
  checkout (old `app.js` + `index.html` + `js/` stay pinned to the ref).
- `lib/build.mjs` — fresh build of the current tree (`npm run build`) before
  measuring refB; record HEAD sha + `git status --porcelain` dirty flag +
  build stamp into the results meta.
- `lib/static.mjs` — static analysis (A3):
  - cloc via npx on old (`public/app.js`, `public/index.html`) vs new (`src/`),
    language split + code/comment/blank;
  - complexity/maintainability (escomplex-style via npx) on `app.js`, each
    `.ts`, and `.svelte` files after script-block extraction (small regex
    extractor in the module);
  - jscpd duplication % on the same corpora;
  - crude counts: functions, max nesting, longest file, `any`-count in `src/`
    (rule: `any` allowed only in the echarts seam);
  - test counts: old suite (node:test seam, at the ref) vs `src/**/*.test.ts`
    (describe/it counts).
  - Output: `results/static.json` + a markdown section.
- `results/` dir created on demand.

If an npx package misbehaves (escomplex is old), pick the closest maintained
equivalent, record the substitution in the as-built.

## Not touched in this step

Load/interaction/report modules (stubbed calls ok), `src/`, `update.py`,
`public/`, plan-025 files.

## Verification

- `node .tmp/refactor-bench/run.mjs --runs 1` reaches the static module and
  exits 0; `results/static.json` populated for both sides.
- Worktree lifecycle clean: after the run, `git worktree list` shows no
  `llm-arena-pareto` extra worktree.
- Spot-check one number by hand (e.g. old `app.js` LOC = 2,093).

## Seams under test

- no tests: scratch benchmark tooling (gitignored); each module is verified by
  running it against the cutover pair — there is no repo-facing behavior.

## As-built

(to be written at close)
