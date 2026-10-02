// Movement encoding for time playback (plan 043, steps 04/05): the
// per-frame entry/exit diff (frameDiff, step 04) and the trail computation
// over the cached snapshot frames (computeTrails) that feeds the 3D
// showcase's dot-chain trails (step 05). Pure over the snapshots store —
// the chart seam (charts.ts) owns all ECharts option building; the
// Timeline dock owns the readout chrome.
//
// The 2D `lines` trails existed in step 04 as first shipped and were
// removed after the owner's 2026-10-02 A/B (visible only when zoomed, a
// few models, pure noise — plan amendment); frameDiff's consumers (the
// frame-swap pulse, the Timeline readout's ±N) remain. The chart seam
// records the verdict in its entry-pulse comment.
//
// Cache contract (the spec's no-blocking rule): trails are computed from
// already-cached snapshots only — a not-yet-fetched (or failed) frame
// contributes nothing and the trail reads through the gap; the step-02
// prefetch fills the cache as playback advances.

import type { Row } from "./types";
import type { Snapshot } from "./snapshots.svelte";
import { cachedSnapshot, frameRows, snapIndex } from "./snapshots.svelte";

export interface Trail {
  orId: string;
  /** The model's rows in frame order, one per cached frame where it is
   *  present — the first is its entry frame (mid-play entries start there). */
  rows: Row[];
  /** Parallel to rows: the frame's own snapshot speed (p50 throughput) —
   *  null where the frame carries no speed for the model (a backfill
   *  snapshot's empty map, B2). The RENDER falls back to the live speed
   *  map for those: "as-of each run" semantics (B14: never averaged). */
  speeds: (number | null)[];
}

// frameDiff (step 04): entered/exited between two frames by or_id. The
// chart seam pulses the entered points; the Timeline readout counts both.
export function frameDiff(
  prev: Row[],
  cur: Row[]
): { entered: Row[]; exited: Row[] } {
  const prevIds = new Set(prev.map((r) => r.or_id));
  const curIds = new Set(cur.map((r) => r.or_id));
  return {
    entered: cur.filter((r) => !prevIds.has(r.or_id)),
    exited: prev.filter((r) => !curIds.has(r.or_id)),
  };
}

// Trails up to (and including) frame `uptoIndex`: for each model present in
// ≥2 of the cached frames 0..uptoIndex, its ordered per-frame rows. The cap
// is top-N by arena_votes of the CURRENT frame (fallback: arena rank, null
// votes last); `keep` (the frontier + the comparator picks, resolved by the
// caller) trails regardless of N. Selected ids whose trail would be a
// single point (present only in the shown frame) yield nothing — a trail
// needs somewhere to have come from.
export function computeTrails(
  uptoIndex: number,
  topN: number,
  keep?: Set<string>
): Trail[] {
  const frames: Snapshot[] = [];
  for (let i = 0; i <= uptoIndex && i < snapIndex.entries.length; i++) {
    const s = cachedSnapshot(snapIndex.entries[i].ts);
    if (s) frames.push(s);
  }
  // Presence index: each model's rows across the cached frames, in order —
  // with each frame's own speed for the model (the 3-tuple trails' speed
  // coordinate, 043 step 05).
  const byId = new Map<string, Row[]>();
  const speedById = new Map<string, (number | null)[]>();
  for (const f of frames) {
    for (const r of f.rows) {
      const rows = byId.get(r.or_id);
      const speeds = speedById.get(r.or_id);
      if (rows && speeds) {
        rows.push(r);
        speeds.push(f.speed[r.or_id]?.p50_throughput ?? null);
      } else {
        byId.set(r.or_id, [r]);
        speedById.set(r.or_id, [f.speed[r.or_id]?.p50_throughput ?? null]);
      }
    }
  }
  // The cap ranks the CURRENT frame's rows: more votes first, a null-votes
  // row behind every voted one (fallback arena rank asc among the nulls).
  const cap = (a: Row, b: Row): number => {
    const va = a.arena_votes;
    const vb = b.arena_votes;
    if (va != null && vb != null && va !== vb) return vb - va;
    if ((va != null) !== (vb != null)) return va != null ? -1 : 1;
    return (a.arena_rank ?? Infinity) - (b.arena_rank ?? Infinity);
  };
  const chosen = new Set<string>(keep || []);
  for (const r of [...frameRows()].sort(cap).slice(0, topN))
    chosen.add(r.or_id);
  const out: Trail[] = [];
  for (const orId of chosen) {
    const rows = byId.get(orId);
    if (rows && rows.length >= 2)
      out.push({ orId, rows, speeds: speedById.get(orId)! });
  }
  return out.sort((a, b) => (a.orId < b.orId ? -1 : 1));
}
