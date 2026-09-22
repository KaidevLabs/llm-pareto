# 042 — Bench registry management: `bench:ls` / `bench:rm`

Date: 2026-09-22. **Status: PROPOSED — not reviewed, not executed.**
Source: owner request, verbatim:

> "I want to add a bench:ls to list and a bench:rm <bench id> to remove a nech"

Related: plan 033 A9 (retention = keep all published entries; a prune step "can be
added later if weight ever matters" — this is that step's small form) and plan 041
branch 6 (`rm`/`list` details parked for the future standalone tool; A1 keeps the
bench in-repo for now). This plan touches only the in-repo tool; 041's parked
shape is unchanged.

## Settled decisions (owner, 2026-09-22)

| A# | decision | rationale | date |
|----|----------|-----------|------|
| A1 | Scope = **published registry only** (`public/bench/`): `bench:ls` lists its entries; `bench:rm <id>` removes an entry dir + its `index.json` row. Local `benchmarks/` run dirs are neither listed nor deleted (plain `rm -rf` stays the scratch path) | owner pick this session; the committed registry is the surface the compare page reads and the only bench state git tracks | 2026-09-22 |
| A2 | Command names `bench:ls` / `bench:rm <id>` (npm scripts), matching the owner's wording | owner request | 2026-09-22 |
| A3 | `rm` is file surgery only — no commit, no push; the owner reviews and commits the deletion like a publish (033 A6's "one reviewable act") | 033 A6 pattern; repo commit culture | 2026-09-22 |

## Proposed decisions (settled at owner review)

| # | decision | options & recommendation |
|---|----------|--------------------------|
| D1 | Registry code home | (a) new `lib/registry.mjs` owns read/write/list/remove of `index.json`; `publishRun` switches to it (behavior unchanged) — single owner of the contract the compare page reads, real consumers (publish, ls, rm). (b) extend `lib/publish.mjs` — less churn, registry read/write duplicated across commands. **(rec) (a).** |
| D2 | `ls` output | Registry order (append order), columns id / date / label / KB, plus a footer naming the default compare pair (the last two); `0 published entries` on an empty registry, exit 0. **(rec) as stated** — the footer is the 033 A1 rolling pair made visible. |
| D3 | `rm` edges | Unknown or missing id → clear error + exit 1, nothing touched; removing the last entry is allowed (the compare page already renders its "two are needed" error state via `pickPair`). Success prints the removed id + remaining count, noting when fewer than two remain. **(rec) as stated** — fail-fast; the page is the guard, not an artificial minimum. |
| D4 | `ls`/`rm` CLIs | One file per command (`ls.mjs`, `rm.mjs`), matching `run.mjs` / `publish.mjs` / `cyc.mjs`. **(rec) as stated.** |
| D5 | Tests | New `lib/registry.test.ts`, seams below; `publish.test.ts` stays green through D1's read/write move. **(rec) as stated.** |

## Current state (evidenced 2026-09-22)

- `public/bench/index.json` — 2 published entries (`run-20260921-0252`
  `4d908ab (dirty)`, `run-20260922-2142` `013e1c8`); each entry dir holds the 6
  artifacts copied verbatim by publish (≈44 KB), committed since 033.
- `tools/refactor-bench/publish.mjs` (CLI wrapper) + `lib/publish.mjs`
  (`validateRun` / `entryFrom` / `publishRun`) — registry read/write is inline
  in `publishRun`; duplicate-id refusal lives there.
- `package.json` — `bench`, `bench:publish`, `coverage`, `cyc`; no `bench:ls` /
  `bench:rm`. `benchmarks/` holds 14 local run dirs, gitignored.
- README documents run / publish / compare; nothing about listing or removal.
- `public/bench/compare.html` + `compare-view.mjs` already handle <2 entries
  and unknown `?a=&b=` ids with visible error states (033 step 03) — no page
  change needed here.

## Design

- **`tools/refactor-bench/lib/registry.mjs`** (new) — the single owner of the
  `index.json` contract:
  - `readRegistry(benchRoot)` → entries, missing file → `[]`.
  - `writeRegistry(benchRoot, entries)` → pretty JSON + trailing newline (the
    exact byte shape `publishRun` writes today).
  - `listEntries(benchRoot)` → `[{id, date, label, bytes}]` in registry order
    (`bytes` = sum of the entry dir's files).
  - `removeEntry(benchRoot, id)` → removes the entry dir + the registry row;
    unknown id throws; returns the removed entry.
  - `lib/publish.mjs`'s `publishRun` uses `readRegistry` / `writeRegistry`
    (same behavior; its tests stay green).
- **`tools/refactor-bench/ls.mjs`** (new CLI) — prints the registry per D2.
- **`tools/refactor-bench/rm.mjs`** (new CLI) — one positional `<id>`; D3
  edges; `console.error` + exit 1 on refusal.
- **`package.json`** — add `"bench:ls": "node tools/refactor-bench/ls.mjs"` and
  `"bench:rm": "node tools/refactor-bench/rm.mjs"`.
- **`README.md`** — the `bench:publish` subsection gains the two commands; the
  section's command-count wording is updated to match.
- **`tools/refactor-bench/lib/registry.test.ts`** (new) — seams below.

**Not touched in this step:** `public/bench/compare.html` + `compare-view.mjs`
(already handle every degraded state), the harness measuring phases
(`run.mjs`, analysis libs), `Footer.svelte`, app source, local `benchmarks/`
handling (A1).

## Seams under test

`tools/refactor-bench/lib/registry.test.ts` (vitest, tmp dirs):

- `readRegistry` — missing `index.json` → `[]`; existing registry round-trips.
- `writeRegistry` — byte shape (2-space JSON + trailing newline).
- `listEntries` — registry order preserved; `bytes` sums the entry's files.
- `removeEntry` — removes the dir + row, other entries untouched; unknown id
  throws and changes nothing on disk.

`tools/refactor-bench/lib/publish.test.ts` stays green through D1's move.

## Steps (commit per step; owner stages each diff)

1. `lib/registry.mjs` + `ls.mjs` + `rm.mjs` + package scripts + tests + README.
   Verification: `node --check` on every touched `.mjs`; `npx vitest run
   tools/refactor-bench/lib/registry.test.ts`; `npm test`; live smoke:
   `npm run bench:ls` against the current 2-entry registry, `npm run bench:rm
   nope` → exit 1, and a real `bench:rm <id>` whose diff the owner reviews
   (the removed entry is recoverable from git until committed).
   Commit: `bench: registry ls/rm`.
2. Close: full verification hierarchy (python suite, `npm test`, `npx tsc
   --noEmit`, `npm run build`; `python3 update.py` run reviewed — its data
   output stays out of the commit), README audit, DoD, archive.
   Commit: `plan: 042 — close (plan: 042-bench-registry-ls-rm)`.

## Consequences

- Simplifies: one module owns the registry contract (publish + ls + rm agree by
  construction); removing a published entry becomes one explicit command, the
  prune hook 033 A9 predicted.
- Complicates: two more CLIs + two package scripts + one lib module + README
  surface. `rm` is destructive (files only — git history is the undo);
  deep links to a removed entry degrade to the page's existing unknown-id
  error state.

## Out of scope

- Listing or deleting local `benchmarks/` runs (A1).
- Retention policy / auto-pruning (033 A9 stands: publishing is owner-paced).
- `--json` output or any scripting surface beyond the printed table.
- The 041 standalone-package `list` / `rm` (branch 6) — re-derived there.
- Committing or pushing for the owner (A3).

## Definition of done

- [ ] `npm run bench:ls` lists the published entries in registry order; empty
      registry prints `0 published entries` and exits 0.
- [ ] `npm run bench:rm <id>` removes the entry dir + `index.json` row and
      prints the removal; unknown/missing id → exit 1, nothing touched.
- [ ] `publish` behavior unchanged (its tests green); `index.json` stays valid
      for the compare page after both commands.
- [ ] README documents `bench:ls` / `bench:rm`.
- [ ] Full verification hierarchy green; plan archived with the as-built.