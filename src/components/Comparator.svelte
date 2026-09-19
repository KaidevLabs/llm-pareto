<!--
  Model comparator (plan 025): a panel section below the chart (D1).
  A slot matrix (owner-amended 2026-09-19): up to CMP_MAX picked models as
  shared model cards (providers section off, D2 join diagnostics out) plus
  one dashed add slot holding the search input — gone when 4 slots are
  filled. Each card carries a × (removals close the gap); the shared title
  rail labels every band (4-up desktop / 2-up tablet / 1-up mobile), with
  the comparison marks colored on the cards' own value rows (winner green
  / loser orange / tie blue). Speed joins via the 022 endpoints p50.
  In-memory only (D6 — no URL, no storage); the empty list resolves to the
  top-2 pre-seed by arena rank.
-->
<script lang="ts">
  import { data } from "../lib/data.svelte";
  import { ui } from "../lib/state.svelte";
  import { buildMarks, resolvedCmps, band, CMP_MAX } from "../lib/comparator";
  import { speedOf } from "../lib/speed";
  import { store } from "../lib/endpoints.svelte";
  import ModelCard from "./ModelCard.svelte";
  import ModelSearch from "./ModelSearch.svelte";
  import { flip } from "svelte/animate";
  import { fade, fly } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import type { Row } from "../lib/types";

  // D5: the picker searches the full joined set — the current filters
  // don't scope the comparator. The empty list resolves to the top-2
  // pre-seed (data loads async, so the store starts empty); the first
  // add/remove materializes the picks.
  const ids = $derived(resolvedCmps(ui.cmps, data.rows));
  const picked = $derived(
    ids
      .map((id) => data.rows.find((r) => r.or_id === id))
      .filter((r) => r != null)
  );

  const add = (r: Row) => {
    if (ui.cmps.includes(r.or_id) || ids.length >= CMP_MAX) return;
    ui.cmps = [...ids, r.or_id];
  };
  const remove = (id: string) => {
    ui.cmps = ids.filter((x) => x !== id);
  };

  // Slot matrix: the picked cards plus one add slot (null) until the cap.
  // Bands of `per` slots each carry their own title rail (4/2/1 by
  // viewport width, tracked via the window binding).
  let vw = $state(1024);
  const per = $derived(vw >= 1024 ? 4 : vw >= 601 ? 2 : 1);
  const cells = $derived(
    picked.map((r, i) => ({ r, i })).concat(picked.length < CMP_MAX ? [null] : [])
  );
  const bands = $derived(band(cells, per));

  // Speed p50 medians (023 D2 rule) from the shared endpoints store; the
  // speed row stays out until the lazy fetch settles.
  const speeds = $derived(picked.map((r) => (store.done ? speedOf(r.or_id, store.data) : null)));
  const marks = $derived(picked.length >= 2 ? buildMarks(picked, speeds) : {});
</script>

<svelte:window bind:innerWidth={vw} />

{#if picked.length}
  <section class="cmp" id="compare" aria-label="model comparator">
    <div class="cmp-head">
      <h2>Compare</h2>
      <span class="hint">up to {CMP_MAX} — search in the dashed slot, × removes</span>
    </div>

    <div class="stack">
      {#each bands as cells2, bi (bi)}
        <div class="band">
          <div class="rail" aria-hidden="true">
            <div class="rs"></div>
            <div class="rt">arena</div>
            <div class="rt">openrouter $/m</div>
            <div class="rt">arena $/m (reported)</div>
            <div class="rt">speed</div>
            <div class="rt">context</div>
            <div class="rt">org</div>
            <div class="rl"></div>
          </div>
          {#each cells2 as c, ci (c ? c.r.or_id : "add")}
            <!-- one root per slot: flip slides survivors (the add pair
                 moves right on pick, cards close the gap on removal),
                 new slots rise in, removed ones fade -->
            <div
              class="slot {c ? "is-card" : "is-add"}"
              animate:flip={{ duration: 240, easing: cubicOut }}
              in:fly={{ y: 14, duration: 240, easing: cubicOut }}
              out:fade={{ duration: 160 }}
            >
              {#if c}
                <ModelCard
                  d={c.r}
                  marks={marks[c.r.or_id]}
                  speed={speeds[c.i]}
                  aligned
                  onremove={() => remove(c.r.or_id)}
                />
              {:else}
                <div class="sk-title"><ModelSearch {ids} onadd={add} onremove={remove} /></div>
                <div class="sk-card">
                  <div class="sk-row"><span style="width:72%"></span></div>
                  <div class="sk-row"><span style="width:55%"></span></div>
                  <div class="sk-row"><span style="width:64%"></span></div>
                  <div class="sk-row"><span style="width:48%"></span></div>
                  <div class="sk-row"><span style="width:58%"></span></div>
                  <div class="sk-row"><span style="width:66%"></span></div>
                  <div class="sk-links"><span style="width:80%"></span></div>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/each}
    </div>
  </section>
{/if}

<style>
  .cmp {
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 12px 16px 14px;
    width: 100%;
    min-width: 0;
    overflow-x: auto;
    scroll-margin-top: 12px;
  }
  .cmp-head {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }
  .cmp-head h2 {
    margin: 0;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .cmp-head .hint { color: var(--muted); font-size: 11px; }

  .stack {
    display: flex;
    flex-direction: column;
    gap: 24px;
    margin-top: 12px;
  }
  .band {
    display: flex;
    align-items: stretch;
    gap: 16px;
    /* fixed-width slots; the whole rail+cards block hugs the right
       (max-content + auto margin — never justify-end, which would clip
       the left cards when the band overflows) */
    width: max-content;
    max-width: 100%;
    margin-left: auto;
  }
  .rail {
    flex: 0 0 118px;
    min-width: 0;
    padding-top: 1px;
  }
  .rail .rs { height: var(--head-block); }
  .rail .rt {
    height: var(--row-h);
    display: flex;
    align-items: center;
    justify-content: flex-end;
    text-align: right;
    color: var(--muted);
    font-size: 11px;
  }
  .rail .rl { height: var(--links-block); }
  .slot {
    flex: 0 0 var(--card-w);
    width: var(--card-w);
    min-width: 0;
    position: relative;
  }
  .is-card {
    max-height: var(--chart-h);
    overflow-y: auto;
  }
  .is-add { display: flex; flex-direction: column; }
  /* the empty slot: two separated elements — the input as the slot's
     title (normal title size) and the skeleton card below it; picking a
     model replaces both with the full card (flip-animated rightward) */
  .sk-title {
    height: var(--head-block);
    display: flex;
    align-items: center;
    padding: 0 12px;
  }
  .sk-card {
    flex: 1;
    display: flex;
    flex-direction: column;
  }
  .sk-row {
    height: var(--row-h);
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding: 0 10px;
  }
  .sk-row span,
  .sk-links span {
    height: 10px;
    border-radius: 5px;
    background: rgba(148, 163, 184, 0.12);
    animation: skpulse 1.6s ease-in-out infinite;
  }
  .sk-links {
    height: var(--links-block);
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding: 12px 10px 0;
  }
  @keyframes skpulse {
    0%, 100% { opacity: 0.45; }
    50% { opacity: 0.9; }
  }
</style>