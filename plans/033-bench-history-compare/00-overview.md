# 033 — Bench history & run comparison

Date: 2026-09-19. **Status: DRAFT** — eureka in progress; execution gated on
owner review per the plans lifecycle.

Source: owner idea-dump (2026-09-19, preserved verbatim):

> "Great, what about the html report that compares two bench reports?
>
> Let me add you something what about of it being like a historic snapshot so
> it always comparte the last two bench generated
>
> so if you generate two singles it compares them if then you make another
> single it compares it with the last one and if you do 2 snapshots it
> compares that last two snapshots, ideally also woild be grate to load any
> bench previously made i would like also to add this to the app, maybe add a
> link to the bottom and use svelte lets close what we have now, its good and
> staged, lets close the actual plan also"

## Goal

A rolling bench-run history: the compare view always pits the **last two**
history entries against each other; any older pair is loadable on demand; the
app surfaces the comparison via a footer link. The harness stays the single
generator of self-contained HTML — no in-app re-implementation.

## Settled decisions

| A# | decision | rationale | date |
|----|----------|-----------|------|
| A1 | Rolling window: the compare view always shows the **last two** history entries; each new entry rolls the pair forward (two singles → compared; a third single → compared with the second; two snapshots → last two compared) | owner-stated semantics, verbatim above | 2026-09-19 |
| A2 | Any previously generated entry (pair) is loadable on demand | owner: "ideally also woild be grate to load any bench previously made" | 2026-09-19 |
| A3 | App surfacing: a footer link (Svelte `Footer.svelte`) to the bench comparison; the harness remains the only report generator — no in-app re-implementation | owner: "add this to the app, maybe add a link to the bottom and use svelte"; the app links to harness-generated content | 2026-09-19 |
| A4 | Reports stay self-contained: no third-party requests, no cookies (plan 020 invariant); same-origin fetches of committed artifacts are the allowed pattern (the app's own `public/data` pattern) | cookieless static-site rule | 2026-09-19 |
| A5 | Bench history is **committed to git** (app-linkable, machine-independent) | owner challenge, verbatim: "How are going to accomplish teh comparing history if we do not add it to git?" — local-only history cannot compare across machines and cannot feed the app | 2026-09-19 |
| A6 | **Explicit publish step**: runs stay in gitignored `benchmarks/`; a publish command copies chosen runs into the committed registry (`public/bench/`) — the harness never writes app assets unbidden; publish = one reviewable commit | owner pick; repo weight and deploy churn grow only when the owner says so, matching the owner-driven push culture | 2026-09-19 |

## Current state (evidenced, measured 2026-09-19)

- `report.html` (`tools/refactor-bench/lib/page.mjs`) compares the two **ref
  sides inside one run** (old ref vs new ref) — self-contained (verified: 0
  external refs, 0 `document.cookie`), **15.5 KB**.
- A full run dir ≈ 8 files (~40–80 KB): `static/coverage/load/interact/
  provenance` JSONs + `report.md` + `report.html` + `meta.json`.
- `benchmarks/` is **gitignored** → run history is per-machine only; today
  there is nothing committed for the app to link to.
- `outDir` = `benchmarks/run-YYYYMMDD-HHMM` (minute stamp); two invocations
  in the same minute share the dir (documented reuse behavior, `--force`
  escapes).
- Surfacing path exists and is proven: `public/` → vite publicDir → `dist/`
  → wrangler deploys. `Footer.svelte` already carries a links line (LMArena,
  OpenRouter) — a same-origin link fits the existing slot.
- Every push to `main` auto-deploys (CF git integration); the data bot pushes
  6×/day — bench churn would ride the same deploy train.
- **Naming collision:** `plans/026-historical-snapshots` is the app-DATA
  history (Elo/price over time) — a different domain; user-facing copy should
  not reuse "snapshot" ambiguously. `plans/005-benchmarks` is Epoch AI data —
  also unrelated.

## Open branches

- **Q1 — where bench history lives.** `benchmarks/` is gitignored, so a
  persistent, app-linkable registry must be committed somewhere. Everything
  hangs on this: the footer link target, repo weight, retention, deploy
  noise. (Asked in this session.)
- **Entry unit:** is one history entry a whole **run dir** (compare = last
  two runs) or one measured **tree** (every run appends its current-tree/new
  -side record; any two trees comparable — matches "singles and snapshots
  compared alike")? Owner model pending.
- **Link target:** latest compare page vs a bench index page.
- **Retention:** keep all entries vs last-N (repo weight + deploy churn).
- **Gate:** does the history artifact need a changed-gate like the data bot's
  D3 (a no-op history run must not commit)?

## Not yet specified

- Compare-page mechanics: pre-generated per pair vs one page + query params
  fetching two summaries (same-origin).
- What exactly an entry stores (slim summary vs the full run dir).
- Whether the compare includes per-dimension tables only or also the
  offenders/scorecard cards.

## Out of scope

- In-app re-implementation of the report UI (A3).
- 026's app-data history work (different domain).
- Scheduled/automated bench runs — the harness stays owner-driven.

## Definition of done (this exploration doc)

- [ ] Owner's asks recorded verbatim + context (done — Source above).
- [ ] Current-state claims evidenced (measured 2026-09-19 — done).
- [ ] Q1 settled with rationale; every branch closed or parked deliberately.
- [ ] Plan graduates to steps after owner review.
