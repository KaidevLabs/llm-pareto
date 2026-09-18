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
</script>

<section class="panel" id="panel-{key}" class:hidden aria-label={title}>
  <div class="panel-head">
    <h2>{title}</h2>
    <span class="badge" class:hidden={panelStatus[key].badgeHidden}>◈ frontier</span>
    <Pill title={resetTitle} onclick={() => (key === "3d" ? render3DPanel(el!) : resetChart("chart-" + key))}>
      ⤢ fit
    </Pill>
    <span class="count">{panelStatus[key].count}</span>
  </div>
  <div class="chart" id="chart-{key}" bind:this={el}></div>
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
</style>
