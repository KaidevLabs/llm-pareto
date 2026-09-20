<script lang="ts">
  // Threshold filters (plan 032 D6, owner revision 2026-09-19): every bound
  // is double-sided — min/max are two handles on ONE line that clamp against
  // each other (never cross), for price, Elo and speed alike. Bounds derive
  // from the data extents (price per the active view's x-axis price, D2 —
  // the price row disables in the speed view where the bound is inactive).
  // Price maps the line onto a log domain to match the chart's log x-axis;
  // Elo/speed are linear. Every bound is also editable directly: the numeric
  // field next to a handle accepts a typed value, empty = unbounded.
  import { ui } from "../lib/state.svelte";
  import { data } from "../lib/data.svelte";
  import { store as eps } from "../lib/endpoints.svelte";
  import { viewPrice, type Thr } from "../lib/filters";
  import { speedOf } from "../lib/speed";
  import { fmtPrice } from "../lib/format";

  type Kind = "priceMin" | "priceMax" | "eloMin" | "eloMax" | "speedMin" | "speedMax";

  const T = 1000;
  const r2 = (v: number) => Math.round(v * 100) / 100;
  const isMax = (k: Kind) => k.endsWith("Max");
  const other = (k: Kind): Kind => (isMax(k) ? (k.replace("Max", "Min") as Kind) : (k.replace("Min", "Max") as Kind));

  // Price extents follow the active view (general → blended at ui.ratio);
  // speed extents need the endpoints fetch (row stays disabled until it
  // settles). Both recompute reactively — rows/extents are small.
  const priceExtent = $derived.by(() => {
    if (!data.loaded || ui.mode === "speed") return null;
    let lo = Infinity;
    let hi = 0;
    for (const d of data.rows) {
      const p = viewPrice(d, ui.mode, ui.ratio);
      if (p == null || p <= 0) continue;
      if (p < lo) lo = p;
      if (p > hi) hi = p;
    }
    return lo === Infinity ? null : { lo: lo / 2, hi: hi * 2 };
  });
  const eloExtent = $derived.by(() => {
    if (!data.loaded) return null;
    let lo = Infinity;
    let hi = 0;
    for (const d of data.rows) {
      if (d.arena_elo == null) continue;
      if (d.arena_elo < lo) lo = d.arena_elo;
      if (d.arena_elo > hi) hi = d.arena_elo;
    }
    return lo === Infinity ? null : { lo: Math.floor(lo / 10) * 10, hi: Math.ceil(hi / 10) * 10 };
  });
  const speedExtent = $derived.by(() => {
    if (!data.loaded || !eps.done || !eps.data) return null;
    let lo = Infinity;
    let hi = 0;
    for (const d of data.rows) {
      const s = speedOf(d.or_id, eps.data);
      if (!s || s.toks <= 0) continue;
      if (s.toks < lo) lo = s.toks;
      if (s.toks > hi) hi = s.toks;
    }
    return lo === Infinity ? null : { lo: lo / 2, hi: hi * 2 };
  });

  const extentOf = (kind: Kind) =>
    kind.startsWith("price") ? priceExtent : kind.startsWith("elo") ? eloExtent : speedExtent;

  // Slider position ⇄ threshold value. null (unbounded) parks the handle at
  // its unbounded end: min handles at 0, max handles at T.
  function toSlider(kind: Kind): number {
    const v = ui.thr[kind];
    if (v == null) return isMax(kind) ? T : 0;
    const ext = extentOf(kind);
    if (!ext) return 0;
    if (kind.startsWith("price")) {
      const t = Math.log(v / ext.lo) / Math.log(ext.hi / ext.lo);
      return Math.max(0, Math.min(T, Math.round(t * T)));
    }
    return Math.max(0, Math.min(T, Math.round(((v - ext.lo) / (ext.hi - ext.lo)) * T)));
  }

  function fromSlider(kind: Kind, t: number): number | null {
    const ext = extentOf(kind);
    if (!ext) return null;
    const f = t / T;
    // parked at the unbounded end: min at 0, max at T
    if (isMax(kind) ? f >= 0.9995 : f <= 0.0005) return null;
    if (kind.startsWith("price")) return r2(ext.lo * Math.pow(ext.hi / ext.lo, f));
    return Math.round(ext.lo + ((ext.hi - ext.lo) * t) / T);
  }

  // The two handles share one line and clamp, never cross: each stops at the
  // other's position.
  function setSlider(kind: Kind, raw: string) {
    let t = Math.max(0, Math.min(T, +raw));
    t = isMax(kind) ? Math.max(t, toSlider(other(kind))) : Math.min(t, toSlider(other(kind)));
    (ui.thr as Thr)[kind] = fromSlider(kind, t);
  }

  // Numeric field: raw typed value, empty/invalid → unbounded. Clamped into
  // the domain and against the opposite bound so the pair still can't cross.
  function setNum(kind: Kind, raw: string) {
    const ext = extentOf(kind);
    if (!ext) return;
    const s = raw.trim();
    if (!s || !Number.isFinite(Number(s)) || Number(s) < 0) {
      (ui.thr as Thr)[kind] = null;
      return;
    }
    let v = Number(s);
    v = Math.min(ext.hi, Math.max(ext.lo, v));
    const o = ui.thr[other(kind)];
    if (o != null) v = isMax(kind) ? Math.max(v, o) : Math.min(v, o);
    (ui.thr as Thr)[kind] = kind.startsWith("price") ? r2(v) : Math.round(v);
  }

  const numVal = (kind: Kind) => (ui.thr[kind] == null ? "" : String(ui.thr[kind]));

  const reset = () => {
    ui.thr = { priceMin: null, priceMax: null, eloMin: null, eloMax: null, speedMin: null, speedMax: null };
  };
  const anySet = $derived(!!(ui.thr.priceMin != null || ui.thr.priceMax != null || ui.thr.eloMin != null || ui.thr.eloMax != null || ui.thr.speedMin != null || ui.thr.speedMax != null));
  const priceDisabled = $derived(ui.mode === "speed" || !priceExtent);
  const speedDisabled = $derived(!speedExtent);
</script>

{#snippet dualRow(
  cap: string,
  lo: Kind,
  hi: Kind,
  disabled: boolean,
  loLabel: string,
  hiLabel: string,
  fmt: (v: number) => string,
)}
  <div class="row" class:off={disabled}>
    <span class="cap">{cap}</span>
    <div class="dual">
      <div class="track">
        <div class="fill" style:left={toSlider(lo) / 10 + "%"} style:width={(toSlider(hi) - toSlider(lo)) / 10 + "%"}></div>
      </div>
      <input type="range" min="0" max={T} step="1" value={toSlider(lo)} disabled={disabled}
        aria-label={loLabel} oninput={(e) => setSlider(lo, e.currentTarget.value)}>
      <input type="range" min="0" max={T} step="1" value={toSlider(hi)} disabled={disabled}
        aria-label={hiLabel} oninput={(e) => setSlider(hi, e.currentTarget.value)}>
    </div>
    <input class="num" type="text" inputmode="decimal" disabled={disabled} value={numVal(lo)}
      aria-label={loLabel + " value"} placeholder="—"
      onchange={(e) => setNum(lo, e.currentTarget.value)}
      onkeydown={(e) => e.key === "Enter" && setNum(lo, e.currentTarget.value)}>
    <span class="dash">–</span>
    <input class="num" type="text" inputmode="decimal" disabled={disabled} value={numVal(hi)}
      aria-label={hiLabel + " value"} placeholder="—"
      onchange={(e) => setNum(hi, e.currentTarget.value)}
      onkeydown={(e) => e.key === "Enter" && setNum(hi, e.currentTarget.value)}>
  </div>
{/snippet}

<div class="thr" aria-label="threshold filters">
  {@render dualRow("$ / M", "priceMin", "priceMax", priceDisabled, "minimum price", "maximum price", fmtPrice)}
  {@render dualRow("Elo", "eloMin", "eloMax", !eloExtent, "minimum arena elo", "maximum arena elo", (v) => String(Math.round(v)))}
  {@render dualRow("tok/s", "speedMin", "speedMax", speedDisabled, "minimum output speed", "maximum output speed", (v) => String(Math.round(v)))}

  <button class="reset" onclick={reset} disabled={!anySet} aria-label="clear all thresholds">reset</button>
</div>

<style>
  .thr {
    display: inline-flex;
    flex-direction: column;
    gap: 4px;
    border: 1px solid var(--border);
    background: rgba(148, 163, 184, 0.08);
    border-radius: 10px;
    padding: 8px 12px;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 26px;
  }
  .row.off { opacity: 0.4; }
  .cap { color: var(--muted); font-size: 11px; width: 42px; white-space: nowrap; }
  .dual {
    position: relative;
    width: 170px;
    height: 22px;
  }
  .track {
    position: absolute;
    left: 0;
    right: 0;
    top: 9px;
    height: 4px;
    border-radius: 2px;
    background: rgba(148, 163, 184, 0.25);
  }
  .fill {
    position: absolute;
    top: 0;
    height: 4px;
    border-radius: 2px;
    background: var(--accent);
    opacity: 0.55;
  }
  .dual input[type="range"] {
    position: absolute;
    left: 0;
    width: 170px;
    margin: 0;
    background: none;
    pointer-events: none;
    -webkit-appearance: none;
    appearance: none;
  }
  .dual input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    pointer-events: auto;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--accent);
    border: 2px solid #0a0e16;
    cursor: pointer;
  }
  .dual input[type="range"]::-moz-range-thumb {
    pointer-events: auto;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--accent);
    border: 2px solid #0a0e16;
    cursor: pointer;
  }
  .num {
    width: 56px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 6px;
    color: #d1fae5;
    font-size: 12px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    text-align: right;
    padding: 2px 4px;
  }
  .num:hover:not(:disabled), .num:focus {
    border-color: var(--border);
    background: rgba(148, 163, 184, 0.08);
  }
  .num:focus { outline: none; color: var(--text); }
  .num:disabled { color: var(--muted); font-weight: 400; }
  .dash { color: var(--muted); font-size: 11px; }
  .reset {
    align-self: flex-end;
    border: 1px solid var(--border);
    background: transparent;
    color: var(--muted);
    font-size: 11px;
    padding: 3px 8px;
    border-radius: 8px;
    cursor: pointer;
  }
  .reset:hover:not(:disabled) { color: var(--text); background: rgba(148, 163, 184, 0.08); }
  .reset:disabled { opacity: 0.35; cursor: default; }
</style>
