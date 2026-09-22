# 041 — Bench generalization (exploration record)

Date: 2026-09-22. **Status: SETTLED (2026-09-22) — design-only (exploration record; no code).**
Archive when the generalization plan is created (the record has served its
purpose) or when the owner settles this document.

Source: owner idea-dumps (2026-09-22, preserved verbatim):

> "I want to open a exploration here is about moving the whole new bench to
> inside the svetle application… For starters for me it seems pretty obvios
> that if we have a web application this web application can show stats of
> itself something like /stats or something or maybe /bench because stats
> seems like visits and such. But at the same time one could think that this
> bech sistem is something non related with the app and with its work,
> something even that one day we could port and use to bench mark any
> application so maybe it its own application. in that case i woudl also
> improve it by converting it to a svelt applicaton… So lets explore this two
> paths no implementing anything just exploring, grill me about it as much as
> you want."

> "Lets not talk about costs and time, this is negligible… You know i have
> always wanted a application like this, there are no specific project but
> with this in mind i could use it for exmaple on
> /home/pacific/Documents/registerabnonline.com.au. So how i would use it…
> npm i benchjs. then npx bench run and npx bench publish or list and rm and
> sucj. or maybe npm run <sha commit>. You know something that would help
> developers to manage all this thigns in a generic way for vie, react,
> svelte everyhtin."

> "a) okay. b) not like that each user of the library decide if he wants to
> publish or not the results of its benchmarks and how. c) / yes me. … You
> know what im going to stay as we are, as a tool inside this project, the
> moment i feel i need to upgrade it ill review all this, for now is good
> enough."

## Goal

Record the bench exploration (in-app feature vs standalone product), settle
the direction with the owner, and park the full shape so the future
"upgrade" plan starts here without re-litigating. Reaching the end of this
plan = this document settled + archived; **no code changes**; 033 continues
as planned.

**Revisit triggers** (owner's words, made concrete): (a) a second repo
actually runs the bench (candidate: `registerabnonline.com.au`); (b) this
repo's bench needs a feature that doesn't fit a single-repo tool; (c) the
owner wants the hosted cockpit.

## Settled decisions

| A# | decision | rationale | date |
|----|----------|-----------|------|
| A1 | The bench stays as a tool inside this project (`tools/refactor-bench/`) for now; 033's design unchanged (harness-generated self-contained page + footer link) | owner verbatim: "im going to stay as we are, as a tool inside this project, the moment i feel i need to upgrade it ill review all this, for now is good enough" | 2026-09-22 |
| A2 | If generalized: a standalone product (path B) — an npm package the target apps consume; the app is one target, not the home | a real second tenant exists (`registerabnonline.com.au`, Nuxt 4 / Vue / SSR, live domain); owner declared cost/time negligible | 2026-09-22 |
| A3 | Product = three artifacts, one contract: CLI (measures + manages runs) · registry (per-target JSON, committed in each target repo, entries carry a `target` identity) · viewer (swappable reader). The registry schema is the contract | contract-first: every viewer shape (shipped page, embedded component, hosted cockpit) is a reader of the same JSON; the CLI is the only writer | 2026-09-22 |
| A4 | Publishing is the consumer's decision — whether, and how; the tool owns measurement + registry format, not a central aggregation | owner: "each user of the library decide if he wants to publish or not the results of its benchmarks and how" | 2026-09-22 |
| A5 | Self-portrait surface (bench page in the app, public to its visitors) is first-class; hosted cockpit comes later; first audience for bench UI = the owner | owner: "a) okay" / "c)" / "yes me" | 2026-09-22 |
| A6 | Config is an escape hatch, not an entry point: derive from invariants (build script, `dist/`, static serve, vitest, git remote), record every detection in `provenance.json`, fail-fast on ambiguity; explicit config is born for a *server* serve model | owner: "Would we have some defaults?"; the Nuxt case is where the static default genuinely fails — `nuxt build` → Nitro node server in `.output/`, no static dir | 2026-09-22 |
| A7 | The bench measures the **built production artifact, never dev mode** | stated 2026-09-22, no objection: the refactor oracle needs a deterministic unit (HMR/unminified/sourcemaps are dev-mode noise) | 2026-09-22 |
| A8 | Comparison is always **within a target, over time** — no cross-target comparison | stated 2026-09-22, no objection: different apps are different axes; the cockpit groups by target, never pits Nuxt against Svelte | 2026-09-22 |
| A9 | CLI lifecycle: `run [ref]`, `publish` (writes registry + commits), `list` (published + local), `rm` (registry entry / local run) | owner's dump ("npx bench run and npx bench publish or list and rm"); publish = one explicit reviewable act (A4) | 2026-09-22 |
| A10 | Naming: npm package `@kaidev/bench`, bin `bench` | `benchjs` taken on npm (v1.0.1, measured 2026-09-22); the bin keeps the owner's `npx bench …` ergonomics | 2026-09-22 |

Marked do-not-revisit for the future plan: A2–A8, A10. A9's verb set and
A6's detection ladder are the owner's shape with agent-specified details —
the future plan confirms details, not direction.

## Current state (evidenced, 2026-09-22)

- **Harness** `tools/refactor-bench/` (Node CLI, in-repo): `run.mjs` measures
  one tree per run (bare = current tree, positional `<ref>` = throwaway
  worktree) across four phases — static (cloc / cyclomatic / jscpd),
  coverage (vitest), load (CDP, 4 throttle conditions), interact (CDP).
  Probes are **this app's own**: `.drawer` / `.drawer-x` selectors, the "3D"
  `.button.pill`, `chartMs` = the echarts paint. `publish.mjs` copies a run
  verbatim into `public/bench/<id>/` + appends `index.json`. `lib/page.mjs`
  generates each run's self-contained `report.html`.
- **Compare page**: `public/bench/compare.html` + `compare-view.mjs`
  (shipped module, 25 vitest tests) — standalone vanilla JS with its own CSS
  and font stack; same-origin fetches of `index.json` + entry JSONs; not part
  of the Svelte app and not sharing its design system.
- **Registry** `public/bench/`: 2 published entries (~40–80 KB each),
  committed to git, served through vite publicDir → `dist/` → CF Workers.
- **Deploy**: one CF Worker (`llm-pareto`) serving `dist/`; the app is
  single-entry Svelte with query-param URL state (027 A4/A5), **no path
  routing**; `worker.ts` is passthrough (logs asset misses).
- **Plan 033** (which built all of this) mid-execution: steps 1–3 closed
  (013e1c8, f26fe70, e6052b9); step 4 (footer link to
  `/bench/compare.html`) + step 5 (close) open; owner has a staged
  `Footer.svelte` change in flight.
- **Measured 2026-09-22**: live site 6 commits behind (local 12 ahead) →
  `/bench/compare.html` 404s live; **CF static assets send no CORS headers**
  (`GET /data/meta.json` with foreign `Origin` → 200, zero
  `access-control-*`); `benchjs` taken on npm (v1.0.1, "simple Node.js
  library that helps you benchmark the execution time");
  `registerabnonline.com.au` = **Nuxt 4 / Vue 3 / SSR**, live `.com.au`
  domain, own build+serve scripts (`nuxt build` → Nitro `.output/` node
  server; `nuxt generate` → static), vitest + Playwright, Tailwind, Stripe.

## Design (the parked shape — input for the future plan)

Two paths were explored; the decision tree and its evidence are recorded so
the revisit starts here.

**Path A — bench view as a feature of this app** (`/bench` route or
`/?bench=…` in the Svelte app). Simplifies: one design language, one deploy,
deep-links reuse the 027 urlstate discipline, the app can use its own
measurements. Complicates: second data domain + second view set in
`App.svelte`; bench-view JS ships to every visitor; "app about itself"
recursion.

**Path B — the bench as its own product** (settled direction, A2).
Simplifies: the main app stays lean; the bench grows freely (multi-target,
trends, per-target probe configs). Complicates: second deploy identity; the
registry's data plumbing lives per-target-repo; one-tenant-until-proven.

**The shape (what the future plan inherits):**

1. **CLI** — `@kaidev/bench`, extracted from `tools/refactor-bench/`:
   `run [ref]` (built artifact, A7), `publish` (A9), `list`, `rm`, `cyc`
   absorbed from `tools/refactor-bench/cyc.mjs`.
2. **Registry** — per target repo, committed, JSON-only entries with a
   `target` identity; the run artifacts (static/coverage/load/interact/
   provenance) are the entry payload. The schema is the contract (A3).
3. **Viewer** — swappable reader of the registry. Default shape (agent
   recommendation, parked open in branch 1): the registry dir ships a
   self-contained generated page — the 033 `compare.html` shape,
   framework-free, zero integration for any target (every target has a
   public dir; Nuxt's `public/` included). The **Svelte cockpit** — the
   "application I've always wanted", first audience = the owner — is a later
   consumer instance reading N registries (A4/A5); its aggregation mechanism
   is branch 2.
4. **Config** — `bench.config.json` as escape hatch (A6): identity
   (name/url) · serving model (static dir **or** server command + port +
   readiness) · test/coverage command · probes (milestones as named
   predicates — the shape already exists: `interact.json`'s
   `config.drawerVerify` is a JS expression string evaluated in-page) ·
   run count. Detection ladder (build from `scripts.build`; `dist/`; static
   serve; vitest in devDeps; name from git remote; probes optional →
   interact phase skipped): every detection recorded in `provenance.json`;
   ambiguity → fail-fast naming the exact field to set. A vite/svelte repo
   runs with zero config; the Nuxt repo needs the serving-model field
   (`.output/` node server) — that is where the config is born.
5. **Migration of this repo** (when it happens): `tools/refactor-bench/`
   extracted into the package; this repo becomes consumer #1 (dogfood:
   devDep + a `bench.config.json` carrying the drawer/3D/chart-paint probes
   verbatim; `npm run bench` → `bench run`); `public/bench/` path and the
   `/bench/compare.html` deep link stay stable.

## Execution order

No steps — design-only.

## Definition of done

- [x] Exploration recorded with evidence (this document; both paths, the
      decision tree, the measured constraints).
- [x] Owner's decision settled: the bench stays as a tool inside this
      project for now (A1); 033 unaffected — its A3 unchanged, step 4's
      footer link proceeds as planned, no 033 file touched by this record.
- [x] Generalization shape parked as settled decisions (A2–A10) + open
      branches, so the revisit plan starts without re-litigating.
- [x] Owner review of this record; status → `SETTLED (2026-09-22)`; archives
      when the generalization plan is created (the record has served its
      purpose).

## Open branches

Sharp questions parked for the revisit plan — each stateable now, deferred
on purpose:

1. **Viewer mechanism** — default viewer as the generated self-contained
   page in the registry dir (033 shape, framework-free) vs the Svelte cockpit
   as the default. Agent recommendation recorded 2026-09-22, parked
   unconfirmed: the owner parked the whole item before answering. Hangs on
   it: whether the tool still ships HTML generation (`page.mjs` lineage) or
   the registry goes JSON-only; whether the per-target surface is a shipped
   page or an app route.
2. **Cockpit aggregation mechanism** — cross-target fetch of each site's
   registry. Measured: CF static assets send no CORS headers → per-target
   header-append rule (CF Transform on `/bench/*`, cookieless-safe) vs
   dashboard proxy vs self-hosted manifest. Hangs on it: the cockpit's
   deploy identity + the one-time per-target config.
3. **URL mode** — bench the deployed site with no git (load + interact only;
   provenance `{url, fetchedAt, content-hash}`). The Nuxt target's live
   `.com.au` domain makes real-user conditions the honest benchmark for it;
   ref mode stays the refactor oracle. Hangs on it: the entry's provenance
   schema.
4. **Tool home + this repo's migration** — new KaidevLabs repo for
   `@kaidev/bench`; extraction of `tools/refactor-bench/`; this repo becomes
   consumer #1 (branch 5 above). Hangs on it: where `cyc.mjs`, the
   `.run/` worktrees, and the `benchmarks/` local history land.
5. **Per-run `report.html`** — survives as a single-tree profile view, or is
   born dead once the registry is JSON-only (branch 1 decides).
6. **`rm` / `list` details** — registry `rm` = rewrite `index.json` + remove
   the entry dir + commit; local `rm` = delete under gitignored
   `benchmarks/`; `list` shows both, flagged.

## Out of scope (for now)

- Any code change in this repo — 033 continues exactly as planned (steps
  4–5 open).
- In-app re-implementation of the bench view (033 A3 holds: harness remains
  the only report generator).
- A second deploy / new worker / new custom domain.
- The npm publish and the registry schema migration (`target` field).
- Scheduled/automated bench runs — the harness and publishing stay
  owner-driven.

## Executor rules

- None — design-only; no executor until the revisit plan graduates from this
  record.
