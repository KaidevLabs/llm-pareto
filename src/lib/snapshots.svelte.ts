// The historical-snapshot client store (plan 043, step 02). Step 01 keeps
// every data refresh server-side as an immutable public/data/history/
// <stamp>.json plus the append-only index.json; this module is the client's
// half: the eager index fetch (soft failure — no index, no playback offer;
// the main page is unaffected), an in-memory per-page-load cache of
// snapshot payloads (a revisited frame is free — A3's in-memory layer; the
// HTTP immutable layer is step 03's _headers), and the playback state
// (active/i/playing/fps), deliberately in-memory and NOT in urlstate
// (open branch B1).

import type { Meta, Row } from "./types";
import { data } from "./data.svelte";

// The trimmed per-model speed map a live snapshot carries (update.py's
// speed_map, 043 A6): the median p50 throughput over the model's eligible
// endpoints plus their summed request_count — exactly the values the
// front end's speedOf surfaces from endpoints.json as of that run.
export interface SnapSpeed {
  p50_throughput: number;
  request_count: number;
}

export interface SnapIndexEntry {
  ts: string;
  file: string;
  combined: number;
  unmatched_arena: number;
  unmatched_openrouter: number;
  /** false on backfill snapshots (speed never stored, B2). */
  speed?: boolean;
}

// A snapshot payload as update.py writes it (store_snapshots): the run's
// combined rows, the meta with the logos key stripped (the live meta.json
// keeps it), and the trimmed speed map ({} on backfill).
export interface Snapshot {
  ts: string;
  rows: Row[];
  meta: Omit<Meta, "logos">;
  speed: Record<string, SnapSpeed>;
}

export const snapIndex = $state({
  entries: [] as SnapIndexEntry[],
  loaded: false,
  error: null as string | null,
});

let indexPromise: Promise<SnapIndexEntry[]> | null = null;

// The only history file fetched on page load (043 DoD). Soft failure: a
// missing index (404 — pre-043 deploy or data rollback) is a tolerated
// state, the time viewer just doesn't offer playback; any other failure
// records its reason in `error`. Resolves, never rejects: the main page
// never awaits it (endpoints.svelte.ts precedent).
export function loadSnapIndex(): Promise<SnapIndexEntry[]> {
  if (!indexPromise) {
    indexPromise = fetch("./data/history/index.json")
      .then((r) => {
        if (r.status === 404) return [] as SnapIndexEntry[];
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json() as Promise<SnapIndexEntry[]>;
      })
      .then((entries) => {
        snapIndex.entries = entries;
        return entries;
      })
      .catch((err: unknown) => {
        snapIndex.error = err instanceof Error ? err.message : String(err);
        return [] as SnapIndexEntry[];
      })
      .finally(() => {
        snapIndex.loaded = true;
      });
  }
  return indexPromise;
}

// The in-memory cache (A3's first layer): one Promise per ts per page load —
// a revisited frame is free, a second call never re-fetches. A failed
// Promise is cached too (a frame is not retried mid-session, only next page
// load). Keyed by ts; the filename comes from the index entry.
const cache = new Map<string, Promise<Snapshot>>();

export function loadSnapshot(ts: string): Promise<Snapshot> {
  let p = cache.get(ts);
  if (!p) {
    const file = snapIndex.entries.find((e) => e.ts === ts)?.file;
    if (!file) return Promise.reject(new Error("unknown ts: " + ts));
    p = fetch("./data/history/" + file).then((r) => {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json() as Promise<Snapshot>;
    });
    cache.set(ts, p);
  }
  return p;
}

// The playback state: `i` indexes snapIndex.entries; active=false means
// live data (data.rows) — the default. In-memory on purpose (B1): a shared
// "moment" needs a settled frame shape before it joins urlstate.
export const playback = $state({
  active: false,
  i: -1,
  playing: false,
  fps: 2,
});

// The shown frame (null = live data). $state, not a plain let: frameRows /
// speedAt read it and the chart seam's effects must re-run on a swap.
let current = $state(null as Snapshot | null);

// The single switch the render path reads (step 03 wires charts.ts / gl.ts
// to it; the store only owns state): the shown frame's rows during
// playback, the live data rows otherwise.
export function frameRows(): Row[] {
  return playback.active && current ? current.rows : data.rows;
}

// The shown frame's trimmed speed for a model (step 05 reads this). Null
// when no frame is active, or when the frame's map lacks the model —
// backfill snapshots carry {} (B2); what an empty map means for the Speed
// view is step 05's decision.
export function speedAt(orId: string): SnapSpeed | null {
  return playback.active && current ? current.speed[orId] ?? null : null;
}

// Manual frame selection (the timeline dock, step 03): load the frame
// (cached) and make it current. A failed load rejects before any state is
// touched — the last shown frame (or live data) stays. Does not touch
// `playing`: a running ticker keeps stepping from the new position.
// Monotonic guard (043 step 03 owner A/B "smoother"): a fast scrub issues
// overlapping loads — only the NEWEST selection may land, a slower older
// fetch that resolves after it is dropped (no backwards jump).
let selectSeq = 0;

export async function showFrame(i: number): Promise<void> {
  const e = snapIndex.entries[i];
  if (!e) return;
  const seq = ++selectSeq;
  const snap = await loadSnapshot(e.ts);
  if (seq !== selectSeq) return;
  current = snap;
  playback.i = i;
  playback.active = true;
}

// The pinned 2D domain (043 step 03, the spec's cheap v1): the union of
// the FIRST and LAST snapshot frame's axis fits stands in for the union
// over the full snapshot set — monotone-ish by construction (the roster
// only grows, Elo only climbs, so a mid-history extreme widens a later
// fit rather than breaking the pin). Both frames load into the same
// per-page-load cache — a playback that reaches either end pays nothing
// for the pin. The fit itself is computed at render time by charts.ts
// (the panel's price semantics and the ratio slider apply). Module
// $state: the render path re-runs when the pin lands — but every entry
// path awaits ensurePinned before the first frame swap, so the pin is
// ready by the time time mode renders.
let pinFirst = $state<Snapshot | null>(null);
let pinLast = $state<Snapshot | null>(null);
let pinPromise: Promise<void> | null = null;

export function ensurePinned(): Promise<void> {
  const n = snapIndex.entries.length;
  if (n === 0) return Promise.resolve();
  if (!pinPromise) {
    pinPromise = Promise.all([
      loadSnapshot(snapIndex.entries[0].ts),
      loadSnapshot(snapIndex.entries[n - 1].ts),
    ])
      .then(([first, last]) => {
        pinFirst = first;
        pinLast = last;
      })
      .catch(() => {
        // Soft, like the index: a failed pin falls back to the per-frame
        // fit (no jitter guarantee, no time-mode failure). The retry is
        // the next entry — a failed frame is not retried mid-session
        // (the cache keeps the rejection), but the pin itself is.
        pinPromise = null;
      });
  }
  return pinPromise;
}

// The rows the 2D render path fits its axes over while playback.active
// (043 step 03): null until the pin lands.
export function pinnedRows(): Row[] | null {
  if (!pinFirst || !pinLast) return null;
  return pinFirst === pinLast
    ? pinFirst.rows
    : pinFirst.rows.concat(pinLast.rows);
}

// Time-mode entry at frame i: the nav pill, the play button's live start,
// and the slider all take this path — the pinned domain is loaded before
// the first frame swap, so no frame ever renders on a per-frame fit and
// then jumps to the pinned domain.
export async function enterTime(i: number): Promise<void> {
  await ensurePinned();
  await showFrame(i);
}

// The shown frame's chrome (the header's time-view stamp, the dock
// readout): its ts plus its meta — null when live.
export function frameInfo(): { ts: string; meta: Omit<Meta, "logos"> } | null {
  return playback.active && current
    ? { ts: current.ts, meta: current.meta }
    : null;
}

let timer: ReturnType<typeof setInterval> | null = null;

function stopTicker(): void {
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
}

// Advance one frame: load frame i+1 (already warm if the prefetch landed)
// and swap only if we are still where we left off — a showFrame or a
// pause/exit during the load invalidates the swap. A failed load pauses
// and stays on the last good frame (soft, like the index). Reaching past
// the last frame stops the playback (no loop).
async function tick(): Promise<void> {
  const next = playback.i + 1;
  if (next >= snapIndex.entries.length) {
    pause();
    return;
  }
  const seq = ++selectSeq;
  let snap: Snapshot;
  try {
    snap = await loadSnapshot(snapIndex.entries[next].ts);
  } catch {
    pause();
    return;
  }
  // Same monotonic guard as showFrame: a selection that landed mid-load
  // (a drag) supersedes this tick — and `playing` covers pause/exit.
  if (!playback.playing || seq !== selectSeq) return;
  current = snap;
  playback.i = next;
  playback.active = true;
  prefetch(next + 1);
}

// Prefetch distance 1: warm the frame after the one just shown, so the
// next swap never waits on a cold fetch (the no-stutter contract). The
// load is speculative by design — a failure re-surfaces in the tick's own
// load (the cache keeps the rejection), where it is handled.
function prefetch(i: number): void {
  const e = snapIndex.entries[i];
  if (e) void loadSnapshot(e.ts).catch(() => {});
}

// Start (or restart) playback: from live, or from the last frame, start at
// frame 0; otherwise continue from the current position. The first frame
// is shown before the ticker takes over. The fps is read at start — a
// mid-playback change applies from the next play.
export async function play(): Promise<void> {
  const n = snapIndex.entries.length;
  if (!n || playback.playing) return;
  // A live start renders frames — the pinned domain must be ready first
  // (043 step 03); a resume from a paused frame already has it.
  await ensurePinned();
  if (!playback.active || playback.i >= n - 1) {
    current = null;
    playback.i = -1;
    playback.active = false;
  }
  playback.playing = true;
  await tick();
  if (!playback.playing) return;
  stopTicker();
  timer = setInterval(tick, 500 / playback.fps);
}

export function pause(): void {
  playback.playing = false;
  stopTicker();
}

// Back to live data: stop the ticker and drop the frame — frameRows falls
// back to data.rows. The cache stays: replaying a frame is a fetch-free
// revisit.
export function exit(): void {
  pause();
  playback.active = false;
  playback.i = -1;
  current = null;
}
