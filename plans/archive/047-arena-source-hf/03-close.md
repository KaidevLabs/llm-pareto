# Step 03 — Close — ✅ COMPLETE (2026-11-12; the close commit carries the archive move)

## Spec

No new behaviour. Prove the plan landed and record it:

1. **Full verification**, in this order:

   ```sh
   python3 -m unittest discover -s tests -v
   python3 update.py
   npm test
   npx tsc --noEmit
   npm run build
   ```

   `update.py` must print a sane report: `arena: ~418 entries`, `join: ~163
   models matched` (216 arena names, from the ~418), top-20 ≥ 18/20, overall
   match ≥ 40 %, a provider layer at ~96 % stats coverage with no percentile
   `die`, a `schema report` of five sections, and it must reach the writes.

2. **Data diff review** — `git diff public/data/meta.json` first
   (`sources.arena.publish_date`, `join.*`, `logos` count), then
   `public/data/combined.json` (no lowercase-slug `arena_org` for an org that
   has a logo key; `arena_model_url`/`arena_context_length`/`arena_price_*`
   null; elo values in the same range as the Oct-13 snapshot).

3. **Greps** — `grep -rn "lmarena\|liveboard" --include="*.py" .` returns
   nothing; `grep -rn "arena.ai" update.py .github/` returns nothing outside
   prose comments that describe provenance.

4. **Doc audit** — `AGENTS.md` (Testing/Commands sections) and `README.md`
   describe the source as the HF dataset; `public/data/meta.json` carries
   `schema` with the five surfaces; `.github/workflows/update-data.yml` has the
   alert step, the recovery step and the drift notice; `tests/` has no
   `test_parse_arena.py` and does have `test_arena_hf.py` + `test_schema.py`;
   `plans/047-arena-source-hf/` is marked CLOSED.

5. **Archive** — move the directory to `plans/archive/047-arena-source-hf/`,
   with `00-overview.md` noting the close date and the final measured counts.

## Not touched in this step

Nothing — a verification-only step, no code changes.

## Verification

The five commands above green, plus the four audits. A close-step failure
reopens the step as an amendment, not a new plan.

## Seams under test

None.

## Close amendments (2026-11-12)

Recorded at close, not failures — the spec was drafted before the source swap
ran for real:

- **Grep audit refined.** `grep -rn "lmarena\|liveboard" --include="*.py" .`
  cannot be empty: the HF dataset id is `lmarena-ai/leaderboard-dataset`, so
  `update.py:4,32,33` match by design. The audit that holds is
  `grep -rn "lmarena\.ai\|liveboard" --include="*.py" .` → no output, and
  `grep -rn "arena\.ai" update.py .github/` → no output (the single
  `parse_provider_page` docstring mention was reworded at close).
- **Workflow audit corrected.** `.github/workflows/update-data.yml` has no
  recovery step and no drift notice: step 02's 2026-11-11 amendment dropped
  the issue/recovery machinery for one failure email, and step 02b's
  2026-11-11 amendment made schema drift a report line that never alarms. The
  workflow is the `force_fail` input, the failure email step, and the
  commit-push step.
- **Measured counts differ from the drafted figures** — upstream drift, every
  threshold held: 421 entries (drafted ~418), 156 combined models of 369
  arena names = 42 % overall (floor 40 %; drafted 163 of 216), top-20 20/20,
  OpenRouter catalog 363 models (was 375 at drafting).
- **Doc drift fixed** in `README.md` (build step, deploy target, workflow
  gate and alerting, layout, local preview) and `AGENTS.md` (the data source,
  the fixture shape — `parse_arena` no longer exists).
