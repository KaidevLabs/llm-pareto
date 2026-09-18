<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    on = false,
    title,
    onclick,
    children,
    ...rest
  }: {
    on?: boolean;
    title?: string;
    onclick?: () => void;
    children: Snippet;
    [key: string]: unknown;
  } = $props();
</script>

<button class="pill" class:on {title} {onclick} {...rest}>{@render children()}</button>

<style>
  .pill {
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 8px 14px;
    background: transparent;
    color: var(--muted);
    font: 500 13px "Inter", system-ui, sans-serif;
    cursor: pointer;
    letter-spacing: 0.02em;
    transition: color 0.15s, background 0.15s, box-shadow 0.15s;
  }
  .pill:hover { color: var(--text); }
  .pill.on {
    background: var(--accent-dim);
    color: #d1fae5;
    box-shadow: inset 0 0 0 1px rgba(52, 211, 153, 0.35), 0 0 18px rgba(52, 211, 153, 0.12);
  }
</style>
