// URL state serializer (plan 027 step 1, executed in-framework per 028 A7).
// Pure module: read(location.search) -> a partial-state patch; write(state)
// -> a query string. Defaults are omitted so the bare URL stays canonical;
// unknown values degrade to defaults (ignored). `selected` (the drawer) is
// deliberately NOT serialized — transient UI, not a shareable view (027
// out-of-scope). Cookieless: URL params are the only state surface here.

import type { Mode } from "./state.svelte";
import type { Thr } from "./filters";

export type View = Mode | "3d";

const VIEWS: View[] = ["general", "in", "out", "speed", "3d"];
const VISIONS = ["all", "vision"];

const NO_THR: Thr = { priceMin: null, priceMax: null, eloMin: null, speedMin: null };

const DEFAULTS = {
  mode: "general" as Mode,
  vision: "all",
  ratio: 3,
  spread: false,
  frontier: true,
  three3d: false,
};

export type Query = Record<string, string>;

export function parseQuery(search: string): Query {
  const q: Query = {};
  for (const [k, v] of new URLSearchParams(search)) q[k] = v;
  return q;
}

// Read the URL into a partial ui patch — only keys that differ from the
// defaults come back; unknown values are dropped. `fam` entries that don't
// look like "org|family" leaves are ignored wholesale.
export function read(search: string): {
  mode?: Mode;
  three3d?: boolean;
  vision?: "all" | "vision";
  ratio?: number;
  spread?: boolean;
  frontier?: boolean;
  search?: string;
  families?: string[];
  thr?: Thr;
} {
  const q = parseQuery(search);
  const out: ReturnType<typeof read> = {};
  if (q.view && VIEWS.includes(q.view as View)) {
    if (q.view === "3d") out.three3d = true;
    else out.mode = q.view as Mode;
  }
  if (q.vis && VISIONS.includes(q.vis)) out.vision = q.vis as "all" | "vision";
  if (q.q) out.search = q.q;
  if (q.ratio) {
    const r = Number(q.ratio);
    if (Number.isFinite(r) && r >= 0 && r <= 10) out.ratio = r;
  }
  if (q.spread === "1") out.spread = true;
  if (q.frontier === "0") out.frontier = false;
  if (q.fam) {
    const fams = q.fam
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.includes("|"));
    if (fams.length) out.families = fams;
  }
  // Thresholds (032 step 1): each bound is independent; a bound absent or
  // unreadable from the URL falls to null (unbounded). A patch with no
  // valid bound at all is not emitted — the key stays off the bare URL.
  const bounds: [keyof Thr, string | undefined][] = [
    ["priceMin", q.pmin],
    ["priceMax", q.pmax],
    ["eloMin", q.emin],
    ["speedMin", q.smin],
  ];
  let thr: Thr | null = null;
  for (const [key, raw] of bounds) {
    let v: number | null = null;
    if (raw !== undefined) {
      const n = Number(raw);
      if (Number.isFinite(n) && n >= 0) v = n;
    }
    if (v !== null) (thr ??= { ...NO_THR })[key] = v;
  }
  if (thr) out.thr = thr;
  return out;
}

// Write the state to a query string — defaults omitted, no leading "?".
// Continuous fields are rounded (ratio to 1dp) so slider noise never
// churns the URL.
export function write(s: {
  mode: Mode;
  three3d: boolean;
  vision: "all" | "vision";
  ratio: number;
  spread: boolean;
  frontier: boolean;
  search: string;
  families: Iterable<string>;
  thr?: Thr;
}): string {
  const p = new URLSearchParams();
  const view: View = s.three3d ? "3d" : s.mode;
  if (view !== DEFAULTS.mode) p.set("view", view);
  if (s.vision !== DEFAULTS.vision) p.set("vis", s.vision);
  if (s.search) p.set("q", s.search);
  if (s.ratio !== DEFAULTS.ratio) p.set("ratio", String(Math.round(s.ratio * 10) / 10));
  if (s.spread) p.set("spread", "1");
  if (!s.frontier) p.set("frontier", "0");
  const fams = [...s.families];
  if (fams.length) p.set("fam", fams.join(","));
  // Threshold bounds (032 step 1): null = default (unbounded) — omitted.
  // Values round to 2dp so slider noise never churns the URL.
  const r2 = (v: number) => String(Math.round(v * 100) / 100);
  const thr = s.thr ?? NO_THR;
  if (thr.priceMin != null) p.set("pmin", r2(thr.priceMin));
  if (thr.priceMax != null) p.set("pmax", r2(thr.priceMax));
  if (thr.eloMin != null) p.set("emin", r2(thr.eloMin));
  if (thr.speedMin != null) p.set("smin", r2(thr.speedMin));
  return p.toString();
}
