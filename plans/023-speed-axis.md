# 023 — Speed as a third axis (price × Elo × speed)

Date: 2026-09-17. **Status: COMPLETE (2026-09-17) — owner A/B feel-out
pending at the review session (this run was delegated: "start implementing
and decide yourself … we can talk about it later and cross correct").**
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
   ✅ Complete — `2a2899c` (2026-09-17). As-built: seg gains "Speed tok/s";
   `#panel-speed` mirrors the in/out panels; `paretoFrontier(pts, highX)`
   grew the flipped-x flag (D3) — price views unchanged; `chartOption`
   takes an x-formatter param and carries `spd` on scatter data; tooltip
   shows tok/s + basis + latency p50 (D2/D6); D4 exclusion counted in the
   panel's status line ("143 models · 11 without speed data hidden") —
   the plan's "panel-footer note" landed there, matching the existing
   count-line pattern; chart init + zoom-restore extracted into
   `ensureChart`/`restoreZoom` shared by all panels; the axis-note swaps
   per mode. Found + fixed during CDP verification: a 404 left
   ENDPOINTS/ENDPOINTS_ERROR both falsy so the loading guard re-scheduled
   forever — added the ENDPOINTS_DONE settled flag. Verified by
   `.tmp/cdp_verify.mjs` (31 CDP assertions, all PASS): 4 seg buttons,
   panel visibility, frontier present, 143 points, claude-opus-4 absent,
   count text, x label, axis-note swap, tooltip lines, fetch-once +
   no-refetch on re-entry, search dims (15/154, plot keeps 143), family
   filter shrinks, 404 + hard-fail graceful states, other views unaffected.
3. Verify 2D Speed mode + ship: CDP structural checks (mode switch renders
   the frontier; a no-stats model is absent + footnoted; filters apply; the
   cached fetch fires once), the cookie probe (no new storage/cookies —
   #333), owner manual A/B, deploy.
   ✅ Complete — pushed `63687a4` (2026-09-17). As-built: CDP checks ran in
   the step-2 harness (31 assertions, all PASS — the 404/fail-tolerance
   cases included); cookieless grep clean (no storage APIs in app.js /
   index.html); cookie-jar probe on live over `/` + every asset the HTML
   references (app.js, echarts, combined/meta/endpoints.json, woff2),
   desktop + curl + mobile UAs — all 200, zero Set-Cookie, empty jar.
   Deployed via the git integration: push → "Workers Builds: llm-pareto"
   success → deployment 2026-09-17T12:24:42Z → live `/` carries the Speed
   button + speedOf in app.js. Owner manual A/B deferred — the owner
   delegated this run ("decide yourself … cross correct later"); the
   feel-out happens at the review session.
4. `public/js/echarts-gl-2.1.0.min.js`: vendoring (fetch from unpkg;
   provenance comment block in `index.html` — source URL, fetch date,
   sha256, same pattern as the Inter font and the vendored echarts) + the
   lazy-load seam in `app.js` (promise-cached script injection, D5 pattern;
   on failure the 3D pill reports "3D unavailable" and the 2D views are
   untouched — D7). No 3D rendering yet. Commit: `chart: vendor echarts-gl`.
   ✅ Complete — `70baf9a` (2026-09-17). As-built: sha256 verified against a
   fresh unpkg fetch (d6d60f21…); the browser UMD global is
   `window["echarts-gl"]` (the factory wires the 3D types onto the global
   echarts) — the seam's success signal; `loadEchartsGL()` in app.js is
   promise-cached, resolves true/false, injects nothing eagerly. Harness
   extended (+6 assertions): 0 gl requests before first use, resolves true
   + global present + fetched once + cached promise, 2D views unaffected;
   the 404 docroot now lacks the gl file → resolves false without throw.
5. `app.js` + `index.html`: the 3D showcase — the "◈ 3D" pill (D7) + the
   `grid3D` scene: spheres per plotted model, org colors, log₁₀
   pre-transformed axes, `viewControl` camera + idle `autoRotate`, the
   custom 2D pan/zoom layer mode-guarded (D9), the 3-objective frontier
   (D8: glow default + `lines3D` ribbon toggle), click → the existing model
   card, sparse labels, filters/search/vision through the existing state
   path. Commit: `chart: 3D showcase mode`.
   ✅ Complete — `76c0a5a` (2026-09-17). **DEVIATION from D8, delegated
   decision:** the `lines3D` ribbon is NOT shipped — every data-shape
   variant of `lines3D` on `cartesian3D` throws synchronously in
   echarts-gl 2.1.0 + echarts 5.6.0 (`Cannot read properties of undefined
   (reading '0')` in the GL view update — data processing, not WebGL, so it
   breaks in any browser). Isolated by headless bisection of the real option
   piece-by-piece; glow-only ships, and D8's "ribbon as optional toggle"
   stays parked until echarts-gl or echarts fix the incompatibility (the
   D8 math — 3-objective non-dominated set — is fully shipped as the glow).
   As-built: axes are x = blended price (General's blend at the current
   ratio), depth = output tok/s, up = Elo (z is vertical in echarts-gl);
   log₁₀ values on linear axes with whole-decade ticks ($1/$10/$100);
   glow = a 22px 0.16-alpha halo twin sphere behind each frontier core
   (WebGL has no shadowBlur); sparse labels via a series-level formatter
   that formats empty for non-frontier points (per-data labels untrusted
   after #427/#428); `autoRotateAfterStill: 4` (idle rotation, never fights
   the hand); the 2D pan/zoom layer is NOT bound to chart-3d (D9's mode
   guard is structural — 3D init skips bindZoomChart/bindPan); the details
   card + drawer-close reuse the 2D machinery; filters/search/vision via
   the same state path. Second headless find: **echarts-gl must register
   before the chart instance is created** — an instance initialized before
   the extension loads throws on its first GL render; render3DPanel now
   awaits the cached `loadEchartsGL()` before `echarts.init`. Harness
   extended: the point set and frontier size are cross-checked against an
   independent recomputation from the raw JSONs (143/143, 31/31), halo ==
   frontier size, pill lazy-loads gl exactly once, click wiring opens the
   card, family filter shrinks the scene, leave/re-enter clean, 404 and
   fail runs degrade gracefully ("3D unavailable" / empty count).
6. Verify 3D + ship: CDP structural checks (the pill lazy-loads
   echarts-gl exactly once; the scene renders spheres + the glow frontier;
   the ribbon toggle adds the `lines3D` series; clicking a sphere opens the
   model card; the 2D views are unaffected after entering/leaving 3D and on
   a failed load), the cookie probe, owner manual A/B (visual judgment of
   the WebGL scene — #403), deploy.
   ✅ Complete — pushed `76e448c` (2026-09-17). As-built: the full CDP
   harness (46 assertions) is ALL PASS, including the 3D section (the
   ribbon assertions replaced by the "no ribbon series" deviation check);
   cookieless grep clean; cookie-jar probe on live over `/` + every asset
   (both echarts files, the gl file, combined/meta/endpoints.json, woff2),
   desktop + curl + mobile UAs — zero Set-Cookie; git-integration deploy
   verified live (app.js carries render3DScene, /js/echarts-gl-2.1.0.min.js
   serves 200, the 3D pill is in the live HTML). Owner manual A/B pending —
   delegated run; the WebGL scene's visual judgment + the D8 ribbon
   deviation are the review session's agenda.

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
      **Shipped as glow-only: the ribbon (lines3D) is dropped — it throws
      in echarts-gl 2.1.0 + echarts 5.6.0 (D8 deviation, step 5 as-built).**
- [ ] Cookie probe clean (no new storage or cookies) + owner A/B feel-out
      (2D Speed mode and the 3D scene). — probe clean 2026-09-17; owner A/B
      pending at the review session.
- [x] Deployed (live == main, push `76e448c`, 2026-09-17).
