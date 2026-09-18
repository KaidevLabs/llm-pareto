<!--
  Step-1 host (028): scaffolding only — loads the data resources and mounts
  the reconciled drawer seed against the first model so the build exercises
  the whole seed path. Steps 2-4 replace this with the real panels.
-->
<script lang="ts">
  import { data, loadData } from "./lib/data.svelte";
  import Details from "./components/Details.svelte";

  $effect(() => {
    loadData();
  });
</script>

{#if data.error}
  <div class="fatal">
    Failed to load data ({data.error}). Run <code>python3 update.py</code> and commit <code>public/data/</code>.
  </div>
{:else if data.loaded}
  <div class="demo">
    {#if data.rows.length}
      <Details d={data.rows[0]} />
    {/if}
  </div>
{/if}

<style>
  .fatal {
    padding: 40px;
    color: var(--muted);
  }
  .demo {
    padding: 40px;
    max-width: 440px;
  }
</style>
