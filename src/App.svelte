<!--
  App shell (028 step 2): header, nav controls, the four 2D panels, the
  details drawer overlay, and the boot sequence (live main(): data +
  badges, then the shared endpoints fetch). The 3D showcase joins in
  step 3; the footer content in step 4.
-->
<script lang="ts">
  import { data, boot, loadData } from "./lib/data.svelte";
  import { buildBadges } from "./lib/badges";
  import { ensureEndpoints } from "./lib/endpoints.svelte";
  import { ui, type Mode } from "./lib/state.svelte";
  import { NOTE_PRICE, NOTE_SPEED, NOTE_3D, resizeVisibleCharts } from "./lib/charts";
  import Panel from "./components/Panel.svelte";
  import Seg from "./components/Seg.svelte";
  import Pill from "./components/Pill.svelte";
  import RatioCtl from "./components/RatioCtl.svelte";
  import SearchBox from "./components/SearchBox.svelte";
  import OfPanel from "./components/OfPanel.svelte";
  import Details from "./components/Details.svelte";

  let echartsFatal = $state(false);

  async function bootOnce() {
    if (!window.echarts) {
      echartsFatal = true;
      return;
    }
    await loadData();
    await buildBadges();
    boot.ready = true;
    // Fire the shared endpoints fetch on load, after first paint (023 D8):
    // the hover card's p50 speed line needs it without the caller having to
    // open a drawer first. Non-blocking.
    if (!data.error) ensureEndpoints();
  }

  // boot once on mount (no reactive reads in bootOnce's sync path)
  $effect(() => {
    void bootOnce();
  });

  // live render()'s post-render resize loop: visible charts follow the DOM
  // size after mode switches (children's render effects run first) and on
  // window resizes.
  $effect(() => {
    ui.mode;
    ui.three3d;
    resizeVisibleCharts();
  });
</script>

<svelte:window onresize={() => resizeVisibleCharts()} />

<header>
  <div>
    <h1>Arena <span class="x">×</span> OpenRouter</h1>
    <div class="subtitle">Frontier models · LMArena quality vs OpenRouter price · Pareto frontier</div>
  </div>
  {#if data.loaded}
    <div class="stamp"><b>{data.rows.length}</b> models · updated {data.meta?.fetched_at || "—"}</div>
  {/if}
</header>

<nav class="filters">
  <Seg
    aria="price mode"
    options={[
      { label: "General", value: "general", on: ui.mode === "general" },
      { label: "Input $/M", value: "in", on: ui.mode === "in" },
      { label: "Output $/M", value: "out", on: ui.mode === "out" },
      { label: "Speed tok/s", value: "speed", on: ui.mode === "speed" },
    ]}
    onpick={(v) => {
      // entering any 2D mode leaves the 3D showcase (023 D7)
      ui.mode = v as Mode;
      ui.three3d = false;
    }}
  />
  <RatioCtl />
  <Seg
    aria="vision filter"
    options={[
      { label: "All models", value: "all", on: ui.vision === "all" },
      { label: "✨ Vision-capable", value: "vision", on: ui.vision === "vision" },
    ]}
    onpick={(v) => (ui.vision = v as "all" | "vision")}
  />
  <OfPanel />
  <SearchBox />
  <Pill on={ui.frontier} title="Pareto frontier on/off"
    onclick={() => (ui.frontier = !ui.frontier)}>
    <span class="diamond">◈</span> Pareto frontier
  </Pill>
</nav>

<div class="axis-note">
  {ui.three3d ? NOTE_3D : ui.mode === "speed" ? NOTE_SPEED : NOTE_PRICE}
</div>

<main>
  {#if echartsFatal}
    <div class="fatal">ECharts failed to load from CDN — check your connection and reload.</div>
  {:else if data.error}
    <div class="fatal">
      Failed to load data ({data.error}). Run <code>python3 update.py</code> and commit <code>public/data/</code>.
    </div>
  {:else}
    <Panel key="blend" title="Blended price" hidden={ui.three3d || ui.mode !== "general"}>
      {#snippet legend()}
        <div class="legend-row">
          <span><span class="sw" style="background:#34d399"></span>pareto frontier — nothing beats these on both quality and price</span>
          <span><span class="sw ov-sw"></span>manual override — identity fixed by owner decision, price final</span>
          <span><span class="sw grad-sw"></span>real price spread of the model — <span class="ink">blue = input</span>, <span class="outk">amber = output</span> $/M</span>
        </div>
      {/snippet}
    </Panel>
    <Panel key="in" title="Input price" hidden={ui.three3d || ui.mode !== "in"}>
      {#snippet legend()}
        <div class="legend-row">
          <span><span class="sw" style="background:#34d399"></span>pareto frontier — nothing beats these on both quality and price</span>
          <span><span class="sw ov-sw"></span>manual override — identity fixed by owner decision, price final</span>
        </div>
      {/snippet}
    </Panel>
    <Panel key="out" title="Output price" hidden={ui.three3d || ui.mode !== "out"}>
      {#snippet legend()}
        <div class="legend-row">
          <span><span class="sw" style="background:#34d399"></span>pareto frontier — nothing beats these on both quality and price</span>
          <span><span class="sw ov-sw"></span>manual override — identity fixed by owner decision, price final</span>
        </div>
      {/snippet}
    </Panel>
    <Panel key="speed" title="Output speed" hidden={ui.three3d || ui.mode !== "speed"}>
      {#snippet legend()}
        <div class="legend-row">
          <span><span class="sw" style="background:#34d399"></span>pareto frontier — nothing beats these on both quality and speed</span>
          <span><span class="sw ov-sw"></span>manual override — identity fixed by owner decision, price final</span>
        </div>
      {/snippet}
    </Panel>
  {/if}

  {#if ui.selected}
    <!-- Details drawer (plan 006 D1): overlays the chart's right edge — no
         layout change, no reflow. -->
    <aside class="drawer" aria-label="model details">
      <button class="drawer-x" aria-label="close details" onclick={() => (ui.selected = null)}>×</button>
      <Details d={ui.selected} />
    </aside>
  {/if}
</main>

<footer id="footer"></footer>

<style>
  header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 16px;
    padding: 22px 28px 14px;
    flex-wrap: wrap;
  }
  h1 {
    margin: 0;
    font-size: 24px;
    font-weight: 700;
    letter-spacing: -0.02em;
  }
  h1 .x { color: var(--accent); }
  .subtitle {
    margin-top: 4px;
    color: var(--muted);
    font-size: 13px;
    letter-spacing: 0.01em;
  }
  .stamp {
    color: var(--muted);
    font-size: 12px;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .stamp b { color: var(--text); font-weight: 600; }

  nav.filters {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 28px 14px;
    flex-wrap: wrap;
  }
  .axis-note { color: var(--muted); font-size: 11px; padding: 0 28px 8px; }

  main {
    flex: 1;
    display: grid;
    grid-template-columns: 1fr;
    gap: 16px;
    padding: 0 28px;
    min-height: 0;
    position: relative;
  }
  .fatal { padding: 40px; color: #8b98ab; grid-column: 1; }

  .legend-row {
    display: flex;
    gap: 16px;
    padding: 0 16px 10px;
    font-size: 11px;
    color: var(--muted);
    flex-wrap: wrap;
  }
  .legend-row .sw {
    display: inline-block;
    width: 10px; height: 10px;
    border-radius: 50%;
    margin-right: 5px;
    vertical-align: -1px;
  }
  .legend-row .ov-sw {
    border: 2px dashed var(--gold);
    background: transparent;
    border-radius: 50%;
  }
  .ink { color: #60a5fa; }
  .outk { color: #f59e0b; }
  .grad-sw {
    background: linear-gradient(90deg, #60a5fa, #f59e0b) !important;
    border-radius: 2px !important;
    width: 16px !important;
    height: 4px !important;
  }

  /* Details drawer shell (plan 006 D1); the body styles live in Details. */
  .drawer {
    position: absolute;
    top: 0;
    right: 28px;
    bottom: 0;
    width: 400px;
    z-index: 20;
    background: #0a0e16;
    border: 1px solid var(--border);
    border-radius: 14px;
    box-shadow: 0 18px 50px rgba(0, 0, 0, 0.5);
    overflow-y: auto;
    padding: 18px;
  }
  .drawer-x {
    position: absolute;
    top: 10px;
    right: 10px;
    border: 0;
    background: transparent;
    color: var(--muted);
    font-size: 18px;
    line-height: 1;
    padding: 4px 8px;
    border-radius: 8px;
    cursor: pointer;
  }
  .drawer-x:hover { color: var(--text); background: rgba(148, 163, 184, 0.08); }

  footer {
    margin-top: 18px;
    padding: 16px 28px 26px;
    border-top: 1px solid var(--border);
    color: var(--muted);
    font-size: 12px;
    line-height: 1.7;
  }
</style>
