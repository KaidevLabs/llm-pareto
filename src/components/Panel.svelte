<script lang="ts">
  import type { Snippet } from "svelte";
  import Pill from "./Pill.svelte";
  import { panelStatus, type PanelKey } from "../lib/panels.svelte";
  import {
    ensureChart2D,
    renderPanel,
    renderSpeedPanel,
    render3DPanel,
    resetChart,
    startTour3D,
    stopTour3D,
    tourRunning,
    registerTourUi,
  } from "../lib/charts";
  import { boot } from "../lib/data.svelte";

  let {
    key,
    title,
    hidden,
    legend,
  }: {
    key: PanelKey;
    title: string;
    hidden: boolean;
    legend?: Snippet;
  } = $props();

  let el = $state<HTMLElement>();

  // Lazy chart lifecycle (live ensureChart/render): the echarts instance is
  // created on the panel's first ACTIVE render and persists across mode
  // switches; the effect re-renders whenever any state it reads changes
  // (mode, ratio, spread, frontier, search, families, vision, endpoints).
  // Hidden panels never render — same as live render()'s active-panel rule.
  $effect(() => {
    if (!boot.ready || !el || hidden) return;
    if (key === "3d") render3DPanel(el);
    else if (key === "speed") renderSpeedPanel(el);
    else renderPanel(el, key);
  });

  const resetTitle = $derived(
    key === "3d"
      ? "Reset the camera to the default view"
      : "Reset both axes to fit"
  );

  // Guided tour (027 step 2): the tour's lifecycle lives in charts.ts (the
  // pill click and the `tour=1` autostart share it); this panel owns the
  // DOM chrome — the caption chip over the chart and the tiny trigger pill.
  let touring = $state(false);
  let caption = $state("");

  $effect(() => {
    if (key !== "3d") return;
    registerTourUi({
      onCaption: (s) => (caption = s),
      onState: (r) => (touring = r),
    });
  });

  function playTour() {
    if (tourRunning()) stopTour3D();
    else startTour3D();
  }
</script>

<section class="panel" id="panel-{key}" class:hidden aria-label={title}>
  <div class="panel-head">
    <h2>{title}</h2>
    <span class="badge" class:hidden={panelStatus[key].badgeHidden}>◈ frontier</span>
    {#if key === "3d"}
      <Pill class="tour-pill" title="Play the guided tour" onclick={playTour}>
        {touring ? "■" : "▶"}
      </Pill>
    {/if}
    <Pill title={resetTitle} onclick={() => (key === "3d" ? render3DPanel(el!) : resetChart("chart-" + key))}>
      ⤢ fit
    </Pill>
    <span class="count">{panelStatus[key].count}</span>
  </div>
  <div class="chart-wrap">
    <div class="chart" id="chart-{key}" bind:this={el}></div>
    {#if caption}
      <div class="tour-cap" role="status">{caption}</div>
    {/if}
  </div>
  {#if legend}{@render legend()}{/if}
</section>

<style>
  .panel {
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 14px;
    display: flex;
    flex-direction: column;
    min-height: 620px;
    overflow: hidden;
  }
  .panel-head {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px 4px;
  }
  .panel-head h2 {
    margin: 0;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .badge {
    font-size: 11px;
    color: var(--accent);
    border: 1px solid rgba(52, 211, 153, 0.35);
    background: var(--accent-dim);
    padding: 2px 8px;
    border-radius: 999px;
    letter-spacing: 0.03em;
  }
  .count {
    margin-left: auto;
    font-size: 11px;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }
  .chart { flex: 1; min-height: 560px; }

  /* Guided tour (027 step 2): the tiny tucked-away trigger (A2) + the
     caption chip over the scene. */
  .chart-wrap {
    flex: 1;
    min-height: 560px;
    position: relative;
    display: flex;
  }
  .tour-pill {
    padding: 2px 8px !important;
    font-size: 10px !important;
    border-radius: 8px !important;
    opacity: 0.65;
  }
  .tour-pill:hover { opacity: 1; }
  .tour-cap {
    position: absolute;
    left: 50%;
    bottom: 18px;
    transform: translateX(-50%);
    background: rgba(10, 14, 23, 0.92);
    border: 1px solid rgba(52, 211, 153, 0.35);
    color: #d1fae5;
    font-size: 16px;
    font-weight: 600;
    letter-spacing: 0.02em;
    padding: 10px 18px;
    border-radius: 999px;
    pointer-events: none;
    white-space: nowrap;
    max-width: calc(100% - 40px);
    overflow: hidden;
    text-overflow: ellipsis;
    z-index: 5;
  }
</style>
