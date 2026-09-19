<!--
  The model card: head, attribute rows, links — the body the bubble-click
  drawer shows (006/024 lineage). Shared by the drawer (Details adds the
  Providers section) and the comparator columns (plan 025, card-only),
  which pass the comparison marks (winner green / loser orange / tie blue
  on the attribute values, 2026-09-19 owner directive) and the endpoints
  speed p50. The optional compare fast-access sends the model to the
  comparator section.

  aligned (comparator only): the fixed canonical row set without in-card
  labels — the comparator's shared title rail owns them, so the card shows
  values only, at fixed row heights (--row-h etc.) that match the rail.
  Missing values render "--"; the variants/match join diagnostics stay
  drawer-only (plan 025 D2). Optional fast-accesses: the × takes the model
  out of the comparator; the expand chip opens the full model card (the
  drawer) for the rest of the info — providers, variants, match.
-->
<script lang="ts">
  import { fmtPrice, fmtVotes, fmtToks } from "../lib/format";
  import { orgOf } from "../lib/family";
  import { logoFor } from "../lib/data.svelte";
  import type { Row } from "../lib/types";
  import type { Marks, MetricKey } from "../lib/comparator";

  let {
    d,
    oncompare,
    onremove,
    onopen,
    marks,
    speed,
    aligned,
  }: {
    d: Row;
    oncompare?: () => void;
    onremove?: () => void;
    onopen?: () => void;
    marks?: Marks;
    speed?: { toks: number } | null;
    aligned?: boolean;
  } = $props();

  // Winner color for one metric segment; "" renders unstyled.
  const mcol = (k: MetricKey): string =>
    marks?.[k] === "win"
      ? "var(--accent)"
      : marks?.[k] === "lose"
        ? "var(--lose)"
        : marks?.[k] === "tie"
          ? "var(--tie)"
          : "";

  const ci = $derived(
    d.arena_elo_upper != null && d.arena_elo != null
      ? " (±" + Math.round(d.arena_elo_upper - d.arena_elo) + ")"
      : ""
  );
  const match = $derived(
    d.match_method === "override"
      ? "⚑ manual override — identity fixed by owner decision, price final"
      : d.match_method +
        (d.match_ratio ? " (similarity " + d.match_ratio + ")" : "")
  );
</script>

<div class="card" class:aligned={aligned}>
  <div class="dhead">
    {#if logoFor(orgOf(d))}<img src={logoFor(orgOf(d))!} width="20" height="20" alt="">{/if}
    <span class="dname">{d.or_name}</span>
    <div class="did">{d.or_id}</div>
  </div>

  <div class="drow">{#if !aligned}<span class="k">arena</span>{/if}
    <span class="v">#{d.arena_rank} · elo <span style:color={mcol("elo")}>{d.arena_elo.toFixed(1)}{ci}</span> · <span style:color={mcol("votes")}>{fmtVotes(d.arena_votes)} votes</span></span></div>
  <div class="drow">{#if !aligned}<span class="k">openrouter $/m</span>{/if}
    <span class="v"><span style:color={mcol("price_in")}>{fmtPrice(d.price_in_per_m)}</span> in · <span style:color={mcol("price_out")}>{fmtPrice(d.price_out_per_m)}</span> out</span></div>
  {#if aligned || d.arena_price_in_per_m != null || d.arena_price_out_per_m != null}
    <div class="drow">{#if !aligned}<span class="k">arena $/m (reported)</span>{/if}
      {#if aligned && d.arena_price_in_per_m == null && d.arena_price_out_per_m == null}
        <span class="v dim">--</span>
      {:else}
        <span class="v dim">{fmtPrice(d.arena_price_in_per_m)} in · {fmtPrice(d.arena_price_out_per_m)} out</span>
      {/if}</div>
  {/if}
  {#if aligned || speed}
    <div class="drow">{#if !aligned}<span class="k">speed</span>{/if}
      {#if speed}
        <span class="v"><span style:color={mcol("speed")}>{fmtToks(speed.toks)} tok/s p50</span></span>
      {:else}
        <span class="v dim">--</span>
      {/if}</div>
  {/if}
  <div class="drow">{#if !aligned}<span class="k">context</span>{/if}
    <span class="v"><span style:color={mcol("context")}>{fmtVotes(d.context_length)}</span>{d.arena_context_length != null && d.arena_context_length !== d.context_length ? " · arena: " + fmtVotes(d.arena_context_length) : ""}</span></div>
  <div class="drow">{#if !aligned}<span class="k">org</span>{/if}
    <span class="v">{orgOf(d)}{d.arena_license ? " · " + d.arena_license : ""}{#if d.vision}<span style:color={mcol("vision")}> · ✨ vision</span>{/if}</span></div>
  {#if !aligned && d.arena_variants && d.arena_variants.length}
    <div class="drow"><span class="k">variants</span><span class="v">{d.arena_variants.join(" · ")}</span></div>
  {/if}
  {#if !aligned}
    <div class="drow"><span class="k">match</span>
      <span class="v{d.match_method === 'override' ? ' gold' : ''}">{match}</span></div>
  {/if}

  <div class="dlinks">
    <a href="https://openrouter.ai/{d.or_id}" target="_blank" rel="noopener">OpenRouter page ↗</a>
    {#if d.arena_model_url}<a href={d.arena_model_url} target="_blank" rel="noopener">arena model page ↗</a>{/if}
  </div>

  {#if onopen || onremove}
    <div class="acts">
      {#if onopen}
        <button class="info" aria-label={"full model card: " + d.or_name} title="full model card — providers, variants, links" onclick={onopen}>
          <svg width="11" height="11" viewBox="0 0 10 10" aria-hidden="true">
            <path d="M6 1 h3 v3 M9 1 L5.8 4.2 M4 9 H1 V6 M1 9 L4.2 5.8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" fill="none" />
          </svg>
        </button>
      {/if}
      {#if onremove}
        <button class="x" aria-label={"remove " + d.or_name} title={"remove " + d.or_name} onclick={onremove}>
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <path d="M1.5 1.5 L8.5 8.5 M8.5 1.5 L1.5 8.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none" />
          </svg>
        </button>
      {/if}
    </div>
  {/if}
  {#if oncompare}
    <button class="cmpbtn" onclick={oncompare}>◈ compare</button>
  {/if}
</div>

<style>
  .card { min-width: 0; }
  .dhead { padding-right: 26px; margin-bottom: 12px; }
  .dhead img { vertical-align: -4px; margin-right: 6px; border-radius: 3px; }
  .dname { font-weight: 600; font-size: 14px; }
  .did { color: var(--muted); font-size: 11px; margin-top: 3px; }
  .drow {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 0;
    border-top: 1px solid rgba(148, 163, 184, 0.08);
    font-size: 12px;
  }
  .drow .k { color: var(--muted); flex-shrink: 0; }
  .drow .v { text-align: right; font-variant-numeric: tabular-nums; }
  .drow .v.dim { color: var(--muted); }
  .drow .v.gold { color: var(--gold); }
  .dlinks {
    display: flex;
    gap: 14px;
    margin-top: 14px;
    font-size: 12px;
  }
  .dlinks a {
    color: var(--text);
    text-decoration: none;
    border-bottom: 1px solid var(--border);
  }
  .dlinks a:hover { border-bottom-color: var(--accent); }
  .cmpbtn {
    margin-top: 14px;
    border: 1px solid rgba(52, 211, 153, 0.35);
    background: var(--accent);
    color: #06281f;
    font: 600 12px "Inter", system-ui, sans-serif;
    padding: 7px 14px;
    border-radius: 8px;
    cursor: pointer;
  }
  .cmpbtn:hover { background: #4be0a8; }

  /* aligned (comparator): fixed row heights so the shared title rail lines
     up row-for-row; labels live on the rail, values only here. */
  .card.aligned .dhead {
    height: var(--head-block);
    margin-bottom: 0;
    padding-right: 64px;
  }
  .card.aligned .dhead .dname,
  .card.aligned .dhead .did {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .card.aligned .drow {
    height: var(--row-h);
    align-items: center;
    padding: 0;
    white-space: nowrap;
  }
  .card.aligned .drow .v {
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
    flex: 1;
  }
  .card.aligned .dlinks {
    height: var(--links-block);
    margin-top: 0;
    padding-top: 12px;
    white-space: nowrap;
  }
  .acts {
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 2;
    display: flex;
    gap: 6px;
  }
  .acts button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border: 1px solid var(--border);
    background: rgba(148, 163, 184, 0.08);
    color: var(--muted);
    border-radius: 7px;
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s, background 0.15s;
  }
  .x:hover { color: var(--lose); border-color: rgba(251, 146, 60, 0.4); background: rgba(251, 146, 60, 0.1); }
  .info:hover { color: var(--accent); border-color: rgba(52, 211, 153, 0.4); background: rgba(52, 211, 153, 0.1); }
</style>