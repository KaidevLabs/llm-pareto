# Step 04 — Close — OPEN

## Spec

Closing procedure per the plans skill:

1. Finalize the step-01 profile, step-02 audit, and step-03 backlog into the plan's
   final state (they are the deliverable).
2. Definition-of-done audit — each item checked only with the evidence gathered in
   steps 01–03.
3. Update the overview: status → `ARCHIVED (date)` with commit history; every
   execution-order row; mark satisfied DoD items.
4. Move `plans/030-svelte-port-perf/` → `plans/archive/030-svelte-port-perf/`; single
   closing plan commit, message suffixed ` (plan: 030-svelte-port-perf)`.

**Not touched in this step:** no `src/` files; the harness (promotion is plan 031).

## Verification

- Plan archived; `plans/archive/030-svelte-port-perf/` exists; no `plans/030-svelte-port-perf/`
  remains.
- Closing commit contains only plan files (no `src/` changes — exploration-only).
- DoD items all evidenced.

## Seams under test

- `no tests`: closing procedure; verified by the checklist above.
