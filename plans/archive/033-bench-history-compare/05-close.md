# Step 05 — Close — ✅ COMPLETE (2026-09-22, no code changes)

## Spec

No code changes (verification + docs audit only).

- Full verification hierarchy: `python3 -m unittest discover -s tests -v` +
  `npm test` + `npx tsc --noEmit` green → `npm run build` clean →
  `python3 update.py` passing (sane match report) → reviewed `public/data`
  diff untouched by this plan.
- 020 cookie probe over `/` **and** `/bench/compare.html` + its fetched JSONs
  (desktop + curl + mobile UAs, cookie-jar curl — recipe in
  `plans/archive/020-cookie-exploration.md`).
- README audit: the bench section documents run / coverage / cyc / publish /
  compare, matching shipped reality.
- Definition-of-done audit in `00-overview.md`.

## Closing procedure

1. Update plan files: this step's as-built + title, every execution-order
   row, the DoD.
2. Overview status → `ARCHIVED (date)` with the commit history.
3. Move `plans/033-bench-history-compare/` → `plans/archive/`, stage, commit
   — message suffixed `(plan: 033-bench-history-compare)`.
4. No push (Push policy) — the publish/compare/footer deploy rides the
   owner's next deliberate push to `main`.

## As-built

Verification-only close; no code changes. All gates ran on the merged HEAD
`a86921a` (owner-directed pull mid-close, below).

- Python suite 159 tests OK; `npm test` 162/162 (19 files);
  `npx tsc --noEmit` clean; `npm run build` clean — bundle hashes unchanged
  (`index-h4T--1LN.js` / `index-DxCke74S.css`).
- `python3 update.py` exit 0 — arena 402 entries, OpenRouter 364, join 153
  matched (exact 161 / override 1 / prefix-variant 10 / prefix-base 30 /
  fuzzy 6), 194 unmatched, config variants 40 groups collapsed; **top-20
  20/20**, overall 44.1 % (153/347); provider layer 153 models / 793
  endpoints (748 with stats); logos 23/23. Full log:
  `.tmp/update-033-close.log`. The run's data output was then restored so
  the close leaves the tree clean (the bot refreshes on its own schedule).
- `public/data` untouched by the plan: `git log 4d908ab..f2fc89d --
  public/data` is empty; the only `public/data` change in the range is the
  routine refresh commit below, reviewed as plain live-source drift
  (pricing / context / Elo / throughput), no schema change.
- 020 cookie probe (`.tmp/probe_033_close_cookies.zsh`): 3 UAs (desktop
  Chrome, curl, mobile Safari) × 47 URLs = 141 requests over `/` + every
  asset the HTML references or fetches (bundle, CSS, vendored echarts +
  echarts-gl, font, favicon, `data/combined.json`, `data/meta.json`, 23
  logos) and `/bench/compare.html` + module + `index.json` + both entries'
  5 JSONs + `report.html`: all 200, zero `Set-Cookie`, cookie jars empty →
  **COOKIELESS PASS**.
- README audit: the bench section (`coverage` / `cyc` / `bench` /
  `bench:publish` / compare URL) matches shipped code — one-tree semantics,
  7-run default, phases + `--only`/`--force`, worktree path + cleanup,
  publish validation (static+provenance, duplicate id, pre-rework
  refusal), compare last-two default + `?a=&b=` — no README edits needed.
- Owner-directed mid-close pull: committed the staged 21:09Z data refresh
  (`96dbcdd`), merged `origin/main` (6 bot data commits; `a86921a`), and
  resolved the data files to ours — 4 conflicted files + `arena.json`
  (auto-merged, normalized to ours for coherence) — because the local
  refresh is fresher than origin's newest bot snapshot (21:09Z vs 18:33Z)
  and is one coherent validated run. Local `main` sits ahead of
  `origin/main` (plan work + data + merge + this close); no push
  (Push policy).
- DoD: all items checked in `00-overview.md`. Plan archived to
  `plans/archive/033-bench-history-compare/` in the closing commit.

Out-of-scope finding (flagged, deliberately untouched): the README
"Layout" section and manual-deploy paragraph still describe the pre-028
`public/` + `app.js` reality — stale since the vite cutover, not part of
this plan's bench-section audit.
