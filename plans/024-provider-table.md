# 024 — Provider comparison table (per model)

Date: 2026-09-17. **Status: EXECUTING (step 1/2). Owner approved by
execute trigger (2026-09-17).**
Source: `plans/021-exploration-backlog.md` item B15 + its exploration
findings. **Depends on 022** (the `endpoints.json` provider layer) and on
**006 closing** (the details drawer — EXECUTING step 3/3 as of
2026-09-17, drawer code landed `5fc1368`).

Inside the model details drawer (006), a **Providers** section: the model's
provider endpoints as a compact table — provider, quantization, $/M in/out,
context, uptime, speed — so the per-model "who serves this, at what price"
cross-reference the owner asked for is one click from any bubble. No
update.py changes; the data comes from 022's `endpoints.json` via 023's
shared lazy fetch (or its own lazy fetch if 023 has not landed — the fetch
is one shared module-level promise either way).

## Proposed decisions (settled at owner review)

| # | decision | rationale |
|---|----------|-----------|
| D1 | Surface: a "Providers" section at the bottom of the 006 details drawer (not a standalone page, not an in-tooltip table) | the drawer is the existing per-model detail surface (landed `5fc1368`); the section inherits its open/close/filters semantics for free; a standalone table duplicates the model-identity header the drawer already renders; the in-tooltip option is rejected at 0.5–1.5 s hover dwell (021 B15 findings). A site-wide provider table (rows = providers, cross-model) stays a possible later add-on — it is a different query shape and stays out of scope here |
| D2 | Columns v1 (tight, drawer-width ~340 px): provider (+ tag), quantization, $/M in, $/M out, context (K), uptime 1 d, speed p50 tok/s (`—` when the endpoint has no stats) | the measured price spread is 2× median (5× max) per model — the comparison the owner asked for is price-first; 7 columns is the ceiling that fits the drawer without a horizontal scroll; rate limits (`limit_rpm`/`capacity_tpm`) and `data_policy.training` are v2 columns (021 B15 OQ4) — the data is already in `endpoints.json` (022), so adding them later is a row-spec change, not a data change |
| D3 | Sort: $/M in ascending by default, clickable headers for in/out/uptime/speed | price-ascending is the "who is cheapest" read; the measured 27% duplicate-provider rows are already merged by 022 D6, so the sort surface is clean |
| D4 | The row matching the chart point's price (the model-level list price, `combined.json`) gets a "· chart price" marker | measured (021 B15 findings): for 24/38 sample models the chart price equals the first-listed endpoint, but for 12/27 multi-price models it sits strictly *inside* the provider spread — the marker tells the reader which endpoint (if any) the frontier point actually prices |
| D5 | Single-endpoint models (29% of the joined 154): the section renders the one row + a "single provider" note; models where every row is `—` for speed note "no speed data (low traffic)" | a one-row table is the honest answer for the majority of models; no fake comparison |
| D6 | Overridden models (overrides.json / "price is final", #347): the section shows normally + the note "chart price is final — provider prices are reference" | the frontier keeps the override price (024 is display-only, D7); the note carries the disclaimer semantics without a new meta field |
| D7 | Chart semantics: display only — no frontier recomputation from provider prices; `combined.json` and the frontier are untouched | the owner's directive is that the data plan guarantees the data and this plan shows it; recomputing the frontier from cheapest-provider prices would change the site's core object (the frontier) and collide with the override rule — that is a separate, bigger decision (021 B15 OQ3) |
| D8 | Data: the shared lazy `endpoints.json` fetch (023 D5) — no new fetch path; the section renders on drawer open after the fetch resolves (a one-frame `—` placeholder, never a spinner state that lingers) | one cached promise for two consumers; the drawer is an overlay, so a late fetch costs one re-render of the section only |

## Current state (evidence)

- The 006 drawer is in the code: `renderDetails()` (`app.js:973`), the
  bubble/frontier click handlers (`app.js:668–694`), the × close
  (`app.js:1301`); 006 step 3 (review pass) is outstanding — the section
  lands after it.
- `endpoints.json` (022) carries everything D2 lists: pricing strings,
  quantization, context, rounded uptime 1 d, per-endpoint `stats`
  (p50 throughput). The chart point price lives in `combined.json`
  (`price_in_per_m`).

## Steps (commit per step; owner stages each diff)

1. `app.js` + `index.html`: the Providers section in the drawer — the
   section markup in the drawer shell, the D9 percentile summary block
   (transposed — percentiles as columns, speed/latency/price/context as
   rows; D9 q1 settled at step 1 review), `renderProviders(model)` wired
   into `renderDetails()` (re-renders with the drawer, so the 006 D4
   filtered-out state carries through), the sort (D3), the chart-price
   marker (D4), the single-provider / no-speed / override notes
   (D5/D6), the tight-column CSS (7 columns, drawer-width). Owner A/B at
   step 1 review (2026-09-17): drawer 400 px + card-wide breathing pass;
   color hints — summary block (p50 column = accent, the plotted value;
   latency label warm; price in/out = the site's blue/amber encoding),
   same encoding in the hover tooltip (in/out + accent on elo); the
   chart-price marker became a gold dot + row rail + a legend line under
   the table (self-explaining: "● chart price — the endpoint the chart
   point prices on"). The hover card now carries the p50 speed line in
   every view (value + 023 D2 basis, same wording as the speed view) —
   and the endpoints file is fetched on load (non-blocking, after first
   paint) so hover data is never gated on opening a drawer first; the 023
   D8 shared lazy-fetch mechanism is unchanged, only its trigger moved.
   Not touched:
   `update.py`, the chart, the other drawer content. Commit:
   `chart: provider table in the details drawer`.
2. Verify + ship: CDP structural checks (open the drawer on a
   multi-endpoint model → row count == `endpoints.json` count, sort order,
   marker present; a single-endpoint model → one row + note; an override
   model → note; a model with no stats → `—` cells + note), the cookie
   probe, owner manual A/B, deploy.

## Out of scope

- The site-wide provider table (rows = providers, cross-model aggregation).
- v2 columns (rate limits, `data_policy`, `provider_region`,
  `provider_info.baseUrl`) — data already committed by 022; add as a row-spec
  change.
- Frontier recomputation from provider prices (D7 — a separate decision).
- Provider links (the OR provider page is not a stable per-endpoint URL —
  `provider_info.baseUrl` is a candidate; v2).
- Full latency percentiles in the tooltip (owner note, 2026-09-17: the p50
  latency line stays the only latency in the tooltip; the drawer is the
  detail surface — see D9 below).

## D9 — percentile display (owner note 2026-09-17)

Owner request, verbatim intent: "add all ps p50, p75, p90, p95 and p99 on
the model card that opens when you click a model. And also evaluate what
should be the P to put on the little card which i think it should not b[e]
[p50]". Recorded as a parked entry at 024's drafting per the standing rule
(#352/#447). Both halves are drawer/speed-view concerns and the data is
already in `endpoints.json` (`p50/75/90/95/99_*` +
`latency_request_count`/`throughput_request_count`, all present on 754
endpoint stat blocks; verified 2026-09-17) — scoped here at step 1.

1. **Card (drawer) display** — SETTLED at step 1 review (2026-09-17, owner
   "rec" on the proposed layout): a transposed summary block atop the
   Providers section — percentiles (p50–p99) as columns, metrics as rows.
   Speed tok/s and latency rows: aggregated per percentile with the 023 D2
   rule (median across the rc≥30 endpoints) — the p50 column therefore
   equals the value plotted on the speed axis. Price $/M (the model-level
   list price) and context rows: single values spanning the p columns
   (they are not distributions). A basis line under the block (n endpoints
   (rc≥30) · requests · window) so the p99 tail doesn't read as a promise;
   no basis line when nothing qualifies. Per-endpoint rows keep the D2
   p50 speed column — per-endpoint percentile columns stay out of the
   table. Latency keeps 023 D6's label: what is certain, no TTFT claim.
2. **The "P" on the little card** (tooltip / speed-view labels / 3D) —
   OPEN. p50 is the current plotted value (023 D2). Owner suspects p50
   undersells typical experience. Candidates: stay p50 (consistent with
   "half of requests were at least this fast"), move to p75 (one line
   higher, still stable, less tail-dominated), or plot p50 with p75 shown
   alongside. Decision changes the axis label (023 D6), the tooltip line,
   and possibly the frontier shape (higher P = higher tok/s values =
   points move right — same monotone transform, frontier membership can
   shift between models with different spread shapes).
3. Latency percentiles carry the metric ambiguity flagged in 023 D6 (TTFT
   vs round-trip) — the block inherits that label rule, not an amplified
   claim.

## Definition of done

- [ ] Owner approves this plan (D1–D8) in a review session.
- [ ] The drawer's Providers section renders the D2 columns for a
      multi-endpoint model, sorted per D3, with the D4 marker. — CDP check.
- [ ] The D9 summary block renders the percentile columns (p50–p99) with
      the p50 speed equal to the plotted value, the spanned price/context
      rows, and the basis line. — CDP check.
- [ ] Single-endpoint, no-speed, and override models render their notes
      (D5/D6). — CDP check.
- [ ] The chart and the frontier are byte-identical before/after (D7):
      `combined.json` untouched, the frontier series config untouched.
- [ ] Cookie probe clean + owner A/B feel-out; deployed (live == main).
