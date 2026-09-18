<script lang="ts">
  // The footer (live renderFooter): spread-bar explainer, sources, join
  // stats, manual-override disclaimer, cookieless note. Same content, same
  // DOM shape — Svelte's {...} escapes what the vanilla version built as
  // strings.
  import { data } from "../lib/data.svelte";

  const join = $derived(data.meta?.join ?? null);
  const methods = $derived(
    join?.by_method
      ? Object.keys(join.by_method)
          .map((k) => join.by_method[k] + " " + k)
          .join(" · ")
      : ""
  );
  const ov = $derived(join?.overrides_applied ?? []);
</script>

<footer id="footer">
  <div id="legend-spread">
    <span class="swatch"></span>Spread bar: each model's real price range on
    the log axis — <span class="ink">blue end = input</span>,
    <span class="outk">amber end = output</span> $/M. The point is the
    blended price at the slider's input:output ratio; a long bar means
    output tokens cost disproportionately more than input.
  </div>
  <div class="sources">
    Sources:
    <a href="https://lmarena.ai/leaderboard/text" target="_blank" rel="noopener">LMArena text leaderboard</a>
    ·
    <a href="https://openrouter.ai/models" target="_blank" rel="noopener">OpenRouter models</a>
    · data {data.meta?.fetched_at || "unknown"}
  </div>
  <div class="joinline">
    {#if join}{join.combined} models joined (arena ∩ openrouter){#if methods} · join: {methods}{/if}{/if}
  </div>
  {#if ov.length}
    <div class="ov">
      <span class="diamond">⚑</span> Manual overrides:
      {ov.map((o) => o.arena + " → " + o.openrouter_id).join(", ")} — where
      the arena name is ambiguous, an explicit manual override fixes the
      model identity; that price is final. Overridden points are outlined
      in gold on the chart.
    </div>
  {/if}
  <div class="cookieless">Cookieless by design — no cookies. Just content.</div>
</footer>

<style>
  footer {
    margin-top: 18px;
    padding: 16px 28px 26px;
    border-top: 1px solid var(--border);
    color: var(--muted);
    font-size: 12px;
    line-height: 1.7;
  }
  footer a {
    color: var(--text);
    text-decoration: none;
    border-bottom: 1px solid var(--border);
  }
  footer a:hover {
    border-bottom-color: var(--accent);
  }
  footer :global(.diamond) {
    color: var(--gold);
  }
  .swatch {
    display: inline-block;
    width: 30px;
    height: 4px;
    border-radius: 2px;
    background: linear-gradient(90deg, #60a5fa, #f59e0b);
    vertical-align: middle;
    margin-right: 6px;
  }
  .ink {
    color: #60a5fa;
  }
  .outk {
    color: #f59e0b;
  }
  .ov {
    color: #e9d8a6;
  }
  .ov .diamond {
    color: var(--gold);
  }
</style>
