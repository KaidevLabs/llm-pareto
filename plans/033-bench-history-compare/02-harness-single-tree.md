# Step 02 — Harness: one tree per run — OPEN

Settled **A11** (owner pick B, 2026-09-21): a run measures exactly ONE tree —
bare `npm run bench` measures the current tree; a positional `<ref>` measures
that ref in a throwaway worktree. The two-ref mode and the in-run old/new
diff are removed; `/bench/compare.html` (step 03) becomes the only
comparison surface. Every run's JSONs become single-tree shaped, so
published entries are uniform for the compare page.

## Spec

- **`tools/refactor-bench/run.mjs`** — rework:
  - drop the `--single` flag and the refA/refB positional pair: one optional
    positional `<ref>`. Bare = current tree (no worktree); `<ref>` =
    `git worktree add` into `<workDir>/tree` + `fairCopy` (current
    data/assets/fonts → the worktree's `public/`) so the measured tree serves
    the same data snapshot as the live one.
  - one side object, one server port; the old-side plumbing (`ports.old`,
    `oldRoot`, `refA` labels) goes. `worktreeCleanup` only runs for `--ref`.
  - `provenance.json` schema: `{ref, dirty, buildAt, nodeVersion,
    chromiumVersion, runs, runDate}` — `ref` = `gitFacts(measured tree).short`
    (resolved sha for `--ref` runs, HEAD short for bare); `dirty` is only
    ever true for bare runs. `meta.json`: `refs`/`head`/`short`/`dirty`
    collapse to `ref` (the measured tree); drop `single`.
- **`lib/load.mjs`** — drop oldRoot/refA branches; one serve; output
  flattened to `{label, conditions, waterfall}` (+ `live` when `--live`).
- **`lib/interact.mjs`** — same flattening: `{label, config, …metrics}`;
  `SIDE_CFG` keyed `vanilla`/`svelte`, picked by `hasSvelte` (a `--ref` run
  may measure the vanilla tree).
- **`lib/static.mjs`** — unchanged logic (already measures one tree); the
  no-`srcDir` corpus branch (vanilla refs) stays.
- **`lib/coverage.mjs`** — `coverageAnalysis(side)`, single tree; the stray
  `coverage/` cleanup keeps.
- **`lib/report.mjs` / `lib/page.mjs`** — single-tree render: metric + value
  columns; the Δ columns, verdict pill, comparison scorecard items, and the
  031 vanilla→svelte caveats go. Title/headers name the measured tree.
- **`lib/publish.mjs`** — `entryFrom` label = `<ref>` + `" (dirty)"` when
  dirty; old-schema provenance (no `ref` field) is refused with a clear
  message — pre-rework two-ref runs are not publishable (their JSONs carry
  `{old, new}` shapes the registry must not mix).
- **`README.md`** — bench section rewritten for the one-tree CLI.

**Not touched in this step:** `tools/refactor-bench/publish.mjs` (CLI wrapper),
`cyc.mjs`, `serve.mjs`, `build.mjs`, `fair.mjs` logic (comment only), the
compare page (step 03), `Footer.svelte`, app source.

## Seams under test

`tools/refactor-bench/lib/publish.test.ts` keeps its seam — fixtures move to
the new provenance shape; new case: old-schema provenance refused.

`no tests:` run.mjs + the analysis libs — CLI/CDP orchestrators over git
worktrees + chromium (the harness shipped without tests in 029/031 for the
same reason); verified by the live runs below: a bare static-only run, a
`--ref` static-only run (worktree path), and a full bare run whose report is
inspected for the single-tree render.

## Verification

```sh
node --check tools/refactor-bench/run.mjs tools/refactor-bench/lib/load.mjs tools/refactor-bench/lib/interact.mjs tools/refactor-bench/lib/report.mjs tools/refactor-bench/lib/page.mjs tools/refactor-bench/lib/publish.mjs
npx vitest run tools/refactor-bench/lib/publish.test.ts
npm test                                                          # suite stays green
npm run bench -- --only static --out .tmp/smoke-bare              # bare = current tree; prov.ref = HEAD short
npm run bench -- --only static --out .tmp/smoke-ref e858d24       # worktree path; prov.ref = e858d24, dirty false
npm run bench -- --runs 1 --out benchmarks/run-<stamp>            # full bare run
npm run bench:publish -- benchmarks/run-<stamp>                   # fresh single-tree registry seed
npm run bench:publish -- benchmarks/run-20260919-2341             # old schema → refused, exit 1
```

Registry note: the step-01 probe entry (`run-20260919-2341`, two-ref JSON
shapes + old label) is replaced by the fresh run's entry — the registry must
hold a uniform single-tree shape so the compare page (step 03) can diff two
entries without shape branches. The 2341 run dir keeps its two-ref JSONs and
becomes unpublishable by design.
