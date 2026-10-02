# 043 — Historical snapshots & time playback

> **Status:** EXECUTING (step 06/06) — written 2026-10-01 from the 026 exploration
> (plans/026-historical-snapshots.md), grounded in the post-028 Svelte
> codebase. Owner decisions settled 2026-10-01 in-session.

## Goal

The site's data gains a time dimension: every data refresh is kept as a
per-snapshot file, lazily fetched and cached; a timeline dock + play pill
plays the snapshots back on the existing 2D scatter panels and the 3D
showcase — dots move, trails draw, entries/exits flash. Nothing is
downloaded until asked for, and nothing is downloaded twice.

## Settled decisions

| # | Decision | Rationale | Date |
|---|----------|-----------|------|
| A1 | Keep **every** snapshot — no pruning ladder (no 1/d×30, no monthly curation) | Owner: "store and store and store". Snapshots are born immutable; git deltas them cheaply (~4 MB/yr .git growth measured); no policy ever needs re-curation. Days/weeks/months survive only as slider *marks*, not retention | 2026-10-01 |
| A2 | Per-snapshot files `data/history/<stamp>.json` + `index.json`, fetched on demand | Owner: "not download everything in one go, just when asked". Also keeps every file far under CF's 25 MiB asset cap forever | 2026-10-01 |
| A3 | Two cache layers: in-memory `Map` per page load + HTTP `Cache-Control: immutable` via `_headers` (filenames are content-addressed, never rewritten) | Owner: "cache those if we can control that". No localStorage/cookies — 020 invariant stands | 2026-10-01 |
| A4 | Orthogonal controls: timeline dock + play pill, over any surface (2D modes and 3D) — not a "time" mode segment | Owner pick; avoids time × price × 3D mode combinatorics | 2026-10-01 |
| A5 | Full v1 playback: ghost per-frame render + top-25 trails + entry/exit highlights | Owner pick | 2026-10-01 |
| A6 | Snapshot payload: full combined `rows` + meta (logos stripped) + trimmed per-model speed map | Owner pick on speed; speed history becomes playable at ~2–4 KB/snapshot | 2026-10-01 |
| A7 | 3D camera: autoRotate keeps running during playback; drag always wins | Previously "not yet specified" in 026 | 2026-10-01 |
| A8 | **2D movement trails removed** after the step-04 A/B (noise: visible only zoomed, few models); entry pulse + `±N` readout kept; trails live on the 3D showcase only (dot-chains) | Owner A/B verdict 2026-10-02 | 2026-10-02 |

Pending owner decision (step 03 close, 2026-10-02): the frontier
badge↔circle symbol-type flip recreates its element instantly (echarts
has no tween on that path; 0–2 flips per frame boundary, 13+10 at the
newest two). Options: (a) accept, (b) badges in their own series,
(c) circular badges via image-fill. Settles when the owner picks.

## Current state (evidenced, measured 2026-10-01)

- 274 commits since 2026-09-16; ~4 scheduled data refreshes/day; `.git` =
  33 MB loose / **6.76 MiB packed** — git-space is a non-issue (A1).
- Cloudflare static-asset limits: 25 MiB per file, 20,000 files (free) /
  100,000 (paid), no storage cost, no total-size cap — the store never
  approaches them with per-snapshot files (~120 KB each, ≤ 1,500/yr).
- Post-028 architecture: `data.svelte.ts` (combined+meta, cached promise),
  `endpoints.svelte.ts` (lazy fetch, the lazy-load pattern to copy),
  `charts.ts` renderers read `data.rows` directly (lines 720/804/1038),
  `gl.ts` + `render3DPanel` for 3D, `urlstate.ts` owns serialized state.
- `update.py` already has the write-only-on-change precedent
  (`write_endpoints`, `logos.json`) and a canonical `write_json`.
- Speed stats are a 30-min rolling window per run (B14) — a snapshot's
  speed is "as-of that run", exactly what history should be.

## Design (per step)

1. **01 — Store**: `update.py` writes `history/<stamp>.json` +
   append-only `index.json` only when data changed; `--backfill-history`
   rebuilds the store from `git log -- public/data/combined.json`
   (speed absent in backfill, marked as such); D3 gate covers
   `public/data/history/`.
2. **02 — Client store**: `snapshots.svelte.ts` — eager index, lazy
   cached snapshots, playback state (`active/i/playing/fps`), prefetch-1
   ticker, `frameRows()` accessor. Not in urlstate (B1).
3. **03 — Timeline + 2D**: `Timeline.svelte` dock, play pill, frame swap
   through `charts.ts` (filters apply to frames for free), pinned axis
   domain, `_headers` immutable caching.
4. **04 — Trails + entry/exit (2D)**: `trails.ts` — top-25 trails under
   the bubbles, entry pulse + `±N` readout.
5. **05 — 3D playback**: `render3DPanel` on frames; `lines3D` trails with
   as-of speed; autoRotate continues (A7); tour guard.
6. **06 — Close**: full gate, cookie + cache-header probe, DoD audit,
   026 doc pointer.

## Execution order

| Step | File | Depends on | Status | Commit |
|------|------|------------|--------|--------|
| 01 | 01-store.md | — | ✅ COMPLETE | 226ac13 |
| 02 | 02-snapshot-store-client.md | 01 | ✅ COMPLETE | 51083d6 |
| 03 | 03-timeline-2d.md | 02 | ✅ COMPLETE | cdb3c1d |
| 04 | 04-trails-2d.md | 03 | ✅ COMPLETE (trails removed per A8; pulse + readout kept) | 92fb951 |
| 05 | 05-3d-playback.md | 02, 04 | ✅ COMPLETE | 92fb951 |
| 06 | 06-close.md | all | OPEN | — |

## Definition of done

- [x] Every data refresh lands a snapshot; nothing pruned; index grows
      append-only (backfill + live run verified idempotent).
- [ ] Page load fetches `index.json` only; a snapshot is fetched exactly
      once per page load and browser-cached immutable thereafter
      (header-verified).
- [ ] Timeline dock + play pill play 2D and 3D; axes pinned during play;
      filters/search work per-frame.
- [ ] Entry/exit deltas visible on 2D (pulse + `±N` readout; 2D line
      trails removed per A8); dot-chain trails on 3D.
- [ ] Full verification gate green; 020 cookie probe re-run clean.
- [ ] No storage/cookie APIs introduced (grep audit).

## Open branches

- **B1 — deep-linkable playback** (`?t=<ts>` in urlstate): parked. The
  serializer round-trip contract (027 A4/A5) wants a settled frame shape
  first; playback state is in-memory for v1. Revisit when someone wants
  to share a specific moment.
- **B2 — backfilled speed**: backfill snapshots carry `speed: {}` (git
  history lacks the trimmed map). If speed-through-time proves valuable
  on live snapshots alone, a trimmed-endpoints backfill re-derivation
  from `endpoints.json` history is a separate decision — parked, NOT
  planned.
- **B3 — H3 leftovers** (Elo race chart, price-drift, org aggregates,
  A↔B diff panel…): parked in 026 H3, unchanged by this plan.

## Out of scope

- Cross-board history (026: Elo scales incomparable across boards).
- Any backend / runtime third party (020, H1 option 2/3 rejected).
- Pruning/compaction of the snapshot store (A1: everything, forever).
- Speed-mode playback UI beyond the 3D trail fallback (speed panel
  playback is future work once live snapshots accumulate).

## Executor rules

- Standard repo gate per step: `npm test` + `npx tsc --noEmit` (+ python
  suite where update.py is touched); build before closing a
  chart-touching step.
- Commits: `<type>: <message>`; plan commits `plan: 043 — step NN` after
  each code commit. No push during execution.
- Scratch probes in `.tmp/`, never committed.
- 020 rules bind: grep audit before each chart-touching close; no
  storage/cookie APIs.
