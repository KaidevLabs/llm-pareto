import type { Row } from "./types";
import { orgOf } from "./family";

export const ORG_COLORS = [
  "#58a6ff", "#3fb950", "#f78166", "#d2a8ff", "#ffa657", "#7ee787",
  "#ff7b72", "#56d4dd", "#db61a2", "#e3b341", "#9ecbff", "#f472b6",
  "#a5b4fc", "#86efac", "#fda4af", "#fcd34d",
];
export const ORG_FALLBACK = "#64748b";
export const FRONTIER = "#34d399";
export const OVERRIDE = "#ffd166";

export function withAlpha(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

export function buildOrgColors(data: Row[]): Record<string, string> {
  const counts: Record<string, number> = {};
  for (const d of data) {
    const o = orgOf(d);
    counts[o] = (counts[o] || 0) + 1;
  }
  const sorted = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
  const map: Record<string, string> = {};
  sorted.forEach((o, i) => {
    map[o] = i < ORG_COLORS.length ? ORG_COLORS[i] : ORG_FALLBACK;
  });
  return map;
}
