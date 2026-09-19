// Comparator marks (plan 025 D2/D3, owner-amended 2026-09-19: N-way —
// one tag input, up to 4 models; the win/lose/tie colors land on the
// model cards' own attribute rows instead of a separate verdict table).
// Pure: rows + per-row Speeds in, per-model marks out; the component
// supplies the Speeds from the shared endpoints store.
//
// Winner logic (D3): price in/out → lower wins; elo/speed/context/votes →
// higher wins; elo ties on CI overlap (chained through the elo-descending
// order); vision marks the capable side only when the set differs. A
// strict leader is "win", a shared top is "tie", everything else "lose".

import type { Row } from "./types";
import type { Speed } from "./speed";

export const CMP_MAX = 4;

export type Mark = "win" | "lose" | "tie";
export type MetricKey =
  | "price_in"
  | "price_out"
  | "elo"
  | "votes"
  | "context"
  | "speed"
  | "vision";

export type Marks = Partial<Record<MetricKey, Mark>>;

const EPS = 1e-9;

// The picks as displayed: non-empty as-is (capped), else the D5 pre-seed —
// top-2 by arena rank.
export function resolvedCmps(cmps: string[], rows: Row[]): string[] {
  if (cmps.length) return cmps.slice(0, CMP_MAX);
  return [...rows]
    .sort((a, b) => a.arena_rank - b.arena_rank)
    .slice(0, 2)
    .map((r) => r.or_id);
}

interface NumItem {
  id: string;
  v: number;
}

function numItems(rows: Row[], get: (r: Row) => number | null): NumItem[] {
  return rows
    .map((r) => ({ id: r.or_id, v: get(r) }))
    .filter((x): x is NumItem => x.v != null);
}

// One metric's marks: the top group ties when shared, wins when strict;
// the rest lose.
function assign(
  out: Record<string, Marks>,
  key: MetricKey,
  items: NumItem[],
  lowerBetter: boolean
): void {
  if (items.length < 2) return;
  const sorted = [...items].sort((a, b) => (lowerBetter ? a.v - b.v : b.v - a.v));
  const best = sorted[0].v;
  const leaders = sorted.filter((x) => Math.abs(x.v - best) < EPS);
  const top: Mark = leaders.length > 1 ? "tie" : "win";
  for (const x of leaders) (out[x.id] ??= {})[key] = top;
  for (const x of sorted.slice(leaders.length)) (out[x.id] ??= {})[key] = "lose";
}

// Chunk a list into bands of at most `size` (the responsive slot rows:
// 4-up desktop / 2-up tablet / 1-up mobile — one rail labels each band).
export function band<T>(xs: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += size) out.push(xs.slice(i, i + size));
  return out;
}

export function buildMarks(rows: Row[], speeds: (Speed | null)[]): Record<string, Marks> {
  const out: Record<string, Marks> = {};
  if (rows.length < 2) return out;

  assign(out, "price_in", numItems(rows, (r) => r.price_in_per_m), true);
  assign(out, "price_out", numItems(rows, (r) => r.price_out_per_m), true);
  assign(out, "context", numItems(rows, (r) => r.context_length), false);
  assign(out, "votes", numItems(rows, (r) => r.arena_votes), false);
  assign(
    out,
    "speed",
    rows
      .map((r, i) => ({ id: r.or_id, v: speeds[i]?.toks ?? null }))
      .filter((x): x is NumItem => x.v != null),
    false
  );

  // elo: the CI-overlap chain over the elo-descending order — adjacent
  // intervals that overlap share a cluster; the top cluster ties, the
  // rest lose. Null bounds fall back to the elo point.
  const eloItems = rows
    .map((r) => ({ r, elo: r.arena_elo }))
    .filter((x): x is { r: Row; elo: number } => x.elo != null)
    .sort((a, b) => b.elo - a.elo);
  const lo = (x: { r: Row; elo: number }) => x.r.arena_elo_lower ?? x.elo;
  const up = (x: { r: Row; elo: number }) => x.r.arena_elo_upper ?? x.elo;
  const overlaps = (a: { r: Row; elo: number }, b: { r: Row; elo: number }) =>
    lo(a) <= up(b) && lo(b) <= up(a);
  let cluster: { r: Row; elo: number }[] = [];
  let topCluster = true;
  const flush = () => {
    // Only the first (highest-elo) cluster can win; a singleton there is
    // a strict win, a shared one a tie — every later cluster lost.
    const top: Mark = topCluster ? (cluster.length > 1 ? "tie" : "win") : "lose";
    for (const x of cluster) (out[x.r.or_id] ??= {}).elo = top;
    topCluster = false;
    cluster = [];
  };
  for (const x of eloItems) {
    if (cluster.length && !overlaps(cluster[cluster.length - 1], x)) flush();
    cluster.push(x);
  }
  flush();

  if (rows.some((r) => r.vision) && rows.some((r) => !r.vision)) {
    for (const r of rows) if (r.vision) (out[r.or_id] ??= {}).vision = "win";
  }

  return out;
}
