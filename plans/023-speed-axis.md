# 023 — Speed as a third axis (price × Elo × speed)

Date: 2026-09-17. **Status: EXECUTING (step 1/6) — D1–D9 settled at owner
review 2026-09-17 ("staged" + delegated execution: "start implementing and
decide yourself … we can talk about it later and cross correct").**
Source: `plans/021-exploration-backlog.md` item B14 + its exploration
findings; D7–D9 from the owner review of 2026-09-17 (recorded below).
**Depends on 022** (the `endpoints.json` provider layer); executes after 022.

A fourth chart mode: **Speed** — x = per-model output speed (p50 throughput,
log scale), y = arena Elo, per-view frontier line in the existing view
switcher — plus a standalone **3D showcase** (D7–D9): a rotatable WebGL
scene of price × Elo × speed with the 3-objective frontier. The speed data
comes from 022's `endpoints.json`; this plan adds the client-side
derivation + the views. No update.py changes.

D7–D9 source (owner review 2026-09-17, intent preserved): the speed axis
could be "a separated graph, so we have a selector somewhere like the input
and output or maybe the same graph that transform"; it "should have like a
3d object, should we be able to rotate and move around, i dont even know
what shape it will it even have"; frontier in 3D as "a 3d bubble also? and
on click the same, showing the card and all?"; bar: "really cool really
clean … the whole colors of the app are on point". Settled: 1 — standalone
pill; 2 — glow default + ribbon as optional toggle; 3 — keep the 2D Speed
mode alongside.

## Proposed decisions (settled at owner review)

| # | decision | rationale |
|---|----------|-----------|
| D1 | Encoding: a fourth mode in the existing `.seg` control — x = log₁₀(p50 throughput, tok/s), y = arena Elo, the frontier line computed per view. No bubble size, no color scale; 3D is a separate showcase view (D7), not this mode's encoding | measured spread (3.6× median within one model across providers) argues for one number per point, not a cloud; the D4 precedent is against size-encoding (the frontier line is the identity — 021 B14 findings); color fights the org identity; the mode tabs already own the "what is the x-axis" question and the switch reuses fit/zoom/filters for free. Owner re-raised 3D at the 2026-09-17 review → D7–D9 |
| D2 | Per-model speed = **median of the endpoints' `p50_throughput`** among endpoints with `request_count ≥ 30`; latency = median of `p50_latency` (ms); the tooltip shows the basis (n endpoints, summed request_count) and the 30-min window | measured: the median beats the fastest provider by a factor of 1.7 on average (a typical model serves from several endpoints — "the fastest endpoint" is a different, marketing-style claim); the p25 of the request-count distribution is 189, so a ~30 floor trims only the thin tails (021 B14 OQ5); the spread is real (3.6× median, 31.7× worst) — the rule is visible in the tooltip's basis rather than hidden |
| D3 | Frontier semantics: per-view 2-D frontier — in the Speed view a point is dominated iff another plotted point is strictly higher Elo **and** strictly faster. No 3-objective frontier | a 3-objective Pareto set is not a chain and cannot render as the current single line; the per-view 2-D frontier keeps the frontier identity and the existing non-dominated-points math (021 B14 OQ3); the price-vs-speed trade stays readable as "switch views and compare frontier lines" |
| D4 | Models with no endpoint stats (zero traffic in the window): excluded from the Speed view, with a panel-footer note ("N models without speed data hidden"); the frontier is computed over the plotted set | the frontier is defined over the currently filtered/plotted set (#335); a 0 tok/s point on a log axis would pin the edge and dominate visually; measured known-miss class = zero-traffic legacy endpoints (claude-opus-4) |
| D5 | Data: one lazy `fetch("data/endpoints.json")` (module-level cached promise, no storage — cookieless-safe) on first entry to the Speed mode; the same cached fetch is the shared seam for 024's provider table, whichever plan lands first | `endpoints.json` is ~30–45 KB gz (021 B15 measurement on the trimmed shape; D1's full set is larger — re-measured at 022 step 3); eager-adding it to the page load would tax every visitor for a view most never open |
| D6 | Labels: the x axis reads "output tok/s (p50, 30-min window)"; the tooltip's latency line reads "latency p50 (ms)" — no TTFT claim in v1 | the metric conflict (the API doc calls `latency_last_30m` time-to-first-token; the page UI implies round-trip) is unresolved (021 B14 OQ4) — label it what is certain, keep the question open |
| D7 | **3D showcase**: a standalone "◈ 3D" pill in `nav.filters` (next to the `#tgl-frontier` pill — NOT in the `#seg-mode` price seg, which answers "which price"). First click lazy-loads vendored `echarts-gl` (promise-cached script injection, the D5 pattern), then swaps the chart region to a WebGL `grid3D` scene; re-clicking (or entering any 2D mode) swaps back. Scene: one sphere per plotted model, colored by org (existing palette); three labeled axes — price (log₁₀), Elo, speed (log₁₀) — with log₁₀ pre-transformed values on linear 3D axes. Filters/search/vision apply through the same state/render path; clicking a sphere opens the existing model card (scatter3D fires the same click event with the same datum). A load failure reports "3D unavailable" on the pill; the 2D views are untouched. | owner decision 2026-09-17 (standalone pill). A 2D↔3D "transform" in one ECharts instance is a coordinate-system swap, not an animated morph — the swap is the clean behavior; ~150 spheres is trivial for WebGL |
| D8 | **3D frontier**: the 3-objective non-dominated set (↑Elo, ↓price, ↑speed) renders as glowing spheres (halo via shadowBlur, larger symbol) by default — the 3D Pareto set is a surface, not a chain, so the 2D "connected line" identity does not generalize. An optional pill toggle additionally strings the non-dominated points with a thin `lines3D` curve (Elo-sorted) — a "ribbon": *a* path through the frontier, not *the* frontier. The 2D views keep their per-view 2-D frontier (D3) | owner decision 2026-09-17 (glow default, ribbon as optional toggle). Honest math + the line identity kept as an opt-in |
| D9 | **3D camera/interaction**: echarts-gl `viewControl` owns rotate (drag) / zoom (wheel) / pan (right-drag), plus a slow `autoRotate` while idle; the custom 2D pan/zoom capture layer (#416/#423) is mode-guarded — active only in 2D modes. Labels stay sparse (frontier points + hover, 2D-projected). | 3D labels are 2D projections — sparse keeps it clean, and it sidesteps the 5.6.0 rich-label quirk (#428) in 3D too |

## Current state (evidence)

- `public/app.js` (1351 lines): the mode tabs (Price / Elo / …) drive
  `render()`; the frontier is a pure non-dominated-points function over the
  filtered set (#335); fit/zoom/filters are mode-agnostic; `state` is
  in-memory (no storage APIs — 021 B16 measurement). `app.js` currently
  fetches only `combined.json` + `meta.json` (eager, `Promise.all`).
- JS unit tests are not runnable until the ESM split lands (017 A2) —
  verification for this plan is CDP-driven headless Chromium (structural DOM
  assertions; #403) + the owner's manual A/B.
- `echarts-gl` measured 2026-09-17 (npm registry + unpkg fetch): latest
  **2.1.0** — 639,846 B min / 175,229 B gz; `peerDependencies: echarts
  ^5.1.2 || ^6.0.0` (compatible with our vendored 5.6.0). The dist contains
  `scatter3D`, `lines3D`, `grid3D`; `viewControl` exposes rotate/zoom/pan
  sensitivity + `autoRotate` (pan is `panSensitivity`; there is no `panRoam`
  key in 2.x). 2.0.9 measured 640,694 B min — 2.1.0 is the same size, newer.
- Nav precedent: `#seg-mode` (General / Input $/M / Output $/M) is the
  "which price" control; standalone pills (`#of-toggle`, `#tgl-frontier`,
  `#tgl-spread`) are the established pattern for view toggles — the 3D pill
  follows that pattern (D7).

## Steps (commit per step; owner stages each diff)

1. `app.js`: the lazy shared fetch of `endpoints.json` (D5, module-level
   promise + a 404-tolerant error state — the file exists from 022; a
   missing file must not break the other views) + the pure
   `speedOf(modelId, endpoints)` derivation (D2: median, rc≥30 filter,
   latency + basis). No render wiring yet. Commit:
   `chart: speed derivation from endpoints.json`.
   ✅ Complete — `a6ef77f` (2026-09-17). As-built: `fetchEndpoints()` +
   `speedOf(modelId, eps)` + `median(xs)` inserted after `blendedPrice`;
   endpoints.json's real shape is `{or_id: [endpoint]}` with a `stats`
   block per endpoint (`p50_throughput` tok/s, `p50_latency` ms,
   `request_count`, `window_minutes: 30`) — the plan's flat field names
   resolved to `e.stats.*`. 404 tolerated (ENDPOINTS null, no error), other
   failures recorded in ENDPOINTS_ERROR. Verified with a stub-eval script
   (`.tmp/verify_step1.mjs`, 23 assertions): medians (odd/even/empty),
   rc≥30 boundary (rc=30 passes), 0-tok/s excluded, real-data dogfood
   (143/154 models get a speed; claude-opus-4 null per D4; range 6–368
   tok/s), fetch 200/404/500/network. No render wiring (step 2 wires it).
2. `app.js` + `index.html`: the Speed mode — the fourth seg button + panel,
   the series config (log x, Elo y, per-view frontier per D3), tooltip/
   labels with tok/s + basis + latency (D6), the D4 exclusion + footer
   note, fit/zoom/filters inherited. Not touched: the other modes,
   `update.py`, `combined.json`. Commit: `chart: speed axis mode`.
3. Verify 2D Speed mode + ship: CDP structural checks (mode switch renders
   the frontier; a no-stats model is absent + footnoted; filters apply; the
   cached fetch fires once), the cookie probe (no new storage/cookies —
   #333), owner manual A/B, deploy.
4. `public/js/echarts-gl-2.1.0.min.js`: vendoring (fetch from unpkg;
   provenance comment block in `index.html` — source URL, fetch date,
   sha256, same pattern as the Inter font and the vendored echarts) + the
   lazy-load seam in `app.js` (promise-cached script injection, D5 pattern;
   on failure the 3D pill reports "3D unavailable" and the 2D views are
   untouched — D7). No 3D rendering yet. Commit: `chart: vendor echarts-gl`.
5. `app.js` + `index.html`: the 3D showcase — the "◈ 3D" pill (D7) + the
   `grid3D` scene: spheres per plotted model, org colors, log₁₀
   pre-transformed axes, `viewControl` camera + idle `autoRotate`, the
   custom 2D pan/zoom layer mode-guarded (D9), the 3-objective frontier
   (D8: glow default + `lines3D` ribbon toggle), click → the existing model
   card, sparse labels, filters/search/vision through the existing state
   path. Commit: `chart: 3D showcase mode`.
6. Verify 3D + ship: CDP structural checks (the pill lazy-loads
   echarts-gl exactly once; the scene renders spheres + the glow frontier;
   the ribbon toggle adds the `lines3D` series; clicking a sphere opens the
   model card; the 2D views are unaffected after entering/leaving 3D and on
   a failed load), the cookie probe, owner manual A/B (visual judgment of
   the WebGL scene — #403), deploy.

## Out of scope

- The latency view (tooltip only in v1 — D6).
- A per-provider speed drill-down (that is 024's table).
- Bubble-size / color-speed encodings (021 B14 options 2/3 — later toggles
  if the owner wants them).
- 3-objective frontier in the 2D views (D3 — the 3-objective set lives in
  the 3D scene only, D8).
- Server-side speed precomputation (the client derives — 022 D4).
- 3D per-axis selectors (remapping each 3D axis to price/Elo/speed) — a
  later extension if the owner wants it.

## Definition of done

- [x] Owner approves this plan (D1–D9 settled 2026-09-17) in a review
      session; execution delegated for this run.
- [ ] A fourth Speed mode renders the frontier line over plotted points;
      the tooltip carries tok/s + basis + latency. — CDP check.
- [ ] A model without stats is hidden + footnoted; filters/search apply in
      the Speed view. — CDP check.
- [ ] `endpoints.json` is fetched lazily, once, and cached (Network panel
      / CDP); the other views work if the fetch fails.
- [ ] 3D: the pill lazy-loads echarts-gl exactly once; the scene renders
      spheres + the 3-objective glow frontier; the ribbon toggle works;
      clicking a sphere opens the model card; the 2D views are unaffected
      (including on a failed echarts-gl load). — CDP check.
- [ ] Cookie probe clean (no new storage or cookies) + owner A/B feel-out
      (2D Speed mode and the 3D scene).
- [ ] Deployed (live == main).
