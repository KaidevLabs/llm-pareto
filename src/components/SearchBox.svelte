<script lang="ts">
  import { ui } from "../lib/state.svelte";
  import { data } from "../lib/data.svelte";
  import { filterRows, searchHit } from "../lib/filters";

  // "n/N" next to the search box (plan 010 D3): matches over the visible
  // set — the family/vision filters still apply. Hidden while the query is
  // empty. The input stays uncontrolled (live kept the raw text in the box,
  // storing it lowercased into the search state).
  const rows = $derived(filterRows(data.rows, ui));
  const count = $derived(
    ui.search
      ? rows.filter((d) => searchHit(d, ui.search)).length + "/" + rows.length
      : ""
  );
</script>

<div class="search">
  <input
    type="search"
    placeholder="Search models…"
    aria-label="search models, dims non-matches"
    oninput={(e) => (ui.search = e.currentTarget.value.trim().toLowerCase())}
  >
  {#if ui.search}
    <span class="search-count">{count}</span>
  {/if}
</div>

<style>
  .search {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    border: 1px solid var(--border);
    background: rgba(148, 163, 184, 0.08);
    border-radius: 10px;
    padding: 0 12px;
    height: 38px;
  }
  .search:focus-within { border-color: rgba(52, 211, 153, 0.45); }
  .search input[type="search"] {
    border: 0;
    background: transparent;
    color: var(--text);
    font: 500 13px "Inter", system-ui, sans-serif;
    width: 150px;
    outline: none;
  }
  .search input[type="search"]::placeholder { color: var(--muted); }
  .search-count {
    font-size: 11px;
    color: #d1fae5;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
</style>
