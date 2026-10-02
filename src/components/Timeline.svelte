<!--
  The timeline dock (043 step 03): the orthogonal time control over any
  surface — a scrubber across the snapshot history plus the playback
  transport (play/pause, frame rate, exit to live). Plain DOM + the
  snapshots store: the store owns all state (A3's in-memory half), this
  component owns the chrome. Hidden with no loaded index (fresh clone /
  failed index → no playback offer, the page is unaffected).
-->
<script lang="ts">
  import {
    snapIndex,
    playback,
    enterTime,
    play,
    pause,
    exit,
    frameInfo,
  } from "../lib/snapshots.svelte";
  import { fmtStamp, tsDay, tsMonth } from "../lib/format";

  const n = $derived(snapIndex.entries.length);

  // Slider position: a local rune, not a bind to playback.i — a drag
  // updates it at once while the frame load is in flight, and the store
  // catches up when it lands. The effect follows external moves (the
  // ticker's steps, an exit back to live, where the slider parks at the
  // newest frame — live sits past the last snapshot).
  let pos = $state(n - 1);
  $effect(() => {
    const i = playback.i;
    pos = playback.active ? i : snapIndex.entries.length - 1;
  });

  // Sparse tick labels (043 step 03's rule): first/last frames + the
  // month-boundary marks; a boundary at the last frame yields to the
  // last frame's own label (day+time is the more informative one).
  const ticks = $derived.by(() => {
    const es = snapIndex.entries;
    if (!es.length) return [] as { i: number; label: string }[];
    const out: { i: number; label: string }[] = [];
    let last = tsMonth(es[0].ts);
    for (let i = 1; i < es.length; i++) {
      const m = tsMonth(es[i].ts);
      if (m !== last) {
        out.push({ i, label: m });
        last = m;
      }
    }
    for (const t of [
      { i: 0, label: tsDay(es[0].ts) },
      { i: es.length - 1, label: tsDay(es[es.length - 1].ts) },
    ]) {
      const j = out.findIndex((o) => o.i === t.i);
      if (j >= 0) out[j] = t;
      else out.push(t);
    }
    out.sort((a, b) => a.i - b.i);
    return out;
  });

  const pct = (i: number) => (n > 1 ? (i / (n - 1)) * 100 : 0);

  // Frame readout (043 step 03): the shown frame's ts + the join counts
  // from ITS meta — the frame is the data, so its own meta is the truth
  // (the live header stamp shows the live meta). The entry/exit delta
  // against the previous frame joins in step 04.
  const info = $derived(frameInfo());
  const readout = $derived(
    info
      ? "⏱ " + fmtStamp(info.ts) +
        " · " + info.meta.join.combined + " joined · " +
        (info.meta.join.unmatched_arena + info.meta.join.unmatched_openrouter) +
        " unmatched"
      : "live · " + n + " snapshots"
  );

  // Scrub (043 step 03): a drag updates the slider at once, pauses a
  // running playback (dragging while playing pauses — the spec), and takes
  // the store's entry path (pin + frame). The frame load is in flight for
  // a moment; the sync effect above re-aligns pos when it lands.
  function onScrub(e: Event) {
    const i = Number((e.target as HTMLInputElement).value);
    pos = i;
    if (playback.playing) pause();
    void enterTime(i);
  }

  // Play/pause (043 step 03): from live, play() starts at frame 0 (the
  // store's rule); mid-playback it resumes from the current frame.
  function onPlay() {
    if (playback.playing) pause();
    else void play();
  }

  // Frame-rate toggle (043 step 03): cycles 0.5× → 1× → 2× → 0.5×. The
  // ticker reads the rate at play start, so a change applies from the
  // next play (the store's rule).
  function cycleFps() {
    playback.fps =
      playback.fps === 0.5 ? 1 : playback.fps === 1 ? 2 : 0.5;
  }
</script>

{#if n > 0}
  <div class="timeline">
    <div class="tl-row">
      <button class="tl-btn" title="Play the snapshot history" onclick={onPlay}>{playback.playing ? "⏸ Pause" : "▶︎ Play"}</button>
      <button class="tl-btn" title="Frame rate (cycles 0.5× / 1× / 2×) — applies from the next play" onclick={cycleFps}>{playback.fps}×</button>
      {#if playback.active}
        <button class="tl-btn tl-live" title="Back to the live data" onclick={() => exit()}>● live</button>
      {/if}
      <span class="tl-readout" role="status">{readout}</span>
    </div>
    <div class="tl-scrub">
      <input
        type="range"
        min="0"
        max={n - 1}
        step="1"
        value={pos}
        aria-label="snapshot position"
        oninput={onScrub}
      />
      <div class="tl-ticks">
        {#each ticks as t (t.i + ":" + t.label)}
          <span
            class="tl-tick"
            class:tl-first={t.i === 0}
            class:tl-last={t.i === n - 1}
            style="left: {pct(t.i)}%"
          >{t.label}</span>
        {/each}
      </div>
    </div>
  </div>
{/if}

<style>
  .timeline {
    display: flex;
    flex-direction: column;
    gap: 2px;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 10px 16px 12px;
  }
  .tl-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .tl-btn {
    border: 1px solid var(--border);
    border-radius: 8px;
    background: transparent;
    color: var(--muted);
    font: 500 12px "Inter", system-ui, sans-serif;
    padding: 4px 10px;
    cursor: pointer;
    letter-spacing: 0.02em;
  }
  .tl-btn:hover { color: var(--text); }
  /* The exit pill takes the History pill's active state (043 step 03). */
  .tl-live {
    background: var(--accent-dim);
    color: #d1fae5;
    box-shadow: inset 0 0 0 1px rgba(52, 211, 153, 0.35);
  }
  .tl-readout {
    margin-left: auto;
    font-size: 11px;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .tl-scrub {
    position: relative;
    padding-top: 6px;
  }
  .tl-scrub input[type="range"] {
    display: block;
    width: 100%;
    margin: 0;
    accent-color: var(--accent);
    cursor: pointer;
  }
  .tl-ticks {
    position: relative;
    height: 14px;
  }
  .tl-tick {
    position: absolute;
    top: 0;
    transform: translateX(-50%);
    font-size: 10px;
    color: var(--muted);
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  .tl-tick.tl-first { left: 0 !important; transform: none; }
  .tl-tick.tl-last { left: 100% !important; transform: translateX(-100%); }
</style>
