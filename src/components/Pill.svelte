<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    on = false,
    tiny = false,
    title,
    onclick,
    children,
    ...rest
  }: {
    on?: boolean;
    tiny?: boolean;
    title?: string;
    onclick?: () => void;
    children: Snippet;
    [key: string]: unknown;
  } = $props();
</script>

<button class="pill" class:on class:tiny {title} {onclick} {...rest}>{@render children()}</button>

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
  /* Tiny variant (plan 038 D2): the tucked-away tour trigger — sized here
     where the button lives; a caller's scoped styles can't reach into it. */
  .pill.tiny {
    padding: 2px 8px;
    font-size: 10px;
    border-radius: 8px;
    opacity: 0.65;
  }
  .pill.tiny:hover { opacity: 1; }
</style>
