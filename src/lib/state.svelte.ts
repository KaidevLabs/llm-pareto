// The user-state store: a direct port of app.js's plain-object `state` as a
// Svelte 5 module store (runes in .svelte.ts). Same fields, same defaults —
// the framework's reactivity replaces the render()-everything convention.
//
// `families` is a SvelteSet (reactive built-in; a Set nested in $state is
// not instrumented). Leaf keys are "org|family" (plan 004 D3).

import { SvelteSet } from "svelte/reactivity";
import type { Row } from "./types";

export type Mode = "general" | "in" | "out" | "speed";

// Named `ui` (not `state`): a binding called `state` cannot coexist with
// local `$state` runes in the same component (store_rune_conflict) — and
// every component that reads the store also has local runes.
export const ui = $state({
  mode: "general" as Mode,
  vision: "all" as "all" | "vision",
  families: new SvelteSet<string>(),
  frontier: true,
  spread: false,
  ratio: 3,
  search: "",
  selected: null as Row | null,
  three3d: false,
  // 025 D6 (owner-amended 2026-09-19 to the multi-comparator): the picked
  // models, or_id-keyed, in-memory only (no URL hash, no storage — reset
  // on reload). Empty = the D5 pre-seed (top-2 by arena rank, resolved by
  // the component); capped at 4 picks.
  cmps: [] as string[],
});

