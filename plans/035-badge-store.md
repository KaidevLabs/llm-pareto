# 036 — Badge store off the boot critical path

Date: 2026-09-20. **Status: PROPOSED — not reviewed, not executed.**
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

## Out of scope

- Changing which orgs get logos (data-layer decision, not perf).
- Logo fetch priority/order beyond what the store naturally does.
- The load-event logo accounting artifact (not a user cost — recorded in 034).

## Definition of done

- [ ] Owner approves D1–D5 in a review session.
- [ ] Throttled `chartMs` ≈ 4.2 s in the harness A/B (from ~7.0–7.5 s).
- [ ] Frontier renders with fallback badges immediately; real badges swap in.
- [ ] Suites green; cookie probe clean; owner A/B ok; deployed per owner.
