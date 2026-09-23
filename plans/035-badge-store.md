# 036 — Badge store off the boot critical path

Date: 2026-09-20. **Status: step 1 executed (2026-09-23, `39cb935`); step 2 pending.**
Source: `docs/reports/030-port-perf-findings.md` B20 (full evidence there; origin:
plan 030 step 01 cost #2 + step 02 F9).

First chart must not wait for badge logos: `boot.ready` awaits
`buildBadges()` — ~25 logo images (start 4.03 s, last lands 6.85 s
throttled) gate the first chart (7.0–7.5 s). `fallbackBadge` already
exists as the natural placeholder; badges arriving later swap the symbols.

## Proposed decisions (settled at owner review)

| # | decision | options & recommendation |
|---|----------|--------------------------|
| D1 | Store shape | Reactive badge store (the `endpoints.svelte.ts` pattern): `boot.ready` no longer awaits badges; `buildBadges()` fills the store per-org; the chart seam reads it on render. **(rec) yes.** |
| D2 | Placeholder + swap | Render with `fallbackBadge` (letter disc) from the first chart; when a real badge lands, one merge re-render swaps the symbol. Owner A/B on the swap flash. Alt: keep the await-gate but only for frontier orgs (smaller gain, zero flash). |
| D3 | Canvas size | 256×256 → 48×48 (2× the 24 px display) — −PNG-encode cost (toDataURL 85–220 ms throttled → proportionally less) and −memory. **(rec) yes.** |
| D4 | Consumers inventory | Enumerate badge/logo consumers (frontier symbols, tooltip, drawer) in the plan's step 1 before wiring — nothing else may silently depend on the gate. |
| D5 | Verification | Harness A/B (`chartMs` cold-throttled; expect ~7.0–7.5→~4.2 s); owner A/B for the swap; suites green. |

## Steps (commit per step; owner stages each diff)

1. Badge store + gate removal + 48 px canvases; consumers inventory (D4).
   Commit: `chart: badge store off the critical path`.
2. Harness A/B + owner A/B (swap flash) + DoD audit. Commit: folded or
   `chart: badge store verification`.

## As-built — step 1 (2026-09-23, code `39cb935`)

- **D1** as planned: `BADGE` is a module-level `$state` record
  (`badges.svelte.ts`, renamed via `git mv` — the file crossed into
  rune territory, and the suffix is the vite plugin's runes trigger, not
  style). `buildBadges()` fills it per-org as each logo lands; orgs
  absent from `meta.logos` never get a key (fallback forever, 007
  semantics). Runs non-blocking in `bootOnce` under the same
  `!data.error` guard as `ensureEndpoints()`.
- **D2** — the tri-state contract: `badgeFor(org)` returns
  `undefined` = not yet attempted → placeholder; `null` = landed, load
  failed → raw logo (soft); `string` = real badge. `charts.ts`'s symbol
  seam renders the fallback letter disc while `undefined` (previously
  the raw logo — the D2 rule), the badge once landed. Reactive swap
  confirmed end-to-end in headless CDP (see D5).
- **D3** as planned: 48×48 canvas, 007's disc geometry rescaled exactly
  (disc r 21, ring 22.5 @ 2.25, image draw 28, letter 21px). Verified
  the shrink is visually lossless at the 24px symbol size against the
  old 256px compositor (side-by-side sheet, incl. the malformed-SVG
  orgs z-ai/tencent — both degrade identically, pre-existing).
- **D4** — consumers inventory (verified by grep, owner challenged the
  selector): `badgeFor`/`BADGE` has exactly ONE consumer — the frontier
  symbol seam (`charts.ts:248-254`). The org/fam selector
  (OfPanel:145), drawer card (ModelCard:68), and tooltip (charts:82)
  render the *raw* logo via `logoFor()` (data store + plain `<img>`),
  which never touched the badge gate. Family rows have no logos.
  Migrating the DOM consumers to composited badges is a deliberate
  non-change: the canvas composite exists for echarts `image://`
  symbols (can't layer disc+ring+logo); `<img>` doesn't need it.
- **D5** partial (headless smoke only; harness numbers = step 2): with
  every logo response held 1500 ms server-side, first chart paint
  ~220 ms (was 7.0-7.5 s with the gate); all 9 frontier symbols were
  fallback discs pre-landing (0 raw-logo placeholders) and all 9
  swapped post-landing, 0 page exceptions. Suites green (170/170),
  tsc clean, build clean.
- **Findings recorded for later seams:**
  - Svelte 5's `$state` proxy DOES track missing-key reads inside
    `$effect` — a later write to a never-before-present key re-runs the
    effect (verified against this repo's runtime with a throwaway
    microtest, deleted after). The per-org fill → swap design rests on
    it.
  - Symbol swaps arrive in WAVES over several seconds (first wave
    ~1.5 s, tail ~6 s in the 1500 ms-delay probe) — Chromium queues the
    23 same-host fetches through ~6 HTTP/1.1 connections. Unthrottled
    is faster but still progressive; this is the owner-A/B surface.
  - Diagnostic trap worth remembering: a probe that polls "did it
    change?" must watch until ALL subjects transition or go idle — an
    arbitrary fixed window (4 s) reported false "never swaps" for the
    queue-tail orgs.

## Out of scope

- Changing which orgs get logos (data-layer decision, not perf).
- Logo fetch priority/order beyond what the store naturally does.
- The load-event logo accounting artifact (not a user cost — recorded in 034).

## Definition of done

- [x] Owner approves D1–D5 in a review session.
- [ ] Throttled `chartMs` ≈ 4.2 s in the harness A/B (from ~7.0–7.5 s). *(step 2)*
- [x] Frontier renders with fallback badges immediately; real badges swap in.
- [ ] Suites green; cookie probe clean; owner A/B ok; deployed per owner. *(suites green; rest step 2)*
