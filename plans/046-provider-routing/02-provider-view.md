# Step 02 — Site-wide provider view + OpenCode export — OPEN

## Spec

Front end (`src/`) + tests:

1. **Pure module** `src/lib/routing.ts` (+ `routing.test.ts`): from `EndpointsMap` (store `endpoints.svelte.ts`) apply filters → rows; and `exportBlock(selection, quants) -> string` generating the OpenCode `providers.openrouter.models` block (per model: `body.provider.order` = matching tags sorted by price, `quantizations` = selected, `allow_fallbacks: false`). No hardcoded policy: the view decides (proposed defaults: quant=fp8, ZDR on, sort by blended in+out).
2. **View** `src/components/ProviderRouting.svelte` (name settles at review): site-wide panel section (Comparator pattern, below the chart) with:
   - filters: model search, quant (multi), "ZDR only" toggle, sort (in/out/blended);
   - table: model, provider (+tag), quant, ZDR, $/M in/out, cache, ctx, uptime, status;
   - **Copy export** action (block for the filtered models).
3. **State in `urlstate`** (AGENTS.md rule): the view's filters join the serializer (`read`/`write` + `DEFAULTS`) with a round-trip test; defaults omitted.
4. **Integration**: mounted in `App.svelte`; data via `ensureEndpoints()` (lazy, non-blocking — 023 D8 contract).

## Not touched in this step

- Chart/Pareto/frontier (024 D7 display-only rule), the 024 drawer, `update.py`, `combined.json`.

## Verification

- `npm test` (routing + urlstate round-trip + component if applicable), `npx tsc --noEmit`, `npm run build`.
- CDP probe (`.tmp/`): filters change rows; the export for a known model (glm-5.3-flash, quant=fp8, ZDR) matches the owner's current block (modulo data drift); URL round-trip.
- Cookie probe untouched (no storage).

## Seams under test

- `src/lib/routing.test.ts`: filters (quant/ZDR/price), price sort, export (order/quantizations/allow_fallbacks), edge cases (model with no ZDR endpoints, duplicate tag).
- `src/lib/urlstate.test.ts`: new params round-trip, defaults omitted.
