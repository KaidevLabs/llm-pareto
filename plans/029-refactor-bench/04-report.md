# Step 04 — Aggregation + report + full cutover run — OPEN

## Spec

- `lib/report.mjs` — merge `results/*.json` → markdown report:
  - header: provenance (refs, HEAD sha, dirty flag, build stamp, node/chromium
    versions, run date);
  - one table per dimension with old / new / delta columns, medians + p90
    where applicable;
  - shared-asset split so the app-only delta is visible;
  - caveats section (architecture-level comparison; feature delta: tour,
    deep-links, comparator; chromium-only memory API; local-vs-CF compression
    note resolved by A5 but `--live` numbers quoted when present).
- Full cutover run: `node .tmp/refactor-bench/run.mjs` (no args, default N).
- Deliverables: `.tmp/refactor-bench/report.md` + raw JSONs in
  `results/`.

## Not touched in this step

Modules 1–3 (only consumed); no repo files.

## Verification

- Default no-arg run completes end to end, exit 0.
- `report.md` contains all four dimension tables with populated delta columns
  and the caveats section.
- Spot-check three numbers in the report against the raw JSONs.

## Seams under test

- no tests: report is generated markdown from measured JSONs; verified by the
  spot-check above.

## As-built

(to be written at close)
