// History wiring for the URL state (027 A5, in-framework): the address bar
// is always live and history gets ONE entry per settled change — discrete
// toggles (mode/3D/vision/families/spread/frontier) push immediately;
// continuous inputs (search typing, ratio slider) start a burst whose
// first change pushes and whose subsequent changes replace that entry
// (a trailing debounce closes it). popstate applies the URL symmetrically
// (guard: the apply never re-writes history; a pending burst is dropped).
// Read-once seeding happens in seedFromURL() before the first render.

import { ui, type Mode } from "./state.svelte";
import { read, write } from "./urlstate";

let initialized = false;
let burst: ReturnType<typeof setTimeout> | null = null;
let applying = false;
let lastCont = "";

function contSnap(): string {
  return JSON.stringify([ui.search, ui.ratio, ui.thr]);
}

function discSnap(): string {
  return JSON.stringify([
    ui.mode, ui.three3d, ui.vision, ui.spread, ui.frontier, [...ui.families],
  ]);
}

// Seed ui from location.search once, before the first render. Unknown
// values degrade to defaults (read drops them).
export function seedFromURL() {
  if (initialized) return;
  initialized = true;
  const patch = read(location.search);
  if (patch.mode) ui.mode = patch.mode;
  if (patch.three3d !== undefined) ui.three3d = patch.three3d;
  if (patch.vision) ui.vision = patch.vision;
  if (patch.ratio !== undefined) ui.ratio = patch.ratio;
  if (patch.spread !== undefined) ui.spread = patch.spread;
  if (patch.frontier !== undefined) ui.frontier = patch.frontier;
  if (patch.search !== undefined) ui.search = patch.search;
  if (patch.families) for (const f of patch.families) ui.families.add(f);
  if (patch.thr) ui.thr = patch.thr;
  lastCont = contSnap();
  history.replaceState(null, "", location.pathname + location.search);
}

function replace(): void {
  history.replaceState(null, "", location.pathname + "?" + write(ui));
}

function push(): void {
  history.pushState(null, "", location.pathname + "?" + write(ui));
}

// Called from App's reactive effect on every ui change. One history entry
// per settled change: burst-open pushes, burst-continuation replaces.
export function notifyChanged(): void {
  if (!initialized || applying) return;
  const cont = contSnap() !== lastCont;
  lastCont = contSnap();
  // No-op when the bar already carries exactly this state (the boot effect
  // run right after seeding; the effect firing after a popstate apply).
  const q = write(ui);
  if (location.search === (q ? "?" + q : "")) return;
  if (burst) {
    // mid-burst: a continuous change absorbs into the open entry (the
    // debounce restarts — long bursts still land as one entry); a discrete
    // toggle settles its own entry instead
    if (cont) {
      replace();
      clearTimeout(burst);
      burst = setTimeout(() => (burst = null), 600);
      return;
    }
    clearTimeout(burst);
    burst = null;
  }
  push();
  // continuous inputs open a burst window; discrete toggles don't need one
  if (cont) burst = setTimeout(() => (burst = null), 600);
}

// Back/forward: apply the URL symmetrically. The guard flag keeps the
// apply from re-writing history, and a pending burst is discarded so a
// stale continuous push can't land on top of the restored entry.
export function applyFromURL(): void {
  if (!initialized) return;
  applying = true;
  if (burst) {
    clearTimeout(burst);
    burst = null;
  }
  try {
    const patch = read(location.search);
    ui.mode = (patch.mode ?? "general") as Mode;
    ui.three3d = patch.three3d ?? false;
    ui.vision = patch.vision ?? "all";
    ui.ratio = patch.ratio !== undefined ? patch.ratio : 3;
    ui.spread = patch.spread ?? false;
    ui.frontier = patch.frontier ?? true;
    ui.search = patch.search ?? "";
    ui.families.clear();
    if (patch.families) for (const f of patch.families) ui.families.add(f);
    ui.thr = patch.thr ?? { priceMin: null, priceMax: null, eloMin: null, speedMin: null };
    lastCont = contSnap();
  } finally {
    applying = false;
  }
}

export function initHistory(): void {
  seedFromURL();
  window.addEventListener("popstate", () => applyFromURL());
}
