export function fmtPrice(v: number | null | undefined): string {
  if (v == null) return "—";
  if (v === 0) return "$0";
  if (v < 0.01) return "$" + v.toFixed(4);
  if (v < 1) return "$" + v.toFixed(3);
  if (v < 10) return "$" + v.toFixed(2);
  return "$" + Math.round(v);
}

export function fmtVotes(v: number | null | undefined): string {
  if (v == null) return "—";
  if (v >= 1000) return Math.round(v / 1000) + "k";
  return String(v);
}

// tok/s axis + tooltip formatting (023 D6): integers from 10 up, one
// decimal below.
export function fmtToks(v: number | null | undefined): string {
  if (v == null) return "—";
  return String(v >= 10 ? Math.round(v) : Math.round(v * 10) / 10);
}

// latency for the 024 D9 summary block: ms → "489ms" / "3.1s". No TTFT
// claim — 023 D6 labels what is certain and keeps the metric question open.
export function fmtMs(v: number | null | undefined): string {
  if (v == null) return "—";
  return v < 1000
    ? Math.round(v) + "ms"
    : (v / 1000).toFixed(1).replace(/\.0$/, "") + "s";
}

// HTML escaping for string-HTML contexts (echarts tooltips/labels). Svelte
// template interpolation escapes on its own — this is only for markup built
// as strings.
export function esc(s: unknown): string {
  const MAP: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
  return String(s).replace(/[&<>"]/g, (c) => MAP[c]);
}

// History timestamps (043 step 03): the ISO-UTC instants the snapshot
// store writes → the dock readout, the header's time-view stamp, and the
// sparse tick labels. UTC getters throughout — the instants are UTC and
// local-timezone drift would shift the tick labels.
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const p2 = (n: number) => String(n).padStart(2, "0");
function utcOf(ts: string): Date | null {
  const d = new Date(ts);
  return isNaN(d.getTime()) ? null : d;
}

// The frame readout + the header stamp: "2026-09-16 01:13 UTC".
export function fmtStamp(ts: string): string {
  const d = utcOf(ts);
  if (!d) return ts;
  return (
    d.getUTCFullYear() + "-" + p2(d.getUTCMonth() + 1) + "-" + p2(d.getUTCDate()) +
    " " + p2(d.getUTCHours()) + ":" + p2(d.getUTCMinutes()) + " UTC"
  );
}

// Sparse timeline ticks (043 step 03): first/last frames carry day+time
// ("Sep 16 01:13"); month-boundary marks carry the month ("Oct"). The full
// ts list lives in the index — the dock stays legible at any history length.
export function tsDay(ts: string): string {
  const d = utcOf(ts);
  if (!d) return ts;
  return (
    MONTHS[d.getUTCMonth()] + " " + d.getUTCDate() +
    " " + p2(d.getUTCHours()) + ":" + p2(d.getUTCMinutes())
  );
}

export function tsMonth(ts: string): string {
  const d = utcOf(ts);
  return d ? MONTHS[d.getUTCMonth()] : "";
}

export function median(xs: (number | null | undefined)[]): number | null {
  const v = xs
    .filter((x): x is number => x != null && isFinite(x))
    .sort((a, b) => a - b);
  if (!v.length) return null;
  const m = v.length >> 1;
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}
