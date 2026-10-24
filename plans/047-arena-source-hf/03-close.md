# Step 03 — Close — OPEN

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

   `update.py` must print a sane report: `arena: ~418 entries`,
   `join: ~215 models matched`, top-20 ≥ 18/20, overall match ≥ 40 %, and it
   must reach the writes without a `die`.

2. **Data diff review** — `git diff public/data/meta.json` first
   (`sources.arena.publish_date`, `join.*`, `logos` count), then
   `public/data/combined.json` (no lowercase-slug `arena_org` for an org that
   has a logo key; `arena_model_url`/`arena_context_length`/`arena_price_*`
   null; elo values in the same range as the Oct-13 snapshot).

3. **Greps** — `grep -rn "lmarena\|liveboard" --include="*.py" .` returns
   nothing; `grep -rn "arena.ai" update.py .github/` returns nothing outside
   prose comments that describe provenance.

4. **Doc audit** — `AGENTS.md` (Testing/Commands sections) and `README.md`
   describe the source as the HF dataset; `plans/047-arena-source-hf/` is
   marked CLOSED.

5. **Archive** — move the directory to `plans/archive/047-arena-source-hf/`,
   with `00-overview.md` noting the close date and the final measured counts.

## Not touched in this step

Nothing — a verification-only step, no code changes.

## Verification

The five commands above green, plus the four audits. A close-step failure
reopens the step as an amendment, not a new plan.

## Seams under test

None.
