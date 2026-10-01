# Step 01 — Snapshot store in update.py + git backfill — OPEN

## Spec

`update.py` gains a history materializer, run at the end of `main()` after
all artifacts are written.

**New module-level pieces** (near `write_endpoints`):

- `HISTORY_DIR = OUT_DIR / "history"`.
- `def snapshot_stamp(fetched_at: str) -> str` — `2026-09-29T06:45:04Z` →
  `20260929T064504Z` (filename-safe, sortable).
- `def speed_map(provider_layer) -> dict` — per `or_id`:
  `{p50_throughput, request_count}` from the joined p50 stats (the same
  values `endpoints.svelte.ts` surfaces; models without stats omitted).
  Bounded ~2–4 KB.
- `def write_history(combined, meta, provider_layer) -> None`:
  - Reads `public/data/history/index.json` if present.
  - If the index's newest `ts` equals this run's `meta.fetched_at`, the
    run's data is already stored → rewrite nothing, print
    `history unchanged` (the logos.json write-only-on-change pattern).
  - Else: writes `history/<stamp>.json`:
    `{ts, rows: combined, meta: meta-minus-logos, speed: speed_map}` —
    `meta` with the `logos` key stripped (the live `meta.json` already
    carries it; per-snapshot it is dead weight). Full `rows` as-is: render
    parity with the live combined.json beats shaving bytes on an
    on-demand-fetched file.
  - Appends to the index and rewrites `index.json`:
    `[{ts, file, combined, unmatched_arena, unmatched_openrouter}]` (ts
    ascending). Index entries are append-only, never pruned — the store
    keeps everything (settled).
  - mkdir the history dir on first write.

**Backfill** — `--backfill-history` flag (argparse; today `main()` has no
flag parsing, add the minimal `sys.argv` check or argparse):

- `git log --format=%H -- public/data/combined.json` → for each sha
  (oldest→newest): `git show <sha>:public/data/combined.json` and
  `:public/data/meta.json`, parse, take `fetched_at` from that commit's
  meta, derive the speed map the best it can — **speed is absent in git
  history** (`endpoints.json` history is full 2.2 MB payloads; do NOT
  backfill from it): backfilled snapshots carry `speed: {}` and the index
  marks `speed: false`.
- Dedup by `ts` against the existing index (a re-run heals/rebuilds; a
  snapshot already indexed by ts is kept, not duplicated).
- Applies the same write path as the live run. Re-runnable at any time =
  the self-heal property.

**D3 gate**: extend the auto-update changed-gate to `public/data/history/`
— a history-only diff means new data arrived, so commit it. Find the gate
in the 013-era commit script (`.github/workflows` or the cron script) and
add the path.

**Not touched in this step**: everything in `src/`; `endpoints.json`
format; the live artifact formats.

## Verification

- `python3 -m unittest tests.test_history -v` (new module, below).
- `python3 -m unittest discover -s tests -v` green.
- `python3 update.py --backfill-history` on the repo: prints the derived
  count; `public/data/history/index.json` exists with one entry per data
  commit (deduped by ts); spot-check the oldest snapshot matches
  `git show 18c68c5:public/data/combined.json` row count.
- Re-run backfill: zero new writes (idempotent).
- `python3 update.py` (live): with unchanged data → `history unchanged`;
  snapshot exists for the current ts; index ascending, no dupes.

## Seams under test

`tests/test_history.py` (stdlib unittest, zero-dep): pure-logic units —
`snapshot_stamp` formatting; `speed_map` extraction (models with/without
stats); index append + ts-dedup on a tmpdir fixture; backfill parsing from
a fake `git show`-shaped input (inject the extraction seam, don't shell
out in tests). One describe-class per function, one behavior per test,
values pinned from actual output.
