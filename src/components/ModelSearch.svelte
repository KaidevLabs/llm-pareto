<!--
  Comparator slot search (plan 025 D5, owner-amended 2026-09-19): the bare
  input inside the add slot — typeahead suggestions from the site-wide
  searchHit (010 D2) over the full joined set, already-picked models
  excluded, arrow-key selection (clamped), Enter picks, Escape clears,
  backspace on an empty query removes the last pick. The picked models
  themselves are the comparator's cards, so there are no chips here.
-->
<script lang="ts">
  import { data } from "../lib/data.svelte";
  import { searchHit } from "../lib/filters";
  import type { Row } from "../lib/types";

  let {
    ids,
    onadd,
    onremove,
  }: {
    ids: string[];
    onadd: (r: Row) => void;
    onremove: (id: string) => void;
  } = $props();

  let q = $state("");
  let open = $state(false);
  let active = $state(0);

  const hits = $derived(
    q
      ? data.rows
          .filter((r) => searchHit(r, q) && !ids.includes(r.or_id))
          .sort((x, y) => x.arena_rank - y.arena_rank)
          .slice(0, 8)
      : []
  );

  function pick(r: Row) {
    onadd(r);
    q = "";
    active = 0;
    // focus stays on the input after a pick — keep the dropdown available
    // for the next query (it stays hidden while the query is empty).
  }

  // Keyboard selection: arrows move the highlight (clamped, never typing
  // into the input), Enter picks it, Escape clears + closes, backspace on
  // an empty query removes the last pick.
  function onkeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      q = "";
      active = 0;
      open = false;
    } else if (e.key === "Backspace" && !q && ids.length) {
      onremove(ids[ids.length - 1]);
    } else if (e.key === "ArrowDown" && hits.length) {
      e.preventDefault();
      active = Math.min(active + 1, hits.length - 1);
    } else if (e.key === "ArrowUp" && hits.length) {
      e.preventDefault();
      active = Math.max(active - 1, 0);
    } else if (e.key === "Enter" && hits.length) {
      e.preventDefault();
      pick(hits[Math.min(active, hits.length - 1)]);
    }
  }
</script>

<div class="ms">
  <input
    type="text"
    placeholder="add model…"
    aria-label="search models to compare"
    autocomplete="off"
    spellcheck="false"
    bind:value={q}
    onfocus={() => (open = true)}
    onblur={() => (open = false)}
    oninput={() => (active = 0)}
    {onkeydown}
  >
  {#if open && q && hits.length}
    <ul>
      {#each hits as r, i (r.or_id)}
        <li>
          <button
            type="button"
            class:active={i === active}
            onmousedown={(e) => e.preventDefault()}
            onclick={() => pick(r)}
          >
            <span class="mn">#{r.arena_rank} {r.or_name}</span>
            <span class="mo">{r.arena_org}</span>
          </button>
        </li>
      {/each}
    </ul>
  {:else if open && q}
    <ul><li><span class="none">no models match “{q}”</span></li></ul>
  {/if}
</div>

<style>
  .ms {
    position: relative;
    display: flex;
    width: 100%;
  }
  .ms input {
    flex: 1;
    min-width: 0;
    border: 0;
    background: transparent;
    color: var(--text);
    /* the slot's title — the same size/weight as the card names */
    font: 600 14px "Inter", system-ui, sans-serif;
    outline: none;
    padding: 2px 0;
  }
  .ms:focus-within input { color: var(--accent); }
  .ms input::placeholder { color: var(--muted); }
  .ms ul {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    z-index: 30;
    margin: 0;
    padding: 4px;
    list-style: none;
    background: #0a0e16;
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: 0 14px 40px rgba(0, 0, 0, 0.5);
    width: max-content;
    min-width: 240px;
    max-width: 340px;
    max-height: 300px;
    overflow-y: auto;
  }
  .ms li button {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 6px 8px;
    border: 0;
    background: transparent;
    color: var(--text);
    font: 500 12px "Inter", system-ui, sans-serif;
    border-radius: 6px;
    cursor: pointer;
    text-align: left;
  }
  .ms li button:hover { background: rgba(148, 163, 184, 0.1); }
  .ms li button.active { background: rgba(52, 211, 153, 0.12); }
  .ms .mn { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ms .mo { color: var(--muted); font-size: 10px; white-space: nowrap; }
  .ms .none { display: block; padding: 8px; color: var(--muted); font-size: 12px; }
</style>