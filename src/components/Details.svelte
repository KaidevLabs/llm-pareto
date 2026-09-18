<!--
  Details drawer body (006/024) as a Svelte 5 component — the 021 B18
  round-2 sketch, reconciled against app.js detailsHTML + providersHTML +
  renderDetails:
  - esc() dropped from all interpolations: Svelte escapes text on its own
    (the sketch's esc() would double-escape).
  - the sketch's undefined `endpointsError` reference is the live
    ENDPOINTS_ERROR display.
  - the per-provider table's `ctx` column header is restored (the sketch
    rendered 7 cells under 6 headers).
  - the four bespoke vanilla conventions (PROV_SORT module state, delegated
    sort headers, the ENDPOINTS quadruple, the .then(renderDetails) settle
    guard) dissolve into component state, {onclick}, the shared endpoints
    store, and rune reactivity.
-->
<script lang="ts">
  import { fmtPrice, fmtVotes, fmtToks, fmtMs, median } from "../lib/format";
  import { orgOf } from "../lib/family";
  import { filterRows } from "../lib/filters";
  import { data, logoFor } from "../lib/data.svelte";
  import { ui } from "../lib/state.svelte";
  import { store, ensureEndpoints } from "../lib/endpoints.svelte";
  import type { Endpoint, Pct, Row } from "../lib/types";

  let { d }: { d: Row } = $props();

  // 024 D8: the Providers section renders once the shared lazy fetch
  // settles — the store updates and the {#if !store.done} branch re-renders.
  $effect(() => {
    ensureEndpoints();
  });

  let provSort = $state<{ key: "in" | "out" | "up" | "spd"; dir: number }>({
    key: "in",
    dir: 1,
  });

  const visible = $derived(
    filterRows(data.rows, ui).some((r) => r.or_id === d.or_id)
  );
  const eps: Endpoint[] = $derived(store.data?.[d.or_id] || []);
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

  const perM = (s: string | null | undefined) =>
    s == null ? null : parseFloat(s) * 1e6;
  const near = (a: number | null, b: number | null) =>
    a != null && b != null && Math.abs(a - b) < 1e-9;

  const use = $derived(
    eps.filter(
      (e) =>
        e.stats &&
        e.stats.p50_throughput > 0 &&
        (e.stats.request_count || 0) >= 30
    )
  );
  const basis = $derived(
    use.length
      ? "across " + use.length + (use.length > 1 ? " endpoints" : " endpoint") +
        " (rc≥30) · " +
        use.reduce((s, e) => s + (e.stats!.request_count || 0), 0) +
        " requests · " +
        (use[0].stats!.window_minutes || 30) +
        "-min window"
      : ""
  );
  const med = (p: Pct) =>
    use.length ? median(use.map((e) => e.stats![`${p}_throughput`])) : null;

  const sortVal = (e: Endpoint): number | null => {
    switch (provSort.key) {
      case "in": return perM((e.pricing || {}).prompt);
      case "out": return perM((e.pricing || {}).completion);
      case "up": return e.uptime_last_1d ?? null;
      default: return e.stats ? e.stats.p50_throughput : null;
    }
  };
  const rows = $derived(
    eps
      .map((e) => ({
        e,
        m:
          near(perM((e.pricing || {}).prompt), d.price_in_per_m) &&
          near(perM((e.pricing || {}).completion), d.price_out_per_m),
      }))
      .sort((a, b) => {
        const va = sortVal(a.e);
        const vb = sortVal(b.e);
        const na = va == null;
        const nb = vb == null;
        if (na || nb) return na && nb ? 0 : na ? 1 : -1;
        return (va - vb) * provSort.dir;
      })
  );
  const notes = $derived.by(() => {
    const n: { t: string; g?: boolean }[] = [];
    if (rows.some((r) => r.m))
      n.push({ t: "● chart price — the endpoint the chart point prices on", g: true });
    if (eps.length === 1) n.push({ t: "single provider" });
    if (!eps.some((e) => e.stats && e.stats.p50_throughput != null))
      n.push({ t: "no speed data (low traffic)" });
    if (d.match_method === "override")
      n.push({ t: "chart price is final — provider prices are reference", g: true });
    return n;
  });

  const PCTS: Pct[] = ["p50", "p75", "p90", "p95", "p99"];
  function th(key: "in" | "out" | "up" | "spd", label: string) {
    return { key, label, on: provSort.key === key, arr: provSort.dir === 1 ? "▲" : "▼" };
  }
  const heads = (["in", "out", "up", "spd"] as const).map((k) =>
    th(k, { in: "$/M in", out: "$/M out", up: "up 1d", spd: "tok/s" }[k])
  );
  function setSort(key: "in" | "out" | "up" | "spd") {
    provSort = { key, dir: provSort.key === key ? -provSort.dir : 1 };
  }
</script>

{#if !visible}
  <div class="dfilter">⚠ filtered out — hidden by the current filters</div>
{/if}

<div class="dhead">
  {#if logoFor(orgOf(d))}<img src={logoFor(orgOf(d))!} width="20" height="20" alt="">{/if}
  <span class="dname">{d.or_name}</span>
  <div class="did">{d.or_id}</div>
</div>

<div class="drow"><span class="k">arena</span>
  <span class="v">#{d.arena_rank} · elo {d.arena_elo.toFixed(1)}{ci} · {fmtVotes(d.arena_votes)} votes</span></div>
<div class="drow"><span class="k">openrouter $/m</span>
  <span class="v">{fmtPrice(d.price_in_per_m)} in · {fmtPrice(d.price_out_per_m)} out</span></div>
{#if d.arena_price_in_per_m != null || d.arena_price_out_per_m != null}
  <div class="drow"><span class="k">arena $/m (reported)</span>
    <span class="v dim">{fmtPrice(d.arena_price_in_per_m)} in · {fmtPrice(d.arena_price_out_per_m)} out</span></div>
{/if}
<div class="drow"><span class="k">context</span>
  <span class="v">{fmtVotes(d.context_length)}{d.arena_context_length != null && d.arena_context_length !== d.context_length ? " · arena: " + fmtVotes(d.arena_context_length) : ""}</span></div>
<div class="drow"><span class="k">org</span>
  <span class="v">{orgOf(d)}{d.arena_license ? " · " + d.arena_license : ""}{d.vision ? " · ✨ vision" : ""}</span></div>
{#if d.arena_variants && d.arena_variants.length}
  <div class="drow"><span class="k">variants</span><span class="v">{d.arena_variants.join(" · ")}</span></div>
{/if}
<div class="drow"><span class="k">match</span>
  <span class="v{d.match_method === 'override' ? ' gold' : ''}">{match}</span></div>

<div class="dlinks">
  <a href="https://openrouter.ai/{d.or_id}" target="_blank" rel="noopener">OpenRouter page ↗</a>
  {#if d.arena_model_url}<a href={d.arena_model_url} target="_blank" rel="noopener">arena model page ↗</a>{/if}
</div>

<div class="dsec">Providers</div>
{#if !store.done}
  <div class="dnote">—</div>
{:else if store.data == null}
  <div class="dnote">provider data unavailable{store.error ? " (" + store.error + ")" : ""}</div>
{:else if !eps.length}
  <div class="dnote">no provider data for this model</div>
{:else}
  <table class="ptable psum">
    <thead><tr><th class="pl"></th>{#each PCTS as p}<th>{p}</th>{/each}</tr></thead>
    <tbody>
      <tr><td class="pl">speed tok/s</td>{#each PCTS as p}<td>{fmtToks(med(p))}</td>{/each}</tr>
      <tr><td class="pl">latency</td>{#each PCTS as p}<td>{fmtMs(med(p))}</td>{/each}</tr>
      <tr><td class="pl">price $/M</td><td colspan="5">
        <span class="ink">{fmtPrice(d.price_in_per_m)}</span> in · <span class="outk">{fmtPrice(d.price_out_per_m)}</span> out</td></tr>
      <tr><td class="pl">context</td><td colspan="5">{fmtVotes(d.context_length)}</td></tr>
    </tbody>
  </table>
  {#if basis}<div class="dnote">{basis}</div>{/if}

  <div class="dsub">per provider</div>
  <table class="ptable epts">
    <thead><tr><th class="pl">provider</th><th>quant</th>
      {#each heads as h}
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
        <th data-sort={h.key} onclick={() => setSort(h.key)}>
          {h.label}{#if h.on} <span class="arr">{h.arr}</span>{/if}</th>
      {/each}
      <th>ctx</th>
    </tr></thead>
    <tbody>
      {#each rows as { e, m } (e.provider + (e.tag || ""))}
        <tr class:pmarked={m}>
          <td class="pl"><div>{#if m}<span class="pmark">●</span> {/if}{e.provider}</div>
            {#if e.tag}<div class="ptag">{e.tag}</div>{/if}</td>
          <td>{e.quantization ?? "—"}</td>
          <td>{fmtPrice(perM((e.pricing || {}).prompt))}</td>
          <td>{fmtPrice(perM((e.pricing || {}).completion))}</td>
          <td>{fmtVotes(e.context_length ?? null)}</td>
          <td>{e.uptime_last_1d == null ? "—" : e.uptime_last_1d + "%"}</td>
          <td>{fmtToks(e.stats?.p50_throughput)}</td>
        </tr>
      {/each}
    </tbody>
  </table>
  {#each notes as n}<div class="dnote{n.g ? " gold" : ""}">{n.t}</div>{/each}
{/if}

<style>
  /* Drawer styles ported verbatim from public/index.html (they belong to
     this component since 028 step 1; the shell .drawer box stays with the
     app shell until step 4). */
  .dhead { padding-right: 26px; margin-bottom: 12px; }
  .dhead img { vertical-align: -4px; margin-right: 6px; border-radius: 3px; }
  .dname { font-weight: 600; font-size: 14px; }
  .did { color: var(--muted); font-size: 11px; margin-top: 3px; }
  .dfilter {
    color: #f59e0b;
    font-size: 11px;
    margin-bottom: 8px;
    border: 1px solid rgba(245, 158, 11, 0.3);
    background: rgba(245, 158, 11, 0.08);
    border-radius: 8px;
    padding: 4px 8px;
  }
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
  /* Providers section (plan 024): the model's OpenRouter endpoints as a
     tight table — provider (+ tag), quantization, $/M in, $/M out, context,
     uptime 1 d, speed p50 tok/s. */
  .dsec {
    margin-top: 18px;
    padding-top: 12px;
    border-top: 1px solid rgba(148, 163, 184, 0.08);
    color: var(--muted);
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  /* per-provider sublabel under the D9 summary block */
  .dsub {
    margin-top: 12px;
    color: var(--muted);
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .ptable {
    width: 100%;
    border-collapse: collapse;
    margin-top: 8px;
    font-size: 11px;
  }
  .ptable th {
    color: var(--muted);
    font-weight: 500;
    text-align: right;
    padding: 2px 4px 8px;
    white-space: nowrap;
  }
  .ptable th.pl { text-align: left; }
  .ptable th[data-sort] { cursor: pointer; }
  .ptable th[data-sort]:hover { color: var(--text); }
  .ptable th .arr { font-size: 9px; }
  .ptable td {
    padding: 6px 4px;
    border-top: 1px solid rgba(148, 163, 184, 0.08);
    text-align: right;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    vertical-align: top;
  }
  .ptable td.pl { text-align: left; white-space: normal; }
  .ptable td.pl > div { font-size: 12px; white-space: nowrap; }
  .ptable .ptag { color: var(--muted); font-size: 10px; }
  .ptable .pmark { color: var(--gold); font-size: 9px; position: relative; top: -1px; }
  /* chart-price rows: gold left rail (all rows carry a transparent one so
     the rail doesn't shift the column) */
  .ptable.epts td:first-child { border-left: 2px solid transparent; }
  .ptable.epts tr.pmarked > td:first-child { border-left-color: var(--gold); }
  /* D9 summary color hints: the p50 column is the plotted value (accent),
     row labels follow the site's existing encoding — speed = accent,
     latency = warm, price = input blue / output amber (.ink/.outk). */
  .psum td.pl { color: var(--muted); }
  .psum thead th:nth-child(2) { color: var(--accent); }
  .psum tbody tr:nth-child(1) td.pl { color: var(--accent); }
  .psum tbody tr:nth-child(2) td.pl { color: #f59e0b; }
  .psum tbody tr:nth-child(3) td.pl { color: var(--text); }
  .psum tbody tr:nth-child(-n+2) td:nth-child(2) { background: var(--accent-dim); }
  .dnote { color: var(--muted); font-size: 11px; margin-top: 8px; }
  .dnote.gold { color: var(--gold); }
  .ink { color: #60a5fa; }
  .outk { color: #f59e0b; }
</style>
