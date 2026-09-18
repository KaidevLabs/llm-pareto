// Fit-to-data axis bounds (plan 018 A1): computed at render time from ALL
// joined data — never hardcoded, never from the filtered set (A2) — padded
// and snapped so edge bubbles stay unclipped and tick labels stay inside.

export function fitLinear(vals: number[]): { min: number; max: number } | null {
  let lo = Infinity, hi = -Infinity;
  for (const v of vals) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  if (lo === Infinity) return null;
  const pad = (hi - lo) * 0.05;
  return {
    min: Math.floor((lo - pad) / 25) * 25,
    max: Math.ceil((hi + pad) / 25) * 25,
  };
}

export function fitLog(vals: number[]): { min: number; max: number } | null {
  const pos = vals.filter((v) => v > 0);
  if (!pos.length) return null;
  let lo = Infinity, hi = -Infinity;
  for (const v of pos) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const pad = Math.log10(hi / lo) * 0.1;
  return {
    min: Math.pow(10, Math.log10(lo) - pad),
    max: Math.pow(10, Math.log10(hi) + pad),
  };
}

// log-axis fit bounds snapped to whole decades (the tick labels then read
// as $1 / $10 / $100 — 018 A1's fit-to-ALL-data rule, log flavor; values
// are already log10-transformed)
export function fitDecade(vals: number[]): { min: number; max: number } | null {
  let lo = Infinity, hi = -Infinity;
  for (const v of vals) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  if (lo === Infinity) return null;
  const pad = (hi - lo) * 0.06;
  return { min: Math.floor(lo - pad), max: Math.ceil(hi + pad) };
}

// Pareto frontier: no other point has both lower price and higher elo.
// points are [price, elo]; the frontier trades lower price for lower elo.
// highX flips the x semantics for axes where the higher value wins (the
// speed view, 023 D3): dominated iff another point is strictly faster AND
// strictly higher-elo. Either way the line sorts monotonic along x.
export function paretoFrontier<T extends { value: number[] }>(
  pts: T[],
  highX = false
): T[] {
  const out: T[] = [];
  for (const p of pts) {
    let dominated = false;
    for (const q of pts) {
      if (q === p) continue;
      if (
        (highX ? q.value[0] >= p.value[0] : q.value[0] <= p.value[0]) &&
        q.value[1] >= p.value[1] &&
        (q.value[0] !== p.value[0] || q.value[1] > p.value[1])
      ) {
        dominated = true;
        break;
      }
    }
    if (!dominated) out.push(p);
  }
  out.sort((a, b) =>
    highX ? b.value[0] - a.value[0] : a.value[0] - b.value[0]
  );
  return out;
}

// 3-objective frontier for the 3D showcase (023 D8): a point is dominated
// iff another is strictly better on at least one of price (lower), speed
// (higher), Elo (higher) and worse on none. The value array is
// [log10 price, log10 speed, elo] — log is monotone, so dominance is
// identical on the transformed values. Unlike the 2-D chain this set is a
// surface, so it renders as glowing spheres, not a line.
export function paretoFrontier3D<T extends { value: number[] }>(pts: T[]): T[] {
  const out: T[] = [];
  for (const p of pts) {
    let dominated = false;
    for (const q of pts) {
      if (q === p) continue;
      if (
        q.value[0] <= p.value[0] &&
        q.value[1] >= p.value[1] &&
        q.value[2] >= p.value[2] &&
        (q.value[0] < p.value[0] ||
          q.value[1] > p.value[1] ||
          q.value[2] > p.value[2])
      ) {
        dominated = true;
        break;
      }
    }
    if (!dominated) out.push(p);
  }
  // Elo order — stable, reads top-down (D8)
  out.sort((a, b) => a.value[2] - b.value[2]);
  return out;
}
