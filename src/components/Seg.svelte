<script lang="ts">
  let {
    aria,
    options,
    onpick,
  }: {
    aria: string;
    options: { label: string; value: string; on: boolean }[];
    onpick: (value: string) => void;
  } = $props();
</script>

<div class="seg" role="tablist" aria-label={aria}>
  {#each options as o (o.value)}
    <button class:on={o.on} data-value={o.value} onclick={() => onpick(o.value)}
      role="tab" aria-selected={o.on}>{o.label}</button>
  {/each}
</div>

<style>
  .seg {
    display: inline-flex;
    background: rgba(148, 163, 184, 0.08);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 3px;
    gap: 2px;
  }
  .seg button {
    border: 0;
    background: transparent;
    color: var(--muted);
    font: 500 13px "Inter", system-ui, sans-serif;
    padding: 7px 14px;
    border-radius: 8px;
    cursor: pointer;
    letter-spacing: 0.02em;
    transition: color 0.15s, background 0.15s, box-shadow 0.15s;
  }
  .seg button:hover { color: var(--text); }
  .seg button.on {
    background: var(--accent-dim);
    color: #d1fae5;
    box-shadow: inset 0 0 0 1px rgba(52, 211, 153, 0.35), 0 0 18px rgba(52, 211, 153, 0.12);
  }
</style>
