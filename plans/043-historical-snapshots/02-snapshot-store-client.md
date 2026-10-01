# Step 02 — Client snapshot store + playback state — OPEN

## Spec

New `src/lib/snapshots.svelte.ts` (reactive store, the
`endpoints.svelte.ts` / `data.svelte.ts` patterns):

- Types: `SnapIndexEntry { ts, file, combined, unmatched_arena,
  unmatched_openrouter, speed? }`, `Snapshot { ts, rows: Row[], meta,
  speed }`.
- `snapIndex = $state({ entries: [] as SnapIndexEntry[], loaded: false,
  error: null })` — `loadSnapIndex()` fetches `./data/history/index.json`
  once (cached promise). Failure is soft: the time viewer just doesn't
  offer playback; the main page is unaffected.
- **In-memory cache**: `const cache = new Map<string,
  Promise<Snapshot>>()` — `loadSnapshot(ts)` fetches
  `./data/history/<file>` exactly once per page load; revisited frames are
  free. (HTTP immutable caching is step 03's `_headers` half; never
  `localStorage`/cookies — 020.)
- **Playback state** (all in-memory, deliberately NOT in urlstate — open
  branch B1): `playback = $state({ active: false, i: -1, playing: false,
  fps: 2 })` where `i` indexes `snapIndex.entries`; `active=false` = live
  data (`data.rows`), the default.
  - `showFrame(i)`: `loadSnapshot(ts)` then set `active`, `i`; charts
    re-render through the existing seam.
  - `play()`/`pause()`: a `setInterval`-driven ticker (0.5 s ÷ fps) that
    advances `i`, lazily fetching the next frame *before* the swap so
    playback doesn't stutter (prefetch distance 1). Stops at the last
    frame (no loop) — restart is one click.
  - `exit()`: `active=false`, `playing=false` — back to live data.
- `frameRows(): Row[]` accessor — `playback.active && frame ? frame.rows
  : data.rows` — the single switch the render path reads (step 03 wires
  `charts.ts`/`gl.ts` to it; the store only owns state).
- `speedAt(or_id)` for the current frame (step 05's speed playback reads
  this; empty map = speed mode keeps live data or shows nothing — decided
  in step 05).

**Not touched in this step**: `data.svelte.ts`, `urlstate.ts`, any
component, any chart code.

## Verification

- `npx vitest run src/lib/snapshots.test.ts` — new suite: index load +
  soft failure; cache hit never refetches (fetch mock call count = 1);
  play ticker advances and prefetches frame i+1 before the swap; stop at
  last frame; exit returns to live.
- `npm test` green; `npx tsc --noEmit` clean.

## Seams under test

`src/lib/snapshots.test.ts` (vitest + mocked `fetch`): the store's public
API (`loadSnapIndex`, `loadSnapshot`, `showFrame`, `play`/`pause`,
`exit`, `frameRows`) — one describe per function, one behavior per test.
