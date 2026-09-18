import type { Row } from "./types";
import { orgOf, familyOf } from "./family";

// Structural view of the live filter state (state.svelte.ts) — pure modules
// take it as an argument instead of importing the store.
export interface Filters {
  families: { has(key: string): boolean; size: number };
  vision: "all" | "vision";
}

export function filterRows(rows: Row[], f: Filters): Row[] {
  let out = rows;
  if (f.families.size)
    out = out.filter((d) => f.families.has(orgOf(d) + "|" + familyOf(d)));
  if (f.vision === "vision") out = out.filter((d) => !!d.vision);
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
