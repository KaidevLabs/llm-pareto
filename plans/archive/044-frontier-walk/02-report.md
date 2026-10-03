# Step 02 — Run the walk, write the findings report — ✅ COMPLETE (awaiting stage)

## As-built

- Report at `docs/reports/044-frontier-walk.md`, all six spec sections
  present. Every number is pasted from `python3 -m tests.frontier_walk`
  and the scratch stability probe `.tmp/044_stability.py` (per-snapshot
  supported sets, champion holds, CI-flip checks, the gemma impossibility
  inequalities with chord-cross values) — the probe is scratch per the
  executor rules, not committed.
- One bug found by the report run, correctly out of this step's scope:
  `grok-4.20-multi-agent` was speed-critical champion in the 2 latest
  snapshots (344 tok/s) but lost all rc≥30 endpoints in live data →
  speed=None → silently drops out of the class. Documented in report §4
  as a stability finding (speed-coverage churn), not a code fix — the
  module behaves as specified.
- No module changes needed; the CLI's CLASSES gates (1450/1470/1500)
  carried over with one-line justifications now stated in report §3.
- `python3 -m unittest discover -s tests` green: 198 tests, OK.

## Spec

Run the step-01 CLI over current data and all `public/data/history/`
snapshots; write `docs/reports/044-frontier-walk.md` (report naming
convention: named after the plan). Required contents:

1. **The walk table** — the 9-point frontier with, per step: model ids,
   $/M, Elo (with CI), tok/s, price multiple, Elo gain, tok/s delta,
   `inside_ci` flag; plus the interpretation of which steps are "real"
   upgrades vs Elo-noise-tied.
2. **The supported set** — supported vs unsupported frontier points, with
   the worked gemma example (the impossibility inequalities) as the
   explanation of *why* a linear index can never reach the dips.
3. **Task-class champions** — the three classes as gate+direction
   (speed-critical, batch-cheap, frontier-quality), each with its gate,
   direction, champion(s), and the runner-up; gates stated explicitly as
   analysis parameters with a one-line justification each.
4. **Stability** — how the frontier, supported set and champions move
   across the 19 snapshots (e.g. "champion X held in N/19 snapshots"),
   and any snapshot where the gate winner flipped inside CI.
5. **What this cannot compute today** — per-board task Elo (open branch,
   #354), revealed preference (no choice log).
6. **Graduation proposal** — a short open-items table: what a follow-up UI
   plan could render (drawer "next step up costs X"), what it would fix.

Report tone per repo convention: complete findings to read and discuss —
not a summary, not a plan.

Not touched in this step: module/tests (step-01 fixes ride in step 01's
commit only if the report run exposes a bug — then note it in the as-built
and keep the fix in a follow-up amend of step 01 before closing it),
`update.py`, `src/`.

## Verification

- Report exists at `docs/reports/044-frontier-walk.md`, all six sections
  present.
- Every number in the report is reproducible by re-running the step-01 CLI
  (dogfood rule — no hand-typed numbers; paste from the run output).
- `python3 -m unittest discover -s tests -v` still green.

## Seams under test

- no tests: report-writing step; the module's behavior is already covered
  by step 01, and the report contains no code.
