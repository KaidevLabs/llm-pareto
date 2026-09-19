# 033 — Bench history & run comparison

Date: 2026-09-19. **Status: OWNER REVIEW** — eureka settled (A1–A10),
plan committed for review; execution starts only on the owner's go, in a
separate session.

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
| A7 | **Per-tree entry**: each published entry records ONE measured tree — a `--single` run publishes its only tree; a two-ref run publishes its new side (the old ref stays the within-run baseline, as today's report uses it). Uniform schema; compare = tree vs tree | owner pick; "singles and snapshots compared alike" is literal — always "how did the app move since the previous entry" | 2026-09-19 |
| A8 | **One compare page**: `public/bench/compare.html` — defaults to the last two published entries; `?a=<id>&b=<id>` loads any pair; an in-page entry list for arbitrary pairs. Footer links to it. No second index page | minimal surface: one artifact satisfies A1+A2; static-site pattern (query params, no cookies) | 2026-09-19 |
| A9 | **Retention = keep all published entries**; no auto-prune | publishing is owner-paced, so growth is owner-paced; entries are small (full run dir ≈ 40–80 KB); a prune step can be added later if weight ever matters | 2026-09-19 |
| A10 | **Entries reuse the run's own artifacts** — publish copies the run's JSONs + `report.html` verbatim into `public/bench/<id>/`; `index.json` names the entry's tree side. No new normalized schema | the run already produces exactly the per-side records; re-shaping would duplicate schemas for no consumer | 2026-09-19 |

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

None — all eureka questions settled (A1–A10) or absorbed into design:

- Entry unit → A7; link target → A8; retention → A9; entry payload → A10.
- **No-junk gate** (was "does history need a changed-gate?"): publish is
  explicit and validates before writing (step 01) — a partial run (no
  `static.json`/`provenance.json`) is refused; a duplicate id is refused.
  Local throwaway runs never touch the registry.

## Design (per-step summary)

1. **Publish + registry** — `tools/refactor-bench/publish.mjs` (CLI
   `<run-dir>`) + `lib/publish.mjs` (pure logic: validate → build entry →
   copy artifacts verbatim → append `public/bench/index.json`; fail-fast on
   partial runs and duplicate ids). npm script `bench:publish`. README gains
   the publish paragraph.
2. **Compare page** — `public/bench/compare.html` + `compare-view.mjs`
   (shipped module: pair-picking + per-dimension diff logic). Fetches
   `index.json` + the two entries' JSONs (same-origin), renders diff tables
   (static / coverage / load / interactions). Self-contained chrome: no
   third parties, no cookies.
3. **Footer link** — `Footer.svelte` sources line gains a link to
   `/bench/compare.html`.
4. **Close** — full verification hierarchy + 020 cookie probe over the new
   page + DoD audit + archive.

## Execution order

| Step | File | Depends on | Status | Commit |
|------|------|------------|--------|--------|
| 1 | 01-publish.md | — | OPEN | |
| 2 | 02-compare-page.md | 1 | OPEN | |
| 3 | 03-footer-link.md | 2 | OPEN | |
| 4 | 04-close.md | 3 | OPEN | |

## Definition of done

- [ ] `npm run bench:publish -- <run-dir>` copies a run into
      `public/bench/<id>/` and updates `index.json`; duplicate id and partial
      run fail with non-zero exit.
- [ ] `/bench/compare.html` shows the last two published entries by default;
      any pair loadable via `?a=&b=`; same-origin fetches only; cookie probe
      clean.
- [ ] Footer link live; `npm test`, `npx tsc --noEmit`, `npm run build` green.
- [ ] README documents publish + the compare page.
- [ ] Full verification hierarchy green (python suite, JS suite, tsc, build,
      `update.py` sane) and the archived plan records the as-built.

## Out of scope

- In-app re-implementation of the report UI (A3).
- 026's app-data history work (different domain).
- Scheduled/automated bench runs — harness and publishing stay owner-driven.
- Auto-pruning of published entries (A9).

## Executor rules

- Standard lifecycle: one step at a time, owner stages each diff, agent
  commits on the owner's signal, no push (Push policy).
- Step 1's registry logic is behavior-changing with declared seams → driven
  by the `tdd` skill (red → green at the seams before the step closes).
- Verification commands per step file; `node --check` on every touched
  `.mjs`; the repo has no formatter — keep style by hand.
- Scratch and throwaway probes go in `.tmp/`.
