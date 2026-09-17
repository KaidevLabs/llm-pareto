# 023 — Speed as a third axis (price × Elo × speed)

Date: 2026-09-17. **Status: PROPOSED — not reviewed, not executed.**
Source: `plans/021-exploration-backlog.md` item B14 + its exploration
findings. **Depends on 022** (the `endpoints.json` provider layer); executes
after 022.

A fourth chart mode: **Speed** — x = per-model output speed (p50 throughput,
log scale), y = arena Elo, per-view frontier line in the existing view
switcher. The speed data comes from 022's `endpoints.json`; this plan adds
the client-side derivation + the view. No update.py changes.

## Proposed decisions (settled at owner review)

| # | decision | rationale |
|---|----------|-----------|
| D1 | Encoding: a fourth mode in the existing `.seg` control — x = log₁₀(p50 throughput, tok/s), y = arena Elo, the frontier line computed per view. No bubble size, no color scale, no 3D/parallel axes | measured spread (3.6× median within one model across providers) argues for one number per point, not a cloud; the D4 precedent is against size-encoding (the frontier line is the identity — 021 B14 findings); color fights the org identity; the mode tabs already own the "what is the x-axis" question and the switch reuses fit/zoom/filters for free |
| D2 | Per-model speed = **median of the endpoints' `p50_throughput`** among endpoints with `request_count ≥ 30`; latency = median of `p50_latency` (ms); the tooltip shows the basis (n endpoints, summed request_count) and the 30-min window | measured: the median beats the fastest provider by a factor of 1.7 on average (a typical model serves from several endpoints — "the fastest endpoint" is a different, marketing-style claim); the p25 of the request-count distribution is 189, so a ~30 floor trims only the thin tails (021 B14 OQ5); the spread is real (3.6× median, 31.7× worst) — the rule is visible in the tooltip's basis rather than hidden |
| D3 | Frontier semantics: per-view 2-D frontier — in the Speed view a point is dominated iff another plotted point is strictly higher Elo **and** strictly faster. No 3-objective frontier | a 3-objective Pareto set is not a chain and cannot render as the current single line; the per-view 2-D frontier keeps the frontier identity and the existing non-dominated-points math (021 B14 OQ3); the price-vs-speed trade stays readable as "switch views and compare frontier lines" |
| D4 | Models with no endpoint stats (zero traffic in the window): excluded from the Speed view, with a panel-footer note ("N models without speed data hidden"); the frontier is computed over the plotted set | the frontier is defined over the currently filtered/plotted set (#335); a 0 tok/s point on a log axis would pin the edge and dominate visually; measured known-miss class = zero-traffic legacy endpoints (claude-opus-4) |
| D5 | Data: one lazy `fetch("data/endpoints.json")` (module-level cached promise, no storage — cookieless-safe) on first entry to the Speed mode; the same cached fetch is the shared seam for 024's provider table, whichever plan lands first | `endpoints.json` is ~30–45 KB gz (021 B15 measurement on the trimmed shape; D1's full set is larger — re-measured at 022 step 3); eager-adding it to the page load would tax every visitor for a view most never open |
| D6 | Labels: the x axis reads "output tok/s (p50, 30-min window)"; the tooltip's latency line reads "latency p50 (ms)" — no TTFT claim in v1 | the metric conflict (the API doc calls `latency_last_30m` time-to-first-token; the page UI implies round-trip) is unresolved (021 B14 OQ4) — label it what is certain, keep the question open |

## Current state (evidence)

- `public/app.js` (1351 lines): the mode tabs (Price / Elo / …) drive
  `render()`; the frontier is a pure non-dominated-points function over the
  filtered set (#335); fit/zoom/filters are mode-agnostic; `state` is
  in-memory (no storage APIs — 021 B16 measurement). `app.js` currently
  fetches only `combined.json` + `meta.json` (eager, `Promise.all`).
- JS unit tests are not runnable until the ESM split lands (017 A2) —
  verification for this plan is CDP-driven headless Chromium (structural DOM
  assertions; #403) + the owner's manual A/B.

## Steps (commit per step; owner stages each diff)

1. `app.js`: the lazy shared fetch of `endpoints.json` (D5, module-level
   promise + a 404-tolerant error state — the file exists from 022; a
   missing file must not break the other views) + the pure
   `speedOf(modelId, endpoints)` derivation (D2: median, rc≥30 filter,
   latency + basis). No render wiring yet. Commit:
   `chart: speed derivation from endpoints.json`.
2. `app.js` + `index.html`: the Speed mode — the fourth seg button + panel,
   the series config (log x, Elo y, per-view frontier per D3), tooltip/
   labels with tok/s + basis + latency (D6), the D4 exclusion + footer
   note, fit/zoom/filters inherited. Not touched: the other modes,
   `update.py`, `combined.json`. Commit: `chart: speed axis mode`.
3. Verify + ship: CDP structural checks (mode switch renders the frontier;
   a no-stats model is absent + footnoted; filters apply; the cached fetch
   fires once), the cookie probe (no new storage/cookies — #333), owner
   manual A/B, deploy.

## Out of scope

- The latency view (tooltip only in v1 — D6).
- A per-provider speed drill-down (that is 024's table).
- Bubble-size / color-speed encodings (021 B14 options 2/3 — later toggles
  if the owner wants them).
- 3-objective frontier rendering (D3).
- Server-side speed precomputation (the client derives — 022 D4).

## Definition of done

- [ ] Owner approves this plan (D1–D6) in a review session.
- [ ] A fourth Speed mode renders the frontier line over plotted points;
      the tooltip carries tok/s + basis + latency. — CDP check.
- [ ] A model without stats is hidden + footnoted; filters/search apply in
      the Speed view. — CDP check.
- [ ] `endpoints.json` is fetched lazily, once, and cached (Network panel
      / CDP); the other views work if the fetch fails.
- [ ] Cookie probe clean (no new storage or cookies) + owner A/B feel-out.
- [ ] Deployed (live == main).
