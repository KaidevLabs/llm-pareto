# Step 01 — Harness skeleton + static analysis — ✅ COMPLETE (committed 5c119bc, 2026-09-19)

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

Implemented 2026-09-19. All modules under `.tmp/refactor-bench/` (gitignored):
`run.mjs` (CLI: refA/refB/`--single`/`--live`/`--runs N`/`--port-base`; worktree
lifecycle via `git worktree add/remove --force` + prune + `rmSync` fallback in
`finally`), `lib/serve.mjs` (A5 zero-dep server: gzip/brotli by Accept-Encoding,
on-the-fly with per-key memo cache, Content-Encoding/Last-Modified/Cache-Control
headers, 404s + traversal guard), `lib/fair.mjs` (A4 copy of data/assets/fonts),
`lib/build.mjs` (fresh `npm run build` + node_modules symlink for worktree-B
builds; HEAD sha/dirty flag), `lib/static.mjs` (analysis).

Verification: `run.mjs --runs 1` exit 0; `results/static.json` populated both
sides; `git worktree list` shows only main after the run; spot-check cloc old
JS 1,745 code + 250 comment + 98 blank = 2,093 = `wc -l` of `app.js` exactly.
`serve.mjs` smoke-tested separately: br on the 1.7 MB echarts min.js →
311,597 B with `Content-Encoding: br`; gzip on combined.json → 16.3 KB; 404 +
path-traversal blocked.

Substitutions and findings (A3 escape hatch):

- escomplex (npx) rejected: `escomplex`, `typhonjs-escomplex`,
  `typhonjs-escomplex-project` all ship no CLI (npx: "could not determine
  executable") and their 2015-era parsers cannot read TypeScript. Substituted
  an in-module cyclomatic/nesting/`any` pass over ASTs from the repo's own
  TypeScript 5.9 — same method both sides. cloc + jscpd via npx as planned
  (cloc natively recognizes Svelte — no force-lang needed; jscpd v4's report
  shape is `statistics.total`, not the v3 `statistics.clone`).
- The cutover ref carries **no JS tests** — the plan's "old node:test seam"
  was already superseded by 028 A7's vitest *before* the cutover commit; the
  old side's only suite is the Python one (9 files, unchanged count on both
  sides). Recorded as a data correction, not a deviation.
- `index.html` at the ref carries no inline JS (scripts are external), so the
  complexity/duplication corpus is `app.js` only; `index.html` counts toward
  cloc only. New-side corpora (cloc + complexity + jscpd) exclude tests for
  parity; tests reported separately (new: 16 files / 36 describes / 100 cases).

First-run static numbers (results/static.json): old 1 file / 2,093 ln / 184
fns / cyclomatic Σ598 / max fn 34 / max nesting 40 / dup 1.62% / `any` 0; new
32 app files / 2,948 ln / 258 fns / Σ728 / max fn 34 (charts.ts, also the only
`any` carrier — 27, the echarts seam rule holds) / max nesting 23 / dup 2.35%.
