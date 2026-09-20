import type { Row } from "./types";
import type { Mode } from "./state.svelte";
import { orgOf, familyOf } from "./family";

// Structural view of the live filter state (state.svelte.ts) — pure modules
// take it as an argument instead of importing the store.
export interface Filters {
  families: { has(key: string): boolean; size: number };
  vision: "all" | "vision";
  thr?: Thr;
  thrCtx?: ThrCtx;
}

// Numeric threshold filters (plan 032 D1/D3). null = unbounded. The price
// bound measures the active view's x-axis price (D2): blended at `ratio`
// for general (and the 3D showcase's x), input price in `in`, output price
// in `out`; in the speed view there is no price axis, so the price bound is
// inactive there.
export interface Thr {
  priceMin: number | null;
  priceMax: number | null;
  eloMin: number | null;
  eloMax: number | null;
  speedMin: number | null;
  speedMax: number | null;
}

// Context the pure predicate needs per render: the mix ratio, the active
// view, and a speed lookup (speedOf is O(endpoints) — callers precompute a
// map once per render). Speed is structurally { toks } so tests don't need
// the full Speed shape.
export interface ThrCtx {
  ratio: number;
  mode: Mode | "3d";
  speed(orId: string): { toks: number } | null;
}

export function viewPrice(d: Row, mode: Mode | "3d", ratio: number): number | null {
  if (mode === "in") return d.price_in_per_m;
  if (mode === "out") return d.price_out_per_m;
  return blendedPrice(d, ratio);
}

export function passThresholds(d: Row, thr: Thr, ctx: ThrCtx): boolean {
  if (thr.priceMin != null || thr.priceMax != null) {
    if (ctx.mode !== "speed") {
      const p = viewPrice(d, ctx.mode, ctx.ratio);
      if (p == null) return false;
      if (thr.priceMin != null && p < thr.priceMin) return false;
      if (thr.priceMax != null && p > thr.priceMax) return false;
    }
  }
  if (thr.eloMin != null && (d.arena_elo == null || d.arena_elo < thr.eloMin))
    return false;
  if (thr.eloMax != null && (d.arena_elo == null || d.arena_elo > thr.eloMax))
    return false;
  if (thr.speedMin != null || thr.speedMax != null) {
    const s = ctx.speed(d.or_id);
    if (!s) return false;
    if (thr.speedMin != null && s.toks < thr.speedMin) return false;
    if (thr.speedMax != null && s.toks > thr.speedMax) return false;
  }
  return true;
}

export function filterRows(rows: Row[], f: Filters): Row[] {
  let out = rows;
  if (f.families.size)
    out = out.filter((d) => f.families.has(orgOf(d) + "|" + familyOf(d)));
  if (f.vision === "vision") out = out.filter((d) => !!d.vision);
  if (f.thr && f.thrCtx) out = out.filter((d) => passThresholds(d, f.thr!, f.thrCtx!));
  return out;
}

// Search match (plan 010 D2): case-insensitive substring over the
// OpenRouter name/id and the arena side — org, model, and the config
// variants collapsed into the point (arena_variants is a list). Stored
// lowercase; an empty query matches everything.
export function searchHit(d: Row, q: string): boolean {
  if (!q) return true;
  return (
    (d.or_name || "").toLowerCase().includes(q) ||
    (d.or_id || "").toLowerCase().includes(q) ||
    (d.arena_org || "").toLowerCase().includes(q) ||
    (d.arena_model || "").toLowerCase().includes(q) ||
    (d.arena_variants || []).join(" ").toLowerCase().includes(q)
  );
}

// Blended $/M for the current input:output mix; falls back to the one
// available price when the other is missing.
export function blendedPrice(d: Row, ratio: number): number | null {
  const pin = d.price_in_per_m;
  const pout = d.price_out_per_m;
  if (pin == null || pout == null) return pin != null ? pin : pout;
  const w = ratio / (ratio + 1);
  return w * pin + (1 - w) * pout;
}
