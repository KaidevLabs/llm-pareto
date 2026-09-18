<script lang="ts">
  import { SvelteSet } from "svelte/reactivity";
  import Pill from "./Pill.svelte";
  import { ui } from "../lib/state.svelte";
  import { data, logoFor } from "../lib/data.svelte";
  import { orgOf, familyOf } from "../lib/family";

  // Org/family accordion panel (plan 004 D3): multi-select tree — a leaf is
  // "org|family"; an org row toggles all its children (union semantics, no
  // exclusions); the searcher filters tree nodes only (model search is 010's).
  // The vanilla DOM-construction port (buildOfPanel/toggleOf*/applyOfSearch/
  // updateOfPanel) becomes derived data + class bindings with the same
  // semantics; expansion and the query survive toggling (component state,
  // the panel never unmounts).
  let open = $state(false);
  let q = $state("");
  let expanded = $state(new SvelteSet<string>());
  let wrap: HTMLElement;
  let qEl = $state<HTMLInputElement>();

  const per = $derived.by(() => {
    const per: Record<string, Record<string, number>> = {};
    for (const d of data.rows) {
      const o = orgOf(d);
      const f = familyOf(d);
      (per[o] ??= {})[f] = (per[o][f] || 0) + 1;
    }
    return per;
  });
  // org display order = frequency order (buildOrgColors' insertion order)
  const orgs = $derived(Object.keys(data.orgColor).filter((o) => per[o]));
  const qq = $derived(q.trim().toLowerCase());
  // the badge counts models in the selected families (live updateOfPanel)
  const models = $derived.by(() => {
    let n = 0;
    for (const [o, fams] of Object.entries(per)) {
      for (const [f, n2] of Object.entries(fams)) {
        if (ui.families.has(o + "|" + f)) n += n2;
      }
    }
    return n;
  });

  function toggleLeaf(key: string) {
    if (ui.families.has(key)) ui.families.delete(key);
    else ui.families.add(key);
  }
  function toggleOpen(o: string) {
    if (expanded.has(o)) expanded.delete(o);
    else expanded.add(o);
  }
  function toggleOrg(o: string) {
    const keys = Object.keys(per[o] || {}).map((f) => o + "|" + f);
    const all = keys.every((k) => ui.families.has(k));
    for (const k of keys) {
      if (all) ui.families.delete(k);
      else ui.families.add(k);
    }
  }
  function rowKey(e: KeyboardEvent, fn: () => void) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fn();
    }
  }

  $effect(() => {
    if (open) qEl?.focus();
  });
</script>

<svelte:window
  onclick={(e) => {
    if (open && wrap && !wrap.contains(e.target as Node)) open = false;
  }}
  onkeydown={(e) => {
    if (e.key !== "Escape" || !open) return;
    // live applyOfSearch escape: first Esc clears the query, second closes
    if (document.activeElement === qEl && q) {
      q = "";
      return;
    }
    open = false;
  }}
/>

<div class="ofwrap" bind:this={wrap}>
  <Pill
    on={open}
    title="Filter by organization and model family"
    onclick={() => (open = !open)}
    aria-expanded={open}
    aria-controls="of-panel"
  >
    <span class="diamond">◆</span> orgs &amp; families<span
      class="ofbadge"
      class:hidden={!models}>{models || ""}</span
    >
  </Pill>
  {#if open}
    <div class="ofpanel" id="of-panel">
      <input
        type="search"
        class="ofsearch"
        placeholder="Filter orgs & families…"
        aria-label="filter orgs and families"
        bind:value={q}
        bind:this={qEl}
      >
      <div id="of-tree">
        {#each orgs as o (o)}
          {@const fams = per[o]}
          {@const famList = Object.entries(fams).sort(
            (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
          )}
          {@const total = famList.reduce((s, [, n]) => s + n, 0)}
          {@const orgHit = !qq || o.toLowerCase().includes(qq)}
          {@const kidHits = famList.filter(
            ([f]) => orgHit || f.toLowerCase().includes(qq)
          ).length}
          {@const kidsOpen = qq ? kidHits > 0 : expanded.has(o)}
          {@const onCount = famList.filter(([f]) =>
            ui.families.has(o + "|" + f)
          ).length}
          {@const full = famList.length > 0 && onCount === famList.length}
          <div
            class="oforg"
            class:on={full}
            class:part={onCount > 0 && !full}
            hidden={qq ? !(orgHit || kidHits) : false}
            role="button"
            tabindex="0"
            onclick={() => toggleOrg(o)}
            onkeydown={(e) => rowKey(e, () => toggleOrg(o))}
          >
            <button
              class="ofchev"
              class:open={kidsOpen}
              aria-label="expand {o}"
              onclick={(e) => {
                e.stopPropagation();
                toggleOpen(o);
              }}
            >▸</button>
            {#if logoFor(o)}<img src={logoFor(o)!} width="16" height="16" alt="">{/if}
            <span class="ofname">{o}</span>
            <span class="ofcount">{total}</span>
            <span class="ofchip">{full ? "on" : onCount > 0 ? "part" : ""}</span>
          </div>
          <div class="offams" class:hidden={!kidsOpen}>
            {#each famList as [f, n] (o + "|" + f)}
              {@const key = o + "|" + f}
              {@const on = ui.families.has(key)}
              <div
                class="offam"
                class:on={on}
                hidden={qq ? !(orgHit || f.toLowerCase().includes(qq)) : false}
                role="button"
                tabindex="0"
                onclick={() => toggleLeaf(key)}
                onkeydown={(e) => rowKey(e, () => toggleLeaf(key))}
              >
                <span class="ofname">{f}</span>
                <span class="ofcount">{n}</span>
                <span class="ofchip">{on ? "on" : ""}</span>
              </div>
            {/each}
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .ofwrap { position: relative; }
  .ofbadge {
    margin-left: 6px;
    font-size: 11px;
    font-variant-numeric: tabular-nums;
    color: #d1fae5;
  }
  .ofpanel {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    z-index: 30;
    width: 340px;
    max-height: 62vh;
    overflow-y: auto;
    background: #0a0e16;
    border: 1px solid var(--border);
    border-radius: 14px;
    box-shadow: 0 18px 50px rgba(0, 0, 0, 0.5);
    padding: 10px;
  }
  .ofsearch {
    width: 100%;
    margin-bottom: 8px;
    border: 1px solid var(--border);
    background: rgba(148, 163, 184, 0.08);
    color: var(--text);
    font: 500 13px "Inter", system-ui, sans-serif;
    padding: 8px 10px;
    border-radius: 8px;
    outline: none;
  }
  .ofsearch::placeholder { color: var(--muted); }
  .ofsearch:focus { border-color: rgba(52, 211, 153, 0.45); }
  .oforg, .offam {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 13px;
    color: var(--muted);
    user-select: none;
  }
  .oforg:hover, .offam:hover { background: rgba(148, 163, 184, 0.08); color: var(--text); }
  .offam { margin-left: 24px; font-size: 12px; }
  .ofchev {
    border: 0;
    background: transparent;
    color: var(--muted);
    width: 18px;
    padding: 0;
    cursor: pointer;
    font-size: 10px;
    line-height: 1;
    transition: transform 0.15s;
  }
  .ofchev.open { transform: rotate(90deg); }
  .ofname { flex: 1; }
  .ofcount { font-size: 11px; color: var(--muted); font-variant-numeric: tabular-nums; }
  .ofchip {
    font-size: 10px;
    letter-spacing: 0.04em;
    color: var(--muted);
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 1px 7px;
  }
  .oforg.on, .offam.on { color: #d1fae5; background: var(--accent-dim); }
  .oforg.on .ofchip, .offam.on .ofchip, .oforg.part .ofchip { color: var(--accent); }
  .oforg.part { color: #a7f3d0; }
  .oforg img { border-radius: 3px; }
</style>
