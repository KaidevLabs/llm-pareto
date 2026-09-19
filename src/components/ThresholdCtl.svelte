<script lang="ts">
  // Threshold filters (plan 032 D6): four native ranges — price min/max,
  // Elo min, speed min — with live readouts and a clear-to-unbounded reset.
  // Slider bounds derive from the data extents at render time (price per the
  // active view's x-axis price, D2 — so the price rows disable in the speed
  // view where the bound is inactive). Price maps the range 0..1000 onto a
  // log domain to match the chart's log x-axis; Elo/speed are linear.
  import { ui } from "../lib/state.svelte";
  import { data } from "../lib/data.svelte";
  import { store as eps } from "../lib/endpoints.svelte";
  import { viewPrice, type Thr } from "../lib/filters";
  import { speedOf } from "../lib/speed";
  import { fmtPrice } from "../lib/format";

  type Kind = "priceMin" | "priceMax" | "eloMin" | "speedMin";

  const T = 1000;
  const r2 = (v: number) => Math.round(v * 100) / 100;

  // Price extents follow the active view (general → blended at ui.ratio);
  // speed extents need the endpoints fetch (slider stays disabled until
  // it settles). Both recompute reactively — rows/extents are small.
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

  // Slider position ⇄ threshold value. null (unbounded) parks the handle at
  // the unbounded end: min sliders at 0, the max slider at T.
  function toSlider(kind: Kind): number {
    const v = ui.thr[kind];
    if (v == null) return kind === "priceMax" ? T : 0;
    const ext = kind === "priceMin" || kind === "priceMax" ? priceExtent : kind === "eloMin" ? eloExtent : speedExtent;
    if (!ext) return 0;
    if (kind === "priceMin" || kind === "priceMax") {
      const t = Math.log(v / ext.lo) / Math.log(ext.hi / ext.lo);
      return Math.max(0, Math.min(T, Math.round(t * T)));
    }
    return Math.max(0, Math.min(T, Math.round(((v - ext.lo) / (ext.hi - ext.lo)) * T)));
  }

  function fromSlider(kind: Kind, t: number): number | null {
    const ext = kind === "priceMin" || kind === "priceMax" ? priceExtent : kind === "eloMin" ? eloExtent : speedExtent;
    if (!ext) return null;
    if (kind === "priceMin" || kind === "priceMax") {
      const f = t / T;
      // parked at the unbounded end: min at 0, max at T
      if (kind === "priceMax" ? f >= 0.9995 : f <= 0.0005) return null;
      return r2(ext.lo * Math.pow(ext.hi / ext.lo, f));
    }
    if (t <= 0.0005 * T) return null;
    return Math.round(ext.lo + ((ext.hi - ext.lo) * t) / T);
  }

  function set(kind: Kind, raw: string) {
    (ui.thr as Thr)[kind] = fromSlider(kind, +raw);
  }

  function readout(kind: Kind): string {
    const v = ui.thr[kind];
    if (v == null) return "—";
    if (kind === "priceMin" || kind === "priceMax") return fmtPrice(v);
    if (kind === "eloMin") return String(Math.round(v));
    return String(Math.round(v));
  }

  const reset = () => {
    ui.thr = { priceMin: null, priceMax: null, eloMin: null, speedMin: null };
  };
  const anySet = $derived(!!(ui.thr.priceMin != null || ui.thr.priceMax != null || ui.thr.eloMin != null || ui.thr.speedMin != null));
  const priceDisabled = $derived(ui.mode === "speed");
  const speedDisabled = $derived(!speedExtent);
</script>

<div class="thr" aria-label="threshold filters">
  <span class="cap">min $</span>
  <input type="range" min="0" max={T} step="1" value={toSlider("priceMin")}
    disabled={priceDisabled} aria-label="minimum price"
    oninput={(e) => set("priceMin", e.currentTarget.value)}>
  <span class="val" class:dim={ui.thr.priceMin == null}>{priceDisabled ? "n/a" : readout("priceMin")}</span>

  <span class="cap">max $</span>
  <input type="range" min="0" max={T} step="1" value={toSlider("priceMax")}
    disabled={priceDisabled} aria-label="maximum price"
    oninput={(e) => set("priceMax", e.currentTarget.value)}>
  <span class="val" class:dim={ui.thr.priceMax == null}>{priceDisabled ? "n/a" : readout("priceMax")}</span>

  <span class="cap">min Elo</span>
  <input type="range" min="0" max={T} step="1" value={toSlider("eloMin")}
    disabled={!eloExtent} aria-label="minimum arena elo"
    oninput={(e) => set("eloMin", e.currentTarget.value)}>
  <span class="val" class:dim={ui.thr.eloMin == null}>{readout("eloMin")}</span>

  <span class="cap">min tok/s</span>
  <input type="range" min="0" max={T} step="1" value={toSlider("speedMin")}
    disabled={speedDisabled} aria-label="minimum output speed"
    oninput={(e) => set("speedMin", e.currentTarget.value)}>
  <span class="val" class:dim={ui.thr.speedMin == null}>{speedDisabled ? "…" : readout("speedMin")}</span>

  <button class="reset" onclick={reset} disabled={!anySet} aria-label="clear all thresholds">reset</button>
</div>

<style>
  .thr {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: 1px solid var(--border);
    background: rgba(148, 163, 184, 0.08);
    border-radius: 10px;
    padding: 0 12px;
    height: 38px;
    flex-wrap: wrap;
  }
  .thr input[type="range"] {
    width: 70px;
    accent-color: var(--accent);
    cursor: pointer;
  }
  .thr input[type="range"]:disabled { cursor: default; opacity: 0.4; }
  .cap { color: var(--muted); font-size: 11px; white-space: nowrap; }
  .val {
    color: #d1fae5;
    font-weight: 600;
    font-size: 12px;
    min-width: 44px;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .val.dim { color: var(--muted); font-weight: 400; }
  .reset {
    border: 1px solid var(--border);
    background: transparent;
    color: var(--muted);
    font-size: 11px;
    padding: 4px 8px;
    border-radius: 8px;
    cursor: pointer;
    margin-left: 2px;
  }
  .reset:hover:not(:disabled) { color: var(--text); background: rgba(148, 163, 184, 0.08); }
  .reset:disabled { opacity: 0.35; cursor: default; }
</style>
