<script lang="ts">
  import Pill from "./Pill.svelte";
  import { ui } from "../lib/state.svelte";
</script>

<div class="ratio" class:hidden={ui.mode !== "general"}>
  <span class="ratio-val">{ui.ratio}:1</span>
  <input
    type="range"
    min="1"
    max="10"
    step="1"
    value={ui.ratio}
    aria-label="input to output token ratio for the blended price"
    oninput={(e) => (ui.ratio = +e.currentTarget.value)}
  >
  <span class="ratio-cap">input:output mix</span>
  <Pill on={ui.spread} title="Show/hide the real $in→$out spread bars"
    onclick={() => (ui.spread = !ui.spread)}>
    <span class="diamond">▭</span>spread
  </Pill>
</div>

<style>
  .ratio {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    border: 1px solid var(--border);
    background: rgba(148, 163, 184, 0.08);
    border-radius: 10px;
    padding: 0 12px;
    height: 38px;
  }
  .ratio input[type="range"] {
    width: 140px;
    accent-color: var(--accent);
    cursor: pointer;
  }
  .ratio-val {
    color: #d1fae5;
    font-weight: 600;
    font-size: 13px;
    min-width: 30px;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .ratio-cap { color: var(--muted); font-size: 11px; white-space: nowrap; }
  .ratio :global(.pill) { padding: 5px 10px; font-size: 12px; margin-left: 4px; }
</style>
