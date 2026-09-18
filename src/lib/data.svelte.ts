// The joined data resources: combined.json + meta.json, loaded once per
// page load (same contract as app.js's main()). Loading is a cached promise;
// failures land in `error` and the app shows the update.py hint — the data
// never hard-crashes the page.

import type { Meta, Row } from "./types";
import { buildOrgColors } from "./colors";

export const data = $state({
  rows: [] as Row[],
  meta: null as Meta | null,
  orgColor: {} as Record<string, string>,
  error: null as string | null,
  loaded: false,
});

let promise: Promise<void> | null = null;

// Set true once data + logo badges are ready — the chart seam's first
// render waits for both (live main() awaited buildBadges before render).
export const boot = $state({ ready: false });

export function loadData(): Promise<void> {
  if (!promise) {
    promise = Promise.all([
      fetch("./data/combined.json"),
      fetch("./data/meta.json"),
    ])
      .then(async ([c, m]) => {
        if (!c.ok || !m.ok)
          throw new Error("HTTP " + c.status + "/" + m.status);
        data.rows = (await c.json()) as Row[];
        data.meta = (await m.json()) as Meta;
        data.orgColor = buildOrgColors(data.rows);
        data.loaded = true;
      })
      .catch((err: unknown) => {
        data.error = err instanceof Error ? err.message : String(err);
      });
  }
  return promise;
}

// org -> logo filename in assets/logos/ (plan 007 D3/D8). Comes from
// meta.json (written by update.py from the logos.json registry), so a new
// org's logo needs no change here — the path is derived mechanically.
export function logoFor(org: string): string | null {
  const f = (data.meta && data.meta.logos && data.meta.logos[org]) || null;
  return f ? "assets/logos/" + f : null;
}
